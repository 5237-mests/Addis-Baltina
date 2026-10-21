# Fix Checklist

Prioritized list of what needs to be fixed before Addis Baltina can be operated
as a real store. Each item is verified against the current code, with the file
or route to change.

Status legend: `[ ]` open · `[~]` in progress · `[x]` done

---

## P0 — Blockers (must fix before production)

- [ ] **Add a `.gitignore`.**
  There is none. `.env` and `node_modules/` are untracked but unprotected — a
  single `git add -A` commits secrets and the dependency tree.
  - Add: `.env`, `node_modules/`, `dist/`, `*.log`, `.DS_Store`, `.idea/`.
  - Confirm `.env` stays out: `git ls-files .env` must return nothing.
- [ ] **Protect admin endpoints.**
  `server.ts` has **no authentication** anywhere (verified: no auth/session/JWT
  code in `src/`). Open to anyone: `PATCH /api/v1/orders/:id/status`,
  `POST /api/v1/inventory/adjust`, `POST|PATCH /api/v1/products*`,
  `POST|DELETE /api/v1/upload*`, `GET /api/v1/admin/*`.
  - [ ] Add admin authentication (signed session cookie or bearer token).
  - [ ] Enforce it with middleware on every mutating route.
  - [ ] Remove/harden the public admin dashboard entry in `AdminDashboard.tsx`.
- [ ] **Fix the Telegram auth fall-through.**
  `server.ts` `POST /api/v1/auth/telegram`: when `TELEGRAM_BOT_TOKEN` **is**
  set but `initData` is absent, validation is skipped and a demo user is
  returned. Configured deployments must return `401` instead of demo mode.
- [ ] **Stop leaking internal errors to clients.**
  Every handler responds with `error.message` on a 500. Return a generic message
  + correlation id; log the detail server-side only (no stack traces in
  production).
- [ ] **Implement data persistence.**
  `src/server/db.ts` is an in-memory store; all orders/inventory/audit data is
  lost on restart, and only one process can ever run. `database/schema.sql` is
  ready but no MySQL driver is installed or wired up.
  - [ ] Add a MySQL client (`mysql2`), connection pool, and a repository
        implementation behind the existing interface.
  - [ ] Preserve server-authoritative pricing and stock decrement.
  - [ ] Make `DB_*` variables actually read; fail fast if unreachable in prod.
- [ ] **Fix the order-ID collision (silent data loss).**
  `db.ts` builds `AB-<year>-<1000..9999>` (9,000 values) and does
  `orders.set(orderId, newOrder)` with no uniqueness check — a collision
  overwrites an existing order.
  - [ ] Use a sequence/UUID or retry on conflict; enforce uniqueness.

---

## P1 — High (correctness, abuse, resilience)

- [~] **Idempotency must survive restarts.**
  `idempotencyKeys` is a `Map` in memory; after a restart the same
  `idempotency_key` creates a duplicate order. Persist with a `UNIQUE` index on
  `orders.idempotency_key` (already in schema) and look up before insert.
  Also reject a reused key with a **different** payload.
  - [x] Reject a reused key with a **different** payload (`IDEMPOTENCY_KEY_REUSE`)
        and replay the same order (200, `replayed: true`) for an identical one.
        The payload is fingerprinted with a stable hash so key order is ignored.
  - [ ] **Durability across restarts still depends on the P0 MySQL store**
        (`orders.idempotency_key UNIQUE`). The lookup/conflict semantics are in
        place; persist the key when the repository lands.
- [x] **Rate limiting.**
  `express-rate-limit` now guards `POST /api/v1/orders` (20/min),
  `POST /api/v1/auth/telegram` (20/15 min), `POST /api/v1/upload` (30/15 min)
  and admin login (10/15 min). Responses use `{ error.code: 'RATE_LIMITED' }`.
- [x] **Restrict CORS.**
  Browsers are allowed only from `CLIENT_URL` (comma-separated) or the same
  origin; other origins get `403 CORS_FORBIDDEN`. Cookies are sent with
  `credentials: true`.
- [x] **Add security headers.**
  `helmet` is applied. Production CSP locks `default/script/connect/object` to
  `'self'`; `frame-ancestors` allows self + `*.telegram.org` (the Mini App is
  framed by Telegram, so `X-Frame-Options` is intentionally left off). HSTS is
  emitted behind TLS.
- [x] **Harden image upload.**
  - [x] Require admin auth (`requireAdmin`).
  - [x] Body capped at 10 MB for this route (1 MB elsewhere) and
        `Content-Type: application/json` enforced (415 otherwise).
  - [x] Only base64 image data URIs (`png/jpeg/webp/gif/avif`) or HTTPS URLs on
        an allow-list (`res.cloudinary.com`, `images.unsplash.com`, extend with
        `UPLOAD_ALLOWED_HOSTS`) are accepted — arbitrary hosts are rejected, so
        Cloudinary can no longer be steered into an SSRF fetch.
- [x] **SSE keep-alive heartbeat.**
  `GET /api/v1/events` now emits a `: ping` comment frame every 25 s (also
  `X-Accel-Buffering: no`) so idle proxies keep the stream open.
