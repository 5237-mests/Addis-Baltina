/**
 * Cross-platform production entry point — plain Node, no `tsx`.
 *
 * The previous entry (`tsx scripts/start.ts`) compiled TypeScript at runtime.
 * `tsx` instantiates a WebAssembly module lexer on startup, and on LVE-limited
 * shared hosting (cPanel / CloudLinux) that allocation is rejected:
 *
 *   RangeError: WebAssembly.instantiate(): Out of memory:
 *   Cannot allocate Wasm memory for new instance
 *
 * The process then dies before serving a single request. Production therefore
 * runs the pre-compiled server bundle produced by `npm run build:server`
 * (esbuild) — no transpiler, no WebAssembly, lower memory and faster start.
 * `tsx` remains the dev-only runner (`npm run dev`).
 *
 * A NODE_ENV that is already set by the environment (or loaded from `.env` by
 * `src/server/env.ts`) still wins.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV ||= 'production';

const bundleUrl = new URL('../dist-server/server.js', import.meta.url);
if (!existsSync(fileURLToPath(bundleUrl))) {
  console.error(
    '[start] dist-server/server.js not found. Run `npm run build` (or `npm run build:server`) first.'
  );
  process.exit(1);
}

await import(bundleUrl.href);
