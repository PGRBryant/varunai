import type { AssistContext } from '@varunai/shared';
import { fetchFlags, fetchExperiments } from '../clients/mystweaver.js';
import { fetchCurrentSession } from '../clients/room404.js';

// ── In-process metric counters (sliding 60s window) ──────────────
interface MetricSample {
  timestamp: number;
  value: number;
}

const metricWindows: Record<string, MetricSample[]> = {
  aiTimeout: [],
  flagEval: [],
  error: [],
};

const METRIC_WINDOW_MS = 60_000;

type MetricName = 'aiTimeout' | 'flagEval' | 'error';

export function recordMetric(name: MetricName, value = 1): void {
  const samples = metricWindows[name]!;
  samples.push({ timestamp: Date.now(), value });
  const cutoff = Date.now() - METRIC_WINDOW_MS;
  while (samples.length > 0 && samples[0]!.timestamp < cutoff) {
    samples.shift();
  }
}

function getRate(name: MetricName): number {
  const samples = metricWindows[name]!;
  const cutoff = Date.now() - METRIC_WINDOW_MS;
  while (samples.length > 0 && samples[0]!.timestamp < cutoff) {
    samples.shift();
  }
  return samples.reduce((sum, s) => sum + s.value, 0);
}

// ── Recent flag changes (sliding 90s window) ────────────────────
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
  while (recentChanges.length > 0 && recentChanges[0]!.timestamp < cutoff) {
    recentChanges.shift();
  }
}

export async function buildAssistContext(): Promise<AssistContext> {
  const [session, flags, experiments] = await Promise.all([
    fetchCurrentSession(),
    fetchFlags().then((f) => { recordMetric('flagEval'); return f; }),
    fetchExperiments().catch(() => []),
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
      aiTimeoutRate: getRate('aiTimeout'),
      flagEvalRate: getRate('flagEval'),
      errorRate: getRate('error'),
    },
    experimentState: {
      active: experiments.filter((e) => e.status === 'running'),
      recentResults: [],
    },
  };
}
