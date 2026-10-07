# Addis Baltina (አዲስ ባልትና)

> Authentic Ethiopian Baltina E-Commerce Platform & Telegram Mini App

Addis Baltina is a production-grade full-stack e-commerce system built for distributing genuine Ethiopian stone-ground spices, grains, flours, and gourmet baltina essentials directly to households in Addis Ababa and beyond.

---

## Key Features

1. **Telegram Mini App & Multi-Channel Deployment**:
   - First-class Telegram Mini App integration with client theme adaptation, haptic feedback, and server-side authentication validation.
   - Fully responsive web application and installable Progressive Web App (PWA) with service worker offline fallback.

2. **Authoritative Server Commerce & Anti-Overselling**:
   - Server-side inventory verification and atomic stock decrementing.
   - Authoritative pricing calculations (client price claims are rejected).
   - Idempotency key mechanism preventing duplicate orders from network retries or double clicks.

3. **Multilingual & Cultural Experience**:
   - Trilingual support: English, Amharic (አማርኛ), and Afaan Oromo (Oromiffa).
   - Light, Dark, System, and Telegram themes.

4. **Ethiopian Payment & Delivery Options**:
   - Cash on Delivery (COD) across Addis Ababa subcities.
   - Telebirr & Commercial Bank of Ethiopia (CBE Birr) manual transfer instructions with transaction reference capture.
   - Hub pickup.

5. **Operational Admin Dashboard**:
   - Real-time revenue, active orders, and low-stock alerts.
   - Order lifecycle workflow: PENDING → CONFIRMED → PROCESSING → READY_FOR_DELIVERY → OUT_FOR_DELIVERY → DELIVERED.
   - Order cancellation with automatic inventory restock and transaction auditing.
   - Manual inventory adjustments with reason codes (RESTOCK, DAMAGE, AUDIT_ADJUSTMENT).
   - System audit trail.

---

## Architecture & Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript (`server.ts` with Vite middleware mounting).
- **Database & Data Layer**: MySQL 8.0 schema (`database/schema.sql`) with in-memory transaction repository.
- **Realtime**: Server-Sent Events (SSE) and event bus with polling fallback.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production
npm run build
npm start
```
