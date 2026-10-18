# Security

This document summarizes the current security posture for Tsion Baltina and how the code hardens the application.

## Authentication & Authorization

- **Admin sessions** (`src/server/auth.ts`): Admin authentication uses an HMAC-signed session token stored in an HttpOnly cookie (`ab_admin_session`). Tokens expire after 8 hours and are verified per request.
- **Fail-closed**: `requireAdmin()` rejects missing, malformed, expired, or forged tokens with `401` and `UNAUTHORIZED`. All mutating admin routes (`/api/v1/admin/*`, order status changes, inventory adjustments, product create/update, image upload/delete) are behind `requireAdmin()`.
- **Strong secrets**: The signing key comes from `SESSION_SECRET`. If unset or still the example placeholder, a per-process random 32-byte key is generated in production (sessions won't survive restarts) and a warning is emitted. All secret comparisons use constant-time SHA-256 equality.
- **Brute-force guard**: Admin login is throttled per IP (5 failed attempts / 15 minutes). In addition, the API applies a global rate limiter to `POST /api/v1/auth/admin/login` (10 requests / 15 minutes).

## CORS

- **Restrictive**: Browser requests are allowed only from `CLIENT_URL` (comma-separated) or the same origin as the request host. Cross-origin requests from any other origin return `403` with `error.code: 'CORS_FORBIDDEN'`.
- **Credentials**: Cookies are allowed (`credentials: true`). Same-origin requests without an `Origin` header pass.
- **Preflight**: Handled by `cors`; disallowed origins are rejected before any body parsing.

## Security Headers

- **Helmet**: Applied across the app. In production, CSP is strict:
  - `default-src 'self'`, `script-src 'self' https://telegram.org` (Telegram Mini App SDK), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob: https:`, `connect-src 'self'`, `font-src 'self' data:`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org`.
- **Framing**: `X-Frame-Options` is not emitted because the Mini App is embedded by Telegram; CSP `frame-ancestors` is the correct policy for modern browsers.
- **HSTS**: Emitted over TLS (standard helmet behavior; browsers ignore over HTTP).

## Input Validation

- **Zod schemas** validate order creation, inventory adjustments, product creation, and status transitions. Invalid payloads return `400` with `VALIDATION_ERROR` and minimal detail.
- **Idempotency**: Reusing an `idempotency_key` with a different payload returns `400` with `IDEMPOTENCY_KEY_REUSE`. Identical payloads return the original order with `replayed: true` (200).

## Rate Limiting

- `POST /api/v1/orders`: 20/min
- `POST /api/v1/auth/telegram`: 20/15 min
- `POST /api/v1/upload`: 30/15 min
- `POST /api/v1/auth/admin/login`: 10/15 min

Responses include `error.code: 'RATE_LIMITED'` and standard rate-limit headers.

## Image Upload Hardening

- **Admin-only**: `POST /api/v1/upload` and `DELETE /api/v1/upload/:public_id` require admin authentication.
- **Body size**: 10 MB JSON limit for the upload route (1 MB elsewhere); `Content-Type: application/json` is enforced (415 otherwise).
- **Source validation** (`src/server/imageSource.ts`): Only base64 image data URIs (`png/jpeg/webp/gif/avif`) or HTTPS URLs from an allow-list are accepted. The default allow-list is `res.cloudinary.com` and `images.unsplash.com`; extra hosts may be added via `UPLOAD_ALLOWED_HOSTS` (comma-separated).
- **SSRF protection**: Arbitrary hosts (including private/metadata IPs) are rejected before any remote fetch, preventing Cloudinary from being steered to internal endpoints.

## Error Handling & Logging

- **Generic 500s**: Unexpected errors are logged server-side with full detail, but clients receive a generic `INTERNAL_ERROR` response that includes a `correlationId` (taken from `X-Request-Id` header or a random UUID).
- **Request correlation**: Every API request is assigned an `X-Request-Id` header, echoed to the response and attached to all request/error logs.
- **Structured logging** (`src/server/logger.ts`): Logs are JSON lines (`{ts, level, msg, ...fields}`). Sensitive keys (`password`, `token`, `secret`, `authorization`, `cookie`, `initData`, `apiKey`, etc.) are redacted recursively. Personal data from bodies is never logged; request logs record only `method`, `path`, `status`, `durationMs`, `ip`, and the `requestId`.

## Secrets & Configuration

- **`.env` loading**: `src/server/env.ts` loads `.env` via Node's `process.loadEnvFile()` on startup (no `dotenv` dependency). Existing environment variables always take precedence (hosting panel values win).
- **Never commit secrets**: `.env` is ignored in `.gitignore`. Admin login is disabled unless `ADMIN_PASSWORD` is set; in production, use a strong random `SESSION_SECRET`.
- **Configurable commerce**: Delivery fee/threshold and tax rate are read from environment (`DELIVERY_FREE_THRESHOLD`, `DELIVERY_FLAT_FEE`, `TAX_RATE`) with safe defaults.

## Additional Safeguards

- **Order integrity**: Server-authoritative pricing, atomic stock decrement with oversell protection, and a uniqueness-guaranteed order ID generation (collision loop) prevent silent data loss.
- **Graceful shutdown**: `SIGTERM`/`SIGINT` close SSE clients, drain the HTTP server, drop idle connections, and force-exit after a timeout — prevents interrupted transactions during restarts.
- **Bounded in-memory collections**: Notifications (200), audit logs (500), and inventory transactions (1000) are capped to prevent unbounded memory growth.
- **XSS hygiene**: No usage of `dangerouslySetInnerHTML`; React escapes text by default.
