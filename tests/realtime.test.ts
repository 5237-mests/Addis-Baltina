import http from 'http';
import type { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import { makeApp, orderPayload, waitFor } from './helpers';

let server: http.Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

function listen(app: ReturnType<typeof makeApp>) {
  return new Promise<number>((resolve) => {
    server = http.createServer(app.app);
    server.listen(0, '127.0.0.1', () => resolve((server!.address() as AddressInfo).port));
  });
}

describe('realtime SSE', () => {
  it('delivers order events to connected clients', async () => {
    const created = makeApp();
    const port = await listen(created);
    const received: string[] = [];

    const sseReq = http.get({ host: '127.0.0.1', port, path: '/api/v1/events' }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => received.push(chunk));
    });

    await waitFor(() => received.join('').includes('event: connected'));

    const orderRes = await fetch(`http://127.0.0.1:${port}/api/v1/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(orderPayload()),
    });
    expect(orderRes.status).toBe(201);
    const { data } = (await orderRes.json()) as { data: { id: string } };

    await waitFor(() => received.join('').includes('event: order:created'));
    expect(received.join('')).toContain(`"id":"${data.id}"`);

    sseReq.destroy();
    created.closeRealtime();
  });

  it('sends a keep-alive comment frame on idle streams', async () => {
    const created = makeApp({ sseHeartbeatMs: 50 });
    const port = await listen(created);
    const received: string[] = [];

    const sseReq = http.get({ host: '127.0.0.1', port, path: '/api/v1/events' }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => received.push(chunk));
    });

    await waitFor(() => received.join('').includes(': ping'), 5000);

    sseReq.destroy();
    created.closeRealtime();
  });
});
