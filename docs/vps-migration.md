# VPS Migration

This guide explains how to move Tsion Baltina from shared hosting to a **VPS**
(Virtual Private Server) and how to introduce the infrastructure the design
explicitly leaves room for — without rewriting the core business logic.

Prerequisites and shared concepts are in [deployment.md](./deployment.md).

The migration is intended to be **infrastructure-first**: the same `server.ts`,
the same REST/SSE API, and the same `dist/` build are reused. What changes is
how the process is supervised, proxied, scaled, and persisted.

---

## 1. What improves on a VPS

| Concern | Shared hosting | VPS |
| --- | --- | --- |
| Shell / root | No | Yes |
| Process manager | Panel-managed | `systemd` or `PM2` |
| Reverse proxy | Provider's | Nginx / Caddy (you control buffering, timeouts) |
| Realtime (SSE) | May be capped | Full control; long-lived connections fine |
| Background workers / queues | Not available | Available |
| Caching / Redis | Not available | Available |
| CI/CD | Rare | GitHub Actions / GitLab CI |
| Docker | Not available | Available |
| Scaling | Single app | Multiple app instances (once persistence lands) |

None of these changes require touching the commerce, inventory, idempotency, or
validation code.

---

## 2. Target architecture

```
                    Internet
                       │  HTTPS (443)
                       ▼
              ┌───────────────────┐
              │   Nginx (TLS)     │  ← terminates TLS, serves /assets, proxies
              └─────────┬─────────┘
                        │  127.0.0.1:3000
                        ▼
              ┌───────────────────┐
              │ Tsion Baltina     │  ← Node process (systemd or PM2)
              │ server.ts         │
              └─────────┬─────────┘
                  │           │
                  ▼           ▼
            MySQL 8.0    Cloudinary CDN
          (persistence)   (images)

      optional, later: Redis (cache/sessions/queue), worker processes
```

---

## 3. Provision the server

Assumptions: Ubuntu 22.04/24.04 (Debian-family commands shown; adapt for others),
a sudo-capable user, and a domain pointed at the server's IP.

```bash
# Base packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx mysql-server

# Node.js 22 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # expect v22.x
```

Open the firewall for HTTP/HTTPS (and SSH):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 4. Obtain the code and build

```bash
sudo mkdir -p /var/www/addis-baltina
sudo chown "$USER":"$USER" /var/www/addis-baltina

git clone <your-repo-url> /var/www/addis-baltina
cd /var/www/addis-baltina

npm ci             # dev deps needed once, to lint + build
npm run lint
npm run build      # → ./dist (front end) + ./dist-server (server bundle)
npm ci --omit=dev  # optional: prune dev deps; runtime only needs production deps
```

