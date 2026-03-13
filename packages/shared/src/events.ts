import type { SessionState, Standing } from './session.js';
import type { AssistSuggestion, FlagValue } from './assist.js';

// ── Server → Client messages ──────────────────────────────────────

export interface SessionUpdateEvent {
  type: 'SESSION_UPDATE';
  players: number;
  floors: Record<number, number>;
  completionRate: number;
  leaderboard: Standing[];
}

export interface FlagChangedEvent {
  type: 'FLAG_CHANGED';
  key: string;
  from: FlagValue;
  to: FlagValue;
  changedBy: string;
  traceId: string;
}

export interface AssistSuggestionEvent {
  type: 'ASSIST_SUGGESTION';
  suggestion: AssistSuggestion;
}

export interface AssistAppliedEvent {
  type: 'ASSIST_APPLIED';
  flagKey: string;
  newValue: FlagValue;
  traceId: string;
}

export interface MetricUpdateEvent {
  type: 'METRIC_UPDATE';
  service: string;
  metric: string;
  value: number;
  timestamp: number;
}

export interface AuditEvent {
  type: 'AUDIT_EVENT';
  caller: string;
  target: string;
  capability: string;
  allowed: boolean;
  traceId: string;
  timestamp: number;
}

export type ServerEvent =
  | SessionUpdateEvent
  | FlagChangedEvent
  | AssistSuggestionEvent
  | AssistAppliedEvent
  | MetricUpdateEvent
  | AuditEvent;

// ── Client → Server messages ──────────────────────────────────────

export type SubscriptionChannel = 'session' | 'flags' | 'assist' | 'audit';

export interface SubscribeMessage {
  type: 'SUBSCRIBE';
  channels: SubscriptionChannel[];
}

export interface AssistQueryMessage {
  type: 'ASSIST_QUERY';
  question: string;
}

export interface FlagChangeMessage {
  type: 'FLAG_CHANGE';
  key: string;
  value: FlagValue;
}

export interface PingMessage {
  type: 'PING';
}

export interface AuthMessage {
  type: 'AUTH';
  token: string;
}

export type ClientMessage =
  | AuthMessage
  | SubscribeMessage
  | AssistQueryMessage
  | FlagChangeMessage
  | PingMessage;
