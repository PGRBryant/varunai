import { context, propagation, Context } from '@opentelemetry/api';

export interface TraceContext {
  traceparent: string;
  tracestate?: string;
}

/**
 * Extract trace context from incoming headers (HTTP or WS JOIN message).
 */
export function extractTraceContext(
  headers: Record<string, string | undefined>
): TraceContext | null {
  const traceparent = headers['traceparent'];
  if (!traceparent) return null;

  return {
    traceparent,
    tracestate: headers['tracestate'],
  };
}

/**
 * Inject current trace context into outgoing headers.
 */
export function injectTraceContext(ctx?: Context): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(ctx ?? context.active(), carrier);
  return carrier;
}
