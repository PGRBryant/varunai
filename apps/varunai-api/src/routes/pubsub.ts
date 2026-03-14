import type { FastifyPluginAsync } from 'fastify';
import { broadcast } from './ws.js';

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

export const pubsubRoutes: FastifyPluginAsync = async (app) => {
  app.post('/flag-updates', async (request, reply) => {
    const body = request.body as PubSubMessage;
    try {
      if (!body?.message?.data) {
        return reply.status(400).send();
      }

      const decoded = JSON.parse(
        Buffer.from(body.message.data, 'base64').toString('utf-8')
      ) as { key: string; value: unknown; previousValue: unknown; changedBy: string; traceId?: string };

      broadcast({
        type: 'FLAG_CHANGED',
        key: decoded.key,
        from: String(decoded.previousValue ?? 'unknown'),
        to: String(decoded.value ?? 'unknown'),
        changedBy: decoded.changedBy,
        traceId: decoded.traceId ?? body.message.messageId,
      });

      return reply.status(200).send();
    } catch (err) {
      app.log.error(err, 'Failed to process Pub/Sub flag update');
      return reply.status(200).send(); // ACK to prevent redelivery
    }
  });
};
