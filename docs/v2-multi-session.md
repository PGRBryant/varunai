# V2: Multi-Session Support

**Status:** Planned
**Trigger condition:** Room 404 orchestration supports multiple concurrent sessions (today it exposes only `GET /api/session/current` which returns a single session).
**Estimated effort:** 1 week (Varunai UI) + depends on Room 404 orchestration timeline.
**Depends on:** Room 404 adding a session list endpoint and multi-session lifecycle management.

---

## Problem

V1 assumes a single active session. The `fetchCurrentSession()` client in `apps/varunai-api/src/clients/room404.ts` hits `/api/session/current` and returns one `SessionState`. The Zustand `sessionStore` holds `session: SessionState | null` -- singular. The WebSocket hook sends one `SUBSCRIBE` message and routes all `SESSION_UPDATE` events to that single slot.

When Room 404 supports running multiple rooms simultaneously (e.g., different presenter tracks at a conference), Varunai needs to let the presenter pick which session to observe and toggle between them without losing state.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  StatusBar                                   │
│  ┌──────────────────────┐                    │
│  │ SessionSelector ▾    │  dropdown          │
│  │  SESSION-ABC (active) │                   │
│  │  SESSION-XYZ (active) │                   │
│  │  SESSION-DEF (done)   │                   │
│  └──────────────────────┘                    │
│         │                                    │
│         ▼                                    │
│  useSessionStore.setActiveSessionId(id)      │
│         │                                    │
│         ├──► WebSocket: re-SUBSCRIBE         │
│         ├──► MetricsPanel: re-scope Grafana  │
│         └──► TraceFeedPanel: filter events   │
└─────────────────────────────────────────────┘
```

## Room 404: Required API Changes

Room 404 must add a session list endpoint. See `docs/room404-integration.md` for the full specification. Summary:

### `GET /api/sessions`

Returns all sessions (active and recently completed):

```json
{
  "sessions": [
    {
      "sessionId": "sess_abc123",
      "sessionCode": "TOWER-7",
      "state": "active",
      "playerCount": 24,
      "startedAt": 1710000000000
    },
    {
      "sessionId": "sess_xyz789",
      "sessionCode": "TOWER-3",
      "state": "completed",
      "playerCount": 18,
      "startedAt": 1709990000000
    }
  ]
}
```

**Capability required:** `session.read` via Verika.

### `GET /api/sessions/:sessionId`

Returns full `SessionState` for a specific session (same schema as current `/api/session/current` but parameterized).

## Implementation Steps

### 1. Add Session List Client

Add to `apps/varunai-api/src/clients/room404.ts`:

```typescript
export interface SessionListEntry {
  sessionId: string;
  sessionCode: string;
  state: SessionLifecycle;
  playerCount: number;
  startedAt: number;
}

export async function fetchSessionList(): Promise<SessionListEntry[]> {
  const res = await fetch(`${config.ROOM404_API_URL}/api/sessions`, {
    headers: { Authorization: `Bearer ${config.VERIKA_SERVICE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Room 404 session list: ${res.status}`);
  const data = (await res.json()) as { sessions: SessionListEntry[] };
  return data.sessions;
}

export async function fetchSessionById(sessionId: string): Promise<SessionState> {
  const res = await fetch(
    `${config.ROOM404_API_URL}/api/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${config.VERIKA_SERVICE_TOKEN}` } },
  );
  if (!res.ok) throw new Error(`Room 404 session ${sessionId}: ${res.status}`);
  return (await res.json()) as SessionState;
}
```

### 2. Add Session List API Route

Add `GET /api/sessions` route in varunai-api that proxies to Room 404:

```typescript
// apps/varunai-api/src/routes/session.ts
app.get('/', async (_request, reply) => {
  const sessions = await fetchSessionList();
  return reply.send({ sessions });
});
```

### 3. Extend the Zustand Session Store

Replace the single-session store with a multi-session-aware store:

```typescript
// apps/client/src/stores/sessionStore.ts
import { create } from 'zustand';
import type { SessionState } from '@varunai/shared';

interface SessionListEntry {
  sessionId: string;
  sessionCode: string;
  state: 'waiting' | 'active' | 'completed';
  playerCount: number;
  startedAt: number;
}

interface SessionStore {
  // V1 compat
  session: SessionState | null;
  setSession: (session: SessionState) => void;

  // V2 multi-session
  sessionList: SessionListEntry[];
  activeSessionId: string | null;
  setSessionList: (list: SessionListEntry[]) => void;
  setActiveSessionId: (id: string) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),

  sessionList: [],
  activeSessionId: null,

  setSessionList: (list) => {
    set({ sessionList: list });
    // Auto-select first active session if none selected
    const current = get().activeSessionId;
    if (!current || !list.some((s) => s.sessionId === current)) {
      const active = list.find((s) => s.state === 'active');
      if (active) set({ activeSessionId: active.sessionId });
    }
  },

  setActiveSessionId: (id) => set({ activeSessionId: id }),
}));
```

### 4. Create SessionSelector Component

Add a dropdown to `StatusBar` that shows available sessions:

```tsx
// apps/client/src/components/SessionSelector.tsx
import { useSessionStore } from '../stores/sessionStore';
import { useEffect } from 'react';

