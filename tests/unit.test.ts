import { describe, expect, it } from 'vitest';
import { DatabaseStore } from '../src/server/db';
import { orderPayload } from './helpers';

describe('pricing & delivery fee', () => {
  it('charges a flat 100 ETB below the 1200 ETB threshold', () => {
    const store = new DatabaseStore();
    const result = store.createOrder(orderPayload()); // Beso = 260 ETB
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.order.subtotal).toBe(260);
    expect(result.order.delivery_fee).toBe(100);
    expect(result.order.total).toBe(360);
  });

  it('gives free delivery from 1200 ETB (700 + 500)', () => {
    const store = new DatabaseStore();
    // Teff flour 650 + Yirgacheffe coffee 680 = 1330
    const result = store.createOrder(
      orderPayload({
        items: [
          { product_id: 'prod-teff-flour', quantity: 1 },
          { product_id: 'prod-yirgacheffe-coffee', quantity: 1 },
        ],
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.order.subtotal).toBe(1330);
    expect(result.order.delivery_fee).toBe(0);
    expect(result.order.total).toBe(1330);
  });

  it('uses server-authoritative prices, ignoring any client price', () => {
    const store = new DatabaseStore();
    const result = store.createOrder(
      orderPayload({
        items: [{ product_id: 'prod-berbere-special', quantity: 2 }],
        // @ts-expect-error unknown client fields must be ignored
        price: 1,
        total: 1,
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.order.items[0].unit_price).toBe(450);
    expect(result.order.subtotal).toBe(900);
    expect(result.order.total).toBe(1000);
  });
});

describe('stock', () => {
  it('rejects an order that would oversell', () => {
    const store = new DatabaseStore();
    const before = store.getProductById('prod-beso')!.stock;
    const result = store.createOrder(
      orderPayload({ items: [{ product_id: 'prod-beso', quantity: before + 1 }] })
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('OUT_OF_STOCK');
    expect(store.getProductById('prod-beso')!.stock).toBe(before);
  });

  it('decrements stock on success', () => {
    const store = new DatabaseStore();
    const before = store.getProductById('prod-beso')!.stock;
    store.createOrder(orderPayload({ items: [{ product_id: 'prod-beso', quantity: 3 }] }));
    expect(store.getProductById('prod-beso')!.stock).toBe(before - 3);
  });

  it('rejects unknown products', () => {
    const store = new DatabaseStore();
    const result = store.createOrder(
      orderPayload({ items: [{ product_id: 'does-not-exist', quantity: 1 }] })
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('idempotency', () => {
  it('replays the same order for the same key and payload', () => {
    const store = new DatabaseStore();
    const payload = orderPayload({ idempotency_key: 'key-1' });
    const before = store.getProductById('prod-beso')!.stock;

    const first = store.createOrder(payload);
    const second = store.createOrder(payload);

    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.order.id).toBe(first.order.id);
    expect(second.replayed).toBe(true);
    // Stock must only be decremented once.
    expect(store.getProductById('prod-beso')!.stock).toBe(before - 1);
  });

  it('rejects a reused key with a different payload', () => {
    const store = new DatabaseStore();
    store.createOrder(orderPayload({ idempotency_key: 'key-2' }));
    const result = store.createOrder(
      orderPayload({ idempotency_key: 'key-2', items: [{ product_id: 'prod-beso', quantity: 2 }] })
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('IDEMPOTENCY_KEY_REUSE');
  });

  it('treats key order as irrelevant when fingerprinting the payload', () => {
    const store = new DatabaseStore();
    const first = store.createOrder({
      idempotency_key: 'key-3',
      customer_name: 'A',
      customer_phone: '+251911000000',
      delivery_subcity: 'Bole',
      payment_method: 'CASH_ON_DELIVERY',
      items: [{ product_id: 'prod-beso', quantity: 1 }],
    });
    const second = store.createOrder({
      items: [{ product_id: 'prod-beso', quantity: 1 }],
      payment_method: 'CASH_ON_DELIVERY',
      delivery_subcity: 'Bole',
      customer_phone: '+251911000000',
      customer_name: 'A',
      idempotency_key: 'key-3',
    });
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.order.id).toBe(first.order.id);
    expect(second.replayed).toBe(true);
  });
});

describe('order ids', () => {
  it('never collides across repeated creation', () => {
    const store = new DatabaseStore();
    const ids = new Set<string>();
    for (let i = 0; i < 40; i++) {
      store.adjustInventory({
        productId: 'prod-beso',
        newStock: 100,
        reason: 'RESTOCK',
        performedBy: 'TEST',
      });
      const result = store.createOrder(orderPayload());
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.order.id).toMatch(/^AB-\d{4}-\d{4}$/);
      expect(ids.has(result.order.id)).toBe(false);
      ids.add(result.order.id);
    }
  });
});

describe('bounded in-memory collections', () => {
  it('caps inventory transactions', () => {
    const store = new DatabaseStore();
    for (let i = 0; i < 1010; i++) {
      store.adjustInventory({
        productId: 'prod-beso',
        newStock: i,
        reason: 'AUDIT_ADJUSTMENT',
        performedBy: 'TEST',
      });
    }
    expect(store.getInventoryTransactions().length).toBe(1000);
  });
});
