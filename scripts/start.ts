/**
 * Cross-platform production entry point.
 *
 * `npm start` used to be `NODE_ENV=production tsx server.ts`, which only works
 * in POSIX shells. Setting NODE_ENV here runs the same on Windows `cmd`,
 * PowerShell, and Linux — and `tsx` is a runtime `dependency`, so it survives
 * `npm ci --omit=dev`.
 *
 * A NODE_ENV that is already set by the environment (or loaded from `.env` by
 * `src/server/env.ts`) still wins.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

await import('../server');
