import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Admin authentication for Addis Baltina.
 *
 * Model: a single admin password (`ADMIN_PASSWORD`) is exchanged for an
 * HMAC-signed, HttpOnly session cookie. Admin-only routes sit behind
 * `requireAdmin`, which fails closed.
 *
 * Design notes:
 * - The signing key comes from `SESSION_SECRET`. If it is missing or still the
 *   example placeholder, a per-process random key is generated instead, so a
 *   leaked default can never be used to forge sessions.
 * - All secret comparisons go through constant-time SHA-256 digests.
 * - Login attempts are throttled in memory (per IP) as a brute-force guard.
 */

const COOKIE_NAME = 'ab_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 1000 * 60 * 15; // 15 minutes

/** Constant-time string equality that does not leak length. */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

let signingSecret: Buffer | null = null;
let warnedAboutSecret = false;

function getSigningSecret(): Buffer {
  if (signingSecret) return signingSecret;

  const configured = process.env.SESSION_SECRET?.trim();
  const placeholder = 'super-secret-key-change-in-production';
  const weak = !configured || configured === placeholder;

  if (weak) {
    if (process.env.NODE_ENV === 'production' && !warnedAboutSecret) {
      warnedAboutSecret = true;
      console.warn(
        '[auth] SESSION_SECRET is unset or still the example value. ' +
        'Using a per-process signing key: admin sessions will not survive a restart. ' +
        'Set SESSION_SECRET in the environment.'
      );
    }
    signingSecret = crypto.randomBytes(32);
  } else {
    signingSecret = crypto.createHash('sha256').update(configured as string).digest();
  }

  return signingSecret;
}

function signature(exp: number): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(`ab_admin:${exp}`).digest('hex');
}

export function createAdminToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  return `${exp}.${signature(exp)}`;
}

export function verifyAdminToken(token?: string | null): boolean {
  if (!token) return false;
  const sep = token.indexOf('.');
  if (sep <= 0) return false;

  const expStr = token.slice(0, sep);
  const sig = token.slice(sep + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;

  return safeEqual(sig, signature(exp));
}

// ---------------------------------------------------------------------------
// Cookie helpers (no external dependency)
// ---------------------------------------------------------------------------

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https';
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const attributes = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isSecureRequest(req)) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const attributes = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecureRequest(req)) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

/** Returns the admin token from the cookie or an `Authorization: Bearer` header. */
function extractToken(req: Request): string | null {
  const cookie = readCookie(req, COOKIE_NAME);
  if (cookie) return cookie;

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  return null;
}

export function isAdminAuthenticated(req: Request): boolean {
  return verifyAdminToken(extractToken(req));
}

// ---------------------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------------------

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function throttleKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isLoginBlocked(key: string): boolean {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(key);
    return false;
  }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(key: string): void {
  const entry = loginAttempts.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clearFailedLogins(key: string): void {
  loginAttempts.delete(key);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** POST /api/v1/auth/admin/login — exchange the admin password for a session. */
export function adminLogin(req: Request, res: Response): void {
  const key = throttleKey(req);

  if (isLoginBlocked(key)) {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many failed attempts. Try again in a few minutes.',
      },
    });
    return;
  }

  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    console.warn('[auth] Admin login rejected: ADMIN_PASSWORD is not set.');
    res.status(503).json({
      success: false,
      error: {
        code: 'ADMIN_LOGIN_DISABLED',
        message:
          'Admin login is disabled because ADMIN_PASSWORD is not configured on the server.',
      },
    });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !safeEqual(password, configured)) {
    recordFailedLogin(key);
    console.warn(`[auth] Failed admin login attempt (ip=${key}).`);
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid admin password.' },
    });
    return;
  }

  clearFailedLogins(key);
  setSessionCookie(req, res, createAdminToken());
  res.json({ success: true });
}

/** GET /api/v1/auth/admin/session — lets the UI know whether it is logged in. */
export function adminSession(req: Request, res: Response): void {
  res.json({ success: true, data: { authenticated: isAdminAuthenticated(req) } });
}

/** POST /api/v1/auth/admin/logout — clears the session cookie. */
export function adminLogout(req: Request, res: Response): void {
  clearSessionCookie(req, res);
  res.json({ success: true });
}

/**
 * Express middleware guarding admin-only routes. Fails closed: any missing,
 * malformed, expired, or forged token is rejected with 401.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (isAdminAuthenticated(req)) {
    next();
    return;
  }
  res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Administrator authentication required.' },
  });
}
