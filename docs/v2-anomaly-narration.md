# V2: Anomaly Narration

**Status:** Planned
**Trigger condition:** Demo assist loop is stable and proven valuable (Gemini suggestions are accurate and presenters trust them).
**Estimated effort:** 2 weeks
**Depends on:** Prometheus metrics being reliably scraped; existing assist loop operational.

---

## Problem

Today, Varunai surfaces raw metric values in Grafana panels and raw audit events in `TraceFeedPanel`. The presenter must mentally correlate spikes, drops, and anomalies to figure out what is happening. This is fine for an experienced SRE, but during a live demo the presenter may not have time to interpret a sudden spike in `room404_ai_timeout_total` or a drop in `mystweaver_flag_evaluations_total`.

Anomaly narration uses Gemini to detect metric anomalies and produce plain-language explanations that appear directly in the TraceFeedPanel alongside raw events, giving the presenter instant context without leaving the dashboard.

## Architecture

```
┌──────────────┐      ┌─────────────────────┐
│  Prometheus   │◄─────│  OTel Collector     │
│  (scrape)     │      │  (apps emit metrics)│
└──────┬───────┘      └─────────────────────┘
       │ PromQL
       ▼
┌──────────────────────┐
│ AnomalyDetector      │  runs every 30s in varunai-api
│ (query + threshold)  │
└──────┬───────────────┘
       │ anomalies[]
       ▼
┌──────────────────────┐
│ Gemini narration      │  generates plain-language explanation
│ (anomaly-narration    │
│  prompt)              │
└──────┬───────────────┘
       │ ANOMALY_NARRATION event
       ▼
┌──────────────────────┐
│ WebSocket broadcast   │──► TraceFeedPanel (client)
└──────────────────────┘
```

## New Event Type: `ANOMALY_NARRATION`

Add to `packages/shared/src/events.ts`:

```typescript
export interface AnomalyNarrationEvent {
  type: 'ANOMALY_NARRATION';
  metric: string;
  service: string;
  severity: 'info' | 'warning' | 'critical';
  currentValue: number;
  baselineValue: number;
  deviationPercent: number;
  narration: string;        // Gemini-generated plain-language explanation
  suggestedAction?: string; // Optional recommendation
  windowStartMs: number;
  windowEndMs: number;
  timestamp: number;
}
```

Add it to the `ServerEvent` union:

```typescript
export type ServerEvent =
  | SessionUpdateEvent
  | FlagChangedEvent
  | AssistSuggestionEvent
  | AssistAppliedEvent
  | MetricUpdateEvent
  | AuditEvent
  | AnomalyNarrationEvent;  // V2
```

Add a new subscription channel `'anomaly'` to `SubscriptionChannel`:

```typescript
export type SubscriptionChannel = 'session' | 'flags' | 'assist' | 'audit' | 'anomaly';
```

## Anomaly Detection

### Metric Definitions and Thresholds

Define anomaly rules as configuration in a new file `apps/varunai-api/src/anomaly/rules.ts`:

```typescript
export interface AnomalyRule {
  metric: string;
  service: string;
  query: string;               // PromQL query
  baselineQuery: string;       // PromQL for rolling baseline (e.g., avg over 1h)
  thresholdPercent: number;    // deviation % that triggers anomaly
  severity: 'info' | 'warning' | 'critical';
  cooldownMs: number;          // minimum time between alerts for same metric
  description: string;         // human-readable description for prompt context
}

export const ANOMALY_RULES: AnomalyRule[] = [
  {
    metric: 'room404_ai_timeout_total',
    service: 'room404',
    query: 'rate(room404_ai_timeout_total[2m])',
    baselineQuery: 'avg_over_time(rate(room404_ai_timeout_total[2m])[30m:])',
    thresholdPercent: 200,
    severity: 'warning',
    cooldownMs: 120_000,
    description: 'Rate of AI generation timeouts in Room 404',
  },
  {
    metric: 'room404_players_active',
    service: 'room404',
    query: 'room404_players_active',
    baselineQuery: 'avg_over_time(room404_players_active[15m])',
    thresholdPercent: 50,  // 50% drop is significant
    severity: 'critical',
    cooldownMs: 60_000,
    description: 'Number of active players in Room 404',
  },
  {
    metric: 'mystweaver_flag_evaluations_total',
    service: 'mystweaver',
    query: 'rate(mystweaver_flag_evaluations_total[2m])',
    baselineQuery: 'avg_over_time(rate(mystweaver_flag_evaluations_total[2m])[30m:])',
    thresholdPercent: 150,
    severity: 'info',
    cooldownMs: 180_000,
    description: 'Rate of feature flag evaluations in MystWeaver',
  },
  {
    metric: 'mystweaver_circuit_breaker_state',
    service: 'mystweaver',
    query: 'mystweaver_circuit_breaker_state',
    baselineQuery: '0',  // baseline is always closed (0)
    thresholdPercent: 100,  // any non-zero is anomalous
    severity: 'critical',
    cooldownMs: 30_000,
    description: 'MystWeaver circuit breaker state (0=closed, 1=half-open, 2=open)',
  },
  {
    metric: 'varunai_assist_latency',
    service: 'varunai',
    query: 'histogram_quantile(0.95, rate(varunai_assist_latency_bucket[5m]))',
    baselineQuery: 'histogram_quantile(0.95, rate(varunai_assist_latency_bucket[30m]))',
    thresholdPercent: 200,
    severity: 'warning',
    cooldownMs: 120_000,
    description: 'P95 latency of Gemini assist suggestions',
  },
];
```

