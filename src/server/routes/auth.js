import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { query, queryOne, execute } from '../config/db.js';
import { AppError, ValidationError, ConflictError } from '../utils/errors.js';

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(12).max(128),
  acceptTerms: z.literal(true),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if username exists
    const existing = await queryOne('SELECT id FROM users WHERE username = ?', [data.username]);
    if (existing) {
      throw new ConflictError('Username already taken');
    }

    // Generate master salt
    const masterSalt = crypto.randomBytes(16);

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const userId = crypto.randomUUID();
    await execute(
      `INSERT INTO users (id, username, password_hash, master_salt, master_key_version, theme, storage_used, role)
       VALUES (?, ?, ?, ?, 1, 'dark', 0, 'user')`,
      [userId, data.username, passwordHash, masterSalt]
    );

    // Create root folder for user
    const rootFolderId = crypto.randomUUID();
    await execute(
      `INSERT INTO nodes (id, owner_id, parent_id, name, type, chunks, size)
       VALUES (?, ?, NULL, 'Root', 'folder', '[]', 0)`,
      [rootFolderId, userId]
    );

    // Generate tokens
    const user = {
      id: userId,
      username: data.username,
      role: 'user',
      master_key_version: 1,
    };

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        theme: 'dark',
        storageUsed: 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await queryOne(
      'SELECT id, username, password_hash, role, master_key_version, master_salt, theme, storage_used FROM users WHERE username = ?',
      [data.username]
    );

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        theme: user.theme,
        storageUsed: user.storage_used,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 401, 'REFRESH_TOKEN_REQUIRED');
    }

    const user = await verifyRefreshToken(refreshToken);

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    setAuthCookies(res, accessToken, newRefreshToken);

    res.json({ message: 'Token refreshed' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await queryOne(
      'SELECT id, username, role, theme, storage_used, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/password
router.put('/password', requireAuth, async (req, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    const user = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const valid = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!valid) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
    }

    const newHash = await bcrypt.hash(data.newPassword, 12);

    // Update password and increment master_key_version (invalidates all wrapped DEKs)
    await execute(
      'UPDATE users SET password_hash = ?, master_key_version = master_key_version + 1 WHERE id = ?',
      [newHash, req.user.id]
    );

    // Clear cookies - user must log in again
    clearAuthCookies(res);

    res.json({ message: 'Password changed. Please log in again.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/delete - Delete own account and all data
router.delete('/delete', requireAuth, async (req, res, next) => {
  try {
    // Foreign keys with ON DELETE CASCADE handle nodes, shares, api_keys
    await execute('DELETE FROM users WHERE id = ?', [req.user.id]);
    clearAuthCookies(res);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/theme
router.put('/theme', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ theme: z.enum(['dark', 'light', 'system']) });
    const { theme } = schema.parse(req.body);

    await execute('UPDATE users SET theme = ? WHERE id = ?', [theme, req.user.id]);

    res.json({ theme });
  } catch (err) {
    next(err);
  }
});

// Import from auth middleware
import {
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  verifyRefreshToken,
} from '../middleware/auth.js';

export default router;