# V2: SRE/Security Narration

**Status:** Planned
**Trigger condition:** Anomaly narration (see `docs/v2-anomaly-narration.md`) is stable and proven valuable.
**Estimated effort:** 3 weeks
**Depends on:** Anomaly narration system operational; Verika audit stream accessible.

---

## Problem

Varunai already displays raw Verika audit events in `TraceFeedPanel` -- each showing `caller -> target`, the capability checked, and whether it was allowed or denied. But these are individual data points. The presenter cannot easily spot patterns like:

- A service making an unusual number of cross-service calls in a short window.
- Capability usage that deviates from normal patterns (potential privilege escalation attempt).
- Correlated failures across multiple services that indicate a systemic issue.
- Denied capability checks that cluster around a specific service (misconfiguration).

SRE/Security narration builds on the anomaly narration infrastructure to interpret Verika audit streams, detect suspicious patterns, and surface plain-language security insights.

## Architecture

```
┌───────────────────┐     ┌───────────────────┐
│ Verika Audit API  │     │ Prometheus         │
│ (audit.read)      │     │ (metrics)          │
└────────┬──────────┘     └────────┬───────────┘
         │ audit events            │ metric anomalies
         ▼                         ▼
┌─────────────────────────────────────────────┐
│ SecurityAnalyzer (varunai-api)               │
│                                              │
│  ┌──────────────┐   ┌──────────────────┐    │
│  │ PatternEngine│   │ AlertCorrelator  │    │
│  │ (audit rules)│   │ (metric+audit)   │    │
│  └──────┬───────┘   └──────┬───────────┘    │
│         │                   │                │
│         └─────────┬─────────┘                │
│                   ▼                          │
│         ┌─────────────────┐                  │
│         │ Gemini Narrator │                  │
│         │ (security prompt)│                 │
│         └────────┬────────┘                  │
└──────────────────┼──────────────────────────┘
                   │ SECURITY_NARRATION event
                   ▼
           WebSocket broadcast
                   │
                   ▼
           TraceFeedPanel (client)
```

## New Event Type: `SECURITY_NARRATION`

Add to `packages/shared/src/events.ts`:

```typescript
export type SecuritySeverity = 'info' | 'warning' | 'critical';

export interface SecurityNarrationEvent {
  type: 'SECURITY_NARRATION';
  category: 'unusual_access' | 'privilege_escalation' | 'denial_cluster' | 'cross_service_anomaly' | 'correlated_failure';
  severity: SecuritySeverity;
  services: string[];         // services involved
  narration: string;          // Gemini-generated explanation
  evidence: SecurityEvidence[];
  suggestedAction?: string;
  windowStartMs: number;
  windowEndMs: number;
  timestamp: number;
}

export interface SecurityEvidence {
  type: 'audit_event' | 'metric_anomaly';
  summary: string;
  traceId?: string;
  timestamp: number;
}
```

Add to the `ServerEvent` union and add `'security'` to `SubscriptionChannel`.

## Pattern Detection Rules

### Audit Pattern Engine

Create `apps/varunai-api/src/security/patterns.ts`:

