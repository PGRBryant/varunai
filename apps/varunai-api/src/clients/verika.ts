import { config } from '../config.js';

interface TokenValidation {
  valid: boolean;
  subject: string;
  roles: string[];
  capabilities: string[];
}

export async function validateHumanToken(token: string): Promise<TokenValidation> {
  const res = await fetch(`${config.VERIKA_API_URL}/api/tokens/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.VERIKA_SERVICE_TOKEN}`,
    },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    return { valid: false, subject: '', roles: [], capabilities: [] };
  }
  return (await res.json()) as TokenValidation;
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
