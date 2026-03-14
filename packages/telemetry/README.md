# @internal/telemetry

OpenTelemetry instrumentation package for the Varunai ecosystem.
Consumed by MystWeaver, Room 404, Verika, and Varunai itself.

## Usage

```ts
// MUST be the first call — before any other imports
import { initTelemetry } from '@internal/telemetry';
initTelemetry({
  serviceName: 'mystweaver-api',
  serviceVersion: '1.4.2',
  environment: 'production',
  collectorEndpoint: 'https://otel-collector.varunai-490119.run.app',
});

// Logger with automatic trace correlation
import { logger } from '@internal/telemetry';
logger.info({ flagKey: 'game.timer' }, 'Flag evaluated');

// Fastify plugin for request lifecycle logging
import { telemetryPlugin } from '@internal/telemetry';
fastify.register(telemetryPlugin);

// Propagation helpers for cross-service trace context
import { extractTraceContext, injectTraceContext } from '@internal/telemetry';
const ctx = extractTraceContext(request.headers);
const headers = injectTraceContext();
```