### Prometheus Client

Add a Prometheus query client in `apps/varunai-api/src/anomaly/prometheus.ts`:

```typescript
import { config } from '../config.js';

interface PrometheusResult {
  metric: Record<string, string>;
  value: [number, string]; // [timestamp, value]
}

export async function queryPrometheus(promql: string): Promise<number | null> {
  const url = new URL('/api/v1/query', config.GRAFANA_URL);
  // Grafana proxies to Prometheus via its datasource API
  // Alternatively, query Prometheus directly if exposed
  url.searchParams.set('query', promql);

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = (await res.json()) as {
    data: { result: PrometheusResult[] };
  };

  if (data.data.result.length === 0) return null;
  return parseFloat(data.data.result[0].value[1]);
}
```

Add `PROMETHEUS_URL` to `config.ts` (defaults to the Grafana-proxied datasource or a direct Prometheus endpoint).

### Detection Loop

Create `apps/varunai-api/src/anomaly/detector.ts`:

```typescript
import { ANOMALY_RULES, type AnomalyRule } from './rules.js';
import { queryPrometheus } from './prometheus.js';
import { narrateAnomaly } from './narrator.js';
import { broadcast } from '../routes/ws.js';
import { logger } from '@varunai/telemetry';

const lastFiredAt = new Map<string, number>();

export function startAnomalyDetector(): void {
  setInterval(() => void runDetectionCycle(), 30_000);
}

async function runDetectionCycle(): Promise<void> {
  const now = Date.now();

  for (const rule of ANOMALY_RULES) {
    try {
      // Cooldown check
      const lastFired = lastFiredAt.get(rule.metric) ?? 0;
      if (now - lastFired < rule.cooldownMs) continue;

      const [current, baseline] = await Promise.all([
        queryPrometheus(rule.query),
        queryPrometheus(rule.baselineQuery),
      ]);

      if (current === null || baseline === null) continue;
      if (baseline === 0 && current === 0) continue;

      const deviation = baseline === 0
        ? (current > 0 ? Infinity : 0)
        : Math.abs((current - baseline) / baseline) * 100;

      if (deviation < rule.thresholdPercent) continue;

      // Anomaly detected -- narrate it
      const narration = await narrateAnomaly(rule, current, baseline, deviation);
      if (!narration) continue;

      lastFiredAt.set(rule.metric, now);

      broadcast({
        type: 'ANOMALY_NARRATION',
        metric: rule.metric,
        service: rule.service,
        severity: rule.severity,
        currentValue: current,
        baselineValue: baseline,
        deviationPercent: Math.round(deviation),
        narration: narration.explanation,
        suggestedAction: narration.suggestedAction,
        windowStartMs: now - 120_000,
        windowEndMs: now,
        timestamp: now,
      });
    } catch (err) {
      logger.warn({ err, metric: rule.metric }, 'Anomaly detection failed for metric');
    }
  }
}
```

## Gemini Narration

### Narration Prompt

Create `apps/varunai-api/src/anomaly/narrator.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import type { AnomalyRule } from './rules.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

const NARRATION_SYSTEM_PROMPT = `You are an SRE analyst for a live demo ecosystem.
You interpret metric anomalies in plain language for a non-technical presenter.

Given a metric anomaly, produce:
1. A one-sentence explanation of what is happening and why it matters.
2. An optional one-sentence suggested action.

Respond as JSON: { "explanation": "...", "suggestedAction": "..." | null }

Keep language concise and avoid jargon. The presenter is showing this to an audience.
Reference the service and metric by name. Quantify the deviation.`;

interface NarrationResult {
  explanation: string;
  suggestedAction: string | null;
}

export async function narrateAnomaly(
  rule: AnomalyRule,
  currentValue: number,
  baselineValue: number,
  deviationPercent: number,
): Promise<NarrationResult | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const userPrompt = `Metric: ${rule.metric}
Service: ${rule.service}
Description: ${rule.description}
Severity: ${rule.severity}
Current value: ${currentValue.toFixed(2)}
Baseline value (rolling average): ${baselineValue.toFixed(2)}
Deviation: ${deviationPercent.toFixed(0)}% above threshold of ${rule.thresholdPercent}%

