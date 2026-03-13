export { initTelemetry } from './init.js';
export type { TelemetryConfig } from './init.js';
export { logger, configureLogger } from './logger.js';
export { telemetryPlugin } from './fastify.js';
export { extractTraceContext, injectTraceContext } from './propagation.js';
export type { TraceContext } from './propagation.js';
