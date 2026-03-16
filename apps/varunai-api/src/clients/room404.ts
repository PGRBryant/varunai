import type { SessionState, PlayerSummary } from '@varunai/shared';
import { config } from '../config.js';

interface Room404EnrichedResponse {
  id: string;
  roomCode: string;
  state: string;
  playerCount: number;
  maxPlayers: number;
  totalFloors: number;
  createdAt: number;
  startedAt?: number;
  players?: Array<{
    displayName: string;
    floor: number;
    score: number;
    isAlive: boolean;
    livesRemaining?: number;
  }>;
  floorDistribution?: Record<string, number>;
  completionRate?: number;
  averageScore?: number;
  cooperationRate?: number;
}

function mapToSessionState(raw: Room404EnrichedResponse): SessionState {
  const players: PlayerSummary[] = (raw.players ?? []).map((p) => ({
    displayName: p.displayName,
    floor: p.floor,
    score: p.score,
    isAlive: p.isAlive,
    livesRemaining: p.livesRemaining,
  }));

  // Convert string keys from JSON to number keys
  const floorDistribution: Record<number, number> = {};
  if (raw.floorDistribution) {
    for (const [key, value] of Object.entries(raw.floorDistribution)) {
      floorDistribution[Number(key)] = value;
    }
  }

  return {
    sessionId: raw.id,
    sessionCode: raw.roomCode,
    state: raw.state === 'active' ? 'active' : raw.state === 'complete' || raw.state === 'closed' ? 'completed' : 'waiting',
    playerCount: raw.playerCount,
    players,
    floorDistribution,
    completionRate: raw.completionRate ?? 0,
    averageScore: raw.averageScore ?? 0,
    leaderboard: [],
    startedAt: raw.startedAt ?? raw.createdAt,
    cooperationRate: raw.cooperationRate,
  };
}

export async function fetchSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${config.ROOM404_API_URL}/session/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`Room 404 session: ${res.status}`);
  const data = (await res.json()) as Room404EnrichedResponse;
  return mapToSessionState(data);
}

export async function fetchSessionByCode(roomCode: string): Promise<SessionState> {
  const res = await fetch(`${config.ROOM404_API_URL}/session/code/${encodeURIComponent(roomCode)}`);
  if (!res.ok) throw new Error(`Room 404 session by code: ${res.status}`);
  const data = (await res.json()) as Room404EnrichedResponse;
  return mapToSessionState(data);
}

/**
 * Fetch the most recent active session from Room 404.
 * Calls GET /session/active which returns enriched session data.
 * Returns null if no active session exists or if Room 404 is unreachable.
 */
export async function fetchCurrentSession(): Promise<SessionState | null> {
  try {
    const res = await fetch(`${config.ROOM404_API_URL}/session/active`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Room 404 active session: ${res.status}`);
    const data = (await res.json()) as Room404EnrichedResponse;
    return mapToSessionState(data);
  } catch {
    // Room 404 unreachable — return null, dashboard shows waiting state
    return null;
  }
}
