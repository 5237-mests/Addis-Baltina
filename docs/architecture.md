# Addis Baltina Architecture

## Overview

The Addis Baltina system follows a clean layered architecture designed to run reliably on shared hosting or VPS environments.

```
Client (Web / Telegram Mini App / PWA)
         ↓  HTTP REST / SSE
Controller / Route Handlers (Express, Zod)
         ↓
Service Layer (Commerce Validation, Pricing Rules, Idempotency)
         ↓
Repository Layer (DatabaseStore / MySQL Connection)
         ↓
Data Store & Event Bus (MySQL 8.0 / In-memory Fallback, Audit Logs, SSE)
```

## Inventory Concurrency & Overselling Prevention

1. Customer submits order with item IDs and quantities.
2. Server validates each product against live stock count atomically.
3. If stock is insufficient, transaction is aborted immediately with `OUT_OF_STOCK` error code.
4. If valid, inventory is decremented and an `inventory_transactions` record is logged.
5. If order is later marked `CANCELLED` by an administrator, stock is automatically refunded and logged as `ORDER_CANCELLATION`.
