import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AssistSuggestion, AssistContext } from '@varunai/shared';
import { config } from '../config.js';
import { PROACTIVE_SYSTEM_PROMPT, REACTIVE_SYSTEM_PROMPT, buildUserPrompt } from './prompts/index.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export async function generateSuggestion(
  context: AssistContext,
  question?: string
): Promise<AssistSuggestion | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const systemPrompt = question ? REACTIVE_SYSTEM_PROMPT : PROACTIVE_SYSTEM_PROMPT;
  const userPrompt = question
    ? `${question}\n\nCurrent session context:\n${buildUserPrompt(context)}`
    : buildUserPrompt(context);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { role: 'model', parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    clearTimeout(timeout);

    const text = result.response.text();
    if (!text || text.trim() === 'null') return null;

    const parsed = JSON.parse(text) as AssistSuggestion;
    if (!parsed.flagKey || typeof parsed.confidence !== 'number') return null;

    return parsed;
  } catch {
    clearTimeout(timeout);
    return null; // Silent failure — retry next cycle
  }
}
