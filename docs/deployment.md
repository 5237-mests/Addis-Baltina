# Tsion Baltina Deployment Guide

This is the entry point for deploying **Tsion Baltina**. It covers the shared
concepts (build, runtime, environment, verification) that all target
environments rely on. Environment-specific guides are linked below.

| Document | Use it when |
| --- | --- |
| **deployment.md** (this file) | You need the overall model, build steps, environment variables, verification, or troubleshooting. |
| [shared-hosting-deployment.md](./shared-hosting-deployment.md) | You are deploying to ordinary shared hosting (cPanel / Plesk / PHP-style infrastructure, no root). |
| [vps-migration.md](./vps-migration.md) | You have a VPS and want Nginx, PM2/systemd, Docker, Redis, or CI/CD. |
| [telegram-mini-app-deployment.md](./telegram-mini-app-deployment.md) | You are publishing the Telegram Mini App. |
| [backups.md](./backups.md) | You need database backup, restore, and verification procedures. |
| [cloudinary-setup.md](./cloudinary-setup.md) | You are enabling CDN image storage. |
| [architecture.md](./architecture.md) | You need the system layering and inventory/concurrency model. |
| [api.md](./api.md) | You need the REST API reference. |

---

## 1. How a deployment looks

Tsion Baltina is a **single Node.js process** that exposes both the API and the
built front end:

```
Browser / Telegram Mini App / PWA
        │  HTTPS
        ▼
┌──────────────────────────────────────────────┐
│  Node.js process  (server.ts)                 │
│   • /api/v1/*      REST API (Express + Zod)   │
│   • /api/v1/events Server-Sent Events (SSE)   │
│   • /*             static SPA from ./dist     │
└──────────────────────────────────────────────┘
        │                         │
        ▼                         ▼
  In-memory data store      Cloudinary CDN
  (see §6)                  (optional, see docs)
```

Key runtime behaviours:

- **Development** (`NODE_ENV` unset/`development`): Vite is started in
  middleware mode and serves the SPA with hot reload.
- **Production** (`NODE_ENV=production`): Vite is **not** started; the server
  serves the pre-built `./dist` folder and falls back to `dist/index.html` for
  unknown routes (SPA routing).
- The server always listens on `0.0.0.0:$PORT` (default `3000`), so it is
  reachable from a reverse proxy or container.

---

## 2. Prerequisites

| Requirement | Version | Needed for |
| --- | --- | --- |
| Node.js | 20 LTS or 22 LTS (tested on 22.x) | Server runtime and build |
| npm | 10+ | Dependency installation |
| MySQL | 8.0+ | Optional at present — see §6 for status |
| Cloudinary account | — | Optional — real image storage (otherwise demo mode) |
| Telegram bot | — | Optional — Mini App authentication |
| A domain + TLS certificate | — | HTTPS (required by Telegram Mini App) |

> Node 20.6+ is recommended because it supports `node --env-file=.env`, which is
> useful given that the app does **not** load `.env` by itself (§3).

---

## 3. Environment variables

Copy the template and fill in real values:

```bash
cp .env.example .env
```

> ⚠️ **The application does not read `.env` automatically.** There is no
> `dotenv` dependency. On your target host you must either:
> - export the variables in the process environment (recommended in
>   production), or
> - start the server with Node's built-in loader:
>   `node --env-file=.env ...` (Node 20.6+).

### 3.1 Variables actually read by the current code

| Variable | Default | Consumed by | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | `server.ts`, build | Set to `production` to serve `./dist` and disable the Vite dev middleware. |
| `PORT` | `3000` | `server.ts` | HTTP port. |
| `TELEGRAM_BOT_TOKEN` | empty | `server.ts` | When set, `POST /api/v1/auth/telegram` validates the Mini App `initData` HMAC-SHA256 signature. |
| `CLOUDINARY_URL` | empty | `src/server/cloudinary.ts` | Single connection string alternative to the 3 keys below. |
| `CLOUDINARY_CLOUD_NAME` | empty | `src/server/cloudinary.ts` | Used with the two keys below. |
| `CLOUDINARY_API_KEY` | empty | `src/server/cloudinary.ts` | |
| `CLOUDINARY_API_SECRET` | empty | `src/server/cloudinary.ts` | |

### 3.2 Variables reserved by the specification (not yet consumed)

