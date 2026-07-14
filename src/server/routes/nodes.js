import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { query, queryOne, execute } from '../config/db.js';
import { AppError, NotFoundError, ValidationError, AuthorizationError } from '../utils/errors.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Validation schemas
const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
});

const renameSchema = z.object({
  name: z.string().min(1).max(255),
});

const moveSchema = z.object({
  parentId: z.string().uuid().nullable(),
});

const updateNodeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isFav: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/nodes/tree - Get folder tree
router.get('/tree', async (req, res, next) => {
  try {
    const folders = await query(
      `SELECT id, parent_id as parentId, name, type, is_fav as isFav, is_trashed as isTrashed
       FROM nodes
       WHERE owner_id = ? AND type = 'folder' AND is_trashed = FALSE
       ORDER BY name`,
      [req.user.id]
    );

    // Build tree structure
    const folderMap = new Map();
    const roots = [];

    for (const folder of folders) {
      folderMap.set(folder.id, { ...folder, children: [] });
    }

    for (const folder of folders) {
      const node = folderMap.get(folder.id);
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    res.json({ tree: roots });
  } catch (err) {
    next(err);
  }
});

// GET /api/nodes - List nodes in a folder
router.get('/', async (req, res, next) => {
  try {
    const { parentId = null, search = '', sort = 'name', order = 'ASC', page = 1, limit = 100 } = req.query;

    let whereClause = 'WHERE owner_id = ? AND is_trashed = FALSE';
    const params = [req.user.id];

    if (parentId) {
      whereClause += ' AND parent_id = ?';
      params.push(parentId);
    } else {
      whereClause += ' AND parent_id IS NULL';
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR MATCH(name) AGAINST(? IN BOOLEAN MODE))';
      params.push(`%${search}%`, search);
    }

    // Validate sort/order
    const allowedSort = ['name', 'size', 'created_at', 'updated_at', 'type'];
    const allowedOrder = ['ASC', 'DESC'];
    const sortField = allowedSort.includes(sort) ? sort : 'name';
    const sortOrder = allowedOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'ASC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 500);

    // Get total count
    const [{ total }] = await query(
      `SELECT COUNT(*) as total FROM nodes ${whereClause}`,
      params
    );

    // Get nodes
    const nodes = await query(
      `SELECT id, parent_id as parentId, name, type, mime_type as mimeType, size,
              chunks, enc_iv as encIv, enc_key_wrapped as encKeyWrapped,
              sha256, sha1, chunk_count as chunkCount, thumb_url as thumbUrl,
              tags, is_fav as isFav, is_trashed as isTrashed,
              created_at as createdAt, updated_at as updatedAt
       FROM nodes
       ${whereClause}
       ORDER BY type DESC, ${sortField} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    // Parse JSON fields (mysql2 may already parse JSON columns)
    for (const node of nodes) {
      node.chunks = typeof node.chunks === 'string' ? JSON.parse(node.chunks || '[]') : (node.chunks || []);
      node.tags = node.tags ? (typeof node.tags === 'string' ? JSON.parse(node.tags) : node.tags) : null;
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

// GET /api/nodes/:id - Get single node
router.get('/:id', async (req, res, next) => {
  try {
    const node = await queryOne(
      `SELECT id, owner_id as ownerId, parent_id as parentId, name, type, mime_type as mimeType, size,
              chunks, enc_iv as encIv, enc_key_wrapped as encKeyWrapped,
              sha256, sha1, chunk_count as chunkCount, thumb_url as thumbUrl,
              tags, is_fav as isFav, is_trashed as isTrashed,
              created_at as createdAt, updated_at as updatedAt
       FROM nodes
       WHERE id = ? AND owner_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!node) {
      throw new NotFoundError('File or folder');
    }

    node.chunks = typeof node.chunks === 'string' ? JSON.parse(node.chunks || '[]') : (node.chunks || []);
    node.tags = node.tags ? (typeof node.tags === 'string' ? JSON.parse(node.tags) : node.tags) : null;

    res.json({ node });
  } catch (err) {
    next(err);
  }
});

