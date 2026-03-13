import type { AssistSuggestion, FlagChange } from '@varunai/shared';

const MIN_CONFIDENCE = 0.7;
const MIN_INTERVAL_MS = 60_000;
const RECENTLY_CHANGED_MS = 120_000;

/**
 * Determine whether a suggestion should be surfaced to the presenter.
 * Guards against noise: low confidence, rapid-fire suggestions, and
 * suggesting changes to recently-modified flags.
 */
export function shouldSurfaceSuggestion(
  suggestion: AssistSuggestion,
  lastSuggestionAt: number,
  recentChanges: FlagChange[]
): boolean {
  if (suggestion.confidence < MIN_CONFIDENCE) return false;

  const now = Date.now();
  if (now - lastSuggestionAt < MIN_INTERVAL_MS) return false;

  const recentlyChanged = recentChanges.some(
    (c) => c.flagKey === suggestion.flagKey && now - c.timestamp < RECENTLY_CHANGED_MS
  );
  if (recentlyChanged) return false;

  return true;
}