export function SessionSelector() {
  const { sessionList, activeSessionId, setSessionList, setActiveSessionId } =
    useSessionStore();

  // Poll session list every 10 seconds
  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessionList(data.sessions);
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 10_000);
    return () => clearInterval(interval);
  }, [setSessionList]);

  if (sessionList.length <= 1) return null; // Hide if only one session

  return (
    <select
      value={activeSessionId ?? ''}
      onChange={(e) => setActiveSessionId(e.target.value)}
      className="bg-shadow-blue border border-bureaucrat-grey/30 text-ghost-white
                 rounded px-2 py-1 text-sm font-mono"
    >
      {sessionList.map((s) => (
        <option key={s.sessionId} value={s.sessionId}>
          {s.sessionCode} ({s.state}) - {s.playerCount} players
        </option>
      ))}
    </select>
  );
}
```

Render `<SessionSelector />` in `StatusBar` between the title and the service health indicators.

### 5. WebSocket Reconnection on Session Change

The `useWebSocket` hook must reconnect (or re-subscribe) when `activeSessionId` changes. Modify the hook to take `activeSessionId` as a dependency:

```typescript
// apps/client/src/hooks/useWebSocket.ts
export function useWebSocket(): void {
  const wsRef = useRef<WebSocket | null>(null);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'AUTH', token: 'dev-token' }));
        ws.send(
          JSON.stringify({
            type: 'SUBSCRIBE',
            channels: ['session', 'flags', 'assist', 'audit'],
            sessionId: activeSessionId, // V2: scope to session
          })
        );
      };

      // ... rest of message handling unchanged ...

      ws.onclose = () => {
        if (!disposed) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [activeSessionId]); // Re-run on session change
}
```

Adding `activeSessionId` to the dependency array causes the entire effect to clean up (closing the old WebSocket) and reconnect with the new session scope.

### 6. WebSocket Protocol Changes

Extend the `SubscribeMessage` in `@varunai/shared`:

```typescript
export interface SubscribeMessage {
  type: 'SUBSCRIBE';
  channels: SubscriptionChannel[];
  sessionId?: string; // V2: optional session scope
}
```

On the server side (`apps/varunai-api/src/routes/ws.ts`), update the `ConnectedClient` to track the subscribed session and filter broadcasts:

```typescript
interface ConnectedClient {
  socket: WebSocket;
  channels: Set<SubscriptionChannel>;
  authenticated: boolean;
  sessionId: string | null; // V2
}
```

In the `broadcast()` function, filter by `sessionId` when the event carries one:

```typescript
export function broadcast(event: ServerEvent, sessionId?: string): void {
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (!client.authenticated || client.socket.readyState !== 1) continue;
    // If event is session-scoped and client is session-scoped, match them
    if (sessionId && client.sessionId && client.sessionId !== sessionId) continue;
    // ... existing channel check ...
    client.socket.send(data);
  }
}
```

### 7. Scope Grafana Panels to Session

Add a `var-sessionId` parameter to the Grafana iframe URL so PromQL queries can filter by session label:

```typescript
const params = new URLSearchParams({
  orgId: '1',
  from,
  to,
  theme: 'dark',
  kiosk: '',
  'var-sessionId': activeSessionId ?? '',
});
```

Grafana panels that use `room404_*` metrics should include `{sessionId="$sessionId"}` in their PromQL selectors.

### 8. Event Store: Per-Session Isolation

Events from different sessions should not bleed into each other. Tag each event in the store:

```typescript
interface StoredEvent extends AuditEvent {
  _sessionId: string;
}
```

In `TraceFeedPanel`, filter by `activeSessionId`:

```typescript
const events = useEventStore((s) => s.events);
const activeSessionId = useSessionStore((s) => s.activeSessionId);
const filtered = events.filter((e) => e._sessionId === activeSessionId);
```

## Migration Steps (V1 to V2)

1. **Room 404 ships `GET /api/sessions` and `GET /api/sessions/:id`** -- this is the external dependency and gate.
2. Add `fetchSessionList()` and `fetchSessionById()` to `room404.ts` client.
3. Add `GET /api/sessions` proxy route in varunai-api.
4. Extend `sessionStore.ts` with `sessionList`, `activeSessionId`, `setSessionList`, `setActiveSessionId`.
5. Create `SessionSelector` component, embed in `StatusBar`.
6. Add `sessionId` to `SubscribeMessage` in `@varunai/shared`.
7. Update `useWebSocket` to depend on `activeSessionId` and pass it in `SUBSCRIBE`.
8. Update server-side `broadcast()` to filter by `sessionId`.
9. Tag events in `eventStore` with session ID, filter in `TraceFeedPanel`.
10. Add `var-sessionId` to Grafana iframe URL.

**Backward compatibility:** When `activeSessionId` is null or the session list has only one entry, behavior is identical to V1. The `sessionId` field in `SubscribeMessage` is optional.

## Testing Checklist

- [ ] With one active session, `SessionSelector` is hidden -- V1 behavior preserved.
- [ ] With multiple active sessions, dropdown appears and lists all sessions.
- [ ] Selecting a different session closes the old WebSocket and opens a new one.
- [ ] Events from the previous session do not appear in `TraceFeedPanel` after switching.
- [ ] Grafana iframe updates to show metrics for the selected session.
- [ ] Session list auto-refreshes every 10 seconds.
- [ ] Completed sessions appear in the list but are visually distinct.
- [ ] Assist loop context uses the selected session, not always "current."