// POST /api/nodes - Create folder
router.post('/', async (req, res, next) => {
  try {
    const data = createFolderSchema.parse(req.body);

    // Verify parent exists and user owns it
    let parentId = data.parentId;
    if (!parentId) {
      // Get root folder
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
        throw new NotFoundError('Parent folder');
      }
    }

    const folderId = crypto.randomUUID();
    await execute(
      `INSERT INTO nodes (id, owner_id, parent_id, name, type, chunks, size)
       VALUES (?, ?, ?, ?, 'folder', '[]', 0)`,
      [folderId, req.user.id, parentId, data.name]
    );

    const folder = await queryOne(
      'SELECT * FROM nodes WHERE id = ?',
      [folderId]
    );

    res.status(201).json({ node: folder });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/nodes/:id - Update node (rename, move, fav, tags)
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateNodeSchema.parse(req.body);

    const node = await queryOne(
      'SELECT * FROM nodes WHERE id = ? AND owner_id = ?',
      [req.params.id, req.user.id]
    );

    if (!node) {
      throw new NotFoundError('File or folder');
    }

    const updates = [];
    const params = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.parentId !== undefined) {
      // Verify new parent exists and is a folder owned by user
      if (data.parentId) {
        const newParent = await queryOne(
          'SELECT id FROM nodes WHERE id = ? AND owner_id = ? AND type = "folder"',
          [data.parentId, req.user.id]
        );
        if (!newParent) {
          throw new NotFoundError('Destination folder');
        }
        // Prevent moving into self or descendant
        if (data.parentId === req.params.id) {
          throw new ValidationError('Cannot move folder into itself');
        }
      }
      updates.push('parent_id = ?');
      params.push(data.parentId);
    }

    if (data.isFav !== undefined) {
      updates.push('is_fav = ?');
      params.push(data.isFav);
    }

    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id, req.user.id);

      await execute(
        `UPDATE nodes SET ${updates.join(', ')} WHERE id = ? AND owner_id = ?`,
        params
      );
    }

    const updated = await queryOne('SELECT * FROM nodes WHERE id = ?', [req.params.id]);
    updated.chunks = typeof updated.chunks === 'string' ? JSON.parse(updated.chunks || '[]') : (updated.chunks || []);
    updated.tags = updated.tags ? (typeof updated.tags === 'string' ? JSON.parse(updated.tags) : updated.tags) : null;

    res.json({ node: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/nodes/:id - Move to trash
router.delete('/:id', async (req, res, next) => {
  try {
    const node = await queryOne(
      'SELECT * FROM nodes WHERE id = ? AND owner_id = ?',
      [req.params.id, req.user.id]
    );

    if (!node) {
      throw new NotFoundError('File or folder');
    }

    await execute(
      `UPDATE nodes SET is_trashed = TRUE, trashed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_id = ?`,
      [req.params.id, req.user.id]
    );

    // If folder, also trash children recursively
    if (node.type === 'folder') {
      await execute(
        `UPDATE nodes SET is_trashed = TRUE, trashed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND (parent_id = ? OR id IN (
           SELECT id FROM (SELECT id FROM nodes WHERE parent_id = ?) AS t
         ))`,
        [req.user.id, req.params.id, req.params.id]
      );
    }

    res.json({ message: 'Moved to trash' });
  } catch (err) {
    next(err);
  }
});

// POST /api/nodes/:id/restore - Restore from trash
router.post('/:id/restore', async (req, res, next) => {
  try {
    const node = await queryOne(
      'SELECT * FROM nodes WHERE id = ? AND owner_id = ? AND is_trashed = TRUE',
      [req.params.id, req.user.id]
    );

    if (!node) {
      throw new NotFoundError('File or folder in trash');
    }

    await execute(
      `UPDATE nodes SET is_trashed = FALSE, trashed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_id = ?`,
      [req.params.id, req.user.id]
    );

    // If folder, restore children
    if (node.type === 'folder') {
      await execute(
        `UPDATE nodes SET is_trashed = FALSE, trashed_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND (parent_id = ? OR id IN (
           SELECT id FROM (SELECT id FROM nodes WHERE parent_id = ?) AS t
         ))`,
        [req.user.id, req.params.id, req.params.id]
      );
    }

    res.json({ message: 'Restored from trash' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/nodes/:id/purge - Permanently delete
router.delete('/:id/purge', async (req, res, next) => {
  try {
    const node = await queryOne(
      'SELECT * FROM nodes WHERE id = ? AND owner_id = ? AND is_trashed = TRUE',
      [req.params.id, req.user.id]
    );

    if (!node) {
      throw new NotFoundError('File or folder in trash');
    }

    // Delete chunks from ImgBB (optional, just mark as deleted)
    // For now, just delete from database - ImgBB cleanup can be a background job

    await execute('DELETE FROM nodes WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);

    // If folder, delete children recursively
    if (node.type === 'folder') {
      await execute('DELETE FROM nodes WHERE owner_id = ? AND parent_id = ?', [req.user.id, req.params.id]);
    }

    // Update user storage used
    if (node.type === 'file') {
      await execute(
        'UPDATE users SET storage_used = GREATEST(0, storage_used - ?) WHERE id = ?',
        [node.size, req.user.id]
      );
    }

    res.json({ message: 'Permanently deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/nodes/search?q= - Full-text search
router.get('/search', async (req, res, next) => {
  try {
    const { q, limit = 50 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ nodes: [] });
    }

    const nodes = await query(
      `SELECT id, parent_id as parentId, name, type, mime_type as mimeType, size,
              thumb_url as thumbUrl, is_fav as isFav, created_at as createdAt
       FROM nodes
       WHERE owner_id = ? AND is_trashed = FALSE AND MATCH(name) AGAINST(? IN BOOLEAN MODE)
       ORDER BY type DESC, name
       LIMIT ?`,
      [req.user.id, q, parseInt(limit)]
    );

    res.json({ nodes });
  } catch (err) {
    next(err);
  }
});

// GET /api/nodes/stats - Storage statistics
router.get('/stats', async (req, res, next) => {
  try {
    const [{ fileCount, folderCount, totalSize }] = await query(
      `SELECT
         COUNT(CASE WHEN type = 'file' THEN 1 END) as fileCount,
         COUNT(CASE WHEN type = 'folder' THEN 1 END) as folderCount,
         COALESCE(SUM(CASE WHEN type = 'file' THEN size END), 0) as totalSize
       FROM nodes
       WHERE owner_id = ? AND is_trashed = FALSE`,
      [req.user.id]
    );

    const [{ trashCount, trashSize }] = await query(
      `SELECT COUNT(*) as trashCount, COALESCE(SUM(size), 0) as trashSize
       FROM nodes
       WHERE owner_id = ? AND is_trashed = TRUE`,
      [req.user.id]
    );

    const user = await queryOne(
      'SELECT storage_used FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      files: fileCount,
      folders: folderCount,
      totalSize,
      trashFiles: trashCount,
      trashSize,
      storageUsed: user?.storage_used || 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;