These exist in `.env.example` and the architecture spec. They are currently
**not read at runtime** and are documented here so they are wired rather than
silently ignored. The in-memory store does not connect to MySQL yet (§6).

| Variable | Intended purpose |
| --- | --- |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `DB_NAME` | MySQL database name (`addis_baltina`) |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `CLIENT_URL` | Canonical client origin for CORS / links |
| `SESSION_SECRET` | Session/auth signing key |
| `SOCKET_PATH` | Legacy realtime path (realtime is now SSE at `/api/v1/events`) |

**Never commit a populated `.env` file, and never hardcode secrets.** Configure
them through the host's environment-variable UI (cPanel, Plesk, systemd
`EnvironmentFile`, Docker `--env-file`, or your CI/CD secret store).

---

## 4. Install, build, and run

### 4.1 Local / first-time build

```bash
# 1. Install dependencies (includes build/runtime tooling)
npm install

# 2. Type-check the project
npm run lint          # = tsc --noEmit

# 3. Produce the production front end in ./dist
npm run build         # = vite build
```

### 4.2 Run

```bash
# Development (Vite middleware, hot reload)
npm run dev           # = tsx server.ts

# Production
npm start             # = NODE_ENV=production tsx server.ts
```

### 4.3 Important build/runtime caveats

1. **`tsx` and `vite` must be present at runtime.**
   `npm start` runs the TypeScript server through `tsx` (a `devDependency`), and
   `server.ts` imports `vite` at module scope even in production. Therefore:
   - do **not** run `npm install --omit=dev` / `npm ci --omit=dev`, and
   - if the host strips dev dependencies, promote `tsx` and `vite` to
     `dependencies`, or refactor `server.ts` to import `vite` dynamically only
     when `NODE_ENV !== 'production'`.

2. **The `npm start` script is POSIX-only.**
   `NODE_ENV=production tsx server.ts` does not work in Windows `cmd`. On
   Windows use one of:

   ```powershell
   $env:NODE_ENV="production"; npx tsx server.ts
   ```

   ```cmd
   set NODE_ENV=production&& npx tsx server.ts
   ```

   On a Linux host the script works as-is.

3. **Build the front end before starting production.** With
   `NODE_ENV=production` the server serves `./dist`; if that folder is missing,
   only the API will respond.

---

## 5. Production topology

Minimum viable production setup:

1. A Node process running `server.ts` (bound to `0.0.0.0:$PORT`).
2. A TLS-terminating reverse proxy or the host's HTTPS layer in front of it.
3. The `dist/` folder present on disk (built in step §4.1).
4. Cloudinary credentials (for persistent images) and a Telegram bot token (for
   the Mini App) if you use those features.

Because the API and the SPA share one origin, no cross-origin configuration is
required for the browser client.

See the shared-hosting or VPS guides for concrete process managers, proxy
configs, and start commands.

---

## 6. Database

The repository ships a complete MySQL 8.0 schema at
[`database/schema.sql`](../database/schema.sql) covering categories, products,
product images, users, addresses, orders, order items, inventory transactions,
notifications, and audit logs.

### 6.1 Current runtime status (read this before go-live)

> **The running server uses an in-memory data store**
> (`src/server/db.ts`, `DatabaseStore`). It seeds demo categories and products
> on boot and keeps orders, inventory, and audit data **in process memory**.

Consequences you must plan for:

- **Data does not survive a restart.** Every redeploy or process restart resets
  the catalog and all orders to the seed data.
- **The MySQL driver is not installed or wired up yet.** The `DB_*` variables
  are placeholders (§3.2); `schema.sql` is provided so the persistence layer
  can be implemented against a known schema, and is not yet the live store.
- **A single instance only.** Because state is in-process, running multiple
  Node workers (cluster mode / multiple app processes) will give each worker a
  diverging view of stock and orders. Keep it to one process until persistence
  lands.

Treat the current build as a **single-instance, ephemeral-data deployment**. It
is suitable for staging, demos, and pilot operation with low volume, not for
unattended production commerce.

### 6.2 Importing the schema (for the DB migration path)

When you introduce the persistence layer, provision the database and import the
schema:

```sql
-- Run in the target MySQL instance, or via phpMyAdmin's Import tab
SOURCE database/schema.sql;
```

