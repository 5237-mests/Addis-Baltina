import { DatabaseStore } from '../src/server/db';
import { createApp, type CreateAppOptions, type CreatedApp } from '../src/server/app';
import type { OrderSource, PaymentMethod } from '../src/types';

/** Builds an isolated app + store for a test (no shared state between apps). */
export function makeApp(options: CreateAppOptions = {}): CreatedApp {
  const store = options.store ?? new DatabaseStore();
  return createApp({ isProduction: false, trustProxy: false, ...options, store });
}

export const ADMIN_PASSWORD = 'test-admin-password';

export interface OrderPayload {
  customer_name: string;
  customer_phone: string;
  delivery_subcity: string;
  delivery_woreda?: string;
  delivery_landmark?: string;
  delivery_notes?: string;
  payment_method: PaymentMethod;
  payment_reference?: string;
  items: Array<{ product_id: string; quantity: number }>;
  idempotency_key?: string;
  source?: OrderSource;
}

export function orderPayload(overrides: Partial<OrderPayload> = {}): OrderPayload {
  return {
    customer_name: 'Test Customer',
    customer_phone: '+251911000000',
    delivery_subcity: 'Bole',
    payment_method: 'CASH_ON_DELIVERY',
    items: [{ product_id: 'prod-beso', quantity: 1 }],
    ...overrides,
  };
}

/** Waits until `predicate()` is true, or throws after `timeoutMs`. */
export async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('waitFor: condition not met before timeout');
}