- [x] **Bound in-memory collections.**
  `notifications` (200), `auditLogs` (500) and `inventoryTransactions` (1000)
  are capped on insert.
- [x] **Graceful shutdown.**
  `SIGTERM`/`SIGINT` close SSE clients, stop the HTTP server, drop idle
  connections, and force-exit after a 10 s timeout.
- [x] **Runtime dependency split.**
  - [x] `vite` is imported dynamically only when `NODE_ENV !== 'production'`.
  - [x] Production runs a pre-compiled server bundle (`npm run build:server`,
        esbuild → `dist-server/server.js`) via `node scripts/start.mjs`;
        `tsx` is dev-only again. This also fixes the CloudLinux/LVE crash
        (`RangeError: WebAssembly.instantiate(): Out of memory`) that `tsx`'s
        WebAssembly lexer triggers on cPanel shared hosting.
- [~] **Write tests** (`npm test`, Vitest + supertest; 29 tests pass).
  - [x] Unit: pricing, delivery fee (≥1200 ETB free), idempotency, order-id
        uniqueness, bounded collections.
  - [x] Integration (supertest): order creation, overselling, status
        transitions + restock, inventory adjust, admin auth, CORS, rate limit,
        upload/SSRF guard.
  - [x] Realtime: SSE connect, event delivery, heartbeat.
  - [ ] E2E in a browser (Playwright): the API flow
        (catalog → order → login → status) is covered in `tests/api.test.ts`,
        but there is no headless-browser test yet.

---

## P2 — Medium (correctness, UX, operability)

- [ ] **No pagination** on `GET /api/v1/products` and `GET /api/v1/orders` —
  they serialize the full set. Add `limit/offset` (or cursor) + total.
- [ ] **Shallow health check.** `GET /api/v1/health` always returns `ok`. Add a
  real dependency check (DB pool) and expose `status: degraded` accordingly.
- [ ] **Demo data leaking into UX.**
  `src/context/AppContext.tsx` seeds tracked orders with `'AB-2026-1049'` —
  every new visitor sees a fake order.
- [ ] **`metadata.json` claims**
  `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` — an AI Studio leftover that
  misrepresents the project. Remove or correct.
- [ ] **Unstructured logging.** Raw `console.log('[API] ...')`. Move to
  structured logs (JSON), never log tokens/passwords/personal data, and include
  a request correlation id (matches the P0 error-response fix).
- [ ] **`@types/express@5` vs `express@4`** type mismatch. Align versions to
  avoid silent type drift.
- [x] **`npm start` is cross-platform** — it is `node scripts/start.mjs`
  (production server bundle); no POSIX-only `NODE_ENV=... tsx server.ts`
  prefix anymore.
- [ ] **`.env` is not loaded by the app** (no `dotenv`). Either load it
  explicitly or make the scripts use `node --env-file=.env` (Node 20.6+), so
  config behaviour is not host-dependent.
- [ ] **Add ESLint + Prettier.** `npm run lint` is only `tsc --noEmit`.
- [ ] **Input sanitization / XSS pass.** Confirm rich text (descriptions) is
  rendered safely; React escapes by default — verify no `dangerouslySetInnerHTML`.
- [ ] **Delivery fee & tax hardcoded** in `db.ts` (`>= 1200 → 0 else 100`,
  `tax = 0`). Move to config/env.
- [ ] **Service worker cache versioning.** `public/sw.js` `CACHE_NAME` is a
  constant; bump on release or the stale shell will serve old builds.
- [ ] **Missing spec'd docs:** `docs/security.md` and `docs/websocket.md`
  (realtime is covered inside `deployment.md` but the spec names discrete files).

---

## P3 — Nice to have / later

- [x] `database/migrations/` and `database/seeds/` directories (scaffolded with README + baseline reference).
- [x] Indexes for query paths on MySQL (`orders.status`, `orders.created_at`,
  `orders.customer_phone`, `products.category_id`) added to `database/schema.sql`.
- [x] Dockerfile + `docker-compose.yml` for VPS (multi-stage build, app+mysql+redis).
- [x] CI pipeline: install → `lint` → `test` → `build` on every PR (`.github/workflows/ci.yml`).
- [ ] Uptime monitoring wired to `/api/v1/health`; alerting on failure.
- [ ] Rate-limit backed by Redis + shared sessions when scaling horizontally.
- [x] Telegram `auth_date` freshness check in the auth flow (±300s window).
- [ ] Backups automation once MySQL persistence is live
      ([backups.md](./backups.md)).

---

## Definition of done for "production-ready"

All **P0** items closed, all **P1** items closed or explicitly accepted with a
recorded risk, and the smoke test in
[deployment.md §13.2](./deployment.md#132-smoke-test-checklist) passing against
a real HTTPS deployment with:

- [ ] `.env` provably not tracked by git.
- [ ] An anonymous `curl` cannot mutate orders/products/inventory.
- [ ] A restart does not lose data.
- [ ] Order IDs are unique under repeated creation.
- [ ] Automated tests exist and pass in CI.
