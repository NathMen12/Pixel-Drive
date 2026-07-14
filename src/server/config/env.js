import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(7860),
  APP_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.coerce.boolean().default(false),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  DB_CA_CERT: z.string().optional(),

  IMGBB_API_KEY: z.string().min(1),

  RATE_LIMIT_AUTH: z.string().default('10/15m'),
  RATE_LIMIT_UPLOAD: z.string().default('50/1m'),
  RATE_LIMIT_API: z.string().default('100/1m'),

  SHARP_CONCURRENCY: z.coerce.number().default(2),

  CHUNK_SIZE: z.coerce.number().default(26214400),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Parse rate limit strings like "10/15m" -> { limit: 10, windowMs: 900000 }
const UNIT_MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

export function parseRateLimit(str) {
  const [limitStr, windowStr] = String(str).split('/');
  const limit = parseInt(limitStr, 10) || 100;
  const match = String(windowStr || '1m').match(/^(\d+)([smhd])$/);
  const windowMs = match ? parseInt(match[1], 10) * (UNIT_MS[match[2]] || 60000) : 60000;
  return { limit, windowMs };
}

export default env;
