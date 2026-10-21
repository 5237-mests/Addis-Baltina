# WebSocket / Realtime (SSE) Notes

The application provides live updates via **Server-Sent Events** (SSE), not raw WebSocket. This is intentional — it works well through reverse proxies, shared hosting, and automatic reconnection in the browser (`EventSource`).

## Endpoint

```
GET /api/v1/events  (text/event-stream, keep-alive)
```

## Events

| Event | Description |
|---|---|
| `connected` | Sent immediately after the client connects, with the server's current timestamp. |
| `product:created` | A new product was created. |
| `product:updated` | A product was updated. |
| `inventory:low` | Stock dropped to or below the low-stock threshold. |
| `inventory:updated` | Stock changed (manual adjustment or due to an order). |
| `order:created` | A new order was placed. |
| `order:status_changed` | Order status changed (e.g., `CONFIRMED`, `DELIVERED`, `CANCELLED`). |
| `notification:new` | A new admin notification was generated. |

Event payloads are JSON objects in the `data` field. Clients should handle unexpected event names.

## Keep-alive

- The server sends a `: ping` comment frame every 25 seconds (`: ping <ts>`).
- `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, and `X-Accel-Buffering: no` are set.
- Heartbeat is stopped when the last client disconnects and re-established when a new client connects.

## Client Behaviour

- The web client uses `EventSource` (`/api/v1/events`). `EventSource` automatically reconnects on connection loss; the app also falls back to REST (`/api/v1/products`, `GET /api/v1/orders/:id`) when SSE is unavailable.
- Realtime is an **enhancement**, not the source of truth. The UI refreshes relevant data on reconnection or user action.

## Proxy/Hosting Requirements

For SSE to work reliably behind a reverse proxy (Nginx, Caddy, shared hosting with Apache + mod_proxy, etc.):
- Disable response buffering for the `/api/v1/events` location: `proxy_buffering off;` (Nginx).
- Increase read timeouts: `proxy_read_timeout 3600s;` (Nginx). Long-lived streams require generous timeouts.
- Do not compress the SSE response for this path (`gzip off`) in most setups.
- Ensure keep-alive timeouts between proxy and Node are aligned; for shared hosting, check the provider's long-connection policy.

If a host cannot support long-lived connections, the application still functions correctly (no data loss). Clients will reconnect according to `EventSource`'s default behaviour or rely on REST refreshes.