```typescript
import type { SecurityNarrationEvent } from '@varunai/shared';

interface AuditEntry {
  caller: string;
  target: string;
  capability: string;
  allowed: boolean;
  traceId: string;
  timestamp: number;
}

// Sliding window buffer -- keeps last 5 minutes of audit events
const auditBuffer: AuditEntry[] = [];
const WINDOW_MS = 5 * 60_000;

export function ingestAuditEvent(entry: AuditEntry): void {
  auditBuffer.push(entry);
  // Prune old entries
  const cutoff = Date.now() - WINDOW_MS;
  while (auditBuffer.length > 0 && auditBuffer[0].timestamp < cutoff) {
    auditBuffer.shift();
  }
}

export interface DetectedPattern {
  category: SecurityNarrationEvent['category'];
  severity: SecurityNarrationEvent['severity'];
  services: string[];
  evidence: Array<{ summary: string; traceId?: string; timestamp: number }>;
  contextForNarration: string; // structured text for Gemini prompt
}

export function detectPatterns(): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const now = Date.now();

  // 1. Denial clusters: >5 denied requests from same caller in 2 minutes
  patterns.push(...detectDenialClusters(now));

  // 2. Unusual access: a service calling a target it hasn't called before in this window
  patterns.push(...detectUnusualAccess(now));

  // 3. Privilege escalation: sequential capability requests with increasing scope
  patterns.push(...detectPrivilegeEscalation(now));

  // 4. Cross-service anomaly: fan-out pattern (one caller hitting >3 distinct targets in 1 minute)
  patterns.push(...detectCrossServiceFanout(now));

  return patterns;
}
```

### Rule: Denial Clusters

```typescript
function detectDenialClusters(now: number): DetectedPattern[] {
  const windowMs = 2 * 60_000;
  const threshold = 5;
  const recent = auditBuffer.filter(
    (e) => !e.allowed && e.timestamp > now - windowMs
  );

  // Group by caller
  const byCaller = new Map<string, AuditEntry[]>();
  for (const entry of recent) {
    const list = byCaller.get(entry.caller) ?? [];
    list.push(entry);
    byCaller.set(entry.caller, list);
  }

  const patterns: DetectedPattern[] = [];
  for (const [caller, entries] of byCaller) {
    if (entries.length < threshold) continue;

    const targets = [...new Set(entries.map((e) => e.target))];
    const capabilities = [...new Set(entries.map((e) => e.capability))];

    patterns.push({
      category: 'denial_cluster',
      severity: entries.length > 10 ? 'critical' : 'warning',
      services: [caller, ...targets],
      evidence: entries.slice(0, 5).map((e) => ({
        summary: `${e.caller} denied ${e.capability} on ${e.target}`,
        traceId: e.traceId,
        timestamp: e.timestamp,
      })),
      contextForNarration: `Service "${caller}" has been denied access ${entries.length} times in the last 2 minutes. ` +
        `Targeted services: ${targets.join(', ')}. Capabilities attempted: ${capabilities.join(', ')}.`,
    });
  }

  return patterns;
}
```

### Rule: Unusual Access Patterns

```typescript
function detectUnusualAccess(now: number): DetectedPattern[] {
  // Compare the last 1 minute against the preceding 4 minutes
  const recentWindow = 60_000;
  const baselineWindow = 4 * 60_000;

  const recent = auditBuffer.filter((e) => e.timestamp > now - recentWindow);
  const baseline = auditBuffer.filter(
    (e) => e.timestamp > now - baselineWindow && e.timestamp <= now - recentWindow
  );

  const baselinePairs = new Set(baseline.map((e) => `${e.caller}|${e.target}|${e.capability}`));
  const novelPairs = recent.filter(
    (e) => !baselinePairs.has(`${e.caller}|${e.target}|${e.capability}`)
  );

  if (novelPairs.length < 3) return []; // noise threshold

  const services = [...new Set(novelPairs.flatMap((e) => [e.caller, e.target]))];

  return [{
    category: 'unusual_access',
    severity: 'info',
    services,
    evidence: novelPairs.slice(0, 5).map((e) => ({
      summary: `New pattern: ${e.caller} -> ${e.target} (${e.capability})`,
      traceId: e.traceId,
      timestamp: e.timestamp,
    })),
    contextForNarration: `${novelPairs.length} new caller-target-capability combinations appeared in the last minute that were not seen in the preceding 4 minutes. ` +
      `Services involved: ${services.join(', ')}.`,
  }];
}
```

### Rule: Privilege Escalation Attempts

