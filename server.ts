import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';
import { db } from './src/server/db';
import { uploadImage, deleteFromCloudinary, getCloudinaryConfigInfo } from './src/server/cloudinary';
import crypto from 'crypto';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// API Request Logger
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// Realtime SSE event bus clients
const sseClients: Set<express.Response> = new Set();

db.subscribe((event, data) => {
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
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  // Send initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Addis Baltina',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Categories
app.get('/api/v1/categories', (_req, res) => {
  try {
    const categories = db.getCategories();
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Products
app.get('/api/v1/products', (req, res) => {
  try {
    const categorySlug = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const products = db.getProducts({ categorySlug, search });
    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

app.get('/api/v1/products/:id', (req, res) => {
  const product = db.getProductById(req.params.id);
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

app.post('/api/v1/upload', async (req, res) => {
  try {
    const { image, folder, public_id, tags } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'Image data (base64 data URI or image URL) is required' },
      });
    }

    const uploadResult = await uploadImage(image, { folder, public_id, tags });
    res.json({
      success: true,
      data: uploadResult,
    });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Image upload failed' },
    });
  }
});

app.delete('/api/v1/upload/:public_id', async (req, res) => {
  try {
    const publicId = req.params.public_id;
    const deleted = await deleteFromCloudinary(publicId);
    res.json({
      success: true,
      data: { deleted },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Image delete failed' },
    });
  }
});

// Product Create & Update (with Cloudinary image support)
app.post('/api/v1/products', (req, res) => {
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

    const newProd = db.createProduct(parsed.data);
    res.status(201).json({ success: true, data: newProd });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

app.patch('/api/v1/products/:id', (req, res) => {
  try {
    const product = db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: { message: 'Product not found' } });
    }

    const updated = db.updateProduct(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
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

app.post('/api/v1/orders', (req, res) => {
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

  const result = db.createOrder(parseResult.data);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: result.code,
        message: result.error,
      },
    });
  }

  res.status(201).json({ success: true, data: result.order });
});

app.get('/api/v1/orders', (req, res) => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const orders = db.getOrders({ status, search });
  res.json({ success: true, data: orders });
});

app.get('/api/v1/orders/:id', (req, res) => {
  const order = db.getOrderById(req.params.id);
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

app.patch('/api/v1/orders/:id/status', (req, res) => {
  const parseResult = UpdateStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid status transition' },
    });
  }

  const result = db.updateOrderStatus(req.params.id, parseResult.data.status, 'ADMIN');
  if (!result.success) {
    return res.status(404).json({ success: false, error: { message: result.error } });
  }

  res.json({ success: true, data: result.order });
});

// Inventory
app.get('/api/v1/inventory', (_req, res) => {
  const products = db.getProducts();
  const transactions = db.getInventoryTransactions();
  res.json({ success: true, data: { products, transactions } });
});

app.post('/api/v1/inventory/adjust', (req, res) => {
  const schema = z.object({
    productId: z.string(),
    newStock: z.number().int().min(0),
    reason: z.enum(['RESTOCK', 'DAMAGE', 'AUDIT_ADJUSTMENT']),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { message: 'Invalid inventory adjustment data' } });
  }

  const result = db.adjustInventory({
    ...parsed.data,
    performedBy: 'ADMIN_OPERATOR',
  });

  if (!result.success) {
    return res.status(400).json({ success: false, error: { message: result.error } });
  }

  res.json({ success: true, data: result.product });
});

// Notifications
app.get('/api/v1/notifications', (_req, res) => {
  const notifications = db.getNotifications();
  res.json({ success: true, data: notifications });
});

app.post('/api/v1/notifications/:id/read', (req, res) => {
  db.markNotificationRead(req.params.id);
  res.json({ success: true });
});

// Admin Stats
app.get('/api/v1/admin/stats', (_req, res) => {
  const stats = db.getStats();
  res.json({ success: true, data: stats });
});

app.get('/api/v1/admin/audit-logs', (_req, res) => {
  const logs = db.getAuditLogs();
  res.json({ success: true, data: logs });
});

// Telegram Auth Verification Endpoint (Section 14)
app.post('/api/v1/auth/telegram', (req, res) => {
  const { initData, user } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  // In production with TELEGRAM_BOT_TOKEN set, validate HMAC-SHA256 signature
  if (botToken && initData) {
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
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (calculatedHash !== hash) {
        return res.status(401).json({ success: false, error: 'Invalid Telegram signature' });
      }
    } catch (err: any) {
      console.warn('Telegram auth check error:', err.message);
    }
  }

  // Validated or in demo mode: return Telegram session user
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

// Vite Integration: Mount vite.middlewares in development mode
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Addis Baltina Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
