/**
 * Crypto Manager - Web Crypto API Wrapper
 * E2EE: PBKDF2 (MK) -> AES-KW (DEK wrap) -> AES-GCM (chunks)
 */

class CryptoManager {
  constructor() {
    this.masterKey = null;
    this.masterSalt = null;
    this.PBKDF2_ITERATIONS = 210000;
    this.CHUNK_SIZE = 25 * 1024 * 1024; // 25 MB
  }

  // Derive Master Key from password + salt
  async deriveMasterKey(password, saltB64) {
    const salt = this.b64ToBytes(saltB64);
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    this.masterSalt = salt;
    return this.masterKey;
  }

  // Generate Data Encryption Key (DEK) per file
  async generateDEK() {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  // Wrap DEK with Master Key (AES-KW)
  async wrapKey(dek, mk) {
    const wrapped = await crypto.subtle.wrapKey('raw', dek, mk, 'AES-KW');
    return this.bytesToB64(new Uint8Array(wrapped));
  }

  // Unwrap DEK with Master Key
  async unwrapKey(wrappedB64, mk) {
    const wrapped = this.b64ToBytes(wrappedB64);
    return crypto.subtle.unwrapKey(
      'raw',
      wrapped,
      mk,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt a single chunk
  async encryptChunk(buffer, dek, iv = null) {
    const ivBytes = iv || this.generateIV();
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBytes },
      dek,
      buffer
    );
    return {
      ciphertext: new Uint8Array(ciphertext),
      iv: ivBytes,
    };
  }

  // Decrypt a single chunk
  async decryptChunk(buffer, dek, iv) {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      dek,
      buffer
    );
    return new Uint8Array(plaintext);
  }

  // Generate random IV (12 bytes for AES-GCM)
  generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
  }

  // Hash file (SHA-256 + SHA-1) - streaming for large files
  async hashFile(file, onProgress) {
    const sha256 = await this.hashFileAlgorithm(file, 'SHA-256', onProgress);
    const sha1 = await this.hashFileAlgorithm(file, 'SHA-1');
    return { sha256, sha1 };
  }

  async hashFileAlgorithm(file, algorithm, onProgress) {
    const hash = await crypto.subtle.digest(algorithm, await file.arrayBuffer());
    return this.bytesToHex(new Uint8Array(hash));
  }

  // Streaming hash for large files (chunked)
  async hashFileStreaming(file, onProgress) {
    const chunkSize = 1024 * 1024; // 1MB chunks for hashing
    const sha256 = new HashStream('SHA-256');
    const sha1 = new HashStream('SHA-1');

    let loaded = 0;
    const total = file.size;

    for (let offset = 0; offset < total; offset += chunkSize) {
      const chunk = file.slice(offset, offset + chunkSize);
      const buffer = await chunk.arrayBuffer();
      sha256.update(buffer);
      sha1.update(buffer);

      loaded += chunk.size;
      if (onProgress) {
        onProgress({ loaded, total });
      }
    }

    return {
      sha256: await sha256.digest(),
      sha1: await sha1.digest(),
    };
  }

  // Encrypt file stream (async generator for chunks)
  async *streamEncrypt(file, dek, onProgress) {
    let offset = 0;
    let index = 0;
    const total = file.size;

    while (offset < total) {
      const chunkSize = Math.min(this.CHUNK_SIZE, total - offset);
      const slice = file.slice(offset, offset + chunkSize);
      const buffer = await slice.arrayBuffer();

      const iv = this.generateIV();
      const { ciphertext } = await this.encryptChunk(buffer, dek, iv);

      yield {
        index,
        data: ciphertext,
        iv,
        size: chunkSize,
      };

      offset += chunkSize;
      index++;

      if (onProgress) {
        onProgress({ loaded: offset, total });
      }
    }
  }

  // Decrypt file stream
  async *streamDecrypt(chunks, dek, onProgress) {
    let totalDecrypted = 0;
    const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);

    for (const chunk of chunks) {
      const decrypted = await this.decryptChunk(chunk.data, dek, chunk.iv);
      yield {
        index: chunk.index,
        data: decrypted,
      };

      totalDecrypted += chunk.size;
      if (onProgress) {
        onProgress({ loaded: totalDecrypted, total: totalSize });
      }
    }
  }

  // Utility: bytes to Base64
  bytesToB64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Utility: Base64 to bytes
  b64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Utility: bytes to Hex
  bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Utility: Hex to bytes
  hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  // Get master key (for re-use)
  getMasterKey() {
    return this.masterKey;
  }

  // Clear master key from memory
  clearMasterKey() {
    this.masterKey = null;
    this.masterSalt = null;
  }
}

// Helper class for streaming hash
class HashStream {
  constructor(algorithm) {
    this.algorithm = algorithm;
    this.buffer = [];
    this.length = 0;
  }

  update(chunk) {
    this.buffer.push(new Uint8Array(chunk));
    this.length += chunk.byteLength;
  }

  async digest() {
    const combined = new Uint8Array(this.length);
    let offset = 0;
    for (const buf of this.buffer) {
      combined.set(buf, offset);
      offset += buf.length;
    }
    const hash = await crypto.subtle.digest(this.algorithm, combined);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const cryptoManager = new CryptoManager();