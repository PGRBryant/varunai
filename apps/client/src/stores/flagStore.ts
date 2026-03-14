import { create } from 'zustand';
import type { FlagValue } from '@varunai/shared';

interface FlagStore {
  flags: Record<string, FlagValue>;
  setFlags: (flags: Record<string, FlagValue>) => void;
  setFlag: (key: string, value: FlagValue) => void;
  updateFlag: (key: string, value: FlagValue) => void;
}

export const useFlagStore = create<FlagStore>((set) => ({
  flags: {},
  setFlags: (flags) => set({ flags }),
  setFlag: (key, value) =>
    set((state) => ({ flags: { ...state.flags, [key]: value } })),
  updateFlag: (key, value) => {
    const previousValue = useFlagStore.getState().flags[key];
    set((state) => ({ flags: { ...state.flags, [key]: value } }));
    fetch(`/api/flags/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => {
      if (previousValue !== undefined) {
        set((state) => ({ flags: { ...state.flags, [key]: previousValue } }));
      }
    });
  },
}));
