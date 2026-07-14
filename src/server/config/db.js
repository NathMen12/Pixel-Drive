import mysql from 'mysql2/promise';
import { env } from './env.js';

let pool = null;

export function createPool() {
  if (pool) return pool;

  const sslConfig = env.DB_CA_CERT ? {
    ca: env.DB_CA_CERT,
    rejectUnauthorized: true
  } : undefined;

  pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: sslConfig,
    namedPlaceholders: true,
    charset: 'utf8mb4',
    timezone: '+00:00',
    multipleStatements: true,
  });

  pool.on('error', (err) => {
    console.error('❌ MySQL pool error:', err.code, err.message);
  });

  console.log('✅ MySQL pool created');
  return pool;
}

export function getPool() {
  if (!pool) return createPool();
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ MySQL pool closed');
  }
}

export async function testConnection() {
  const p = getPool();
  const [rows] = await p.execute('SELECT 1 as test');
  return rows[0].test === 1;
}

// Query helpers used across the app
export async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.query(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function execute(sql, params = []) {
  const p = getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

export async function transaction(callback) {
  const p = getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export default {
  createPool,
  getPool,
  closePool,
  testConnection,
  transaction,
};