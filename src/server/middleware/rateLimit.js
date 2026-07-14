import rateLimit from 'express-rate-limit';
import { env, parseRateLimit } from '../config/env.js';

// Parse rate limit strings like "10/15m" -> { limit: 10, windowMs: 900000 }
const authLimit = parseRateLimit(env.RATE_LIMIT_AUTH);
const uploadLimit = parseRateLimit(env.RATE_LIMIT_UPLOAD);
const apiLimit = parseRateLimit(env.RATE_LIMIT_API);

// Auth rate limiter (strict)
export const authRateLimit = rateLimit({
  windowMs: authLimit.windowMs,
  limit: authLimit.limit,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Upload rate limiter (moderate)
export const uploadRateLimit = rateLimit({
  windowMs: uploadLimit.windowMs,
  limit: uploadLimit.limit,
  message: { error: 'Upload rate limit exceeded, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// General API rate limiter
export const apiRateLimit = rateLimit({
  windowMs: apiLimit.windowMs,
  limit: apiLimit.limit,
  message: { error: 'API rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// Export as object for easy importing
export const rateLimiters = {
  auth: authRateLimit,
  upload: uploadRateLimit,
  api: apiRateLimit,
};