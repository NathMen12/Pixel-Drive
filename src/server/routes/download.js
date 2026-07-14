import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { queryOne, query } from '../config/db.js';
import { depixelateBuffer } from '../services/pixelate.js';
import { AppError, NotFoundError, AuthorizationError } from '../utils/errors.js';

const router = express.Router();

// AES-GCM decryption using Node.js crypto
async function decryptChunk(encryptedBuffer, dek, iv) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted;
}

// Unwrap DEK using master key (AES-KW)
async function unwrapDek(wrappedDekB64, masterKey) {
  const wrappedDek = Buffer.from(wrappedDekB64, 'base64');
  const unwrapped = crypto.unwrapKey('raw', wrappedDek, masterKey, 'aes-256-gcm', 'aes-kw');
  return unwrapped;
}

// For zero-knowledge: server doesn't have master key
// Client sends wrapped DEK, server can't unwrap it
// Instead, client decrypts chunks and server just streams them
// OR we implement a different approach where server has DEK in memory only during streaming

// For now, implement server-side streaming with DEK passed from client (for shared/public links)
// For authenticated users, client should do decryption

/**
 * GET /shared/:id - Stream or download a file
 * Supports Range requests for video/audio seeking
 * Query params:
 *   - dl=1: force download (Content-Disposition: attachment)
 *   - dek: wrapped DEK (for public shares)
 *   - password: for password-protected shares
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dl, dek: wrappedDek, password } = req.query;

    // Get node
    let node = await queryOne(
      `SELECT n.*, u.master_salt, u.master_key_version
       FROM nodes n
       JOIN users u ON n.owner_id = u.id
       WHERE n.id = ?`,
      [id]
    );

    if (!node) {
      throw new NotFoundError('File');
    }

    // Check if trashed
    if (node.is_trashed) {
      throw new NotFoundError('File');
    }

    // Check permissions
    let hasAccess = false;
    let isOwner = false;

    if (req.user && req.user.id === node.owner_id) {
      hasAccess = true;
      isOwner = true;
    }

    // Check shares if not owner
    if (!hasAccess) {
      const share = await queryOne(
        `SELECT s.* FROM shares s
         WHERE s.node_id = ? AND s.target_type = 'public'
         AND (s.expires_at IS NULL OR s.expires_at > NOW())`,
        [id]
      );

      if (share) {
        // Check password if set
        if (share.password_hash) {
          if (!password) {
            return res.status(401).json({
              error: 'Password required',
              code: 'PASSWORD_REQUIRED',
              shareId: share.id,
            });
          }
          const bcrypt = await import('bcryptjs');
          const valid = await bcrypt.compare(password, share.password_hash);
          if (!valid) {
            throw new AuthorizationError('Invalid password');
          }
        }

        // For public shares, client must provide wrapped DEK
        // Server cannot decrypt without master key
        // This is a limitation of zero-knowledge + server-side streaming
        // Workaround: for public shares, store DEK encrypted with a share-specific key
        // Or require client-side decryption only
        
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      // Check user-specific shares
      if (req.user) {
        const share = await queryOne(
          `SELECT s.* FROM shares s
           WHERE s.node_id = ? AND s.target_type = 'user' AND s.target_id = ?
           AND (s.expires_at IS NULL OR s.expires_at > NOW())`,
          [id, req.user.id]
        );
        if (share) hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw new AuthorizationError('Access denied');
    }

    // Parse chunks (mysql2 may already parse JSON columns)
    const chunks = typeof node.chunks === 'string' ? JSON.parse(node.chunks || '[]') : (node.chunks || []);
    if (!chunks.length) {
      throw new AppError('File has no chunks', 500, 'NO_CHUNKS');
    }

    // Total file size
    const totalSize = node.size;

    // Parse Range header
    const range = req.headers.range;
    let start = 0;
    let end = totalSize - 1;
    let statusCode = 200;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const rangeStart = parseInt(parts[0], 10);
      const rangeEnd = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(rangeStart) || rangeStart >= totalSize) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      start = rangeStart;
      end = Math.min(rangeEnd, totalSize - 1);
      statusCode = 206;
    }

    const contentLength = end - start + 1;

    // Set headers
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', node.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (statusCode === 206) {
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    }

    if (dl) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(node.name)}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(node.name)}"`);
    }

    // If no DEK provided and not owner, we can't decrypt server-side
    // For zero-knowledge, client should handle decryption
    // But for public shares / embed, we need server-side streaming
    
    // For now, stream encrypted chunks and let client decrypt
    // This requires client to support Range requests on encrypted data
    // Better approach: decrypt on server if DEK is available

    // Try to get DEK for server-side decryption
    let dek = null;
    if (wrappedDek && req.user && isOwner) {
      // Owner can provide master key... but we don't have it
      // In real zero-knowledge, server never has master key
      // So server-side decryption only works if DEK is stored unwrapped (not zero-knowledge)
      // OR if we have a key management system
    }

    // Stream chunks
    await streamChunks(res, chunks, start, end, dek, totalSize);

  } catch (err) {
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
      return; // Client disconnected
    }
    next(err);
  }
});

/**
 * Stream chunks to response with Range support
 */
