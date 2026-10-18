#!/usr/bin/env node
/**
 * Lightweight MySQL migration runner (P3 scaffolding).
 *
 * Usage: node database/migrate.mjs [--up|--list] [--host ...] [--port ...]
 *
 * Requires: mysql2 (not installed yet). This is a scaffold script for when
 * MySQL persistence lands (P0). It reads files from database/migrations/ in
 * numeric order and tracks applied migrations in a `schema_migrations` table.
 */
import { createPool } from 'mysql2/promise';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { action: 'up', host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'addis_baltina' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--list') opts.action = 'list';
    else if (a === '--up') opts.action = 'up';
    else if (a === '--host' && args[i + 1]) { opts.host = args[++i]; }
    else if (a === '--port' && args[i + 1]) { opts.port = Number(args[++i]); }
    else if (a === '--user' && args[i + 1]) { opts.user = args[++i]; }
    else if (a === '--password' && args[i + 1]) { opts.password = args[++i]; }
    else if (a === '--db' && args[i + 1]) { opts.database = args[++i]; }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  try {
    const pool = createPool({ host: opts.host, port: opts.port, user: opts.user, password: opts.password, database: opts.database, multipleStatements: true });
    const conn = await pool.getConnection();
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      const dir = join(process.cwd(), 'database', 'migrations');
      const files = (await readdir(dir)).filter(f => f.endsWith('.sql') && /^\d+_/.test(f)).sort();
      if (opts.action === 'list') {
        const [rows] = await conn.query('SELECT version, applied_at FROM schema_migrations ORDER BY version');
        console.log('Applied:', rows);
        console.log('Available:', files);
        return;
      }
      for (const f of files) {
        const [exists] = await conn.query('SELECT 1 FROM schema_migrations WHERE version = ?', [f]);
        if (exists.length) continue;
        const sql = await readFile(join(dir, f), 'utf8');
        console.log('Applying', f);
        await conn.query(sql);
        await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [f]);
      }
      console.log('Migrations complete');
    } finally {
      conn.release();
    }
    await pool.end();
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

main();
