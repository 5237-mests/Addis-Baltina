# Backups and Restore

Tsion Baltina's business data ultimately lives in **MySQL** (schema at
[`database/schema.sql`](../database/schema.sql)). This document covers how to
back that data up, restore it, verify the backups, and how often to do each.

> ⚠️ **Do not assume your hosting provider's backups are sufficient.** Provider
> backups are a safety net, not a strategy. Keep your own independent, tested
> copies.
>
> ⚠️ **Current status:** the running server uses an **in-memory** store
> ([deployment.md §6.1](./deployment.md#6-database)), so today there is no
> durable database content to lose on restart. Set up and rehearse the MySQL
> procedures below **now**, so they are ready the moment persistence is enabled.

---

## 1. What to back up

| Item | Why | Where |
| --- | --- | --- |
| MySQL database (`addis_baltina`) | Orders, inventory, products, audit logs — the business record | Database server |
| Application code | To reproduce/deploy a known-good version | Git repository (primary) |
| Environment/config | Secrets and connection settings | Secret store / secure offline copy |
| Uploaded media | If not on Cloudinary | Cloudinary (if used) or the host's uploads dir |
| Nginx / systemd / panel config | To rebuild the server | Version control or offline copy |

Image assets are on Cloudinary when configured
([cloudinary-setup.md](./cloudinary-setup.md)); Cloudinary itself retains
assets, but keep your own copies of originals for critical branding images.

---

## 2. MySQL backup

### 2.1 Logical dump (recommended)

```bash
mysqldump \
  --single-transaction \
  --routines --triggers --events \
  --default-character-set=utf8mb4 \
  -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p \
  "$DB_NAME" | gzip > "addis_baltina_$(date +%F_%H%M).sql.gz"
```

Notes:

- `--single-transaction` gives a consistent snapshot for InnoDB without locking
  tables (safe while the app runs).
- `utf8mb4` is **required** to preserve Amharic and Oromo text correctly.
- Keep the resulting `.sql.gz` **off the database server**.

### 2.2 On shared hosting

- **cPanel → phpMyAdmin → Export**: select the database, choose **Custom**,
  set format **SQL**, enable "Add DROP TABLE", and export.
- Or use **cPanel → Backup / Backup Wizard** if the host offers per-database
  downloads.
- Automate with a cron job if the host provides cron:

  ```bash
  0 2 * * * mysqldump --single-transaction --default-character-set=utf8mb4 -u USER -p'PASS' DBNAME | gzip > ~/backups/addis_baltina_$(date +\%F).sql.gz
  ```

  (Prefer a `~/.my.cnf` credentials file with `chmod 600` over inline
  passwords.)

### 2.3 Physical / snapshot backups

On a VPS you may additionally snapshot the disk or MySQL data directory. These
are fast to restore but tied to the same OS/MySQL version — always keep a
logical dump as well.

---

## 3. Restore

### 3.1 Restore a logical dump

```bash
# Create an empty database if needed
mysql -h "$DB_HOST" -u "$DB_USER" -p -e \
  "CREATE DATABASE IF NOT EXISTS addis_baltina CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Import
gunzip -c addis_baltina_2026-01-31_0200.sql.gz \
  | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME"
```

### 3.2 Restore from the schema only (empty database)

To rebuild structure without data:

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < database/schema.sql
```

(On shared hosting, edit out the `CREATE DATABASE` / `USE` lines first — see
[shared-hosting-deployment.md §9](./shared-hosting-deployment.md#9-mysql-and-schema-import).)

### 3.3 Restore procedure (safe order)

1. Put the app in maintenance mode (stop the Node process, or block writes):
   `sudo systemctl stop addis-baltina`.
2. Take a **fresh backup of the current (possibly broken) database** before
   overwriting it — you may need to extract data from it later.
3. Restore the chosen dump.
4. Run the post-restore checks (§5).
5. Restart the app: `sudo systemctl start addis-baltina`.

---

## 4. Frequency and retention

A suggested starting policy (adjust to order volume and risk):

| Backup | Frequency | Retention |
| --- | --- | --- |
| Full logical dump | Daily (off-peak, e.g. 02:00) | 30 daily |
| Weekly full | Weekly | 12 weekly |
| Monthly archive | Monthly | 12 monthly |
| Pre-deploy snapshot | Before every release/migration | Until the next successful release + 7 days |
| Off-site copy | Every dump | Replicated to a different provider/region |

Keep at least one copy **off-site** (different provider/region) so a single
provider outage or account problem cannot destroy both the live data and the
backups.

---

## 5. Verify backups (do not skip)

A backup you have never restored is not a backup.

- **Weekly automated check**: restore the latest dump into a scratch database
  and confirm it imports without errors.
  ```bash
  gunzip -c latest.sql.gz | mysql -u root -p addis_restore_test
  ```
- **Monthly full drill**: restore into a staging environment, start the app
  against it, and run the smoke test
  ([deployment.md §13.2](./deployment.md#132-smoke-test-checklist)).
- **Row-count sanity check** after import:
  ```sql
  SELECT COUNT(*) FROM orders;
  SELECT COUNT(*) FROM order_items;
  SELECT COUNT(*) FROM products;
  SELECT COUNT(*) FROM inventory_transactions;
  ```
  Compare against expectations from the source database.
- **Encoding check**: confirm Amharic renders, e.g.
  ```sql
  SELECT name_am FROM categories LIMIT 5;
  ```
  Garbled text means the dump was taken or restored with the wrong charset.
- **Alerting**: make the automated check fail loudly (cron email / CI failure /
  monitoring alert) if a restore or row-count check fails.

---

## 6. Pre-migration backups

Before any schema change or the eventual switch from the in-memory store to
MySQL:

1. Take a full dump and verify it restores.
2. Record the current row counts.
3. Apply migrations.
4. Re-check counts and (if applicable) reconcile against the in-memory seed
   data that was live before the switch.

---

## 7. Secrets and configuration

- Back up environment files (`/etc/addis-baltina/addis-baltina.env`, panel env
  vars) to a **secure** location — they contain `TELEGRAM_BOT_TOKEN`,
  Cloudinary secrets, `SESSION_SECRET`, and DB credentials.
- Never store secrets in the Git repository or in the same bucket as public
  assets.
- Rotate secrets after any suspected exposure (new bot token, new Cloudinary
  keys, new DB password).

---

## 8. Quick reference

```bash
# Back up
mysqldump --single-transaction --default-character-set=utf8mb4 \
  -u "$DB_USER" -p "$DB_NAME" | gzip > "addis_baltina_$(date +%F_%H%M).sql.gz"

# Restore
gunzip -c addis_baltina_2026-01-31_0200.sql.gz | mysql -u "$DB_USER" -p "$DB_NAME"

# Verify
mysql -u "$DB_USER" -p addis_restore_test -e "SELECT COUNT(*) FROM orders;"
```
