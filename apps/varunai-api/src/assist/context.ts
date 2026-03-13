import type { AssistContext } from '@varunai/shared';
import { fetchFlags } from '../clients/mystweaver.js';
import { fetchCurrentSession } from '../clients/room404.js';

const recentChanges: Array<{
  flagKey: string;
  previousValue: unknown;
  newValue: unknown;
  changedBy: string;
  timestamp: number;
  traceId: string;
}> = [];

export function recordFlagChange(change: (typeof recentChanges)[number]): void {
  recentChanges.push(change);
  // Keep only last 90 seconds of changes
  const cutoff = Date.now() - 90_000;
  while (recentChanges.length > 0 && recentChanges[0].timestamp < cutoff) {
    recentChanges.shift();
  }
}

export async function buildAssistContext(): Promise<AssistContext> {
  const [session, flags] = await Promise.all([
    fetchCurrentSession(),
    fetchFlags(),
  ]);

  const stuckThreshold = 7;
  const stuckPlayerCount = session.players.filter(
    (p) => p.isAlive && p.floor < stuckThreshold
  ).length;

  return {
    session: {
      playerCount: session.playerCount,
      floorDistribution: session.floorDistribution,
      completionRate: session.completionRate,
      averageScore: session.averageScore,
      stuckPlayerCount,
    },
    flags: {
      current: flags,
      recentChanges: recentChanges.map((c) => ({
        flagKey: c.flagKey,
        previousValue: c.previousValue as string,
        newValue: c.newValue as string,
        changedBy: c.changedBy,
        timestamp: c.timestamp,
        traceId: c.traceId,
      })),
    },
    metrics: {
      roomCompletionRate: session.completionRate,
      aiTimeoutRate: 0, // TODO: pull from Prometheus
      flagEvalRate: 0,   // TODO: pull from Prometheus
      errorRate: 0,       // TODO: pull from Prometheus
    },
    experimentState: {
      active: [],
      recentResults: [],
    },
  };
}