```typescript
// Ordered capability scopes from least to most privileged
const CAPABILITY_SCOPE_ORDER = [
  'metrics.read',
  'stream.subscribe',
  'session.read',
  'audit.read',
  'flag.read',
  'flag.write',
  'admin.read',
  'admin.write',
];

function detectPrivilegeEscalation(now: number): DetectedPattern[] {
  const windowMs = 2 * 60_000;
  const recent = auditBuffer.filter((e) => e.timestamp > now - windowMs);

  const byCaller = new Map<string, AuditEntry[]>();
  for (const entry of recent) {
    const list = byCaller.get(entry.caller) ?? [];
    list.push(entry);
    byCaller.set(entry.caller, list);
  }

  const patterns: DetectedPattern[] = [];
  for (const [caller, entries] of byCaller) {
    // Sort by timestamp
    const sorted = entries.sort((a, b) => a.timestamp - b.timestamp);

    let maxScopeIndex = -1;
    let escalationCount = 0;

    for (const entry of sorted) {
      const scopeIndex = CAPABILITY_SCOPE_ORDER.indexOf(entry.capability);
      if (scopeIndex > maxScopeIndex) {
        if (maxScopeIndex >= 0) escalationCount++;
        maxScopeIndex = scopeIndex;
      }
    }

    if (escalationCount < 2) continue; // Need at least 2 escalation steps

    patterns.push({
      category: 'privilege_escalation',
      severity: 'critical',
      services: [caller],
      evidence: sorted.slice(0, 5).map((e) => ({
        summary: `${e.caller} requested ${e.capability} (${e.allowed ? 'allowed' : 'denied'})`,
        traceId: e.traceId,
        timestamp: e.timestamp,
      })),
      contextForNarration: `Service "${caller}" made ${escalationCount} escalating capability requests in 2 minutes, ` +
        `progressing through: ${sorted.map((e) => e.capability).join(' -> ')}.`,
    });
  }

  return patterns;
}
```

### Rule: Cross-Service Fan-Out

```typescript
function detectCrossServiceFanout(now: number): DetectedPattern[] {
  const windowMs = 60_000;
  const fanoutThreshold = 4;
  const recent = auditBuffer.filter((e) => e.timestamp > now - windowMs);

  const byCaller = new Map<string, Set<string>>();
  for (const entry of recent) {
    const targets = byCaller.get(entry.caller) ?? new Set();
    targets.add(entry.target);
    byCaller.set(entry.caller, targets);
  }

  const patterns: DetectedPattern[] = [];
  for (const [caller, targets] of byCaller) {
    if (targets.size < fanoutThreshold) continue;

    const targetList = [...targets];
    const entries = recent.filter((e) => e.caller === caller);

    patterns.push({
      category: 'cross_service_anomaly',
      severity: 'warning',
      services: [caller, ...targetList],
      evidence: entries.slice(0, 5).map((e) => ({
        summary: `${e.caller} -> ${e.target} (${e.capability})`,
        traceId: e.traceId,
        timestamp: e.timestamp,
      })),
      contextForNarration: `Service "${caller}" contacted ${targets.size} distinct services in the last minute: ${targetList.join(', ')}. ` +
        `This fan-out pattern may indicate a scanning behavior or orchestration issue.`,
    });
  }

  return patterns;
}
```

## Alert Correlation

### Correlating Metric Anomalies with Audit Patterns

The `AlertCorrelator` joins metric anomalies (from `v2-anomaly-narration`) with audit patterns to produce richer narrations. Create `apps/varunai-api/src/security/correlator.ts`:

