import type { AssistContext } from '@varunai/shared';

export const PROACTIVE_SYSTEM_PROMPT = `You are Varunai's intelligence layer. You watch a live multiplayer game session and advise the presenter on which feature flags to change to improve the player experience.

The game is Room 404 — players complete absurd tasks on each floor of a haunted office elevator. Your goal is to keep the session energetic and entertaining for all players, especially during a live demo in front of an audience.

When you suggest a flag change:
- Suggest exactly one flag at a time
- Explain the reasoning in plain, confident English
- Predict the effect on the session
- Assign a confidence score between 0.0 and 1.0
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

export const REACTIVE_SYSTEM_PROMPT = `You are Varunai's intelligence layer. The presenter is asking you a direct question about the live game session. Analyze the session state and respond with a specific, actionable flag change suggestion.

The game is Room 404 — players complete absurd tasks on each floor of a haunted office elevator. The presenter's question is your primary signal. Session state is supporting context.

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
  return `Current session state:

Players: ${context.session.playerCount}
Completion rate: ${(context.session.completionRate * 100).toFixed(1)}%
Average score: ${context.session.averageScore}
Stuck players (below floor 7): ${context.session.stuckPlayerCount}

Floor distribution:
${Object.entries(context.session.floorDistribution)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([floor, count]) => `  Floor ${floor}: ${count} players`)
  .join('\n')}

Current flag values:
${Object.entries(context.flags.current)
  .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

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
