import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { sessionRoutes } from './routes/session.js';
import { flagRoutes } from './routes/flags.js';
import { assistRoutes } from './routes/assist.js';
import { auditRoutes } from './routes/audit.js';
import { healthRoutes } from './routes/health.js';
import { pubsubRoutes } from './routes/pubsub.js';
import { verikaAlertRoutes } from './routes/verika-alerts.js';
import { wsHandler } from './routes/ws.js';
import { startAssistLoop } from './assist/loop.js';

const PORT = parseInt(process.env.PORT ?? '8080', 10);

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  await app.register(sessionRoutes, { prefix: '/api/session' });
  await app.register(flagRoutes, { prefix: '/api/flags' });
  await app.register(assistRoutes, { prefix: '/api/assist' });
  await app.register(auditRoutes, { prefix: '/api/audit' });
  await app.register(healthRoutes);
  await app.register(pubsubRoutes, { prefix: '/internal/pubsub' });
  await app.register(verikaAlertRoutes, { prefix: '/internal/verika' });
  await app.register(wsHandler);

  startAssistLoop();

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error('Failed to start varunai-api:', err);
  process.exit(1);
});
