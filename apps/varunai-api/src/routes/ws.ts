import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import type { ServerEvent, ClientMessage, SubscriptionChannel } from '@varunai/shared';

interface ConnectedClient {
  socket: WebSocket;
  channels: Set<SubscriptionChannel>;
  authenticated: boolean;
}

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

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as ClientMessage;

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

async function handleFlagChange(key: string, value: unknown): Promise<void> {
  try {
    const { patchFlag } = await import('../clients/mystweaver.js');
    await patchFlag(key, value as string, 'Manual change from dashboard');
  } catch {
    // Silent failure
  }
}