Explain this anomaly for a live demo presenter.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { role: 'model', parts: [{ text: NARRATION_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 200,
      },
    });

    const text = result.response.text();
    if (!text) return null;

    return JSON.parse(text) as NarrationResult;
  } catch {
    return null;
  }
}
```

## Client-Side Display

### TraceFeedPanel Changes

Update `TraceFeedPanel.tsx` to render `ANOMALY_NARRATION` events with distinct styling:

```tsx
// Inside the event list rendering
case 'ANOMALY_NARRATION':
  return (
    <div
      key={i}
      className={`flex flex-col gap-1 py-2 border-b text-sm ${
        event.severity === 'critical'
          ? 'border-warning-red/40 bg-warning-red/5'
          : event.severity === 'warning'
          ? 'border-ember-gold/40 bg-ember-gold/5'
          : 'border-bureaucrat-grey/20'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="timestamp text-xs">
          {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
        </span>
        <span className={`text-xs font-bold uppercase ${
          event.severity === 'critical' ? 'text-warning-red' :
          event.severity === 'warning' ? 'text-ember-gold' : 'text-spirit-teal'
        }`}>
          {event.severity}
        </span>
        <span className="text-ghost-white/60 text-xs">
          {event.service} / {event.metric}
        </span>
      </div>
      <p className="text-ghost-white/90 pl-4">{event.narration}</p>
      {event.suggestedAction && (
        <p className="text-ember-gold/80 pl-4 text-xs italic">
          Suggested: {event.suggestedAction}
        </p>
      )}
    </div>
  );
```

### Event Store Changes

The `eventStore` currently stores only `AuditEvent`. Generalize it to store a union type:

```typescript
type StoredEvent = AuditEvent | AnomalyNarrationEvent;
```

The store shape stays the same (`events: StoredEvent[]`, `addEvent(e: StoredEvent)`), but the `TraceFeedPanel` now switches on `event.type` to render different layouts.

### WebSocket Hook Changes

Add `ANOMALY_NARRATION` to the message handler in `useWebSocket.ts`:

```typescript
case 'ANOMALY_NARRATION':
  useEventStore.getState().addEvent(msg);
  break;
```

## Integration: Separate Loop vs. Extending Assist Loop

**Decision: Separate loop.**

The existing assist loop in `apps/varunai-api/src/assist/loop.ts` runs every 30 seconds and generates `AssistSuggestion` events. Anomaly detection has a fundamentally different concern:

- **Assist loop**: Evaluates session state and flags, suggests flag changes. Output is an `AssistSuggestion` with a `flagKey` and `suggestedValue`.
- **Anomaly loop**: Evaluates raw Prometheus metrics against baselines, narrates deviations. Output is an `AnomalyNarrationEvent` with metric context.

Mixing them would blur the prompt context and reduce accuracy for both. Instead:

1. `startAssistLoop()` continues running in `apps/varunai-api/src/index.ts` -- unchanged.
2. `startAnomalyDetector()` starts alongside it as a separate interval.

Both loops share the same WebSocket broadcast mechanism but produce different event types.

```typescript
// apps/varunai-api/src/index.ts
import { startAssistLoop } from './assist/loop.js';
import { startAnomalyDetector } from './anomaly/detector.js';

// ... after server starts ...
startAssistLoop();
startAnomalyDetector();
```

## Configuration

Add to `config.ts`:

```typescript
PROMETHEUS_URL: z.string().default('http://localhost:9090'),
ANOMALY_DETECTION_ENABLED: z.string().default('false'),
ANOMALY_DETECTION_INTERVAL_MS: z.string().default('30000'),
```

The feature is gated by `ANOMALY_DETECTION_ENABLED` so it can be turned on after the assist loop is proven stable.

## Testing Checklist

- [ ] Anomaly detector starts when `ANOMALY_DETECTION_ENABLED=true`.
- [ ] Prometheus queries return valid results for each rule.
- [ ] Threshold math correctly identifies deviations above the configured percent.
- [ ] Cooldown prevents duplicate alerts for the same metric within the window.
- [ ] Gemini narration returns valid JSON with `explanation` and optional `suggestedAction`.
- [ ] `ANOMALY_NARRATION` events appear in `TraceFeedPanel` with correct severity styling.
- [ ] Critical anomalies have red background, warnings have gold, info has default.
- [ ] Narration text is concise and understandable by a non-technical audience.
- [ ] Assist loop continues functioning independently -- no interference.
- [ ] When Prometheus is unreachable, the detector logs a warning and retries next cycle.
