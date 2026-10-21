# Shared Hosting Deployment

This guide covers deploying Tsion Baltina to **ordinary shared hosting**
(cPanel, Plesk, DirectAdmin, or similar) where you have:

- MySQL + phpMyAdmin,
- a web server you configure through a control panel,
- **limited or no root access**,
- **limited Node.js support** (usually via a "Setup Node.js App" /
  "Node.js Selector" feature), and
- possibly unreliable WebSocket support.

For the general build/env concepts, read [deployment.md](./deployment.md) first.

---

## 1. Reality check: which shared-hosting case are you in?

Tsion Baltina is a **single Node process serving both the API and the built
SPA**. Shared hosting falls into two categories:

| Case | Host capability | What to do |
| --- | --- | --- |
| **A — Node.js supported** | Control panel offers "Setup Node.js App" / Node.js Selector (Phusion Passenger or LiteSpeed) | Use §3–§9. This is the supported path. |
| **B — No Node.js at all** | PHP-only, no Node runtime | You **cannot** run the current server here. You must either upgrade to a host with Node.js support, or separate the front end (static) from the API (Node) on a small VPS/PaaS. See §10. |

> Tsion Baltina is intentionally **free of Docker, Redis, an ORM, and root-level
> services**, so it fits Case A well. It does, however, absolutely require a
> Node.js runtime — verify this before paying for a plan.

---

## 2. Host requirements checklist

Confirm with your provider before starting:

- [ ] Node.js **20 LTS or 22 LTS** selectable for your app.
- [ ] Ability to run a custom startup command (or a Passenger startup file).
- [ ] Ability to set **environment variables** for the Node app.
- [ ] At least one MySQL 8.0 database + `phpMyAdmin`.
- [ ] HTTPS available (free AutoSSL / Let's Encrypt is typical).
- [ ] Ability to write the built `dist/` folder and `node_modules/`.
- [ ] (Preferred) long-lived HTTP connections allowed for SSE — see §8.
- [ ] (Optional) outgoing HTTPS allowed, for Cloudinary and Telegram API calls.

---

## 3. Prepare the application locally

Build on your machine, then upload the result. Building on the host is often
slow and sometimes blocked.

```bash
npm install          # with dev dependencies (vite + esbuild are required to build)
npm run lint         # tsc --noEmit
npm run build        # produces ./dist (front end) + ./dist-server (server bundle)
```

You now have:

```
./dist                 ← built front end (upload this)
./dist-server          ← compiled server bundle (upload this)
package.json           ← upload
package-lock.json      ← upload
public/                ← upload (source of manifest.json, sw.js, favicon.svg)
database/schema.sql    ← keep locally, import via phpMyAdmin
```

`server.ts`, `src/`, and `scripts/` do **not** need to be on the host: in
production the server runs from the compiled `dist-server/server.js` bundle,
which only needs the production `node_modules` (or nothing else, if the host
installs for you).

> **Why not run TypeScript with `tsx` on the host?** Earlier versions of this
> guide ran `tsx server.ts` at runtime. `tsx` instantiates a **WebAssembly**
> module lexer on startup, and on CloudLinux/LVE-limited shared hosting that
> allocation is rejected — the process dies before serving anything:
>
> ```
> RangeError: WebAssembly.instantiate(): Out of memory:
> Cannot allocate Wasm memory for new instance
> ```
>
> The compiled bundle (`npm run build:server`, plain esbuild output) contains
> no transpiler and no WebAssembly, so it starts fine inside LVE limits — and
> starts faster with a fraction of the memory.

Do **not** upload your local `.env`; configure secrets in the panel (§6).

> **Do not exclude `node_modules` if the host cannot run `npm install`.** If it
> can run `npm install` (most Node selectors can), skip uploading
> `node_modules` and install on the host instead — only production
> dependencies are needed at runtime now. Uploading `node_modules` from
> Windows to Linux can ship platform-specific binaries — prefer hosting-side
> install when available.

---

## 4. Create the domain / subdomain and document root

1. In cPanel, open **Domains → Create A New Domain** (or Subdomains).
2. Create e.g. `shop.example.com`.
3. Set or note the **document root**. With Node.js Selector the app usually
   lives in a folder *above* `public_html` (e.g. `~/addis-baltina`), and the web
   server proxies to it. Follow your panel's convention.
4. Ensure a valid TLS certificate is issued (AutoSSL usually runs
   automatically).

---

## 5. Upload the project

Options, best first:

1. **Git** — if the panel has "Git™ Version Control", clone your repository into
   the app directory, then install/build via the panel's terminal or a task.
2. **File Manager upload** — zip the project locally (excluding `.env`,
   `.git`, and optionally `node_modules`/`dist`) and upload + extract.
3. **SFTP** — upload the folder tree with an SFTP client.

After upload, the app directory should contain `package.json`, `dist/`, and
`dist-server/` (built locally per §3).

---

## 6. Configure environment variables

In the panel's **Setup Node.js App** screen, use the **Environment Variables**
section (labels vary: "Environment Variables", "Passenger Environment", or
"Application Environment"). Add at minimum:

```text
NODE_ENV=production
PORT=3000                 # leave as the value the panel expects/assigns
```

Add these when the features are enabled:

```text
TELEGRAM_BOT_TOKEN=<token from BotFather>
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
# — or the three separate keys —
CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>
```

Reserved for the future persistence layer (the current runtime uses the
in-memory store; see [deployment.md §6](./deployment.md#6-database)):

```text
DB_HOST=localhost
DB_PORT=3306
DB_NAME=<cpanel_db_name>
DB_USER=<cpanel_db_user>
DB_PASSWORD=<password>
CLIENT_URL=https://shop.example.com
SESSION_SECRET=<long-random-string>
```

> The app does **not** load a `.env` file automatically. On a Node.js Selector
> host, the panel injects variables into the process environment — that works.
> If your host cannot set env vars, you can instead run the app with Node's
> `--env-file` flag (§7) against an uploaded `.env` kept outside the web root.

---

## 7. Choose a start command / startup file

Use whichever your panel supports. All options run the same compiled bundle —
plain `node` on `dist-server/server.js`, with `NODE_ENV=production` as the
default. (The old `tsx server.ts` flow is gone: `tsx` loads a WebAssembly
lexer that LVE-limited hosts reject with
`RangeError: WebAssembly.instantiate(): Out of memory` — see §3.)

### Option A — Custom start command

If the Node.js selector lets you define the startup command:

```bash
npm start
```

or, on Node 20.6+ with an `.env` file outside the web root:

```bash
node --env-file=/home/USER/.env scripts/start.mjs
```

### Option B — Passenger startup file

Some panels require a JavaScript startup file instead of a command (the
panel runs it with Node). Set the panel's **Application startup file** to:

```text
scripts/start.mjs
```

It is plain JavaScript (no TypeScript, no loader hooks): it defaults
`NODE_ENV` to `production` and imports the compiled server bundle. If your
panel insists the startup file sits in the app root, create **`app.mjs`**:

```js
// app.mjs — Passenger startup shim for Tsion Baltina
process.env.NODE_ENV ||= 'production';
await import('./dist-server/server.js');
```

### Option C — Panel runs `npm start`

Some panels have a "Run NPM script" / "Start command" field. Use:

```bash
npm start
```

`npm start` is `node scripts/start.mjs`, which works on Linux, macOS, and
Windows alike (no POSIX-only `NODE_ENV=...` prefix involved).

**In all cases, the process must listen so the web server can proxy to it.**
The server binds `0.0.0.0:$PORT`; set `PORT` to whatever the panel assigns
(often shown in the Node.js selector screen).

---

## 8. Realtime (SSE) on shared hosting

Realtime uses Server-Sent Events at `GET /api/v1/events` (see
[deployment.md §8](./deployment.md#8-realtime-server-sent-events)).

Shared hosting is the environment most likely to interfere:

- Long-lived requests may be killed by an idle timeout (commonly 30–120s).
  Browsers then reconnect automatically, so you may see periodic drops.
- Some proxies buffer responses, which delays events; if the panel exposes
  proxy settings, disable buffering for `/api/v1/events`.
- If long-lived connections are disallowed entirely, **the app still works**:
  the UI is REST-driven and users can refresh. Realtime simply won't be live.

**No separate polling fallback process is required** — the client tolerates a
missing SSE stream and relies on normal REST requests.

---

## 9. MySQL and schema import

Even though the live runtime is currently in-memory
([§6.1](./deployment.md#6-database)), set the database up now so the
persistence migration is drop-in.

1. cPanel → **MySQL® Databases**:
   - Create a database (cPanel prefixes it, e.g. `cpuser_addis_baltina`).
   - Create a user and a strong password; add the user to the database with
     **ALL PRIVILEGES**.
2. cPanel → **phpMyAdmin**:
   - Select the database.
   - Open the **Import** tab.
   - Upload `database/schema.sql`.
   - Run the import and confirm all tables are created
     (`categories`, `products`, `orders`, `order_items`,
     `inventory_transactions`, `notifications`, `audit_logs`, and the rest).
3. Record host/user/name/password into the env vars from §6
   (`DB_*`) for when persistence is enabled.
4. `schema.sql` begins with `CREATE DATABASE IF NOT EXISTS addis_baltina`, which
   may fail on a cPanel account (you already created a prefixed database).
   If so, edit the file to remove the `CREATE DATABASE` and `USE` lines before
   importing, or ignore that specific error and confirm the tables imported.

---

## 10. Case B: no Node.js on the host

If your host is PHP-only, the current single-process app cannot run there.
Reasonable options:

- **Move to a host with Node.js support** (still cheap shared hosting) — the
  least work and what this project targets.
- **Split the deployment**: host the static `dist/` output on the PHP host (or
  any static host/CDN) and run the API on a small VPS or managed Node host.
  This requires pointing the front end at the API origin and enabling CORS for
  that origin — a code/configuration change, not just hosting configuration.
  Prefer [vps-migration.md](./vps-migration.md) if you go this route.

Do not attempt to "convert" the Express server to PHP; that would be a rewrite
of the core architecture and is out of scope.

---

## 11. HTTPS and Telegram

- Enable AutoSSL / Let's Encrypt so the site is served over `https://`, and
  turn on "Force HTTPS Redirect" in the panel.
- Then set `CLIENT_URL` to the `https://` origin.
- Publish the Mini App using
  [telegram-mini-app-deployment.md](./telegram-mini-app-deployment.md). Telegram
  requires HTTPS.

---

## 12. Verify the deployment

Use the smoke-test checklist in
[deployment.md §13.2](./deployment.md#132-smoke-test-checklist). Additionally,
on shared hosting confirm:

- [ ] The Node app shows as **running** in the panel (not crashed/stopped).
- [ ] The panel's error/access logs show no startup exceptions.
- [ ] `https://shop.example.com/api/v1/health` returns `status: "ok"`.
- [ ] `https://shop.example.com/` loads the SPA, and deep links work (SPA
      fallback to `index.html`).
- [ ] `manifest.json` and `sw.js` are served (PWA).
- [ ] Check `https://shop.example.com/api/v1/upload/status` for the expected
      Cloudinary mode.
- [ ] Watch the browser console for repeated `EventSource` errors — if present,
      realtime is blocked on this host (acceptable; app still functions).

---

## 13. Operations on shared hosting

- **Restart** after changing env vars or uploading a new build (panel "Restart"
  button).
- **Update**: rebuild locally (`npm run build`), upload the new `dist/` +
  `dist-server/`, then restart.
- **Logs**: rely on the panel's Node app log + the app's own stdout
  (`[API] METHOD /path` request logging is built in).
- **Backups**: follow [backups.md](./backups.md); do not assume the host's
  backups are sufficient.
- **Remember the in-memory store**: every restart resets orders/inventory until
  the MySQL persistence layer is implemented.

---

## 14. Known limitations on shared hosting

1. **No durable data yet** — the runtime uses the in-memory store
   ([deployment.md §6.1](./deployment.md#6-database)).
2. **Build before deploy** — the server runs from the compiled
   `dist-server/server.js` bundle, not from TypeScript sources. Rebuild
   locally (`npm run build`) whenever server code changes and upload the new
   bundle. No dev dependencies are needed on the host.
3. **Realtime may be degraded** — SSE can be capped by idle timeouts; the app
   degrades gracefully to REST refresh.
4. **Single process** — do not run multiple workers against the in-memory
   store; they will diverge.
5. **Admin endpoints are unauthenticated** in the current build — review
   [deployment.md §14](./deployment.md#14-security-hardening-checklist).