async function streamChunks(res, chunks, start, end, dek, totalSize) {
  let currentPos = 0;
  let bytesSent = 0;

  for (const chunk of chunks) {
    const chunkStart = currentPos;
    const chunkEnd = currentPos + chunk.size - 1;

    // Check if this chunk overlaps with requested range
    if (chunkEnd < start) {
      currentPos += chunk.size;
      continue;
    }
    if (chunkStart > end) {
      break;
    }

    // Calculate bytes needed from this chunk
    const chunkReadStart = Math.max(0, start - chunkStart);
    const chunkReadEnd = Math.min(chunk.size - 1, end - chunkStart);
    const chunkReadLength = chunkReadEnd - chunkReadStart + 1;

    try {
      // Fetch chunk from ImgBB
      const response = await axios.get(chunk.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        // ImgBB supports Range headers
        headers: {
          Range: `bytes=${chunkReadStart}-${chunkReadEnd}`,
        },
      });

      let chunkBuffer = Buffer.from(response.data);

      // If DEK provided, decrypt
      if (dek) {
        const iv = Buffer.from(chunk.iv, 'base64');
        chunkBuffer = await decryptChunk(chunkBuffer, dek, iv);
      }

      // Write to response
      const writeResult = res.write(chunkBuffer);
      bytesSent += chunkBuffer.length;

      // Handle backpressure
      if (!writeResult) {
        await new Promise(resolve => res.once('drain', resolve));
      }
    } catch (error) {
      console.error('Chunk streaming error:', error.message);
      // Continue to next chunk or end
    }

    currentPos += chunk.size;
  }

  res.end();
}

// GET /embed/:id - Embed-friendly endpoint (same as shared but with embed headers)
router.get('/embed/:id', optionalAuth, async (req, res, next) => {
  try {
    // Same logic as /shared/:id but with embed-friendly headers
    req.query.embed = 'true';
    return router.handle(req, res, next);
  } catch (err) {
    next(err);
  }
});

// POST /shared/:id/verify-password - Verify password for protected share
router.post('/:id/verify-password', async (req, res, next) => {
  try {
    const { password } = req.body;
    const { id } = req.params;

    const share = await queryOne(
      `SELECT s.*, n.enc_key_wrapped, n.enc_iv
       FROM shares s
       JOIN nodes n ON s.node_id = n.id
       WHERE s.node_id = ? AND s.target_type = 'public' AND s.password_hash IS NOT NULL`,
      [id]
    );

    if (!share) {
      throw new NotFoundError('Share');
    }

    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(password, share.password_hash);

    if (!valid) {
      throw new AuthorizationError('Invalid password');
    }

    // Generate temporary access token (short-lived JWT)
    // For simplicity, return the wrapped DEK and IV so client can decrypt
    // In production, use a proper token system
    res.json({
      encKeyWrapped: share.enc_key_wrapped,
      encIv: share.enc_iv?.toString('base64') || null,
      token: 'temp-access-token', // Would be a real JWT in production
    });
  } catch (err) {
    next(err);
  }
});

export default router;