import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordMetric, recordFlagChange, buildAssistContext } from './context.js';

// Mock upstream clients
vi.mock('../clients/mystweaver.js', () => ({
  fetchFlags: vi.fn().mockResolvedValue({ 'game.task-timer': 8, 'game.lives': 3 }),
  fetchExperiments: vi.fn().mockResolvedValue([
    { id: 'exp-1', name: 'Timer test', flagKey: 'game.task-timer', variants: { control: 8, test: 10 }, status: 'running' },
    { id: 'exp-2', name: 'Old test', flagKey: 'game.lives', variants: { control: 3, test: 5 }, status: 'completed' },
  ]),
}));

vi.mock('../clients/room404.js', () => ({
  fetchCurrentSession: vi.fn().mockResolvedValue({
    sessionId: 'test-session',
    sessionCode: 'GHOST-7',
    state: 'active',
    playerCount: 47,
    players: [
      { id: '1', name: 'Player1', floor: 3, isAlive: true, score: 100 },
      { id: '2', name: 'Player2', floor: 9, isAlive: true, score: 200 },
      { id: '3', name: 'Player3', floor: 5, isAlive: false, score: 50 },
    ],
    floorDistribution: { 3: 10, 5: 8, 9: 15 },
    completionRate: 0.71,
    averageScore: 150,
    leaderboard: [],
    startedAt: Date.now(),
  }),
}));

describe('recordMetric / getRate', () => {
  beforeEach(() => {
    // Clear metric windows by recording nothing and letting them expire
    // We rely on buildAssistContext to read rates
  });

  it('records metrics and reflects them in buildAssistContext', async () => {
    recordMetric('aiTimeout');
    recordMetric('aiTimeout');
    recordMetric('error');

    const ctx = await buildAssistContext();

    expect(ctx.metrics.aiTimeoutRate).toBe(2);
    expect(ctx.metrics.errorRate).toBe(1);
    // flagEval gets incremented by the fetchFlags().then() call
    expect(ctx.metrics.flagEvalRate).toBeGreaterThanOrEqual(1);
  });
});

describe('recordFlagChange', () => {
  it('tracks recent changes in assist context', async () => {
    recordFlagChange({
      flagKey: 'game.task-timer',
      previousValue: 8,
      newValue: 10,
      changedBy: 'gemini-assist',
      timestamp: Date.now(),
      traceId: 'trace-123',
    });

    const ctx = await buildAssistContext();

    expect(ctx.flags.recentChanges).toHaveLength(1);
    expect(ctx.flags.recentChanges[0]!.flagKey).toBe('game.task-timer');
    expect(ctx.flags.recentChanges[0]!.changedBy).toBe('gemini-assist');
  });
});

describe('buildAssistContext', () => {
  it('returns full context shape', async () => {
    const ctx = await buildAssistContext();

    expect(ctx.session.playerCount).toBe(47);
    expect(ctx.session.completionRate).toBe(0.71);
    // Only player 1 is alive and below floor 7
    expect(ctx.session.stuckPlayerCount).toBe(1);

    expect(ctx.flags.current).toEqual({ 'game.task-timer': 8, 'game.lives': 3 });
    expect(ctx.metrics.roomCompletionRate).toBe(0.71);

    // Only running experiments included
    expect(ctx.experimentState.active).toHaveLength(1);
    expect(ctx.experimentState.active[0]!.id).toBe('exp-1');
  });

  it('handles fetchExperiments failure gracefully', async () => {
    const { fetchExperiments } = await import('../clients/mystweaver.js');
    vi.mocked(fetchExperiments).mockRejectedValueOnce(new Error('network'));

    const ctx = await buildAssistContext();

    expect(ctx.experimentState.active).toEqual([]);
  });
});