```typescript
import type { AnomalyNarrationEvent } from '@varunai/shared';
import type { DetectedPattern } from './patterns.js';

interface CorrelatedInsight {
  metricAnomaly: AnomalyNarrationEvent | null;
  auditPattern: DetectedPattern;
  correlationReason: string;
}

// Buffer of recent metric anomalies for correlation
const recentAnomalies: AnomalyNarrationEvent[] = [];

export function recordMetricAnomaly(anomaly: AnomalyNarrationEvent): void {
  recentAnomalies.push(anomaly);
  const cutoff = Date.now() - 5 * 60_000;
  while (recentAnomalies.length > 0 && recentAnomalies[0].timestamp < cutoff) {
    recentAnomalies.shift();
  }
}

export function correlate(patterns: DetectedPattern[]): CorrelatedInsight[] {
  return patterns.map((pattern) => {
    // Find metric anomalies involving the same services within 2 minutes
    const relatedAnomalies = recentAnomalies.filter(
      (a) =>
        pattern.services.includes(a.service) &&
        Math.abs(a.timestamp - Date.now()) < 2 * 60_000
    );

    if (relatedAnomalies.length === 0) {
      return { metricAnomaly: null, auditPattern: pattern, correlationReason: '' };
    }

    const anomaly = relatedAnomalies[0];
    return {
      metricAnomaly: anomaly,
      auditPattern: pattern,
      correlationReason:
        `Metric anomaly on ${anomaly.service}/${anomaly.metric} ` +
        `(${anomaly.deviationPercent}% deviation) occurred within 2 minutes of this audit pattern.`,
    };
  });
}
```

## Gemini Security Narration Prompt

Create `apps/varunai-api/src/security/narrator.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import type { DetectedPattern } from './patterns.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

const SECURITY_SYSTEM_PROMPT = `You are a security analyst for a live microservice ecosystem demo.
You interpret audit log patterns and produce plain-language security insights for a presenter.

The ecosystem has three services:
- MystWeaver: feature flag management
- Room 404: multiplayer game server
- Verika: authentication and authorization

Given a detected audit pattern and optional correlated metric anomaly, produce:
1. A 1-2 sentence explanation of what is happening and whether it is concerning.
2. An optional suggested action.

Respond as JSON: { "narration": "...", "suggestedAction": "..." | null }

Be specific about services and capabilities. Avoid false alarms -- if the pattern
could be normal behavior, say so. The presenter is showing this live.`;

interface NarrationResult {
  narration: string;
  suggestedAction: string | null;
}

export async function narrateSecurityPattern(
  pattern: DetectedPattern,
  correlationContext: string,
): Promise<NarrationResult | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const userPrompt = `Category: ${pattern.category}
Severity: ${pattern.severity}
Services involved: ${pattern.services.join(', ')}

Pattern details:
${pattern.contextForNarration}

Evidence (first 5 events):
${pattern.evidence.map((e) => `  - ${e.summary}`).join('\n')}

${correlationContext ? `Correlated metric anomaly:\n${correlationContext}` : 'No correlated metric anomalies.'}

