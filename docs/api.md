# Addis Baltina REST API Documentation (v1)

Base URL: `/api/v1`

## Endpoints

### 1. Categories
- `GET /api/v1/categories`: Retrieve all active product categories.

### 2. Products
- `GET /api/v1/products`: List products.
  - Query params: `category` (slug), `search` (text query).
- `GET /api/v1/products/:id`: Get single product details.

### 3. Orders
- `POST /api/v1/orders`: Create authoritative order.
  - Body: `{ customer_name, customer_phone, delivery_subcity, delivery_woreda?, delivery_landmark?, payment_method, payment_reference?, items: [{ product_id, quantity }], idempotency_key?, source? }`
- `GET /api/v1/orders`: List orders (supports `status` and `search` query).
- `GET /api/v1/orders/:id`: Get order by ID (e.g. `AB-2026-1049`).
- `PATCH /api/v1/orders/:id/status`: Update status (e.g. `PENDING`, `CONFIRMED`, `PROCESSING`, `READY_FOR_DELIVERY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`).

### 4. Inventory
- `GET /api/v1/inventory`: Retrieve stock levels and recent inventory transactions.
- `POST /api/v1/inventory/adjust`: Admin manual stock adjustment.
  - Body: `{ productId, newStock, reason: 'RESTOCK' | 'DAMAGE' | 'AUDIT_ADJUSTMENT' }`

### 5. Realtime Events
- `GET /api/v1/events`: Server-Sent Events stream for real-time order lifecycle and stock changes.
