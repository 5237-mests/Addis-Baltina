import './src/server/env';
import express from 'express';
import { createServer } from 'http';
import { createApp } from './src/server/app';
import { logger } from './src/server/logger';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const { app, closeRealtime } = createApp({ isProduction });
  const httpServer = createServer(app);
  let shuttingDown = false;

  if (!isProduction) {
    // Dev-only dependency: imported lazily so a production install
    // (`npm ci --omit=dev`) does not need Vite at runtime.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info('server_started', { port: PORT, isProduction });
  });

  // Graceful shutdown: stop accepting requests, close SSE clients so the
  // server can actually drain, then exit. Required for clean systemd/PM2
  // restarts.
  function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('server_shutting_down', { signal });

    closeRealtime();

    const forceExit = setTimeout(() => {
      logger.error('server_shutdown_timed_out');
      httpServer.closeAllConnections?.();
      process.exit(1);
    }, 10_000);
    forceExit.unref?.();

    httpServer.close(() => {
      clearTimeout(forceExit);
      logger.info('server_shutdown_complete');
      process.exit(0);
    });
    // Drop keep-alive connections that would otherwise hold the server open.
    httpServer.closeIdleConnections?.();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error('server_failed_to_start', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
