/**
 * Loads a `.env` file into `process.env` using Node's built-in loader — no
 * `dotenv` dependency. This module must be imported BEFORE any module that
 * reads configuration at load time (e.g. Cloudinary config), so it is the
 * first import in `server.ts`.
 *
 * Behaviour:
 * - Variables already present in the process environment always win (so a
 *   hosting panel's variables take precedence over a stray .env file).
 * - A missing .env file is not an error; the real environment is used.
 *
 * Requires Node >= 20.12 / 21.7 (`process.loadEnvFile`). On older runtimes the
 * call is skipped and environment variables must be provided directly.
 */
try {
  const loadEnvFile = (process as NodeJS.Process & {
    loadEnvFile?: (path?: string) => void;
  }).loadEnvFile;
  loadEnvFile?.();
} catch {
  // No .env file present — rely entirely on the process environment.
}
