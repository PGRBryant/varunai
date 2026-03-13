import type { SessionState } from '@varunai/shared';
import { config } from '../config.js';

export async function fetchCurrentSession(): Promise<SessionState> {
  const res = await fetch(`${config.ROOM404_API_URL}/api/session/current`, {
    headers: { Authorization: `Bearer ${config.VERIKA_SERVICE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Room 404 session: ${res.status}`);
  return (await res.json()) as SessionState;
}
