/**
 * Session context — the time window and session identity that governs
 * the entire dashboard. V1 hardcodes sessionId to the active session.
 *
 * // TODO(varunai-v2): Multi-session selector UI and API.
 * // Triggers when: Room 404 session orchestration supports multiple concurrent sessions.
 * // Estimated effort: 1 week (UI) + depends on Room 404 orchestration timeline.
 * // See docs/v2-multi-session.md
 */
export interface SessionContext {
  sessionId: string;
  sessionCode: string;
  startedAt: number;
  windowStartMs: number;
  windowEndMs: number;
}

export interface PlayerSummary {
  displayName: string;
  floor: number;
  score: number;
  isAlive: boolean;
  livesRemaining?: number;
}

export interface Standing {
  rank: number;
  displayName: string;
  score: number;
  floor: number;
}

export type SessionLifecycle = 'waiting' | 'active' | 'completed';

export interface SessionState {
  sessionId: string;
  sessionCode: string;
  state: SessionLifecycle;
  playerCount: number;
  players: PlayerSummary[];
  floorDistribution: Record<number, number>;
  completionRate: number;
  averageScore: number;
  leaderboard: Standing[];
  startedAt: number;
  cooperationRate?: number;
}

export function createV1SessionContext(session: SessionState): SessionContext {
  const now = Date.now();
  return {
    sessionId: session.sessionId,
    sessionCode: session.sessionCode,
    startedAt: session.startedAt,
    windowStartMs: session.startedAt,
    windowEndMs: now,
  };
}
