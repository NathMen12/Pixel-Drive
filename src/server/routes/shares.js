import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';
import { query, queryOne, execute } from '../config/db.js';
import { AppError, NotFoundError, ValidationError, AuthorizationError } from '../utils/errors.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Validation schemas
const createShareSchema = z.object({
  nodeId: z.string().uuid(),
  targetType: z.enum(['user', 'public']),
  targetId: z.string().uuid().nullable().optional(), // required for user shares
  permission: z.enum(['read', 'write']).default('read'),
  password: z.string().min(4).max(128).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const updateShareSchema = z.object({
  permission: z.enum(['read', 'write']).optional(),
  password: z.string().min(4).max(128).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// POST /api/shares - Create a new share
router.post('/', async (req, res, next) => {
  try {
    const data = createShareSchema.parse(req.body);

    // Verify node exists and user owns it (or has write permission)
    const node = await queryOne(
      'SELECT * FROM nodes WHERE id = ? AND is_trashed = FALSE',
      [data.nodeId]
    );

    if (!node) {
      throw new NotFoundError('File or folder');
    }

    // Check ownership
    if (node.owner_id !== req.user.id) {
      // Check if user has write access via existing share
      const share = await queryOne(
        `SELECT * FROM shares WHERE node_id = ? AND target_type = 'user' AND target_id = ? AND permission = 'write'`,
        [data.nodeId, req.user.id]
      );
      if (!share) {
        throw new AuthorizationError('You do not have permission to share this item');
      }
    }

    // Validate target for user shares
    if (data.targetType === 'user') {
      if (!data.targetId) {
        throw new ValidationError('targetId is required for user shares');
      }
      const targetUser = await queryOne('SELECT id FROM users WHERE id = ?', [data.targetId]);
      if (!targetUser) {
        throw new NotFoundError('Target user');
      }
      if (data.targetId === req.user.id) {
        throw new ValidationError('Cannot share with yourself');
      }
    }

    // Check for existing share (user shares)
    if (data.targetType === 'user') {
      const existing = await queryOne(
        'SELECT id FROM shares WHERE node_id = ? AND target_type = "user" AND target_id = ?',
        [data.nodeId, data.targetId]
      );
      if (existing) {
        throw new AppError('Already shared with this user', 409, 'SHARE_EXISTS');
      }
    }

    // Hash password if provided
    let passwordHash = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 12);
    }

    // Create share
    const shareId = crypto.randomUUID();
    await execute(
      `INSERT INTO shares (id, node_id, owner_id, target_type, target_id, permission, password_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shareId,
        data.nodeId,
        req.user.id,
        data.targetType,
        data.targetType === 'user' ? data.targetId : null,
        data.permission,
        passwordHash,
        data.expiresAt || null,
      ]
    );

    const share = await queryOne('SELECT * FROM shares WHERE id = ?', [shareId]);
    share.public_url = share.target_type === 'public' ? `${process.env.APP_URL}/shared/${data.nodeId}` : null;

    res.status(201).json({ share });
  } catch (err) {
    next(err);
  }
});

// GET /api/shares - List shares for a node
router.get('/', async (req, res, next) => {
  try {
    const { nodeId } = req.query;

    if (!nodeId) {
      throw new ValidationError('nodeId is required');
    }

    // Verify node exists and user owns it
    const node = await queryOne(
      'SELECT id FROM nodes WHERE id = ? AND owner_id = ? AND is_trashed = FALSE',
      [nodeId, req.user.id]
    );

    if (!node) {
      throw new NotFoundError('File or folder');
    }

    const shares = await query(
      `SELECT s.*, u.username as target_username
       FROM shares s
       LEFT JOIN users u ON s.target_id = u.id
       WHERE s.node_id = ?
       ORDER BY s.created_at DESC`,
      [nodeId]
    );

    // Add public URLs
    for (const share of shares) {
      share.public_url = share.target_type === 'public'
        ? `${process.env.APP_URL}/shared/${nodeId}`
        : null;
    }

    res.json({ shares });
  } catch (err) {
    next(err);
  }
});

// GET /api/shares/received - List shares received by current user
router.get('/received', async (req, res, next) => {
  try {
    const shares = await query(
      `SELECT s.*, n.name as node_name, n.type as node_type, n.mime_type, n.size,
              u.username as owner_username
       FROM shares s
       JOIN nodes n ON s.node_id = n.id
       JOIN users u ON n.owner_id = u.id
       WHERE s.target_type = 'user' AND s.target_id = ?
         AND s.node_id IN (SELECT id FROM nodes WHERE is_trashed = FALSE)
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );

    res.json({ shares });
  } catch (err) {
    next(err);
  }
});

// GET /api/shares/public/:nodeId - Get public share info (no auth required)
router.get('/public/:nodeId', async (req, res, next) => {
  try {
    const share = await queryOne(
      `SELECT s.*, n.name as node_name, n.type as node_type, n.mime_type, n.size
       FROM shares s
       JOIN nodes n ON s.node_id = n.id
       WHERE s.node_id = ? AND s.target_type = 'public'
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
         AND n.is_trashed = FALSE`,
      [req.params.nodeId]
    );

    if (!share) {
      throw new NotFoundError('Public share');
    }

    // Don't expose password hash
    delete share.password_hash;

    res.json({ share });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/shares/:id - Update share
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateShareSchema.parse(req.body);

    const share = await queryOne(
      `SELECT s.* FROM shares s
       JOIN nodes n ON s.node_id = n.id
       WHERE s.id = ? AND n.owner_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!share) {
      throw new NotFoundError('Share');
    }

    const updates = [];
    const params = [];

    if (data.permission !== undefined) {
      updates.push('permission = ?');
      params.push(data.permission);
    }

    if (data.password !== undefined) {
      if (data.password === null) {
        updates.push('password_hash = NULL');
      } else {
        const passwordHash = await bcrypt.hash(data.password, 12);
        updates.push('password_hash = ?');
        params.push(passwordHash);
      }
    }

    if (data.expiresAt !== undefined) {
      updates.push('expires_at = ?');
      params.push(data.expiresAt || null);
    }

    if (updates.length > 0) {
      params.push(req.params.id, req.user.id);
      await execute(
        `UPDATE shares SET ${updates.join(', ')} WHERE id = ? AND owner_id = ?`,
        params
      );
    }

    const updated = await queryOne('SELECT * FROM shares WHERE id = ?', [req.params.id]);
    delete updated.password_hash;
    updated.public_url = updated.target_type === 'public'
      ? `${process.env.APP_URL}/shared/${share.node_id}`
      : null;

    res.json({ share: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/shares/:id - Revoke share
router.delete('/:id', async (req, res, next) => {
  try {
    const share = await queryOne(
      `SELECT s.* FROM shares s
       JOIN nodes n ON s.node_id = n.id
       WHERE s.id = ? AND n.owner_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!share) {
      throw new NotFoundError('Share');
    }

    await execute('DELETE FROM shares WHERE id = ?', [req.params.id]);

    res.json({ message: 'Share revoked' });
  } catch (err) {
    next(err);
  }
});

// POST /api/shares/:id/verify-password - Verify password for public share (no auth)
router.post('/:id/verify-password', async (req, res, next) => {
  try {
    const { password } = req.body;

    const share = await queryOne(
      `SELECT s.*, n.enc_key_wrapped, n.enc_iv, n.chunks, n.mime_type, n.size, n.name
       FROM shares s
       JOIN nodes n ON s.node_id = n.id
       WHERE s.id = ? AND s.target_type = 'public' AND s.password_hash IS NOT NULL
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
         AND n.is_trashed = FALSE`,
      [req.params.id]
    );

    if (!share) {
      throw new NotFoundError('Protected share');
    }

    const valid = await bcrypt.compare(password, share.password_hash);

    if (!valid) {
      throw new AuthorizationError('Invalid password');
    }

    // Generate short-lived access token (1 hour)
    // In production, use proper JWT with secret
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Store token temporarily (in production, use Redis with TTL)
    // For now, just return the decryption info
    res.json({
      token,
      expiresIn: 3600,
      encKeyWrapped: share.enc_key_wrapped,
      encIv: share.enc_iv?.toString('base64') || null,
      node: {
        id: share.node_id,
        name: share.name,
        mimeType: share.mime_type,
        size: share.size,
        chunks: JSON.parse(share.chunks),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;