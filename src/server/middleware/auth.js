import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { queryOne } from '../config/db.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';

// Verify JWT access token
export function requireAuth(req, res, next) {
  const token = req.cookies?.access_token;

  if (!token) {
    throw new AuthenticationError('Access token required');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      username: decoded.username,
      role: decoded.role,
      masterKeyVersion: decoded.mkv,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthenticationError('Access token expired');
    }
    throw new AuthenticationError('Invalid access token');
  }
}

// Optional authentication - doesn't throw if no token
export function optionalAuth(req, res, next) {
  const token = req.cookies?.access_token;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      username: decoded.username,
      role: decoded.role,
      masterKeyVersion: decoded.mkv,
    };
  } catch (err) {
    // Token invalid/expired, just continue without user
  }

  next();
}

// Require admin role
export function requireAdmin(req, res, next) {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  if (req.user.role !== 'admin') {
    throw new AuthorizationError('Admin access required');
  }
  next();
}

// Generate access token
export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      mkv: user.master_key_version,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL }
  );
}

// Generate refresh token
export function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL }
  );
}

// Set auth cookies
export function setAuthCookies(res, accessToken, refreshToken) {
  const cookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN !== 'localhost' ? env.COOKIE_DOMAIN : undefined,
  };

  res.cookie('access_token', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

// Clear auth cookies
export function clearAuthCookies(res) {
  const cookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN !== 'localhost' ? env.COOKIE_DOMAIN : undefined,
  };

  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
}

// Verify refresh token and return user
export async function verifyRefreshToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);

    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }

    const user = await queryOne(
      'SELECT id, username, role, master_key_version FROM users WHERE id = ?',
      [decoded.sub]
    );

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    return user;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthenticationError('Refresh token expired');
    }
    throw new AuthenticationError('Invalid refresh token');
  }
}

export default {
  requireAuth,
  optionalAuth,
  requireAdmin,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  verifyRefreshToken,
};