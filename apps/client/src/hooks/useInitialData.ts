import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useFlagStore } from '../stores/flagStore';

export function useInitialData(): void {
  useEffect(() => {
    async function fetchFlags() {
      try {
        const res = await fetch('/api/flags/current');
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data === 'object') {
          useFlagStore.getState().setFlags(data);
        }
      } catch {
        // Non-critical — flags will arrive via WebSocket
      }
    }

    async function fetchSession() {
      try {
        const res = await fetch('/api/session/current');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.sessionId) {
          useSessionStore.getState().setSession(data);
        }
      } catch {
        // Non-critical — session will arrive via WebSocket
      }
    }

    void fetchFlags();
    void fetchSession();
  }, []);
}
