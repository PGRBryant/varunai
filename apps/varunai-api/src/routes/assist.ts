import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { generateSuggestion } from '../assist/gemini.js';
import { buildAssistContext } from '../assist/context.js';
import { requireCapability } from '../middleware/verika-auth.js';

const suggestSchema = z.object({
  question: z.string().optional(),
});

export const assistRoutes: FastifyPluginAsync = async (app) => {
  app.post('/suggest', { preHandler: requireCapability('varunai.assist.read') }, async (request, reply) => {
    const parsed = suggestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request' });
    }

    try {
      const context = await buildAssistContext();
      const suggestion = await generateSuggestion(context, parsed.data.question);
      return reply.send(suggestion);
    } catch (err) {
      app.log.error(err, 'Assist suggest failed');
      return reply.status(204).send();
    }
  });
};
