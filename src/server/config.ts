/**
 * Central runtime configuration.
 *
 * Values are read from the environment once at import time (after
 * `src/server/env.ts` has loaded `.env`) so pricing rules are not hardcoded in
 * the data layer. Defaults preserve the previous behaviour.
 */

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.warn(`[config] ${name}="${raw}" is not a number; using default ${fallback}.`);
    return fallback;
  }
  return value;
}

export interface CommerceConfig {
  /** Orders at or above this subtotal (ETB) get free delivery. */
  freeDeliveryThreshold: number;
  /** Flat delivery fee (ETB) charged below the threshold. */
  flatDeliveryFee: number;
  /** Tax rate as a fraction of the subtotal (0 = tax exempt). */
  taxRate: number;
}

export function loadCommerceConfig(): CommerceConfig {
  return {
    freeDeliveryThreshold: readNumber('DELIVERY_FREE_THRESHOLD', 1200),
    flatDeliveryFee: readNumber('DELIVERY_FLAT_FEE', 100),
    taxRate: readNumber('TAX_RATE', 0),
  };
}

export const commerceConfig: CommerceConfig = loadCommerceConfig();
