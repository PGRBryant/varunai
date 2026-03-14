import type { FastifyPluginAsync } from 'fastify';
import type { ServerEvent, SubscriptionChannel } from '@varunai/shared';
import { z } from 'zod';

interface ConnectedClient {
  socket: { readyState: number; send: (data: string) => void; on: (event: string, handler: (data: unknown) => void) => void };
  channels: Set<SubscriptionChannel>;
  authenticated: boolean;
}

const authSchema = z.object({ type: z.literal('AUTH'), token: z.string() });
const subscribeSchema = z.object({
  type: z.literal('SUBSCRIBE'),
  channels: z.array(z.enum(['session', 'flags', 'assist', 'audit'])),
});
const pingSchema = z.object({ type: z.literal('PING') });
const assistQuerySchema = z.object({ type: z.literal('ASSIST_QUERY'), question: z.string() });
const flagChangeSchema = z.object({
  type: z.literal('FLAG_CHANGE'),
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const clientMessageSchema = z.discriminatedUnion('type', [
  authSchema,
  subscribeSchema,
  pingSchema,
  assistQuerySchema,
  flagChangeSchema,
]);

const clients = new Set<ConnectedClient>();

export function broadcast(event: ServerEvent): void {
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (client.authenticated && client.socket.readyState === 1) {
      const channelMap: Record<string, SubscriptionChannel> = {
        SESSION_UPDATE: 'session',
        FLAG_CHANGED: 'flags',
        ASSIST_SUGGESTION: 'assist',
        ASSIST_APPLIED: 'assist',
        METRIC_UPDATE: 'session',
        AUDIT_EVENT: 'audit',
      };
      const channel = channelMap[event.type];
      if (!channel || client.channels.has(channel)) {
        client.socket.send(data);
      }
    }
  }
}

export const wsHandler: FastifyPluginAsync = async (app) => {
  app.get('/ws', { websocket: true }, (socket) => {
    const client: ConnectedClient = {
      socket,
      channels: new Set(),
      authenticated: false,
    };
    clients.add(client);

    socket.on('message', (raw: unknown) => {
      try {
        const json: unknown = JSON.parse(String(raw));
        const result = clientMessageSchema.safeParse(json);
        if (!result.success) {
          console.warn('[ws] Invalid message:', result.error.format());
          return;
        }
        const msg = result.data;

        switch (msg.type) {
          case 'AUTH':
            // TODO: validate via Verika
            client.authenticated = true;
            socket.send(JSON.stringify({ type: 'AUTH_OK' }));
            break;

          case 'SUBSCRIBE':
            for (const ch of msg.channels) {
              client.channels.add(ch);
            }
            break;

          case 'PING':
            socket.send(JSON.stringify({ type: 'PONG' }));
            break;

          case 'ASSIST_QUERY':
            // Delegate to assist route logic
            void handleAssistQuery(msg.question, client);
            break;

          case 'FLAG_CHANGE':
            // Delegate to flag route logic
            void handleFlagChange(msg.key, msg.value);
            break;
        }
      } catch {
        // Malformed message — ignore
      }
    });

    socket.on('close', () => {
      clients.delete(client);
    });
  });
};

async function handleAssistQuery(question: string, client: ConnectedClient): Promise<void> {
  try {
    const { buildAssistContext } = await import('../assist/context.js');
    const { generateSuggestion } = await import('../assist/gemini.js');
    const context = await buildAssistContext();
    const suggestion = await generateSuggestion(context, question);
    if (suggestion) {
      client.socket.send(JSON.stringify({ type: 'ASSIST_SUGGESTION', suggestion }));
    }
  } catch {
    // Silent failure
  }
}

async function handleFlagChange(key: string, value: string | number | boolean): Promise<void> {
  try {
    const { patchFlag } = await import('../clients/mystweaver.js');
    const { recordFlagChange } = await import('../assist/context.js');
    const result = await patchFlag(key, String(value), 'Manual change from dashboard');
    broadcast({
      type: 'FLAG_CHANGED',
      key,
      from: 'unknown',
      to: result.newValue,
      changedBy: 'dashboard',
      traceId: result.traceId,
    });
    recordFlagChange({
      flagKey: key,
      previousValue: undefined,
      newValue: value,
      changedBy: 'dashboard',
      timestamp: Date.now(),
      traceId: result.traceId,
    });
  } catch {
    // Silent failure
  }
}
