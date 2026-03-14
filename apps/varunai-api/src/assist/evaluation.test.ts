import { describe, it, expect } from 'vitest';
import { shouldSurfaceSuggestion } from './evaluation.js';
import type { AssistSuggestion, FlagChange } from '@varunai/shared';

function makeSuggestion(overrides: Partial<AssistSuggestion> = {}): AssistSuggestion {
  return {
    flagKey: 'game.task-timer',
    currentValue: 8,
    suggestedValue: 10,
    reasoning: 'Players timing out',
    predictedEffect: 'Completion +15%',
    confidence: 0.85,
    urgency: 'medium',
    ...overrides,
  };
}

describe('shouldSurfaceSuggestion', () => {
  it('surfaces high-confidence suggestion with no recent activity', () => {
    expect(shouldSurfaceSuggestion(makeSuggestion(), 0, [])).toBe(true);
  });

  it('rejects low-confidence suggestions', () => {
    expect(shouldSurfaceSuggestion(makeSuggestion({ confidence: 0.5 }), 0, [])).toBe(false);
  });

  it('rejects suggestions too soon after the last one', () => {
    const recentTimestamp = Date.now() - 30_000; // 30s ago (< 60s threshold)
    expect(shouldSurfaceSuggestion(makeSuggestion(), recentTimestamp, [])).toBe(false);
  });

  it('allows suggestions after the minimum interval', () => {
    const oldTimestamp = Date.now() - 90_000; // 90s ago (> 60s threshold)
    expect(shouldSurfaceSuggestion(makeSuggestion(), oldTimestamp, [])).toBe(true);
  });

  it('rejects suggestions for recently-changed flags', () => {
    const recentChange: FlagChange = {
      flagKey: 'game.task-timer',
      previousValue: 5,
      newValue: 8,
      changedBy: 'presenter',
      timestamp: Date.now() - 60_000, // 60s ago (< 120s threshold)
      traceId: 'trace-1',
    };
    expect(shouldSurfaceSuggestion(makeSuggestion(), 0, [recentChange])).toBe(false);
  });

  it('allows suggestions for flags changed more than 2 minutes ago', () => {
    const oldChange: FlagChange = {
      flagKey: 'game.task-timer',
      previousValue: 5,
      newValue: 8,
      changedBy: 'presenter',
      timestamp: Date.now() - 180_000, // 3 min ago (> 120s threshold)
      traceId: 'trace-1',
    };
    expect(shouldSurfaceSuggestion(makeSuggestion(), 0, [oldChange])).toBe(true);
  });

  it('ignores changes to different flags', () => {
    const differentFlagChange: FlagChange = {
      flagKey: 'game.lives',
      previousValue: 3,
      newValue: 5,
      changedBy: 'presenter',
      timestamp: Date.now() - 10_000, // Very recent, but different flag
      traceId: 'trace-2',
    };
    expect(shouldSurfaceSuggestion(makeSuggestion(), 0, [differentFlagChange])).toBe(true);
  });
});
