import { create } from 'zustand';
import type { AuditEvent } from '@varunai/shared';

const MAX_EVENTS = 100;

interface EventStore {
  events: AuditEvent[];
  addEvent: (event: AuditEvent) => void;
}

export const useEventStore = create<EventStore>((set) => ({
  events: [],
  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, MAX_EVENTS),
    })),
}));
