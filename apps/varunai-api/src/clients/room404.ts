import type { SessionState } from '@varunai/shared';
import { config } from '../config.js';

interface Room404SessionResponse {
  id: string;
  roomCode: string;
  state: string;
  playerCount: number;
  maxPlayers: number;
  totalFloors: number;
  createdAt: number;
}

function mapToSessionState(raw: Room404SessionResponse): SessionState {
  return {
    sessionId: raw.id,
    sessionCode: raw.roomCode,
    state: raw.state === 'active' ? 'active' : raw.state === 'complete' || raw.state === 'closed' ? 'completed' : 'waiting',
    playerCount: raw.playerCount,
    players: [],
    floorDistribution: {},
    completionRate: 0,
    averageScore: 0,
    leaderboard: [],
    startedAt: raw.createdAt,
  };
}

export async function fetchSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${config.ROOM404_API_URL}/session/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`Room 404 session: ${res.status}`);
  const data = (await res.json()) as Room404SessionResponse;
  return mapToSessionState(data);
}

export async function fetchSessionByCode(roomCode: string): Promise<SessionState> {
  const res = await fetch(`${config.ROOM404_API_URL}/session/code/${encodeURIComponent(roomCode)}`);
  if (!res.ok) throw new Error(`Room 404 session by code: ${res.status}`);
  const data = (await res.json()) as Room404SessionResponse;
  return mapToSessionState(data);
}

// TODO(varunai-v2): Replace with session discovery once Room 404 adds a list/active endpoint.
export async function fetchCurrentSession(): Promise<SessionState | null> {
  // Room 404 has no "current session" endpoint — sessions are looked up by ID or room code.
  // Return null when no active session is known; the dashboard shows a waiting state.
  return null;
}
