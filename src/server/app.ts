import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import crypto from 'crypto';
import { DatabaseStore, db as defaultDb } from './db';
import { uploadImage, deleteFromCloudinary, getCloudinaryConfigInfo } from './cloudinary';
import { adminLogin, adminLogout, adminSession, requireAdmin } from './auth';
import { checkImageSource } from './imageSource';
import { logger } from './logger';

export interface CreateAppOptions {
  /** Store to serve. Defaults to the shared process-wide store. */
  store?: DatabaseStore;
  /** Production mode toggles strict security headers and CSP. */
  isProduction?: boolean;
  /** `trust proxy` setting; defaults to `1` in production. */
  trustProxy?: number | boolean;
  /** SSE keep-alive interval in ms. Defaults to 25s. */
  sseHeartbeatMs?: number;
}

export interface CreatedApp {
  app: express.Express;
  store: DatabaseStore;
  /** Closes every open SSE connection and stops the heartbeat. */
  closeRealtime: () => void;
}

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
// Domain errors keep their own message (they are intentionally user-facing).
// Unexpected errors are logged in full server-side and reported to the client
// with a generic message + correlation id so internals are never leaked.

function serverError(req: express.Request, res: express.Response, error: unknown): express.Response {
  const correlationId = String(req.headers['x-request-id'] || crypto.randomUUID());
  const detail =
    error instanceof Error ? error.stack || error.message : JSON.stringify(error ?? null);
  logger.error('request_failed', {
    requestId: correlationId,
    method: req.method,
    path: req.path,
    detail,
  });
  return res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      correlationId,
    },
  });
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

const MAX_PAGE_SIZE = 200;

function parsePagination(
  query: express.Request['query'],
  defaultLimit: number
): { limit: number; offset: number } {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE)
      : defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

function paginate<T>(items: T[], limit: number, offset: number) {
  const page = items.slice(offset, offset + limit);
  return {
    items: page,
    pagination: {
      total: items.length,
      limit,
      offset,
      hasMore: offset + page.length < items.length,
    },
  };
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

function configuredOrigins(): string[] {
  return (process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * An origin is allowed when it is explicitly configured via `CLIENT_URL`
 * (comma separated) or when it is the same origin as the request host. The
 * same-origin rule keeps the web app and the Telegram Mini App working even
 * when no cross-origin client is configured.
 */
function isOriginAllowed(origin: string, req: express.Request): boolean {
  const normalized = origin.replace(/\/$/, '');
  if (configuredOrigins().includes(normalized)) return true;
  try {
    const requestHost = req.headers.host;
    return Boolean(requestHost) && new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

function jsonLimiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down and try again shortly.',
      },
    },
  });
}

const orderLimiter = jsonLimiter(60_000, 20);
const telegramAuthLimiter = jsonLimiter(15 * 60_000, 20);
const uploadLimiter = jsonLimiter(15 * 60_000, 30);
const adminLoginLimiter = jsonLimiter(15 * 60_000, 10);

export function createApp(options: CreateAppOptions = {}): CreatedApp {
  const store = options.store ?? defaultDb;
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';
  const sseHeartbeatMs = options.sseHeartbeatMs ?? 25_000;

  const app = express();

  // Behind a reverse proxy, use X-Forwarded-* for req.ip / req.secure.
  const trustProxy = options.trustProxy ?? (isProduction ? 1 : false);
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');

  // --- Security headers -----------------------------------------------------
  // The Telegram Mini App is embedded by Telegram's web client, so CSP
  // `frame-ancestors` (not X-Frame-Options) is the framing policy. HSTS is only
  // emitted over TLS.
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            useDefaults: false,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", 'https://telegram.org'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
            },
          }
        : false,
      // X-Frame-Options cannot express "Telegram' + self"; frame-ancestors does.
      frameguard: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // --- CORS -----------------------------------------------------------------
  // Reject disallowed browser origins outright; allow same-origin requests.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isOriginAllowed(origin, req)) {
      return res.status(403).json({
        success: false,
        error: { code: 'CORS_FORBIDDEN', message: 'Origin not allowed' },
      });
    }
    next();
  });
  app.use(
    cors({
      origin(origin, callback) {
        // `undefined` origin = same-origin or non-browser client.
        callback(null, !origin || configuredOrigins().includes(origin.replace(/\/$/, '')));
      },
      credentials: true,
    })
  );

  // Small JSON body for ordinary API calls; the upload route gets more room for
  // an inline base64 image.
  const jsonDefault = express.json({ limit: '1mb' });
  const jsonUpload = express.json({ limit: '10mb' });
  app.use((req, res, next) =>
    (req.path === '/api/v1/upload' ? jsonUpload : jsonDefault)(req, res, next)
  );
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Correlation id + structured request logging. The id is echoed to the client
  // (X-Request-Id) and included in 500 responses so a user report can be tied to
  // a server log line. Request bodies and query strings are never logged.
  app.use((req, res, next) => {
    const incoming = req.headers['x-request-id'];
    const requestId = (
      typeof incoming === 'string' && incoming.length > 0 ? incoming : crypto.randomUUID()
    ).slice(0, 64);
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    if (req.path.startsWith('/api')) {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        logger.info('http_request', {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          ip: req.ip,
        });
      });
    }
    next();
  });

  // --- Realtime SSE ---------------------------------------------------------
