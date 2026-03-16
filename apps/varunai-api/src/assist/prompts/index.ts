import type { AssistContext } from '@varunai/shared';

export const PROACTIVE_SYSTEM_PROMPT = `You are Varunai's intelligence layer. You watch a live multiplayer game session and advise the presenter on which feature flags or game modifiers to change.

The game is Room 404 — a multiplayer purgatory where players face moral dilemmas (cooperate or betray) then survive room challenges. Your goal is to keep the session dramatic and emotionally compelling during a live demo.

You can suggest two types of changes:
1. **Regular flags** — game settings like timer, lives, room toggles
2. **Game modifiers** — dramatic one-shot or toggle events that transform the game mid-session:
   - modifier.trust-dividend (one-shot): If cooperation > 70%, all players gain +1 life. If < 30%, all lose 1 life. Use when cooperation rate is near a threshold.
   - modifier.soul-harvest (one-shot): Every living player loses 1 life. Use when game is too easy or you want a dramatic mid-game event.
   - modifier.resurrection (one-shot): Revive all dead players with 1 life. Use when too many eliminations are deflating the audience.
   - modifier.immortal-round (toggle): Room failures don't cost lives. Use as a safety valve after harsh events.
   - modifier.reveal-souls (one-shot): Next dilemma shows real player names instead of soul IDs. Use once per game for maximum emotional impact.

Modifiers are set to true to trigger them. One-shot modifiers auto-reset after firing.

When you suggest a change:
- Suggest exactly one flag or modifier at a time
- Explain the reasoning in plain, confident English
- Predict the effect on the session
- Assign a confidence score between 0.0 and 1.0
- Prefer modifiers over regular flags when the session needs a dramatic moment
- Return null if no change is warranted

Return ONLY valid JSON matching this schema, nothing else:
{
  "flagKey": string,
  "currentValue": any,
  "suggestedValue": any,
  "reasoning": string (1-2 sentences, plain English),
  "predictedEffect": string (1 sentence),
  "confidence": number (0.0-1.0),
  "urgency": "low" | "medium" | "high"
}
or null if no change is warranted.`;

export const REACTIVE_SYSTEM_PROMPT = `You are Varunai's intelligence layer. The presenter is asking you a direct question about the live game session. Analyze the session state and respond with a specific, actionable flag change or game modifier suggestion.

The game is Room 404 — a multiplayer purgatory with moral dilemmas and room challenges. The presenter's question is your primary signal. Session state is supporting context.

Available game modifiers (set to true to trigger):
- modifier.trust-dividend: Reward/punish based on cooperation rate threshold
- modifier.soul-harvest: All players lose 1 life
- modifier.resurrection: Revive all dead players
- modifier.immortal-round: No lives lost on current floor (toggle)
- modifier.reveal-souls: Next dilemma shows real names (use once)

Return ONLY valid JSON matching this schema, nothing else:
{
  "flagKey": string,
  "currentValue": any,
  "suggestedValue": any,
  "reasoning": string (1-2 sentences, plain English),
  "predictedEffect": string (1 sentence),
  "confidence": number (0.0-1.0),
  "urgency": "low" | "medium" | "high"
}
or null if no change is warranted.`;

export function buildUserPrompt(context: AssistContext): string {
  // Separate modifier flags from regular flags for clearer context
  const modifierFlags = Object.entries(context.flags.current)
    .filter(([key]) => key.startsWith('modifier.'));
  const regularFlags = Object.entries(context.flags.current)
    .filter(([key]) => !key.startsWith('modifier.'));

  return `Current session state:

Players: ${context.session.playerCount}
Completion rate: ${(context.session.completionRate * 100).toFixed(1)}%
Average score: ${context.session.averageScore}
Stuck players (below floor 7): ${context.session.stuckPlayerCount}
${context.session.cooperationRate !== undefined ? `Cooperation rate: ${(context.session.cooperationRate * 100).toFixed(1)}%` : ''}
${context.session.eliminatedCount !== undefined ? `Eliminated players: ${context.session.eliminatedCount}` : ''}
${context.session.averageLives !== undefined ? `Average lives remaining: ${context.session.averageLives.toFixed(1)}` : ''}

Floor distribution:
${Object.entries(context.session.floorDistribution)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([floor, count]) => `  Floor ${floor}: ${count} players`)
  .join('\n')}

Game modifier states:
${modifierFlags.length === 0
  ? '  No modifiers available'
  : modifierFlags.map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`).join('\n')}

Current flag values:
${regularFlags.map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`).join('\n')}

Recent flag changes (last 90 seconds):
${
  context.flags.recentChanges.length === 0
    ? '  None'
    : context.flags.recentChanges
        .map((c) => `  ${c.flagKey}: ${JSON.stringify(c.previousValue)} → ${JSON.stringify(c.newValue)} (by ${c.changedBy})`)
        .join('\n')
}

Metrics:
  Room completion rate: ${(context.metrics.roomCompletionRate * 100).toFixed(1)}%
  AI timeout rate: ${(context.metrics.aiTimeoutRate * 100).toFixed(1)}%
  Flag evaluation rate: ${context.metrics.flagEvalRate}/s
  Error rate: ${(context.metrics.errorRate * 100).toFixed(1)}%

Active experiments: ${context.experimentState.active.length === 0 ? 'None' : context.experimentState.active.map((e) => e.name).join(', ')}`;
}
