export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentMethod =
  | 'CASH_ON_DELIVERY'
  | 'TELEBIRR'
  | 'CBE_BIRR'
  | 'IN_STORE_PICKUP';

export type OrderSource = 'TELEGRAM_MINI_APP' | 'WEB' | 'PWA';

export type UserRole = 'CUSTOMER' | 'ADMIN';

export type Language = 'en' | 'am' | 'om';

export type Theme = 'light' | 'dark' | 'system';

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_am: string;
  name_om: string;
  description_en: string;
  description_am: string;
  description_om: string;
  icon: string;
  display_order: number;
}

export interface Product {
  id: string;
  category_id: string;
  sku: string;
  name_en: string;
  name_am: string;
  name_om: string;
  description_en: string;
  description_am: string;
  description_om: string;
  price: number; // in ETB
  stock: number;
  min_stock_alert: number;
  unit: string; // '250g', '500g', '1kg', '2kg'
  image_url: string;
  is_active: boolean;
  is_featured: boolean;
  origin: string;
  ingredients_en?: string;
  ingredients_am?: string;
  ingredients_om?: string;
  usage_en?: string;
  usage_am?: string;
  usage_om?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selected_unit: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string; // e.g. AB-2026-1049
  user_id?: string;
  customer_name: string;
  customer_phone: string;
  delivery_subcity: string;
  delivery_woreda?: string;
  delivery_landmark?: string;
  delivery_notes?: string;
  payment_method: PaymentMethod;
  payment_reference?: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  idempotency_key?: string;
  source: OrderSource;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  change_amount: number;
  previous_stock: number;
  new_stock: number;
  reason: 'ORDER_PLACEMENT' | 'ORDER_CANCELLATION' | 'RESTOCK' | 'DAMAGE' | 'AUDIT_ADJUSTMENT';
  reference_id?: string;
  performed_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  performed_by: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'ORDER_UPDATE' | 'LOW_STOCK' | 'PROMOTION' | 'SYSTEM';
  is_read: boolean;
  created_at: string;
  reference_id?: string;
}

export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}
