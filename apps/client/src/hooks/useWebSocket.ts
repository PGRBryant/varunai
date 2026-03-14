import { useEffect, useRef } from 'react';
import type { ServerEvent } from '@varunai/shared';
import { useSessionStore } from '../stores/sessionStore';
import { useFlagStore } from '../stores/flagStore';
import { useAssistStore } from '../stores/assistStore';
import { useEventStore } from '../stores/eventStore';

const RECONNECT_DELAY = 3000;

function getWsUrl(): string {
  // In dev, proxy through Vite to localhost API
  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/ws`;
  }
  // In production, connect directly to Cloud Run (Firebase Hosting doesn't proxy WebSockets)
  const apiUrl = import.meta.env.VITE_API_URL || 'https://varunai-api-qk3n3mly6q-uc.a.run.app';
  return apiUrl.replace(/^http/, 'ws') + '/ws';
}

export function useWebSocket(): void {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'AUTH', token: 'dev-token' }));
        ws.send(
          JSON.stringify({
            type: 'SUBSCRIBE',
            channels: ['session', 'flags', 'assist', 'audit'],
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerEvent;
          switch (msg.type) {
            case 'SESSION_UPDATE':
              useSessionStore.getState().setSession({
                sessionId: '',
                sessionCode: '',
                state: 'active',
                playerCount: msg.players,
                players: [],
                floorDistribution: msg.floors,
                completionRate: msg.completionRate,
                averageScore: 0,
                leaderboard: msg.leaderboard,
                startedAt: Date.now(),
              });
              break;
            case 'FLAG_CHANGED':
              useFlagStore.getState().setFlag(msg.key, msg.to);
              break;
            case 'ASSIST_SUGGESTION':
              useAssistStore.getState().setSuggestion(msg.suggestion);
              break;
            case 'AUDIT_EVENT':
              useEventStore.getState().addEvent(msg);
              break;
          }
        } catch {
          // Malformed message
        }
      };

      ws.onclose = () => {
        if (!disposed) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);
}
