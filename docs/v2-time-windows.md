# V2: Flexible Time Windows

**Status:** Planned
**Trigger condition:** Post-demo analytics become a use case (presenter wants to review a past session window, not just live `now-15m` to `now`).
**Estimated effort:** 1 week
**Depends on:** Nothing external -- purely a Varunai-side change.

---

## Problem

V1 hardcodes the Grafana iframe time range to `from=now-15m&to=now` in `MetricsPanel.tsx`. The `SessionContext.windowStartMs` / `windowEndMs` fields exist in `@varunai/shared` but are set once by `createV1SessionContext()` and never updated by user interaction. There is no UI for the presenter to scrub backward, zoom in on an incident, or review a completed session.

## Architecture Overview

```
┌─────────────────────────────────────┐
│  React Shell (apps/client)          │
│                                     │
│  ┌───────────────┐                  │
│  │ TimeRangePicker│──► Zustand      │
│  └───────────────┘    sessionStore  │
│                          │          │
│           ┌──────────────┘          │
│           ▼                         │
│  MetricsPanel.tsx                   │
│  builds Grafana URL with            │
│  from=${windowStartMs}              │
│  to=${windowEndMs}                  │
│                                     │
│  TraceFeedPanel.tsx                  │
│  filters events within window       │
│                                     │
│  SessionPanel.tsx                    │
│  shows snapshot at windowEndMs      │
└─────────────────────────────────────┘
```

## Implementation Steps

### 1. Extend the Zustand Session Store

The current `sessionStore.ts` only holds `SessionState | null`. Add time window state and actions:

```typescript
// apps/client/src/stores/sessionStore.ts
import { create } from 'zustand';
import type { SessionState } from '@varunai/shared';

type TimeMode = 'live' | 'fixed';

interface SessionStore {
  session: SessionState | null;
  setSession: (session: SessionState) => void;

  // V2 time window
  timeMode: TimeMode;
  windowStartMs: number;
  windowEndMs: number;
  setTimeWindow: (start: number, end: number) => void;
  setLiveMode: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),

  timeMode: 'live',
  windowStartMs: Date.now() - 15 * 60_000,
  windowEndMs: Date.now(),

  setTimeWindow: (start, end) =>
    set({ timeMode: 'fixed', windowStartMs: start, windowEndMs: end }),

  setLiveMode: () =>
    set({ timeMode: 'live', windowStartMs: Date.now() - 15 * 60_000, windowEndMs: Date.now() }),
}));
```

When `timeMode` is `'live'`, the store auto-advances `windowEndMs` to `Date.now()` on every render tick (use a 1-second `useEffect` interval in the root layout). When `timeMode` is `'fixed'`, the window stays pinned.

### 2. Create a TimeRangePicker Component

Add `apps/client/src/components/TimeRangePicker.tsx` -- a small toolbar rendered inside `StatusBar` that lets the presenter:

- Toggle between **Live** and **Fixed** mode.
- In Fixed mode, select a start/end time via two `<input type="datetime-local">` fields or preset buttons (last 5m, 15m, 1h, session duration).
- Show a visual indicator (pulsing dot when Live, static dot when Fixed) so the presenter always knows whether the dashboard is updating.

Wire it to `useSessionStore`:

```tsx
function TimeRangePicker() {
  const { timeMode, windowStartMs, windowEndMs, setTimeWindow, setLiveMode } =
    useSessionStore();

  if (timeMode === 'live') {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-spirit-teal animate-pulse" />
        <span className="label text-sm">Live</span>
        <button onClick={() => setTimeWindow(windowStartMs, Date.now())}
                className="label text-xs underline">
          Pin
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-ember-gold" />
      <input type="datetime-local" ... />
      <input type="datetime-local" ... />
      <button onClick={setLiveMode} className="label text-xs underline">Go Live</button>
    </div>
  );
}
```

### 3. Flow Time Window into Grafana Panels

In `MetricsPanel.tsx`, replace the hardcoded `from`/`to` params:

