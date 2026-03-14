import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { broadcast } from './ws.js';
import { recordFlagChange } from '../assist/context.js';

const pubsubBodySchema = z.object({
  message: z.object({
    data: z.string(),
    messageId: z.string(),
    publishTime: z.string(),
  }),
  subscription: z.string(),
});

const flagChangePayloadSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  previousValue: z.unknown(),
  changedBy: z.string(),
  traceId: z.string().optional(),
});

export const pubsubRoutes: FastifyPluginAsync = async (app) => {
  app.post('/flag-updates', async (request, reply) => {
    try {
      const bodyResult = pubsubBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        app.log.warn('Invalid PubSub envelope: %s', bodyResult.error.message);
        return reply.status(400).send();
      }
      const body = bodyResult.data;

      const raw = JSON.parse(
        Buffer.from(body.message.data, 'base64').toString('utf-8')
      ) as unknown;

      const payloadResult = flagChangePayloadSchema.safeParse(raw);
      if (!payloadResult.success) {
        app.log.warn('Invalid flag change payload: %s', payloadResult.error.message);
        return reply.status(400).send();
      }
      const decoded = payloadResult.data;
      const traceId = decoded.traceId ?? body.message.messageId;

      recordFlagChange({
        flagKey: decoded.key,
        previousValue: decoded.previousValue,
        newValue: decoded.value,
        changedBy: decoded.changedBy,
        timestamp: Date.now(),
        traceId,
      });

      broadcast({
        type: 'FLAG_CHANGED',
        key: decoded.key,
        from: String(decoded.previousValue ?? 'unknown'),
        to: String(decoded.value ?? 'unknown'),
        changedBy: decoded.changedBy,
        traceId,
      });

      return reply.status(200).send();
    } catch (err) {
      app.log.error(err, 'Failed to process Pub/Sub flag update');
      return reply.status(200).send();
    }
  });
};