> To skip installing dev dependencies on the server, build locally instead and
> upload `./dist` + `./dist-server`. See
> [deployment.md §4.3](./deployment.md#43-important-buildruntime-caveats).

---

## 5. Configure environment variables

Create an env file readable only by the app user, outside the repo or gitignored:

```bash
sudo mkdir -p /etc/addis-baltina
sudo tee /etc/addis-baltina/addis-baltina.env >/dev/null <<'EOF'
NODE_ENV=production
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=addis_baltina
DB_USER=addis_app
DB_PASSWORD=change-me

CLIENT_URL=https://shop.example.com
SESSION_SECRET=change-me-to-a-long-random-string

TELEGRAM_BOT_TOKEN=

CLOUDINARY_URL=
EOF

sudo chmod 600 /etc/addis-baltina/addis-baltina.env
```

See [deployment.md §3](./deployment.md#3-environment-variables) for which
variables the code currently reads versus which are reserved.

---

## 6. MySQL setup

```bash
sudo mysql
```

```sql
CREATE DATABASE IF NOT EXISTS addis_baltina
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'addis_app'@'localhost' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON addis_baltina.* TO 'addis_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Import the schema:

```bash
sudo mysql addis_baltina < /var/www/addis-baltina/database/schema.sql
```

Harden MySQL basics:

```bash
sudo mysql_secure_installation
```

> **Persistence status:** the current runtime uses an in-memory store
> ([deployment.md §6.1](./deployment.md#6-database)). MySQL is provisioned here
> so that enabling the persistence layer is a code change, not an infrastructure
> change. Until then, a restart resets order/inventory data.

---

## 7. Run the app under systemd (recommended)

Create `/etc/systemd/system/addis-baltina.service`:

```ini
[Unit]
Description=Tsion Baltina (Node.js + Express + SSE)
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/addis-baltina
EnvironmentFile=/etc/addis-baltina/addis-baltina.env
ExecStart=/usr/bin/node scripts/start.mjs
Restart=always
RestartSec=5
# Sensible hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Make sure the service user can read the project and write anything it needs:

```bash
sudo chown -R www-data:www-data /var/www/addis-baltina
sudo systemctl daemon-reload
sudo systemctl enable --now addis-baltina
sudo systemctl status addis-baltina
journalctl -u addis-baltina -f      # live logs
```

> `EnvironmentFile` is how the variables from §5 reach the process. The app does
> **not** read `.env` on its own; systemd injecting them is the clean approach.

### Alternative: PM2

If you prefer PM2:

```bash
sudo npm install -g pm2

# Load env vars into the shell/PM2, then start
set -a; . /etc/addis-baltina/addis-baltina.env; set +a
pm2 start scripts/start.mjs --name addis-baltina --time

pm2 save
pm2 startup systemd     # follow the printed instructions
```

PM2 gives zero-downtime reloads (`pm2 reload`), log rotation, and basic
monitoring.

---

## 8. Nginx reverse proxy + TLS

Create `/etc/nginx/sites-available/addis-baltina`:

```nginx
server {
    listen 80;
    server_name shop.example.com;
    # For TLS, prefer redirecting to HTTPS once certs exist:
    # return 301 https://$host$request_uri;

    client_max_body_size 20m;   # matches the app's 15MB JSON limit + headroom

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Server-Sent Events: disable buffering and allow long-lived connections
    location /api/v1/events {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        chunked_transfer_encoding off;
    }
}
```

Enable it and reload:

```bash
sudo ln -s /etc/nginx/sites-available/addis-baltina /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Add TLS with Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d shop.example.com
sudo systemctl status certbot.timer   # auto-renewal
```

Certbot rewrites the server block for HTTPS and adds the HTTP→HTTPS redirect.
Then set `CLIENT_URL=https://shop.example.com` in the env file and restart the
service. HTTPS is required for the Telegram Mini App — see
[telegram-mini-app-deployment.md](./telegram-mini-app-deployment.md).

---

## 9. Optional: Docker and Docker Compose

Docker makes the VPS deployment reproducible. It is **optional** for V1 and is
not required by the shared-hosting target.

Example `Dockerfile` (multi-stage: build with dev deps, run with production
deps only):

```dockerfile
# Multi-stage build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build        # → ./dist (front end) + ./dist-server (server bundle)

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY scripts/start.mjs ./scripts/start.mjs
EXPOSE 3000
CMD ["npm", "start"]     # = node scripts/start.mjs → dist-server/server.js
```

Example `docker-compose.yml` (app + MySQL; add Redis later if desired):

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - /etc/addis-baltina/addis-baltina.env
    depends_on:
      - db

  db:
    image: mysql:8.0
    restart: unless-stopped
    command: --default-authentication-plugin=mysql_native_password
    environment:
      MYSQL_DATABASE: addis_baltina
      MYSQL_USER: addis_app
      MYSQL_PASSWORD: change-me
      MYSQL_ROOT_PASSWORD: change-root-me
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql:ro

volumes:
  mysql_data:
```

Build and run:

```bash
docker compose up -d --build
docker compose logs -f app
```

Put Nginx (§8) in front of the container's published port. Point
`DB_HOST` at the compose service name (`db`) instead of `127.0.0.1`.

---

## 10. Optional: Redis, workers, queues

The spec allows these later; none are required now, and Redis is **not** a
dependency of the current code.

When you need them:

- **Caching / sessions** — add Redis and a small cache layer in front of the
  repository. Because the store abstraction already exists (`src/server/db.ts`),
  Redis can sit beside it without changing route handlers.
- **Background workers** — order notifications (e.g. Telegram messages) are a
  natural first job. Introduce a queue and a worker process; keep the HTTP
  request path non-blocking.
- **Rate limiting / sessions** — Redis-backed `express-rate-limit` and session
  stores scale horizontally, unlike the in-process approach.

Keep the rule from the spec: the **core business logic stays independent of
infrastructure**, so none of this leaks into the commerce modules.

---

## 11. Optional: CI/CD

A minimal pipeline (GitHub Actions example):

```yaml
name: deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      # Copy build + source to the server, then reload the service.
      # Use SSH keys stored as repository secrets.
      - name: Deploy over SSH
        run: |
          rsync -az --delete dist/ deploy@shop.example.com:/var/www/addis-baltina/dist/
          ssh deploy@shop.example.com 'cd /var/www/addis-baltina && npm ci && sudo systemctl restart addis-baltina'
```

Store `TELEGRAM_BOT_TOKEN`, `CLOUDINARY_*`, `SESSION_SECRET`, and DB credentials
as **repository/host secrets** — never in the repository.

---

## 12. Scaling checklist (only after persistence lands)

Do these in order; several are unsafe while the store is in-memory:

1. **Implement the MySQL persistence layer** against `database/schema.sql`,
   preserving the atomic stock decrement and idempotency-key uniqueness already
   enforced logically.
2. **Move SSE fan-out off the process.** With multiple app instances, each
   instance only knows its own SSE clients. Use Redis pub/sub (or a message
   broker) to broadcast `order:created`, `inventory:updated`, etc. to all
   instances.
3. **Run multiple instances** behind Nginx `upstream` (or PM2 cluster) once
   broadcasting is shared.
4. **Add rate limiting and shared sessions** via Redis.
5. **Add monitoring** — health check (`/api/v1/health`) probes, log aggregation,
   and metrics.

Until step 1, keep a **single app process**; multiple processes against the
in-memory store will diverge.

---

## 13. Rollback and maintenance

- **Rollback**: keep the previous release (e.g. `releases/2026-xx-xx/` with a
  `current` symlink) and restart the service pointing at it. With PM2,
  `pm2 reload` a previous process.
- **Maintenance window**: stop the service (`systemctl stop addis-baltina`),
  import migrations, restart.
- **Backups**: see [backups.md](./backups.md) — automate MySQL dumps and verify
  restores; do not rely on snapshots alone.
- **Logs**: `journalctl -u addis-baltina` (systemd) or `pm2 logs`.

---

## 14. Post-migration verification

Re-run the full smoke test from
[deployment.md §13.2](./deployment.md#132-smoke-test-checklist), plus:

- [ ] `curl -I https://shop.example.com/api/v1/health` returns `200`.
- [ ] HTTP requests redirect to HTTPS.
- [ ] `curl -N https://shop.example.com/api/v1/events` streams the `connected`
      event and stays open (SSE works end to end through Nginx).
- [ ] The service restarts automatically (`sudo reboot` or
      `systemctl restart`) and comes back healthy.
- [ ] `certbot renew --dry-run` succeeds (TLS auto-renewal).
- [ ] The Telegram Mini App opens against the new HTTPS URL.
- [ ] Cloudinary status matches production credentials.

---

## 15. What did **not** change

For reassurance, migrating from shared hosting to a VPS touched only:
environment variables, the process supervisor, the reverse proxy/TLS, and the
database host. The following are unchanged and portable:

- all API routes and request/response shapes,
- the inventory/overselling, idempotency, and validation logic,
- the SSE event contract,
- the built front end in `dist/`.

That is the point of the architecture: **infrastructure configuration, not a
rewrite.**
