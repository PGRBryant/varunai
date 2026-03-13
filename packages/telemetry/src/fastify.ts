import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from './logger.js';

/**
 * Fastify plugin that adds the telemetry logger to the Fastify instance
 * and logs request/response lifecycle events with trace correlation.
 */
const telemetryPluginImpl: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.decorate('log', logger);

  fastify.addHook('onRequest', async (request) => {
    logger.info({
      msg: 'request_received',
      method: request.method,
      url: request.url,
      requestId: request.id,
    });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.info({
      msg: 'request_completed',
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      requestId: request.id,
      responseTime: reply.elapsedTime,
    });
  });

  done();
};

export const telemetryPlugin = fp(telemetryPluginImpl, {
  name: '@internal/telemetry',
  fastify: '4.x',
});
