import { create } from 'zustand';
import type { AssistSuggestion } from '@varunai/shared';

interface AssistStore {
  suggestion: AssistSuggestion | null;
  setSuggestion: (suggestion: AssistSuggestion) => void;
  confirm: () => void;
  dismiss: () => void;
}

export const useAssistStore = create<AssistStore>((set, get) => ({
  suggestion: null,
  setSuggestion: (suggestion) => set({ suggestion }),
  confirm: () => {
    const s = get().suggestion;
    if (!s) return;

    fetch(`/api/flags/${encodeURIComponent(s.flagKey)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: s.suggestedValue,
        reason: s.reasoning,
      }),
    }).catch(() => {
      // Silent
    });

    set({ suggestion: null });
  },
  dismiss: () => set({ suggestion: null }),
}));
