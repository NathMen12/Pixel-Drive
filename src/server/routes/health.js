import express from 'express';
import { testConnection } from '../config/db.js';
import { env } from '../config/env.js';

const router = express.Router();

// GET / - Basic health check (mounted at /healthz)
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// GET /ready - Readiness check (database connectivity) - mounted at /ready
router.get('/ready', async (req, res) => {
  try {
    const dbOk = await testConnection();

    if (!dbOk) {
      return res.status(503).json({
        status: 'not ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'not ready',
      database: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health - Detailed health info
router.get('/health', async (req, res) => {
  try {
    const dbStart = Date.now();
    await testConnection();
    const dbLatency = Date.now() - dbStart;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        status: 'connected',
        latency: dbLatency,
      },
      environment: env.NODE_ENV,
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: err.message,
    });
  }
});

export default router;