Explain this pattern for a live demo presenter.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { role: 'model', parts: [{ text: SECURITY_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 250,
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

## Security Analysis Loop

Create `apps/varunai-api/src/security/loop.ts`:

```typescript
import { detectPatterns, ingestAuditEvent } from './patterns.js';
import { correlate, recordMetricAnomaly } from './correlator.js';
import { narrateSecurityPattern } from './narrator.js';
import { broadcast } from '../routes/ws.js';
import { logger } from '@varunai/telemetry';

const lastFiredAt = new Map<string, number>();
const COOLDOWN_MS = 3 * 60_000;

export function startSecurityAnalyzer(): void {
  setInterval(() => void runSecurityCycle(), 30_000);
}

async function runSecurityCycle(): Promise<void> {
  const patterns = detectPatterns();
  if (patterns.length === 0) return;

  const insights = correlate(patterns);
  const now = Date.now();

  for (const insight of insights) {
    const key = `${insight.auditPattern.category}:${insight.auditPattern.services.join(',')}`;
    const lastFired = lastFiredAt.get(key) ?? 0;
    if (now - lastFired < COOLDOWN_MS) continue;

    try {
      const result = await narrateSecurityPattern(
        insight.auditPattern,
        insight.correlationReason,
      );
      if (!result) continue;

      lastFiredAt.set(key, now);

      broadcast({
        type: 'SECURITY_NARRATION',
        category: insight.auditPattern.category,
        severity: insight.auditPattern.severity,
        services: insight.auditPattern.services,
        narration: result.narration,
        evidence: insight.auditPattern.evidence.map((e) => ({
          type: 'audit_event' as const,
          ...e,
        })),
        suggestedAction: result.suggestedAction ?? undefined,
        windowStartMs: now - 5 * 60_000,
        windowEndMs: now,
        timestamp: now,
      });
    } catch (err) {
      logger.warn({ err, category: insight.auditPattern.category }, 'Security narration failed');
    }
  }
}

// Export for use by the audit event ingestion pipeline
export { ingestAuditEvent, recordMetricAnomaly };
```

Wire into `apps/varunai-api/src/index.ts`:

```typescript
import { startSecurityAnalyzer } from './security/loop.js';

// After other loops start:
startSecurityAnalyzer();
```

Feed audit events from the WebSocket handler and the audit SSE route into the pattern engine:

```typescript
// In ws.ts, after broadcasting an AUDIT_EVENT:
import { ingestAuditEvent } from '../security/loop.js';
// ...
case 'AUDIT_EVENT':
  ingestAuditEvent(msg);
  break;
```

## Client-Side Display

Security narration events render in `TraceFeedPanel` with a distinct visual treatment:

```tsx
case 'SECURITY_NARRATION':
  return (
    <div
      key={i}
      className={`flex flex-col gap-1 py-2 px-2 border-l-4 border-b text-sm ${
        event.severity === 'critical'
          ? 'border-l-warning-red bg-warning-red/5'
          : event.severity === 'warning'
          ? 'border-l-ember-gold bg-ember-gold/5'
          : 'border-l-spirit-teal/50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="timestamp text-xs">{formatTime(event.timestamp)}</span>
        <span className="text-xs font-bold uppercase text-ghost-white/60">
          SECURITY
        </span>
        <span className={`text-xs font-bold ${severityColor(event.severity)}`}>
          {event.severity}
        </span>
        <span className="text-ghost-white/40 text-xs">
          {event.category.replace(/_/g, ' ')}
        </span>
      </div>
      <p className="text-ghost-white/90 pl-4">{event.narration}</p>
      {event.suggestedAction && (
        <p className="text-ember-gold/80 pl-4 text-xs italic">
          Action: {event.suggestedAction}
        </p>
      )}
      <div className="pl-4 flex gap-1 flex-wrap">
        {event.services.map((s) => (
          <span key={s} className="text-xs bg-bureaucrat-grey/20 px-1.5 py-0.5 rounded">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
```

## Configuration

Add to `config.ts`:

```typescript
SECURITY_ANALYSIS_ENABLED: z.string().default('false'),
SECURITY_ANALYSIS_INTERVAL_MS: z.string().default('30000'),
SECURITY_COOLDOWN_MS: z.string().default('180000'),
```

## Testing Checklist

- [ ] Denial cluster detection fires when >5 denials from same caller in 2 minutes.
- [ ] Unusual access detection identifies new caller-target pairs not seen in baseline.
- [ ] Privilege escalation detection identifies sequential scope increases.
- [ ] Cross-service fan-out detection identifies callers hitting >3 targets in 1 minute.
- [ ] Alert correlator joins metric anomalies with audit patterns within 2-minute windows.
- [ ] Gemini narration produces valid JSON with `narration` and optional `suggestedAction`.
- [ ] `SECURITY_NARRATION` events render in TraceFeedPanel with correct category label and severity color.
- [ ] Cooldown prevents duplicate narrations for the same pattern within 3 minutes.
- [ ] When Verika audit stream is unavailable, the analyzer degrades gracefully.
- [ ] Security analyzer does not interfere with the assist loop or anomaly detector.
