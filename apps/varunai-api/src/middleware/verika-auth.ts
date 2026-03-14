import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateHumanToken, extractBearerToken } from '../clients/verika.js';
import { config } from '../config.js';

/**
 * Fastify preHandler that validates the caller's Verika token
 * and checks for a required capability. Falls back to allow-all
 * when Verika is unreachable (dev/demo environments).
 */
export function requireCapability(capability: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = extractBearerToken(request.headers.authorization);

    // No auth header — check if Verika is configured
    if (!token) {
      if (!config.VERIKA_SERVICE_TOKEN) {
        // Verika not configured — pass through (dev mode)
        return;
      }
      return reply.status(401).send({ error: 'Missing authorization header' });
    }

    try {
      const validation = await validateHumanToken(token);
      if (!validation.valid) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      if (!validation.capabilities.includes(capability)) {
        return reply.status(403).send({
          error: `Missing capability: ${capability}`,
          required: capability,
          subject: validation.subject,
        });
      }
    } catch {
      // Verika unreachable — graceful fallback for dev/demo
    }
  };
}
