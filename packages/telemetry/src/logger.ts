import pino from 'pino';
import { context, trace } from '@opentelemetry/api';

interface LogContext {
  service: string;
  version: string;
  environment: string;
  gcpProjectId?: string;
}

let logContext: LogContext = {
  service: 'unknown',
  version: '0.0.0',
  environment: 'development',
};

/**
 * Configure the logger context. Called once after initTelemetry.
 */
export function configureLogger(ctx: LogContext): void {
  logContext = ctx;
}

function getTraceFields(): Record<string, unknown> {
  const span = trace.getSpan(context.active());
  if (!span) return {};

  const spanContext = span.spanContext();
  const projectId = logContext.gcpProjectId;
  const traceId = spanContext.traceId;

  return {
    'logging.googleapis.com/trace': projectId
      ? `projects/${projectId}/traces/${traceId}`
      : traceId,
    'logging.googleapis.com/spanId': spanContext.spanId,
    'logging.googleapis.com/traceSampled': !!(spanContext.traceFlags & 1),
  };
}

/**
 * Structured logger that correlates with OTel traces.
 * Wraps pino with GCP Cloud Logging compatible output format.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  messageKey: 'message',
  formatters: {
    level(label) {
      return { severity: label.toUpperCase() };
    },
    log(obj) {
      return {
        ...obj,
        service: logContext.service,
        version: logContext.version,
        environment: logContext.environment,
        ...getTraceFields(),
      };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