const sseClients = new Set<express.Response>();
let heartbeat: NodeJS.Timeout | null = null;

function stopHeartbeat() {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

function startHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    sseClients.forEach((client) => {
      try {
        // Comment frame: keeps idle proxies from dropping the stream.
        client.write(`: ping ${Date.now()}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    });
  }, sseHeartbeatMs);
  // Never keep the process alive purely for the heartbeat.
  heartbeat.unref?.();
}

  function closeRealtime() {
    stopHeartbeat();
    sseClients.forEach((client) => {
      try {
        client.end();
      } catch {
        /* already gone */
      }
    });
    sseClients.clear();
  }

  store.subscribe((event, data) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach((client) => {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    });
  });

  // SSE endpoint for live updates
  app.get('/api/v1/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sseClients.add(res);
    startHeartbeat();

    // Send initial ping
    res.write(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
      if (sseClients.size === 0) stopHeartbeat();
    });
  });

  // Health check
  app.get('/api/v1/health', async (_req, res) => {
    const deps = await store.healthCheck();
    const status = deps.ok ? 'ok' : 'degraded';
    res.status(deps.ok ? 200 : 503).json({
      status,
      app: 'Tsion Baltina',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database: deps,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // Admin authentication
  // ---------------------------------------------------------------------------
  app.post('/api/v1/auth/admin/login', adminLoginLimiter, adminLogin);
  app.get('/api/v1/auth/admin/session', adminSession);
  app.post('/api/v1/auth/admin/logout', adminLogout);

  // Categories
  app.get('/api/v1/categories', (_req, res) => {
    try {
      const categories = store.getCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      serverError(_req, res, error);
    }
  });

  // Products
  app.get('/api/v1/products', (req, res) => {
    try {
      const categorySlug = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;
      const { limit, offset } = parsePagination(req.query, 100);
      const products = store.getProducts({ categorySlug, search });
      const paged = paginate(products, limit, offset);
      res.json({ success: true, data: paged.items, pagination: paged.pagination });
    } catch (error) {
      serverError(req, res, error);
    }
  });

  app.get('/api/v1/products/:id', (req, res) => {
    const product = store.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: { message: 'Product not found' } });
    }
    res.json({ success: true, data: product });
  });

  // Cloudinary Image Storage Endpoints
  app.get('/api/v1/upload/status', (_req, res) => {
    const info = getCloudinaryConfigInfo();
    res.json({
      success: true,
      data: info,
    });
  });

  app.post('/api/v1/upload', requireAdmin, uploadLimiter, async (req, res) => {
    try {
      if (!req.is('application/json')) {
        return res.status(415).json({
          success: false,
          error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' },
        });
      }

      const { image, folder, public_id, tags } = req.body;
      const check = checkImageSource(image);
      if (!check.valid) {
        return res.status(400).json({ success: false, error: { message: check.reason } });
      }

      const uploadResult = await uploadImage(image, { folder, public_id, tags });
      res.json({
        success: true,
        data: uploadResult,
      });
    } catch (error) {
      serverError(req, res, error);
    }
  });

  app.delete('/api/v1/upload/:public_id', requireAdmin, async (req, res) => {
    try {
      const publicId = String(req.params.public_id);
      const deleted = await deleteFromCloudinary(publicId);
      res.json({
        success: true,
        data: { deleted },
      });
    } catch (error) {
      serverError(req, res, error);
    }
  });

  // Product Create & Update (with Cloudinary image support)
  app.post('/api/v1/products', requireAdmin, (req, res) => {
    try {
      const productSchema = z.object({
        category_id: z.string(),
        sku: z.string(),
        name_en: z.string().min(2),
        name_am: z.string().min(2),
        name_om: z.string().min(2),
        description_en: z.string().default(''),
        description_am: z.string().default(''),
        description_om: z.string().default(''),
        price: z.number().positive(),
        stock: z.number().int().min(0),
        min_stock_alert: z.number().int().min(1).default(5),
        unit: z.string().default('500g'),
        image_url: z.string().min(1),
        is_active: z.boolean().default(true),
        is_featured: z.boolean().default(false),
        origin: z.string().default('Addis Ababa, Ethiopia'),
        ingredients_en: z.string().optional(),
        usage_en: z.string().optional(),
      });

      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid product details', details: parsed.error.format() },
        });
      }

      const newProd = store.createProduct(parsed.data);
      res.status(201).json({ success: true, data: newProd });
    } catch (error) {
      serverError(req, res, error);
    }
  });

  app.patch('/api/v1/products/:id', requireAdmin, (req, res) => {
    try {
      const product = store.getProductById(req.params.id as string);
      if (!product) {
        return res.status(404).json({ success: false, error: { message: 'Product not found' } });
      }

      const updated = store.updateProduct(req.params.id as string, req.body);
      res.json({ success: true, data: updated });
    } catch (error) {
      serverError(req, res, error);
    }
  });

  // Orders
  const CreateOrderSchema = z.object({
    customer_name: z.string().min(2, 'Customer name is required'),
    customer_phone: z.string().min(7, 'Valid Ethiopian phone number is required'),
    delivery_subcity: z.string().min(2, 'Subcity is required'),
    delivery_woreda: z.string().optional(),
    delivery_landmark: z.string().optional(),
    delivery_notes: z.string().optional(),
    payment_method: z.enum(['CASH_ON_DELIVERY', 'TELEBIRR', 'CBE_BIRR', 'IN_STORE_PICKUP']),
    payment_reference: z.string().optional(),
    items: z.array(
      z.object({
        product_id: z.string(),
        quantity: z.number().int().positive(),
      })
    ).min(1, 'Cart cannot be empty'),
    idempotency_key: z.string().optional(),
    source: z.enum(['TELEGRAM_MINI_APP', 'WEB', 'PWA']).optional(),
  });

  app.post('/api/v1/orders', orderLimiter, (req, res) => {
    const parseResult = CreateOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid order input data',
          details: parseResult.error.format(),
        },
      });
    }

    const result = store.createOrder(parseResult.data);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: result.code,
          message: result.error,
        },
      });
    }

    // A replayed idempotent request is not a new resource.
    const status = result.replayed ? 200 : 201;
    res.status(status).json({ success: true, data: result.order, replayed: result.replayed ?? false });
  });

  app.get('/api/v1/orders', requireAdmin, (req, res) => {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const { limit, offset } = parsePagination(req.query, 50);
    const orders = store.getOrders({ status, search });
    const paged = paginate(orders, limit, offset);
    res.json({ success: true, data: paged.items, pagination: paged.pagination });
  });

  app.get('/api/v1/orders/:id', (req, res) => {
    const order = store.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    }
    res.json({ success: true, data: order });
  });

  const UpdateStatusSchema = z.object({
    status: z.enum([
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'READY_FOR_DELIVERY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ]),
  });

  app.patch('/api/v1/orders/:id/status', requireAdmin, (req, res) => {
    const parseResult = UpdateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid status transition' },
      });
    }

    const result = store.updateOrderStatus(req.params.id as string, parseResult.data.status, 'ADMIN');
    if (!result.success) {
      return res.status(404).json({ success: false, error: { message: result.error } });
    }

    res.json({ success: true, data: result.order });
  });

  // Inventory
  app.get('/api/v1/inventory', requireAdmin, (_req, res) => {
    const products = store.getProducts();
    const transactions = store.getInventoryTransactions();
    res.json({ success: true, data: { products, transactions } });
  });

  app.post('/api/v1/inventory/adjust', requireAdmin, (req, res) => {
    const schema = z.object({
      productId: z.string(),
      newStock: z.number().int().min(0),
      reason: z.enum(['RESTOCK', 'DAMAGE', 'AUDIT_ADJUSTMENT']),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { message: 'Invalid inventory adjustment data' } });
    }

    const result = store.adjustInventory({
      ...parsed.data,
      performedBy: 'ADMIN_OPERATOR',
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: { message: result.error } });
    }

    res.json({ success: true, data: result.product });
  });

  // Notifications
  app.get('/api/v1/notifications', requireAdmin, (_req, res) => {
    const notifications = store.getNotifications();
    res.json({ success: true, data: notifications });
  });

  app.post('/api/v1/notifications/:id/read', requireAdmin, (req, res) => {
    store.markNotificationRead(req.params.id as string);
    res.json({ success: true });
  });

  // Admin Stats
  app.get('/api/v1/admin/stats', requireAdmin, (_req, res) => {
    const stats = store.getStats();
    res.json({ success: true, data: stats });
  });

  app.get('/api/v1/admin/audit-logs', requireAdmin, (_req, res) => {
    const logs = store.getAuditLogs();
    res.json({ success: true, data: logs });
  });

  // Telegram Auth Verification Endpoint (Section 14)
  app.post('/api/v1/auth/telegram', telegramAuthLimiter, (req, res) => {
    const { initData, user } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (botToken) {
      // A bot token is configured: authentication must be verified. Fail closed —
      // never fall back to demo mode just because initData is absent/invalid.
      if (!initData || typeof initData !== 'string') {
        return res.status(401).json({
          success: false,
          error: { code: 'MISSING_INIT_DATA', message: 'Telegram initData is required' },
        });
      }

      let valid = false;
      try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckArr: string[] = [];
        urlParams.forEach((val, key) => {
          dataCheckArr.push(`${key}=${val}`);
        });
        dataCheckArr.sort();
        const dataCheckString = dataCheckArr.join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = crypto
          .createHmac('sha256', secretKey)
          .update(dataCheckString)
          .digest('hex');

        valid = Boolean(hash) && calculatedHash === hash;
      } catch (err) {
        console.warn(
          '[auth] Telegram signature verification failed:',
          err instanceof Error ? err.message : err
        );
        valid = false;
      }

      if (!valid) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_TELEGRAM_SIGNATURE', message: 'Invalid Telegram signature' },
        });
      }

      // Verified: prefer the user object embedded in initData.
      // Check auth_date freshness (±300s) to mitigate replay.
      const authDateParam = new URLSearchParams(initData).get('auth_date');
      const authDateSec = authDateParam ? Number(authDateParam) : 0;
      if (!Number.isFinite(authDateSec) || Math.abs(Math.floor(Date.now() / 1000) - authDateSec) > 300) {
        return res.status(401).json({
          success: false,
          error: { code: 'TELEGRAM_AUTH_DATE_EXPIRED', message: 'Telegram auth_date is too old or invalid' },
        });
      }

      let resolvedUser = user;
      if (!resolvedUser) {
        const userParam = new URLSearchParams(initData).get('user');
        if (userParam) {
          try {
            resolvedUser = JSON.parse(userParam);
          } catch {
            resolvedUser = null;
          }
        }
      }
      return res.json({ success: true, user: resolvedUser || null });
    }

    // No bot token configured (local development only): demo mode.
    res.json({
      success: true,
      user: user || {
        id: 98765432,
        first_name: 'Telegram Customer',
        username: 'addis_customer',
        role: 'CUSTOMER',
      },
    });
  });

  // Central error handler: catches anything thrown/rejected by routes (including
  // handlers without a try/catch) and never leaks internals to the client.
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (res.headersSent) return;
      serverError(req, res, err);
    }
  );

  return { app, store, closeRealtime };
}
