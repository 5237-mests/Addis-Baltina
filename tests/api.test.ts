import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ADMIN_PASSWORD, makeApp, orderPayload } from './helpers';

const { app, store } = makeApp();
const agent = request.agent(app);

let orderId = '';

beforeAll(() => {
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.CLIENT_URL;
});

afterAll(() => {
  delete process.env.ADMIN_PASSWORD;
});

describe('public catalog', () => {
  it('serves products and categories', async () => {
    const products = await request(app).get('/api/v1/products').expect(200);
    expect(products.body.success).toBe(true);
    expect(Array.isArray(products.body.data)).toBe(true);

    const categories = await request(app).get('/api/v1/categories').expect(200);
    expect(categories.body.data.length).toBeGreaterThan(0);
  });
});

describe('order creation', () => {
  it('creates an order with server pricing', async () => {
    const res = await request(app).post('/api/v1/orders').send(orderPayload()).expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.replayed).toBe(false);
    expect(res.body.data.id).toMatch(/^AB-\d{4}-\d{4}$/);
    expect(res.body.data.total).toBe(360);
    orderId = res.body.data.id;
  });

  it('rejects an empty cart', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .send(orderPayload({ items: [] }))
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects overselling', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .send(orderPayload({ items: [{ product_id: 'prod-beso', quantity: 999999 }] }))
      .expect(400);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
  });

  it('replays an idempotent request and rejects key reuse with a new payload', async () => {
    const payload = orderPayload({ idempotency_key: 'http-key-1' });
    const first = await request(app).post('/api/v1/orders').send(payload).expect(201);
    const replay = await request(app).post('/api/v1/orders').send(payload).expect(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.data.id).toBe(first.body.data.id);

    const conflict = await request(app)
      .post('/api/v1/orders')
      .send(orderPayload({ idempotency_key: 'http-key-1', items: [{ product_id: 'prod-beso', quantity: 2 }] }))
      .expect(400);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_REUSE');
  });
});

describe('admin protection', () => {
  it('blocks mutating routes when anonymous', async () => {
    await request(app).get('/api/v1/orders').expect(401);
    await request(app).patch(`/api/v1/orders/${orderId}/status`).send({ status: 'CONFIRMED' }).expect(401);
    await request(app)
      .post('/api/v1/inventory/adjust')
      .send({ productId: 'prod-beso', newStock: 5, reason: 'RESTOCK' })
      .expect(401);
    await request(app)
      .post('/api/v1/upload')
      .send({ image: 'data:image/png;base64,iVBORw0KGgo=' })
      .expect(401);
  });
});

describe('admin session', () => {
  it('rejects a wrong password and accepts the configured one', async () => {
    await agent.post('/api/v1/auth/admin/login').send({ password: 'nope' }).expect(401);
    const login = await agent.post('/api/v1/auth/admin/login').send({ password: ADMIN_PASSWORD }).expect(200);
    expect(login.headers['set-cookie']).toBeTruthy();
    const session = await agent.get('/api/v1/auth/admin/session').expect(200);
    expect(session.body.data.authenticated).toBe(true);
  });

  it('updates order status and restocks on cancellation', async () => {
    const before = store.getProductById('prod-beso')!.stock;
    await agent.patch(`/api/v1/orders/${orderId}/status`).send({ status: 'CONFIRMED' }).expect(200);
    const cancelled = await agent
      .patch(`/api/v1/orders/${orderId}/status`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(store.getProductById('prod-beso')!.stock).toBe(before + 1);
  });

  it('adjusts inventory', async () => {
    const res = await agent
      .post('/api/v1/inventory/adjust')
      .send({ productId: 'prod-beso', newStock: 42, reason: 'RESTOCK' })
      .expect(200);
    expect(res.body.data.stock).toBe(42);
  });
});

describe('upload hardening', () => {
  it('rejects a non-JSON content type', async () => {
    await agent
      .post('/api/v1/upload')
      .set('Content-Type', 'text/plain')
      .send('not json')
      .expect(415);
  });

  it('rejects an arbitrary remote host (SSRF guard)', async () => {
    const res = await agent
      .post('/api/v1/upload')
      .send({ image: 'https://169.254.169.254/latest/meta-data/' })
      .expect(400);
    expect(res.body.error.message).toMatch(/not allowed/i);
  });

  it('rejects plain http URLs', async () => {
    await agent
      .post('/api/v1/upload')
      .send({ image: 'http://res.cloudinary.com/demo/image/upload/x.png' })
      .expect(400);
  });

  it('accepts an allow-listed URL and an inline data URI', async () => {
    const remote = await agent
      .post('/api/v1/upload')
      .send({ image: 'https://res.cloudinary.com/demo/image/upload/sample.png' })
      .expect(200);
    expect(remote.body.success).toBe(true);

    const inline = await agent
      .post('/api/v1/upload')
      .send({ image: 'data:image/png;base64,iVBORw0KGgo=' })
      .expect(200);
    expect(inline.body.success).toBe(true);
  });
});

describe('CORS', () => {
  it('rejects a disallowed browser origin', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Origin', 'https://evil.example')
      .expect(403);
    expect(res.body.error.code).toBe('CORS_FORBIDDEN');
  });

  it('allows same-origin requests without an Origin header', async () => {
    await request(app).get('/api/v1/health').expect(200);
  });
});

describe('security headers', () => {
  it('applies a strict CSP in production while allowing Telegram', async () => {
    const prod = makeApp({ isProduction: true });
    const res = await request(prod.app).get('/api/v1/health').expect(200);
    const csp = String(res.headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://telegram.org');
    expect(csp).toContain('frame-ancestors');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    prod.closeRealtime();
  });
});

describe('rate limiting', () => {
  it('throttles the telegram auth endpoint', async () => {
    for (let i = 0; i < 20; i++) {
      await request(app).post('/api/v1/auth/telegram').send({}).expect(200);
    }
    const res = await request(app).post('/api/v1/auth/telegram').send({}).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
