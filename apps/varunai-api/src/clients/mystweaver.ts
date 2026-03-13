import type { FlagValue } from '@varunai/shared';
import { config } from '../config.js';

interface FlagConfig {
  key: string;
  value: FlagValue;
  type: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export async function fetchFlags(): Promise<Record<string, FlagValue>> {
  const res = await fetch(`${config.MYSTWEAVER_API_URL}/sdk/flags`, {
    headers: { Authorization: `Bearer ${config.VERIKA_SERVICE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`MystWeaver flags: ${res.status}`);
  const flags = (await res.json()) as FlagConfig[];
  return Object.fromEntries(flags.map((f) => [f.key, f.value]));
}

export async function patchFlag(
  key: string,
  value: FlagValue,
  reason: string
): Promise<{ success: boolean; newValue: FlagValue; traceId: string }> {
  const res = await fetch(`${config.MYSTWEAVER_API_URL}/api/flags/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.VERIKA_SERVICE_TOKEN}`,
    },
    body: JSON.stringify({ value, reason }),
  });
  if (!res.ok) throw new Error(`MystWeaver patch flag: ${res.status}`);
  const data = (await res.json()) as { value: FlagValue; traceId?: string };
  return {
    success: true,
    newValue: data.value,
    traceId: data.traceId ?? 'unknown',
  };
}

export async function fetchAuditLog(projectId: string): Promise<AuditEntry[]> {
  const res = await fetch(
    `${config.MYSTWEAVER_API_URL}/api/audit?projectId=${encodeURIComponent(projectId)}`,
    { headers: { Authorization: `Bearer ${config.VERIKA_SERVICE_TOKEN}` } }
  );
  if (!res.ok) throw new Error(`MystWeaver audit: ${res.status}`);
  return (await res.json()) as AuditEntry[];
}

export async function fetchExperiments(): Promise<unknown[]> {
  const res = await fetch(`${config.MYSTWEAVER_API_URL}/api/experiments`, {
    headers: { Authorization: `Bearer ${config.VERIKA_SERVICE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`MystWeaver experiments: ${res.status}`);
  return (await res.json()) as unknown[];
}
