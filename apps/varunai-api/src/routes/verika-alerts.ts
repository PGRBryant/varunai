import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { broadcast } from './ws.js';

const gcpIncidentSchema = z.object({
  incident: z.object({
    incident_id: z.string(),
    state: z.enum(['open', 'closed']),
    summary: z.string(),
    condition_name: z.string(),
    started_at: z.number(),
    ended_at: z.number().nullable(),
    url: z.string(),
  }),
});

export const verikaAlertRoutes: FastifyPluginAsync = async (app) => {
  app.post('/alerts', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (
      !config.VERIKA_WEBHOOK_SECRET ||
      authHeader !== `Bearer ${config.VERIKA_WEBHOOK_SECRET}`
    ) {
      return reply.status(401).send();
    }

    const result = gcpIncidentSchema.safeParse(request.body);
    if (!result.success) {
      app.log.warn('Invalid Verika alert payload: %s', result.error.message);
      return reply.status(400).send();
    }

    const { incident } = result.data;

    app.log.warn(
      { incidentId: incident.incident_id, state: incident.state, condition: incident.condition_name },
      'Verika alert received',
    );

    broadcast({
      type: 'VERIKA_ALERT',
      incidentId: incident.incident_id,
      alertName: incident.condition_name,
      state: incident.state,
      summary: incident.summary,
      startedAt: incident.started_at,
      endedAt: incident.ended_at,
      url: incident.url,
    });

    return reply.status(200).send();
  });
};