Or from a shell:

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < database/schema.sql
```

The schema uses `utf8mb4` / `utf8mb4_unicode_ci` (required for Amharic), and
defines the enum values the API already emits (`PENDING` → `CANCELLED`, the four
payment methods, the three order sources, and the inventory reason codes).

---

## 7. Static assets, PWA, and caching

- `npm run build` emits the SPA to `./dist`. Files in `public/`
  (`manifest.json`, `sw.js`, `favicon.svg`) are copied to the web root.
- The service worker **only registers when the front end was built for
  production** (`process.env.NODE_ENV === 'production'` is replaced at build
  time). A development build will not install the service worker.
- The service worker **never caches `/api/**` requests** — API calls always hit
  the network. Only the app shell is cached, with a cached `index.html`
  fallback when offline.
- When you change the shell, bump `CACHE_NAME` in `public/sw.js` so clients pick
  up the new build.

---

## 8. Realtime (Server-Sent Events)

Realtime is provided by **SSE**, not Socket.IO, at:

```
GET /api/v1/events        (text/event-stream)
```

Broadcast event names:

| Event | Fired when |
| --- | --- |
| `connected` | Client connects (initial ping) |
| `product:created` | Product created |
| `product:updated` | Product updated |
| `inventory:low` | Stock drops to/below the low-stock threshold |
| `inventory:updated` | Stock changed (manual adjustment or order) |
| `order:created` | New order placed |
| `order:status_changed` | Admin changes order status |
| `notification:new` | New admin/customer notification |

Client behaviour and hosting notes:

- The browser client uses `EventSource` for `/api/v1/events`. `EventSource`
  **auto-reconnects** if the connection drops, so brief proxy timeouts are
  tolerated.
- **Realtime is an enhancement, not the source of truth.** The UI also loads
  data over plain REST calls (`/api/v1/products`, `/api/v1/orders/...`), and
  order tracking performs an on-demand `GET /api/v1/orders/:id`. If SSE is
  blocked entirely, the app stays fully functional — it just doesn't update
  live. Users can refresh to see current data.
- SSE is ordinary long-lived HTTP, so it generally passes where WebSockets are
  unreliable, but you must:
  - disable proxy response buffering for `/api/v1/events`
    (Nginx: `proxy_buffering off;`),
  - raise proxy read timeouts (Nginx: `proxy_read_timeout 3600s;`), and
  - confirm the host allows long-lived connections. If it does not, clients
    silently fall back to REST refresh — no action needed, but realtime will be
    absent.

---

## 9. Image storage (Cloudinary)

Product images can be stored on Cloudinary's CDN. Configuration and the full
endpoint reference live in [cloudinary-setup.md](./cloudinary-setup.md).

- Without credentials the server runs in **demo mode**: uploads are accepted
  but not persisted to a CDN, and the admin dashboard shows
  `Cloudinary: Demo Mode`.
- Check the live status at `GET /api/v1/upload/status`.
- Set either `CLOUDINARY_URL` **or** the three `CLOUDINARY_*` keys, then restart.

---

## 10. Telegram Mini App

Publishing the Mini App (BotFather menu button, HTTPS requirement, `initData`
signature validation) is covered in
[telegram-mini-app-deployment.md](./telegram-mini-app-deployment.md).

---

## 11. HTTPS

- **HTTPS is mandatory for the Telegram Mini App** and strongly recommended
  everywhere. Telegram refuses to open `http://` Mini App URLs.
- Terminate TLS at the host's certificate layer, at a reverse proxy (Nginx /
  Caddy / the shared host's "Force HTTPS" toggle), or by using a managed
  platform that provisions certificates automatically.
- After enabling HTTPS, set `CLIENT_URL` to the `https://` origin and re-check
  that the Mini App loads.
- Redirect all `http://` traffic to `https://` at the edge.

---

## 12. Backups

Backup, restore, and verification procedures — including the reminder not to
rely solely on the host's backups — are in [backups.md](./backups.md).

> Note: with the current in-memory store (§6.1) there is no durable database
> content to back up. Set up MySQL backups as soon as persistence is enabled.

---

## 13. Health check and post-deploy verification

### 13.1 Health check

```
GET /api/v1/health
→ { "status": "ok", "app": "Tsion Baltina", "version": "1.0.0", "timestamp": "..." }
```

Wire this into your uptime monitor / load balancer.

### 13.2 Smoke-test checklist

Run through this after every deploy:

- [ ] `GET /api/v1/health` returns `status: "ok"`.
- [ ] The storefront loads over HTTPS and the catalog renders.
- [ ] `GET /api/v1/categories` and `GET /api/v1/products` return data.
- [ ] Placing a test order via checkout succeeds and returns an `AB-...` id.
- [ ] Re-submitting the same order with the same `idempotency_key` does **not**
      create a duplicate.
- [ ] Ordering more than available stock is rejected with an `OUT_OF_STOCK`
      style error (server-authoritative inventory).
- [ ] `GET /api/v1/orders/:id` returns the tracked order.
- [ ] The admin dashboard loads stats, orders, and inventory.
- [ ] An admin status change appears on a customer view (SSE), or after a manual
      refresh if SSE is blocked on the host.
- [ ] `GET /api/v1/upload/status` reports the expected Cloudinary mode.
- [ ] (If applicable) the Telegram Mini App opens and authentication returns a
      user.
- [ ] Static assets and `manifest.json` load; the app is installable as a PWA.
- [ ] The process restarts cleanly (verify your process manager restarts it).

---

## 14. Security hardening checklist

The current application ships with the commerce/validation logic
(server-authoritative pricing, atomic stock checks, idempotency, Zod input
validation, Telegram HMAC validation), but the following are **not yet in
place** and should be addressed before handling public production traffic:

- [ ] **Authentication/authorization on admin endpoints.** Admin routes
      (`/api/v1/admin/*`, order status changes, inventory adjustments, product
      create/update, image upload/delete) are currently **unauthenticated and
      open**. Put real auth (and an admin role check) in front of them, or
      restrict access at the network layer.
- [ ] **CORS is wide open** (`cors()` with no origin restriction). Restrict it
      to `CLIENT_URL` once configured.
- [ ] **No rate limiting.** Add rate limiting, especially for order creation,
      Telegram auth, and uploads.
- [ ] **No security headers.** Add `helmet` (or configure equivalent headers at
      the proxy).
- [ ] **Upload size.** JSON body limit is 15 MB and uploads are
      unauthenticated; cap size and require auth for `/api/v1/upload`.
- [ ] **Secrets.** Keep `.env` out of version control and out of `dist`; inject
      secrets via the host.
- [ ] **Error messages.** Keep production error responses free of stack traces
      and internal details.
- [ ] **TLS.** Enforce HTTPS and HSTS at the edge.
- [ ] **Dependency audit.** Run `npm audit` on each release.

---

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Server starts but the page is blank / 404 at `/` | Production mode without a build | Run `npm run build` so `./dist` exists, then restart. |
| `Error: Cannot find module 'vite'` or `'tsx'` | Installed with `--omit=dev` | Reinstall with dev deps, or promote `tsx`/`vite` to `dependencies`. |
| `'NODE_ENV' is not recognized as an internal or external command` | Windows `cmd` and a POSIX `npm start` script | Use PowerShell/`set`, or a Linux host. |
| Env vars seem ignored | `.env` is not auto-loaded | Export vars or start with `node --env-file=.env`. |
| Data/orders disappear after restart | In-memory store (§6.1) | Expected until the MySQL persistence layer is implemented. |
| `EventSource` errors in the browser console | SSE blocked or buffered by the host/proxy | Disable proxy buffering for `/api/v1/events`, raise read timeouts; otherwise rely on REST refresh. |
| Cloudinary uploads not persisted | Missing credentials (demo mode) | Set `CLOUDINARY_URL` or the three keys and restart; verify `/api/v1/upload/status`. |
| Telegram Mini App won't open | URL is not HTTPS | Serve over HTTPS and set the Mini App URL in BotFather. |
| Telegram auth rejects with `Invalid Telegram signature` | Wrong `TELEGRAM_BOT_TOKEN` | Use the token of the bot that owns the Mini App. |

---

## 16. Deployment checklist (condensed)

- [ ] Node 20/22 available on the host.
- [ ] `npm install` (with dev dependencies).
- [ ] `npm run lint` passes.
- [ ] `npm run build` produced `./dist`.
- [ ] Environment variables set on the host (not just in `.env`).
- [ ] Single Node process running `server.ts` with `NODE_ENV=production`.
- [ ] HTTPS enabled and HTTP redirected.
- [ ] Health check green; smoke test (§13.2) passed.
- [ ] Security hardening items in §14 reviewed.
- [ ] Backups scheduled once persistence is enabled.
