import { create } from 'zustand';
import type { SessionState } from '@varunai/shared';

interface SessionStore {
  session: SessionState | null;
  setSession: (session: SessionState) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));
