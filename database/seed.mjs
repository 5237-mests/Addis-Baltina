#!/usr/bin/env node
/**
 * Lightweight MySQL seeding runner (P3 scaffolding).
 *
 * Usage: node database/seed.mjs [--all|--file name.sql] [--host ...]
 *
 * Requires: mysql2 (not installed yet). Safe by default; seeds should be
 * idempotent (INSERT IGNORE / ON DUPLICATE KEY UPDATE).
 */
import { createPool } from 'mysql2/promise';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { action: 'all', file: undefined, host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'addis_baltina' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--all') opts.action = 'all';
    else if (a === '--file' && args[i + 1]) { opts.action = 'file'; opts.file = args[++i]; }
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
      const dir = join(process.cwd(), 'database', 'seeds');
      if (opts.action === 'file' && opts.file) {
        const sql = await readFile(join(dir, opts.file), 'utf8');
        console.log('Seeding', opts.file);
        await conn.query(sql);
        console.log('Done');
        return;
      }
      const files = (await readdir(dir)).filter(f => f.endsWith('.sql') && /^\d+_/.test(f)).sort();
      for (const f of files) {
        const sql = await readFile(join(dir, f), 'utf8');
        console.log('Seeding', f);
        await conn.query(sql);
      }
      console.log('Seeding complete');
    } finally {
      conn.release();
    }
    await pool.end();
  } catch (e) {
    console.error('Seeding failed:', e);
    process.exit(1);
  }
}

main();