```typescript
// Before (V1)
const params = new URLSearchParams({
  orgId: '1',
  from: 'now-15m',
  to: 'now',
  theme: 'dark',
  kiosk: '',
});

// After (V2)
const { timeMode, windowStartMs, windowEndMs } = useSessionStore();

const from = timeMode === 'live' ? 'now-15m' : String(windowStartMs);
const to   = timeMode === 'live' ? 'now'     : String(windowEndMs);

const params = new URLSearchParams({
  orgId: '1',
  from,
  to,
  theme: 'dark',
  kiosk: '',
});
```

Grafana accepts epoch milliseconds in the `from`/`to` query parameters natively, so no conversion is needed.

### 4. Grafana Template Variable Configuration

For more granular control (e.g., passing the time window into individual panels via PromQL), configure Grafana dashboard template variables:

1. Open the Grafana dashboard (`ecosystem-overview`) in edit mode.
2. Add two template variables:
   - **Name:** `var_from` -- **Type:** Constant -- **Default:** leave empty.
   - **Name:** `var_to` -- **Type:** Constant -- **Default:** leave empty.
3. In each panel's PromQL query, use `$__from` and `$__to` (Grafana built-in time macros) for the time range. These already respect the URL `from`/`to` params -- no additional variable wiring is needed for basic time range scoping.
4. For queries that need explicit epoch timestamps (e.g., `timestamp() - $var_from`), pass them as URL parameters: `&var-var_from=${windowStartMs}&var-var_to=${windowEndMs}`.

The iframe URL becomes:

```
${grafanaUrl}/d/${dashboardUid}?orgId=1&from=${from}&to=${to}&theme=dark&kiosk&var-var_from=${windowStartMs}&var-var_to=${windowEndMs}
```

### 5. Filter TraceFeedPanel Events by Window

The `eventStore` currently holds all received `AuditEvent` objects in memory. In V2, the `TraceFeedPanel` should filter displayed events by the active time window:

```typescript
const events = useEventStore((s) => s.events);
const { windowStartMs, windowEndMs } = useSessionStore();

const filtered = events.filter(
  (e) => e.timestamp >= windowStartMs && e.timestamp <= windowEndMs
);
```

This keeps the store accumulating all events (useful for scrubbing backward) while the UI shows only the relevant slice.

### 6. SessionPanel Snapshot

When in Fixed mode, `SessionPanel` should display the session state as of `windowEndMs` rather than the latest state. This requires the API to support a `?at=<epochMs>` query parameter on `GET /api/session/current`. If Room 404 does not support point-in-time session state, degrade gracefully by showing the latest state with a banner: "Showing current state -- historical snapshots not available."

### 7. Update `SessionContext` in `@varunai/shared`

The `windowStartMs` / `windowEndMs` fields in `SessionContext` are already defined. The change is behavioral: they go from being set once by `createV1SessionContext()` to being updated continuously by user interaction. No schema change needed.

However, add a `timeMode` field to `SessionContext` so the API can know whether the client is in live or review mode (useful for future analytics on how presenters use the tool):

```typescript
export interface SessionContext {
  sessionId: string;
  sessionCode: string;
  startedAt: number;
  windowStartMs: number;
  windowEndMs: number;
  timeMode: 'live' | 'fixed'; // V2
}
```

## Migration Steps (V1 to V2)

1. Add `timeMode`, `windowStartMs`, `windowEndMs`, `setTimeWindow`, `setLiveMode` to the Zustand session store.
2. Create `TimeRangePicker` component and render it in `StatusBar`.
3. Update `MetricsPanel.tsx` to read window from the store instead of hardcoding.
4. Update `TraceFeedPanel.tsx` to filter events by the active window.
5. Add `timeMode` to `SessionContext` in `@varunai/shared` (non-breaking -- optional field).
6. Update Grafana dashboard to accept `var_from` / `var_to` template variables.
7. Test: switch between Live and Fixed modes, verify Grafana iframe updates, verify event filtering.

All changes are backward-compatible. The default `timeMode: 'live'` preserves V1 behavior exactly.

## Testing Checklist

- [ ] Live mode auto-advances and Grafana iframe shows real-time data.
- [ ] Switching to Fixed mode freezes the Grafana iframe at the selected range.
- [ ] TraceFeedPanel shows only events within the selected window.
- [ ] Preset buttons (5m, 15m, 1h, session duration) set correct epoch ranges.
- [ ] Returning to Live mode resumes real-time display.
- [ ] The `kiosk` param still hides Grafana chrome in both modes.
