import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { queryOne, execute } from '../config/db.js';
import { pixelateBuffer } from '../services/pixelate.js';
import { uploadToImgbb } from '../services/imgbb.js';
import { AppError, ValidationError } from '../utils/errors.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Configure multer for chunk uploads (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 26214400, // 25 MiB max per chunk
  },
});

// Validation schemas
const initUploadSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  chunkCount: z.number().int().positive(),
  encKeyWrapped: z.string().min(1), // Base64 wrapped DEK
  encIv: z.string().min(1), // Base64 file IV
  sha256: z.string().length(64).optional(),
  sha1: z.string().length(40).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const chunkSchema = z.object({
  uploadId: z.string().uuid(),
  index: z.number().int().min(0),
  iv: z.string().min(1), // Base64 chunk IV
});

// POST /api/upload/init - Initialize multipart upload
router.post('/init', async (req, res, next) => {
  try {
    const data = initUploadSchema.parse(req.body);

    // Verify parent folder
    let parentId = data.parentId;
    if (!parentId) {
      const root = await queryOne(
        'SELECT id FROM nodes WHERE owner_id = ? AND parent_id IS NULL AND type = "folder"',
        [req.user.id]
      );
      parentId = root.id;
    } else {
      const parent = await queryOne(
        'SELECT id FROM nodes WHERE id = ? AND owner_id = ? AND type = "folder"',
        [parentId, req.user.id]
      );
      if (!parent) {
        throw new AppError('Parent folder not found', 404, 'PARENT_NOT_FOUND');
      }
    }

    // Create upload session
    const uploadId = crypto.randomUUID();
    await execute(
      `INSERT INTO upload_sessions (id, owner_id, parent_id, name, mime_type, size, chunk_count, enc_key_wrapped, enc_iv, sha256, sha1, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        uploadId,
        req.user.id,
        parentId,
        data.name,
        data.mimeType,
        data.size,
        data.chunkCount,
        data.encKeyWrapped,
        data.encIv,
        data.sha256 || null,
        data.sha1 || null,
      ]
    );

    res.json({
      uploadId,
      chunkSize: 26214400, // 25 MiB
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/upload/chunk - Upload a single chunk
router.post('/chunk', upload.single('chunk'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No chunk file provided');
    }

    const data = chunkSchema.parse(req.body);
    const { uploadId, index, iv } = data;

    // Verify upload session
    const session = await queryOne(
      'SELECT * FROM upload_sessions WHERE id = ? AND owner_id = ? AND status = "pending"',
      [uploadId, req.user.id]
    );

    if (!session) {
      throw new AppError('Upload session not found or expired', 404, 'SESSION_NOT_FOUND');
    }

    if (index >= session.chunk_count) {
      throw new ValidationError('Invalid chunk index');
    }

    // Check chunk size
    const expectedSize = index === session.chunk_count - 1
      ? session.size - (26214400 * index)
      : 26214400;

    if (req.file.buffer.length !== expectedSize) {
      throw new ValidationError(`Chunk size mismatch. Expected ${expectedSize}, got ${req.file.buffer.length}`);
    }

    // Pixelate the encrypted chunk
    const pngBuffer = await pixelateBuffer(req.file.buffer);

    // Upload to ImgBB
    const imgbbResult = await uploadToImgbb(pngBuffer, {
      name: `${uploadId}_chunk_${index}.png`,
    });

    // Store chunk metadata
    await execute(
      `INSERT INTO upload_chunks (upload_session_id, chunk_index, imgbb_url, imgbb_delete_url, size, iv)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE imgbb_url = ?, imgbb_delete_url = ?, size = ?, iv = ?`,
      [uploadId, index, imgbbResult.url, imgbbResult.deleteUrl, req.file.buffer.length, iv,
       imgbbResult.url, imgbbResult.deleteUrl, req.file.buffer.length, iv]
    );

    // Update session progress
    await execute(
      'UPDATE upload_sessions SET chunks_received = chunks_received + 1 WHERE id = ?',
      [uploadId]
    );

    res.json({
      index,
      url: imgbbResult.url,
      size: req.file.buffer.length,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/upload/finalize - Complete the upload
router.post('/finalize', async (req, res, next) => {
  try {
    const schema = z.object({
      uploadId: z.string().uuid(),
    });
    const { uploadId } = schema.parse(req.body);

    const session = await queryOne(
      'SELECT * FROM upload_sessions WHERE id = ? AND owner_id = ? AND status = "pending"',
      [uploadId, req.user.id]
    );

    if (!session) {
      throw new AppError('Upload session not found', 404, 'SESSION_NOT_FOUND');
    }

    // Get all chunks in order
    const chunks = await query(
      `SELECT chunk_index as index, imgbb_url as url, size, iv
       FROM upload_chunks
       WHERE upload_session_id = ?
       ORDER BY chunk_index`,
      [uploadId]
    );

    if (chunks.length !== session.chunk_count) {
      throw new ValidationError(`Missing chunks. Expected ${session.chunk_count}, got ${chunks.length}`);
    }

    // Verify total size
    const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
    if (totalSize !== session.size) {
      throw new ValidationError('Total chunk size does not match file size');
    }

    // Generate thumbnail if image/video
    let thumbUrl = null;
    if (session.mime_type.startsWith('image/') || session.mime_type.startsWith('video/')) {
      try {
        // For now, skip thumbnail generation - would need DEK to decrypt first chunk
        // thumbUrl = await generateThumbnail(chunks[0], session.enc_key_wrapped, session.enc_iv);
      } catch (e) {
        console.warn('Thumbnail generation failed:', e.message);
      }
    }

    // Create file node
    const fileId = crypto.randomUUID();
    await execute(
      `INSERT INTO nodes (id, owner_id, parent_id, name, type, mime_type, size, chunks, enc_iv, enc_key_wrapped, sha256, sha1, chunk_count, thumb_url)
       VALUES (?, ?, ?, ?, 'file', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileId,
        req.user.id,
        session.parent_id,
        session.name,
        session.mime_type,
        session.size,
        JSON.stringify(chunks.map(c => ({ url: c.url, size: c.size, iv: c.iv, index: c.index }))),
        session.enc_iv ? Buffer.from(session.enc_iv, 'base64') : null,
        session.enc_key_wrapped,
        session.sha256,
        session.sha1,
        session.chunk_count,
        thumbUrl,
      ]
    );

    // Update user storage
    await execute(
      'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
      [session.size, req.user.id]
    );

    // Mark session complete
    await execute(
      'UPDATE upload_sessions SET status = "completed", completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [uploadId]
    );

    const node = await queryOne('SELECT * FROM nodes WHERE id = ?', [fileId]);
    node.chunks = JSON.parse(node.chunks);
    if (node.tags) node.tags = JSON.parse(node.tags);

    res.status(201).json({ node });
  } catch (err) {
    next(err);
  }
});

// GET /api/upload/status/:uploadId - Check upload progress
router.get('/status/:uploadId', async (req, res, next) => {
  try {
    const session = await queryOne(
      'SELECT * FROM upload_sessions WHERE id = ? AND owner_id = ?',
      [req.params.uploadId, req.user.id]
    );

    if (!session) {
      throw new AppError('Upload session not found', 404, 'SESSION_NOT_FOUND');
    }

    const chunks = await query(
      'SELECT chunk_index as index, size FROM upload_chunks WHERE upload_session_id = ? ORDER BY chunk_index',
      [req.params.uploadId]
    );

    res.json({
      uploadId: session.id,
      status: session.status,
      chunkCount: session.chunk_count,
      chunksReceived: session.chunks_received,
      chunks,
    });
  } catch (err) {
    next(err);
  }
});

export default router;