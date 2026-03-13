# Room 404 Integration Requirements for Varunai

This document specifies the exact changes needed in the Room 404 codebase to support Varunai as a consumer.

---

## Overview

Varunai calls Room 404 to fetch session state. Today this is done through a single endpoint (`GET /api/session/current`) via the client in `apps/varunai-api/src/clients/room404.ts`. Room 404 also needs to initialize OpenTelemetry and replace console logging with structured logging so its traces and metrics flow into the shared observability stack.

## Change 1: Add `GET /api/session/current` Endpoint

**Status:** This endpoint may already exist if Room 404 has an admin API. If not, add it.

### Capability Required

`session.read` via Verika. The endpoint must validate the caller's Verika token and check for this capability.

### Route Implementation

In Room 404's server (likely `apps/server/src/routes/` or similar):

```typescript
// apps/server/src/routes/session.ts
import type { FastifyPluginAsync } from 'fastify';
import { requireCapability } from '../middleware/verika.js';
import { getActiveSession } from '../services/session.js';

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/session/current',
    { preHandler: requireCapability('session.read') },
    async (_request, reply) => {
      const session = getActiveSession();
      if (!session) {
        return reply.status(404).send({ error: 'No active session' });
      }
      return reply.send(formatSessionResponse(session));
    },
  );
};

function formatSessionResponse(session: InternalSession) {
  return {
    sessionId: session.id,
    sessionCode: session.code,
    state: session.state,           // 'waiting' | 'active' | 'completed'
    playerCount: session.players.length,
    players: session.players.map((p) => ({
      displayName: p.displayName,
      floor: p.currentFloor,
      score: p.score,
      isAlive: p.isAlive,
    })),
    floorDistribution: computeFloorDistribution(session.players),
    completionRate: computeCompletionRate(session),
    averageScore: computeAverageScore(session.players),
    leaderboard: computeLeaderboard(session.players),
    startedAt: session.startedAt,
  };
}
```

### Response Schema

The response must match `SessionState` from `@varunai/shared` (`packages/shared/src/session.ts`):

```typescript
interface SessionStateResponse {
  sessionId: string;       // unique session ID
  sessionCode: string;     // human-readable code like "TOWER-7"
  state: 'waiting' | 'active' | 'completed';
  playerCount: number;
  players: Array<{
    displayName: string;
    floor: number;
    score: number;
    isAlive: boolean;
  }>;
  floorDistribution: Record<number, number>;  // floor number -> player count
  completionRate: number;   // 0.0 to 1.0
  averageScore: number;
  leaderboard: Array<{
    rank: number;
    displayName: string;
    score: number;
    floor: number;
  }>;
  startedAt: number;        // epoch milliseconds
}
```

### Error Responses

| Status | Body | Condition |
|---|---|---|
| 200 | `SessionStateResponse` | Active session found |
| 401 | `{ "error": "Missing authorization header" }` | No Bearer token |
| 403 | `{ "error": "Missing capability: session.read" }` | Token lacks capability |
| 404 | `{ "error": "No active session" }` | No session in active state |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

## Change 2: Add `traceContext` to WebSocket JOIN Message

Room 404's WebSocket server sends and receives messages for game coordination. To enable distributed tracing across Room 404 and Varunai, the `JOIN` message (sent by the client when connecting to a session) should include trace context headers.

### `packages/shared` Change

