/**
 * Minimal structured (JSON) logger — no dependency.
 *
 * Every line is a single JSON object: `{ ts, level, msg, ...fields }`. Sensitive
 * field names are redacted before serialization so tokens, passwords, cookies,
 * and authorization headers can never reach the logs. Modules should log
 * identifiers and counts, never request bodies or personal data.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type Fields = Record<string, unknown>;

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|initdata|apikey|api_key/i;
const MAX_DEPTH = 4;

function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(val, depth + 1);
  }
  return out;
}

function write(level: LogLevel, msg: string, fields?: Fields): void {
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(fields ? (redact(fields) as Fields) : {}),
  };

  const text = `${JSON.stringify(line)}\n`;
  if (level === 'error') process.stderr.write(text);
  else process.stdout.write(text);
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(base: Fields): Logger;
}

function make(base: Fields = {}): Logger {
  return {
    debug: (msg, fields) => write('debug', msg, { ...base, ...fields }),
    info: (msg, fields) => write('info', msg, { ...base, ...fields }),
    warn: (msg, fields) => write('warn', msg, { ...base, ...fields }),
    error: (msg, fields) => write('error', msg, { ...base, ...fields }),
    child: (fields) => make({ ...base, ...fields }),
  };
}

export const logger: Logger = make();
