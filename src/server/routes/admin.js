import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { query, queryOne, execute } from '../config/db.js';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';

const router = express.Router();

// All routes require admin authentication
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/stats - System statistics
router.get('/stats', async (req, res, next) => {
  try {
    const [
      [{ userCount }],
      [{ fileCount }],
      [{ folderCount }],
      [{ totalSize }],
      [{ activeUploads }],
      [{ recentUploads }],
      [{ recentLogins }],
    ] = await Promise.all([
      query('SELECT COUNT(*) as userCount FROM users'),
      query('SELECT COUNT(*) as fileCount FROM nodes WHERE type = "file" AND is_trashed = FALSE'),
      query('SELECT COUNT(*) as folderCount FROM nodes WHERE type = "folder" AND is_trashed = FALSE'),
      query('SELECT COALESCE(SUM(size), 0) as totalSize FROM nodes WHERE type = "file" AND is_trashed = FALSE'),
      query('SELECT COUNT(*) as activeUploads FROM upload_sessions WHERE status = "pending"'),
      query('SELECT COUNT(*) as recentUploads FROM nodes WHERE type = "file" AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
      query('SELECT COUNT(*) as recentLogins FROM users WHERE updated_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
    ]);

    res.json({
      users: userCount,
      files: fileCount,
      folders: folderCount,
      totalSize,
      activeUploads,
      recentUploads24h: recentUploads,
      activeUsers24h: recentLogins,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users - List all users with pagination
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '', role, sort = 'created_at', order = 'DESC' } = req.query;

    const allowedSort = ['username', 'created_at', 'storage_used', 'role'];
    const allowedOrder = ['ASC', 'DESC'];
    const sortField = allowedSort.includes(sort) ? sort : 'created_at';
    const sortOrder = allowedOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 200);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (username LIKE ? OR id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    const [users, [{ total }]] = await Promise.all([
      query(
        `SELECT id, username, role, theme, storage_used, created_at, updated_at
         FROM users ${whereClause}
         ORDER BY ${sortField} ${sortOrder}
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM users ${whereClause}`,
        params
      ),
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await queryOne(
      'SELECT id, username, role, theme, storage_used, master_key_version, created_at, updated_at FROM users WHERE id = ?',
      [req.params.id]
    );

    if (!user) {
      throw new NotFoundError('User');
    }

    // Get user's file count
    const [{ fileCount, folderCount, totalSize }] = await query(
      `SELECT
         COUNT(CASE WHEN type = 'file' THEN 1 END) as fileCount,
         COUNT(CASE WHEN type = 'folder' THEN 1 END) as folderCount,
         COALESCE(SUM(CASE WHEN type = 'file' THEN size END), 0) as totalSize
       FROM nodes
       WHERE owner_id = ? AND is_trashed = FALSE`,
      [req.params.id]
    );

    // Get recent activity
    const recentFiles = await query(
      `SELECT id, name, type, mime_type, size, created_at
       FROM nodes
       WHERE owner_id = ? AND is_trashed = FALSE
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.params.id]
    );

    res.json({
      user: {
        ...user,
        fileCount,
        folderCount,
        totalSize,
        recentFiles,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id - Update user (role, ban, etc.)
router.patch('/users/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      role: z.enum(['user', 'admin']).optional(),
      theme: z.enum(['dark', 'light', 'system']).optional(),
      // banned: z.boolean().optional(), // Would need a banned column
    });

    const data = schema.parse(req.body);

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      throw new NotFoundError('User');
    }

    const updates = [];
    const params = [];

    if (data.role !== undefined) {
      updates.push('role = ?');
      params.push(data.role);
    }

    if (data.theme !== undefined) {
      updates.push('theme = ?');
      params.push(data.theme);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = await queryOne(
      'SELECT id, username, role, theme, storage_used, created_at FROM users WHERE id = ?',
      [req.params.id]
    );

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id - Delete user (and all their data)
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      throw new ValidationError('Cannot delete yourself');
    }

    const user = await queryOne('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Delete user (cascades to nodes, shares, etc.)
    await execute('DELETE FROM users WHERE id = ?', [req.params.id]);

    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/nodes - List all files (for moderation)
router.get('/nodes', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '', type, ownerId, sort = 'created_at', order = 'DESC' } = req.query;

    const allowedSort = ['name', 'size', 'created_at', 'type'];
    const allowedOrder = ['ASC', 'DESC'];
    const sortField = allowedSort.includes(sort) ? sort : 'created_at';
    const sortOrder = allowedOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 200);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (n.name LIKE ? OR n.id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (type) {
      whereClause += ' AND n.type = ?';
      params.push(type);
    }

    if (ownerId) {
      whereClause += ' AND n.owner_id = ?';
      params.push(ownerId);
    }

    const [nodes, [{ total }]] = await Promise.all([
      query(
        `SELECT n.id, n.owner_id, n.parent_id, n.name, n.type, n.mime_type, n.size,
                n.is_trashed, n.is_fav, n.created_at, n.updated_at,
                u.username as owner_username
         FROM nodes n
         JOIN users u ON n.owner_id = u.id
         ${whereClause}
         ORDER BY n.${sortField} ${sortOrder}
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM nodes n JOIN users u ON n.owner_id = u.id ${whereClause}`,
        params
      ),
    ]);

    // Parse JSON fields
    for (const node of nodes) {
      node.chunks = JSON.parse(node.chunks || '[]');
      if (node.tags) node.tags = JSON.parse(node.tags);
    }

    res.json({
      nodes,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/nodes/:id - Force delete any file
router.delete('/nodes/:id', async (req, res, next) => {
  try {
    const node = await queryOne('SELECT * FROM nodes WHERE id = ?', [req.params.id]);
    if (!node) {
      throw new NotFoundError('File or folder');
    }

    // Delete from database
    await execute('DELETE FROM nodes WHERE id = ?', [req.params.id]);

    // If folder, delete children
    if (node.type === 'folder') {
      await execute('DELETE FROM nodes WHERE parent_id = ?', [req.params.id]);
    }

    // Update owner's storage
    if (node.type === 'file') {
      await execute(
        'UPDATE users SET storage_used = GREATEST(0, storage_used - ?) WHERE id = ?',
        [node.size, node.owner_id]
      );
    }

    res.json({ message: 'File deleted by admin' });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/cleanup - Cleanup orphaned data
router.post('/cleanup', async (req, res, next) => {
  try {
    const results = {};

    // Delete expired shares
    const [deletedShares] = await execute(
      'DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at < NOW()'
    );
    results.expiredShares = deletedShares.affectedRows;

    // Delete old completed upload sessions (> 7 days)
    const [deletedSessions] = await execute(
      `DELETE FROM upload_sessions WHERE status = "completed" AND completed_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );
    results.oldUploadSessions = deletedSessions.affectedRows;

    // Delete trash older than 30 days
    const [deletedTrash] = await execute(
      `DELETE FROM nodes WHERE is_trashed = TRUE AND trashed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    results.oldTrash = deletedTrash.affectedRows;

    // Delete orphaned upload chunks (sessions that don't exist)
    const [deletedChunks] = await execute(
      `DELETE uc FROM upload_chunks uc
       LEFT JOIN upload_sessions us ON uc.upload_session_id = us.id
       WHERE us.id IS NULL`
    );
    results.orphanedChunks = deletedChunks.affectedRows;

    res.json({ message: 'Cleanup completed', results });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/logs - View recent logs (if using a logging table)
router.get('/logs', async (req, res, next) => {
  try {
    // For now, return placeholder
    // In production, you'd query a logs table or use a logging service
    res.json({
      logs: [
        { timestamp: new Date().toISOString(), level: 'info', message: 'Log endpoint - implement with your logging solution' },
      ],
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/health - Detailed health check
router.get('/health', async (req, res, next) => {
  try {
    const dbStart = Date.now();
    await queryOne('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    // Check ImgBB connectivity
    let imgbbStatus = 'unknown';
    try {
      // Could do a quick API call to verify
      imgbbStatus = 'configured';
    } catch {
      imgbbStatus = 'error';
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        status: 'connected',
        latency: dbLatency,
      },
      imgbb: {
        status: imgbbStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;