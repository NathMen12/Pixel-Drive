import express from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { createPool, closePool, testConnection } from './config/db.js';
import { errorHandler, notFoundHandler } from './utils/errors.js';
import { authRateLimit, uploadRateLimit, apiRateLimit } from './middleware/rateLimit.js';

// Import routes
import authRoutes from './routes/auth.js';
import nodeRoutes from './routes/nodes.js';
import uploadRoutes from './routes/upload.js';
import downloadRoutes from './routes/download.js';
import shareRoutes from './routes/shares.js';
import adminRoutes from './routes/admin.js';
import healthRoutes from './routes/health.js';
import apiKeyRoutes from './routes/api-keys.js';

// Import socket handler
import { initSocket } from './socket/presence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = initSocket(httpServer);

// Trust proxy (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // We'll handle CSP manually if needed
}));

// CORS configuration
app.use(cors({
  origin: env.APP_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression
app.use(compression());

// Logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Rate limiting
app.use('/api/auth', authRateLimit);
app.use('/api/upload', uploadRateLimit);
app.use('/api', apiRateLimit);

// Health check (no rate limit)
app.use('/healthz', healthRoutes);
app.use('/ready', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/api-keys', apiKeyRoutes);

// Download/Shared routes (no /api prefix for clean URLs)
app.use('/shared', downloadRoutes);
app.use('/embed', downloadRoutes); // Alias for embed

// Static file serving for frontend (in production)
if (env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  }));

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') ||
        req.path.startsWith('/shared') ||
        req.path.startsWith('/embed') ||
        req.path.startsWith('/healthz') ||
        req.path.startsWith('/ready')) {
      return next();
    }
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  httpServer.close(async () => {
    console.log('✅ HTTP server closed');

    try {
      await closePool();
      console.log('✅ Database pool closed');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function start() {
  try {
    // Initialize database pool
    createPool();

    // Test database connection
    await testConnection();
    console.log('✅ Database connection verified');

    // Run migrations (in production, this should be done separately)
    if (env.NODE_ENV !== 'production') {
      try {
        const { migrate } = await import('./db/migrate.js');
        await migrate();
      } catch (err) {
        console.warn('⚠️ Migration skipped or failed:', err.message);
      }
    }

    httpServer.listen(env.PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    🎨 PixelDrive                           ║
║         Zero-Knowledge Cloud Storage                      ║
╠═══════════════════════════════════════════════════════════╣
║  Environment: ${env.NODE_ENV.padEnd(47)}║
║  Server:      http://localhost:${env.PORT}${' '.repeat(41 - String(env.PORT).length)}║
║  API:         http://localhost:${env.PORT}/api${' '.repeat(40)}║
║  Health:      http://localhost:${env.PORT}/healthz${' '.repeat(38)}║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

export { app, io, httpServer };