If Room 404 has a shared types package (analogous to Varunai's `@varunai/shared`), add an optional `traceContext` field to the JOIN message type:

```typescript
// packages/shared/src/messages.ts (Room 404's shared package)

export interface JoinMessage {
  type: 'JOIN';
  sessionCode: string;
  displayName: string;
  traceContext?: {
    traceparent: string;   // W3C Trace Context header
    tracestate?: string;   // Optional W3C Trace State
  };
}
```

### Server-Side Extraction

On the Room 404 server, extract the trace context from the JOIN message and set it as the parent span for the session's lifecycle:

```typescript
// apps/server/src/ws/handlers/join.ts
import { context, propagation, trace } from '@opentelemetry/api';

function handleJoin(ws: WebSocket, msg: JoinMessage): void {
  let parentContext = context.active();

  if (msg.traceContext?.traceparent) {
    // Extract W3C trace context from the message
    const carrier = {
      traceparent: msg.traceContext.traceparent,
      tracestate: msg.traceContext.tracestate ?? '',
    };
    parentContext = propagation.extract(context.active(), carrier);
  }

  const tracer = trace.getTracer('room404-server');
  const span = tracer.startSpan(
    'session.player_join',
    { attributes: { 'session.code': msg.sessionCode, 'player.name': msg.displayName } },
    parentContext,
  );

  try {
    // ... existing join logic ...
  } finally {
    span.end();
  }
}
```

This ensures that spans from Room 404's game logic appear in the same trace as Varunai's dashboard operations when viewed in Cloud Trace or Jaeger.

## Change 3: Add `initTelemetry()` as First Call in `apps/server/src/index.ts`

The `@varunai/telemetry` package (or a copy/fork of it for Room 404, e.g., `@room404/telemetry` or `@internal/telemetry`) provides `initTelemetry()` which must be called before any other imports to ensure OTel instruments HTTP, gRPC, and WebSocket modules at require time.

### Installation

If Room 404 uses the shared telemetry package from the Varunai monorepo:

```bash
# In Room 404's server package
pnpm add @varunai/telemetry
```

Or if Room 404 has its own telemetry package, copy the `initTelemetry` and `logger` modules from `packages/telemetry/src/`.

### Entry Point Change

```typescript
// apps/server/src/index.ts -- MUST be the first lines

import { initTelemetry } from '@internal/telemetry';

initTelemetry({
  serviceName: 'room404-server',
  serviceVersion: process.env.SERVICE_VERSION ?? '0.0.0',
  environment: process.env.NODE_ENV ?? 'development',
  collectorEndpoint: process.env.OTEL_COLLECTOR_ENDPOINT ?? 'http://localhost:4318',
});

// All other imports AFTER initTelemetry()
import { createServer } from './server.js';
import { configureLogger } from '@internal/telemetry';
// ...
```

**Why first?** OpenTelemetry's auto-instrumentation works by monkey-patching Node.js modules (`http`, `net`, `ws`, etc.) at require time. If modules are imported before `initTelemetry()`, their network calls will not be traced.

## Change 4: Add `initTelemetry()` as First Call in `apps/ai-service/src/index.ts`

Room 404's AI service (the Gemini-powered puzzle/narrative generator) must also be instrumented:

```typescript
// apps/ai-service/src/index.ts -- MUST be the first lines

import { initTelemetry } from '@internal/telemetry';

initTelemetry({
  serviceName: 'room404-ai-service',
  serviceVersion: process.env.SERVICE_VERSION ?? '0.0.0',
  environment: process.env.NODE_ENV ?? 'development',
  collectorEndpoint: process.env.OTEL_COLLECTOR_ENDPOINT ?? 'http://localhost:4318',
});

// All other imports AFTER initTelemetry()
import { startAIService } from './service.js';
// ...
```

This is critical because `room404_ai_generation_duration` and `room404_ai_timeout_total` metrics are key signals that Varunai monitors.

## Change 5: Replace `console.*` with Structured Logger

Replace all `console.log`, `console.error`, `console.warn` calls with the structured logger from `@internal/telemetry`. This ensures:

1. Logs are JSON-formatted and compatible with Cloud Logging.
2. Logs carry trace context (`traceId`, `spanId`) for correlation in Cloud Trace.
3. Log severity maps correctly (`console.log` -> `INFO`, `console.error` -> `ERROR`).

### Configure Logger

After `initTelemetry()`, configure the logger:

```typescript
import { configureLogger, logger } from '@internal/telemetry';

configureLogger({
  service: 'room404-server',
  version: process.env.SERVICE_VERSION ?? '0.0.0',
  environment: process.env.NODE_ENV ?? 'development',
  gcpProjectId: process.env.GCP_PROJECT_ID,
});
```

### Replacement Patterns

```typescript
// Before
console.log('Player joined:', displayName);
console.error('Failed to generate puzzle:', err);
console.warn('Session nearing capacity:', playerCount);

// After
import { logger } from '@internal/telemetry';

logger.info({ displayName }, 'Player joined');
logger.error({ err }, 'Failed to generate puzzle');
logger.warn({ playerCount }, 'Session nearing capacity');
```

### Finding All console.* Calls

Run this in the Room 404 repo to find all instances:

```bash
grep -rn 'console\.\(log\|error\|warn\|info\|debug\)' apps/server/src/ apps/ai-service/src/
```

Typical count in a medium-sized Node.js project: 30-60 calls. Budget ~1 hour for mechanical replacement.

### ESLint Rule

Add an ESLint rule to prevent future `console.*` usage:

```json
{
  "rules": {
    "no-console": ["error", { "allow": [] }]
  }
}
```

## Environment Variables Required

Room 404 services need these environment variables for telemetry and Verika integration:

| Variable | Example | Purpose |
|---|---|---|
| `OTEL_COLLECTOR_ENDPOINT` | `http://otel-collector:4318` | OTLP HTTP endpoint |
| `VERIKA_API_URL` | `https://verika-api.run.app` | Verika token validation |
| `VERIKA_SERVICE_TOKEN` | (secret) | Room 404's own Verika service token |
| `GCP_PROJECT_ID` | `room404-prod` | For Cloud Logging trace correlation |
| `SERVICE_VERSION` | `1.2.3` | Embedded in telemetry resource |

## Summary of Changes

| # | Change | Files affected | Breaking? |
|---|---|---|---|
| 1 | Add `GET /api/session/current` | New route file | No (new endpoint) |
| 2 | Add `traceContext` to WS JOIN | `packages/shared`, WS handler | No (optional field) |
| 3 | `initTelemetry()` in server entry | `apps/server/src/index.ts` | No (additive) |
| 4 | `initTelemetry()` in AI service entry | `apps/ai-service/src/index.ts` | No (additive) |
| 5 | Replace `console.*` with logger | All source files | No (behavioral) |

All changes are non-breaking. Existing Room 404 clients and game flows are unaffected.
