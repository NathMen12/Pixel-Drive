import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { query, queryOne, execute } from '../config/db.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional().default(['files:read', 'files:write']),
  expiresAt: z.string().datetime().optional(),
});

// List user's API keys
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const keys = await query(
      'SELECT id, name, prefix, scopes, last_used, expires_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

// Create API key (returns full key once)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    const id = crypto.randomUUID();
    const prefix = 'pd_live_' + crypto.randomBytes(3).toString('hex');
    const suffix = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(suffix).digest('hex');

    await execute(
      `INSERT INTO api_keys (id, user_id, name, prefix, key_hash, scopes, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, data.name, prefix, keyHash, JSON.stringify(data.scopes), data.expiresAt || null]
    );

    res.status(201).json({
      id,
      key: prefix + suffix,
      name: data.name,
      prefix,
      scopes: data.scopes,
      expiresAt: data.expiresAt || null,
    });
  } catch (err) {
    next(err);
  }
});

// Delete API key
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const key = await queryOne('SELECT id FROM api_keys WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!key) throw new AppError('API key not found', 404, 'KEY_NOT_FOUND');

    await execute('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'API key deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;