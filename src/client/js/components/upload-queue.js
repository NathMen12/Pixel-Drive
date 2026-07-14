/**
 * Upload Queue Component
 * File queue, progress, crypto worker, chunking
 */

import { store } from '../store.js';
import { cryptoManager } from '../crypto.js';
import { uploadApi } from '../api.js';
import { showToast, formatBytes, escapeHtml } from '../utils/dom.js';

const CHUNK_SIZE = 25 * 1024 * 1024; // 25 MB

export class UploadQueue {
  constructor() {
    this.element = null;
    this.queue = new Map();
    this.processing = false;
    this.maxConcurrent = 1; // Sequential to avoid OOM
  }

  render() {
    this.element = document.createElement('div');
    this.element.id = 'upload-queue';
    this.element.className = 'upload-queue';
    this.element.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 50;
      max-width: 420px;
      pointer-events: none;
    `;
    this.element.innerHTML = `
      <div id="queue-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
      <style>
        .upload-item {
          pointer-events: auto;
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .upload-header {
          display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;
        }
        .upload-file-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .upload-file-icon { width: 40px; height: 40px; border-radius: 8px; background: #1f2937; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .upload-file-name { font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .upload-file-size { font-size: 11px; color: #9ca3af; }
        .upload-progress-bar { height: 6px; background: #1f2937; border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
        .upload-progress-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 3px; transition: width 0.3s; width: 0%; }
        .upload-stats { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
        .upload-status { font-size: 12px; font-weight: 500; }
        .upload-status.encrypting { color: #f59e0b; }
        .upload-status.uploading { color: #6366f1; }
        .upload-status.pixelating { color: #8b5cf6; }
        .upload-status.complete { color: #10b981; }
        .upload-status.error { color: #ef4444; }
        .upload-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #1f2937; }
        .upload-btn { padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; border: none; transition: all 0.15s; }
        .upload-btn.cancel { background: #374151; color: #9ca3af; }
        .upload-btn.cancel:hover { background: #4b5563; color: white; }
        .upload-btn.retry { background: #4f46e5; color: white; }
        .upload-btn.retry:hover { background: #4338ca; }
        .upload-btn.remove { background: #dc2626; color: white; }
        .upload-btn.remove:hover { background: #b91c1c; }
        .chunk-progress { display: flex; gap: 4px; margin-top: 8px; height: 4px; }
        .chunk-segment { flex: 1; background: #1f2937; border-radius: 2px; transition: background 0.2s; }
        .chunk-segment.done { background: #10b981; }
        .chunk-segment.current { background: #6366f1; animation: pulse 1s infinite; }
        .chunk-segment.error { background: #ef4444; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      </style>
    `;

    return this.element;
  }

  addFiles(files, parentId) {
    files.forEach(file => {
      const id = crypto.randomUUID();
      const upload = {
        id,
        file,
        parentId,
        status: 'pending',
        progress: 0,
        chunksTotal: Math.ceil(file.size / CHUNK_SIZE),
        chunksDone: 0,
        chunks: [],
        error: null,
        dek: null,
        wrappedKey: null,
        hashes: null,
        uploadId: null,
      };
      this.queue.set(id, upload);
      this.renderItem(upload);
    });

    if (!this.processing) {
      this.processQueue();
    }
  }

  renderItem(upload) {
    const list = this.element.querySelector('#queue-list');
    const item = document.createElement('div');
    item.className = 'upload-item';
    item.dataset.id = upload.id;
    item.innerHTML = `
      <div class="upload-header">
        <div class="upload-file-info">
          <div class="upload-file-icon">${this.getFileIcon(upload.file.type)}</div>
          <div>
            <div class="upload-file-name">${escapeHtml(upload.file.name)}</div>
            <div class="upload-file-size">${formatBytes(upload.file.size)} • ${upload.chunksTotal} chunk${upload.chunksTotal > 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="upload-status pending">En attente</div>
      </div>
      <div class="upload-progress-bar"><div class="upload-progress-fill" style="width: 0%"></div></div>
      <div class="chunk-progress" id="chunks-${upload.id}"></div>
      <div class="upload-stats">
        <span id="speed-${upload.id}">—</span>
        <span id="eta-${upload.id}">—</span>
      </div>
      <div class="upload-actions">
        <button class="upload-btn cancel" data-action="cancel">Annuler</button>
        <button class="upload-btn retry" data-action="retry" style="display: none;">Réessayer</button>
        <button class="upload-btn remove" data-action="remove" style="display: none;">Supprimer</button>
      </div>
    `;

    list.appendChild(item);

    // Bind actions
    item.querySelector('[data-action="cancel"]')?.addEventListener('click', () => this.cancelUpload(upload.id));
    item.querySelector('[data-action="retry"]')?.addEventListener('click', () => this.retryUpload(upload.id));
    item.querySelector('[data-action="remove"]')?.addEventListener('click', () => this.removeUpload(upload.id));

    // Initialize chunk segments
    const chunkContainer = item.querySelector(`#chunks-${upload.id}`);
    chunkContainer.innerHTML = Array.from({ length: upload.chunksTotal }, (_, i) =>
      `<div class="chunk-segment" data-chunk="${i}"></div>`
    ).join('');
  }

  updateItem(upload) {
    const item = this.element.querySelector(`[data-id="${upload.id}"]`);
    if (!item) return;

    const fill = item.querySelector('.upload-progress-fill');
    const status = item.querySelector('.upload-status');
    const speedEl = item.querySelector(`#speed-${upload.id}`);
    const etaEl = item.querySelector(`#eta-${upload.id}`);
    const chunkContainer = item.querySelector(`#chunks-${upload.id}`);
    const cancelBtn = item.querySelector('[data-action="cancel"]');
    const retryBtn = item.querySelector('[data-action="retry"]');
    const removeBtn = item.querySelector('[data-action="remove"]');

    if (fill) fill.style.width = `${upload.progress}%`;

    if (status) {
      status.textContent = this.getStatusText(upload);
      status.className = `upload-status ${upload.status}`;
    }

    if (speedEl && upload.speed) speedEl.textContent = `${formatBytes(upload.speed)}/s`;
    if (etaEl && upload.eta) etaEl.textContent = `ETA: ${this.formatTime(upload.eta)}`;

    // Update chunk segments
    if (chunkContainer) {
      chunkContainer.querySelectorAll('.chunk-segment').forEach((seg, i) => {
        seg.className = 'chunk-segment';
        if (i < upload.chunksDone) seg.classList.add('done');
        else if (i === upload.chunksDone && upload.status === 'uploading') seg.classList.add('current');
        else if (upload.chunks[i]?.error) seg.classList.add('error');
      });
    }

    // Update buttons
    if (upload.status === 'complete') {
      cancelBtn.style.display = 'none';
      retryBtn.style.display = 'none';
      removeBtn.style.display = 'inline-flex';
    } else if (upload.status === 'error') {
      cancelBtn.style.display = 'none';
      retryBtn.style.display = 'inline-flex';
      removeBtn.style.display = 'inline-flex';
    }
  }

  getStatusText(upload) {
    switch (upload.status) {
      case 'pending': return 'En attente';
      case 'hashing': return `Hachage... ${Math.round(upload.hashProgress || 0)}%`;
      case 'encrypting': return `Chiffrement... ${Math.round(upload.encryptProgress || 0)}%`;
      case 'uploading': return `Upload ${upload.chunksDone}/${upload.chunksTotal}`;
      case 'pixelating': return `Pixelisation...`;
      case 'finalizing': return 'Finalisation...';
      case 'complete': return 'Terminé';
      case 'error': return `Erreur: ${upload.error}`;
      default: return upload.status;
    }
  }

  formatTime(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }

  getFileIcon(mimeType) {
    if (!mimeType) return '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>';
    if (mimeType.startsWith('image/')) return '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
    if (mimeType.startsWith('video/')) return '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>';
    if (mimeType.startsWith('audio/')) return '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1a1 1 0 011 1v3.586a1 1 0 01-.293.707l-5.586 5.586a1 1 0 01-1.414 0z"></path></svg>';
    return '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>';
  }

  async processQueue() {
    this.processing = true;

    while (this.queue.size > 0) {
      const upload = Array.from(this.queue.values()).find(u => u.status === 'pending' || u.status === 'error');
      if (!upload) break;

      await this.processUpload(upload);
    }

    this.processing = false;
  }

  async processUpload(upload) {
    const startTime = Date.now();
    let lastProgressTime = startTime;
    let lastProgressBytes = 0;

    try {
      // Step 1: Hash file
      upload.status = 'hashing';
      this.updateItem(upload);
      upload.hashes = await cryptoManager.hashFile(upload.file, (progress) => {
        upload.hashProgress = (progress.loaded / progress.total) * 100;
        this.updateItem(upload);
      });

      // Step 2: Generate DEK and wrap with MK
      upload.status = 'encrypting';
      this.updateItem(upload);
      upload.dek = await cryptoManager.generateDEK();
      const masterSalt = store.getUser()?.master_salt;
      if (!masterSalt) throw new Error('Master salt not found. Please log in again.');
      const mk = await cryptoManager.deriveMasterKey(
        await this.getPasswordFromUser(),
        masterSalt
      );
      upload.wrappedKey = await cryptoManager.wrapKey(upload.dek, mk);

      // Step 3: Initialize upload on server
      const initResponse = await uploadApi.init({
        name: upload.file.name,
        mime: upload.file.type,
        size: upload.file.size,
        chunkCount: upload.chunksTotal,
        encKeyWrapped: upload.wrappedKey,
        encAlgo: 'AES-GCM',
        sha256: upload.hashes.sha256,
        sha1: upload.hashes.sha1,
        parentId: upload.parentId,
      });
      upload.uploadId = initResponse.uploadId;

      // Step 4: Process chunks sequentially
      let offset = 0;
      let chunkIndex = 0;

      while (offset < upload.file.size) {
        const chunkSize = Math.min(CHUNK_SIZE, upload.file.size - offset);
        const slice = upload.file.slice(offset, offset + chunkSize);
        const buffer = await slice.arrayBuffer();

        // Encrypt chunk
        const iv = cryptoManager.generateIV();
        const { ciphertext, iv: usedIv } = await cryptoManager.encryptChunk(buffer, upload.dek, iv);

        // Pixelate on server (send encrypted chunk)
        upload.status = 'pixelating';
        this.updateItem(upload);

        const pixelateResponse = await uploadApi.pixelate(ciphertext);
        // Server returns { url, size } after pixelating and uploading to ImgBB

        // Upload chunk to server
        upload.status = 'uploading';
        this.updateItem(upload);

        await uploadApi.chunk({
          uploadId: upload.uploadId,
          index: chunkIndex,
          iv: cryptoManager.bytesToB64(usedIv),
          url: pixelateResponse.url,
          size: pixelateResponse.size,
        });

        upload.chunks.push({
          index: chunkIndex,
          url: pixelateResponse.url,
          size: pixelateResponse.size,
          iv: cryptoManager.bytesToB64(usedIv),
        });
        upload.chunksDone++;
        upload.progress = (upload.chunksDone / upload.chunksTotal) * 100;

        // Calculate speed/ETA
        const now = Date.now();
        const elapsed = (now - lastProgressTime) / 1000;
        const bytesSinceLast = offset + chunkSize - lastProgressBytes;
        if (elapsed > 0) {
          upload.speed = bytesSinceLast / elapsed;
          const remaining = upload.file.size - (offset + chunkSize);
          upload.eta = remaining / upload.speed;
        }
        lastProgressTime = now;
        lastProgressBytes = offset + chunkSize;

        this.updateItem(upload);

        offset += chunkSize;
        chunkIndex++;
      }

      // Step 5: Finalize
      upload.status = 'finalizing';
      this.updateItem(upload);

      await uploadApi.finalize({
        uploadId: upload.uploadId,
        chunks: upload.chunks,
      });

      upload.status = 'complete';
      upload.progress = 100;
      this.updateItem(upload);

      // Remove after delay
      setTimeout(() => this.removeUpload(upload.id), 3000);

      // Refresh drive
      window.dispatchEvent(new CustomEvent('nodes:refresh'));
      showToast(`${upload.file.name} uploadé`, 'success');

    } catch (err) {
      console.error('Upload error:', err);
      upload.status = 'error';
      upload.error = err.message || 'Erreur inconnue';
      this.updateItem(upload);
      showToast(`Échec: ${upload.file.name}`, 'error');
    }
  }

  async getPasswordFromUser() {
    // In a real app, this would come from the auth system
    // For now, we'll need to store it temporarily during login
    return sessionStorage.getItem('pixelDrivePassword') || '';
  }

  cancelUpload(id) {
    const upload = this.queue.get(id);
    if (upload) {
      upload.status = 'cancelled';
      this.removeUpload(id);
    }
  }

  retryUpload(id) {
    const upload = this.queue.get(id);
    if (upload) {
      upload.status = 'pending';
      upload.error = null;
      upload.progress = 0;
      upload.chunksDone = 0;
      upload.chunks = [];
      this.updateItem(upload);
      if (!this.processing) this.processQueue();
    }
  }

  removeUpload(id) {
    const item = this.element.querySelector(`[data-id="${id}"]`);
    if (item) {
      item.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => item.remove(), 300);
    }
    this.queue.delete(id);
  }

  destroy() {
    this.element?.remove();
  }
}

// Global instance
export const uploadQueue = new UploadQueue();

// Listen for upload events
window.addEventListener('upload:add-files', (e) => {
  uploadQueue.addFiles(e.detail.files, e.detail.parentId);
});