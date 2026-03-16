import type { AssistSuggestion } from '@varunai/shared';
import { buildAssistContext } from './context.js';
import { generateSuggestion } from './gemini.js';
import { shouldSurfaceSuggestion } from './evaluation.js';
import { broadcast, hasActiveClients } from '../routes/ws.js';

let lastSuggestionAt = 0;

/**
 * Start the proactive assist loop. Evaluates session state every 30 seconds
 * and surfaces Gemini suggestions when thresholds are met.
 *
 * COST GATE: The loop only runs when at least one authenticated WebSocket
 * client is connected (i.e., the dashboard is open). When nobody is watching,
 * no API calls are made — varunai-api stays idle and scales to zero.
 */
export function startAssistLoop(): void {
  setInterval(() => void runAssistCycle(), 30_000);
}

async function runAssistCycle(): Promise<void> {
  // Don't poll Room 404, MystWeaver, or Gemini if nobody is watching
  if (!hasActiveClients()) return;

  try {
    const context = await buildAssistContext();
    const suggestion = await generateSuggestion(context);
    if (!suggestion) return;

    if (shouldSurfaceSuggestion(suggestion, lastSuggestionAt, context.flags.recentChanges)) {
      lastSuggestionAt = Date.now();
      broadcast({ type: 'ASSIST_SUGGESTION', suggestion });
    }
  } catch {
    // Silent failure — the assist bar shows "SESSION NOMINAL"
    // and the loop retries on the next cycle.
  }
}
