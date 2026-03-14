import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { flagRoutes } from './flags.js';

// Track broadcasts
const broadcasts: unknown[] = [];
vi.mock('./ws.js', () => ({
  broadcast: vi.fn((event: unknown) => broadcasts.push(event)),
}));

// Mock MystWeaver client
vi.mock('../clients/mystweaver.js', () => ({
  fetchFlags: vi.fn().mockResolvedValue({ 'game.task-timer': 8, 'game.lives': 3 }),
  patchFlag: vi.fn().mockResolvedValue({ success: true, newValue: 10, traceId: 'trace-abc' }),
}));

// Mock context recorder
vi.mock('../assist/context.js', () => ({
  recordFlagChange: vi.fn(),
}));

describe('flags routes', () => {
  beforeEach(() => {
    broadcasts.length = 0;
  });

  describe('GET /current', () => {
    it('returns current flags', async () => {
      const app = Fastify();
      await app.register(flagRoutes);

      const res = await app.inject({ method: 'GET', url: '/current' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ 'game.task-timer': 8, 'game.lives': 3 });
    });
  });

  describe('PATCH /:key', () => {
    it('broadcasts FLAG_CHANGED for manual changes', async () => {
      const app = Fastify();
      await app.register(flagRoutes);

      const res = await app.inject({
        method: 'PATCH',
        url: '/game.task-timer',
        payload: { value: 10 },
      });

      expect(res.statusCode).toBe(200);
      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0]).toMatchObject({
        type: 'FLAG_CHANGED',
        key: 'game.task-timer',
        to: 10,
        changedBy: 'presenter',
      });
    });

    it('broadcasts FLAG_CHANGED and ASSIST_APPLIED for assist changes', async () => {
      const app = Fastify();
      await app.register(flagRoutes);

      const res = await app.inject({
        method: 'PATCH',
        url: '/game.task-timer',
        payload: { value: 10, reason: 'Players timing out', source: 'assist' },
      });

      expect(res.statusCode).toBe(200);
      expect(broadcasts).toHaveLength(2);

      expect(broadcasts[0]).toMatchObject({
        type: 'FLAG_CHANGED',
        key: 'game.task-timer',
        to: 10,
        changedBy: 'gemini-assist',
      });

      expect(broadcasts[1]).toMatchObject({
        type: 'ASSIST_APPLIED',
        flagKey: 'game.task-timer',
        newValue: 10,
        traceId: 'trace-abc',
      });
    });

    it('records flag change in assist context', async () => {
      const { recordFlagChange } = await import('../assist/context.js');
      const app = Fastify();
      await app.register(flagRoutes);

      await app.inject({
        method: 'PATCH',
        url: '/game.task-timer',
        payload: { value: 10, source: 'assist' },
      });

      expect(recordFlagChange).toHaveBeenCalledWith(
        expect.objectContaining({
          flagKey: 'game.task-timer',
          newValue: 10,
          changedBy: 'gemini-assist',
          traceId: 'trace-abc',
        })
      );
    });

    it('rejects invalid body', async () => {
      const app = Fastify();
      await app.register(flagRoutes);

      const res = await app.inject({
        method: 'PATCH',
        url: '/game.task-timer',
        payload: { value: { nested: true } },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
