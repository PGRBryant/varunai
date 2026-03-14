import { useEffect, useRef } from 'react';
import type { ServerEvent } from '@varunai/shared';
import { useSessionStore } from '../stores/sessionStore';
import { useFlagStore } from '../stores/flagStore';
import { useAssistStore } from '../stores/assistStore';
import { useEventStore } from '../stores/eventStore';

const MAX_RECONNECT_DELAY = 30_000;

function getPresenterToken(): string {
  // 1. URL param (demo convenience: ?token=vk_live_abc123)
  const urlToken = new URLSearchParams(window.location.search).get('token');
  if (urlToken) return urlToken;
  // 2. Build-time env var
  if (import.meta.env.VITE_PRESENTER_TOKEN) return import.meta.env.VITE_PRESENTER_TOKEN as string;
  // 3. Fallback for local dev (Verika auth falls back gracefully)
  return 'dev-token';
}

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
    let reconnectDelay = 3000;

    async function connect() {
      if (disposed) return;

      // Gate: check API health before attempting WebSocket connection
      try {
        const apiUrl = import.meta.env.DEV
          ? ''
          : (import.meta.env.VITE_API_URL || 'https://varunai-api-qk3n3mly6q-uc.a.run.app');
        const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error('API not ready');
      } catch {
        // API not reachable — back off and retry later
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
        reconnectTimer = setTimeout(() => void connect(), reconnectDelay);
        return;
      }

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelay = 3000; // Reset backoff on successful connection
        ws.send(JSON.stringify({ type: 'AUTH', token: getPresenterToken() }));
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
            case 'ASSIST_APPLIED':
              // Surface in trace feed so the full Gemini → flag change flow is visible
              useEventStore.getState().addEvent({
                type: 'AUDIT_EVENT',
                caller: 'gemini-assist',
                target: msg.flagKey,
                capability: 'flag.write',
                allowed: true,
                traceId: msg.traceId,
                timestamp: Date.now(),
              });
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
          reconnectTimer = setTimeout(() => void connect(), reconnectDelay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    void connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);
}
