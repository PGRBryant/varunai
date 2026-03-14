import type { FlagValue, Experiment } from '@varunai/shared';
import { config } from '../config.js';

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

/** SDK endpoints use the MystWeaver SDK key; admin API endpoints use the Verika service token. */
function sdkHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${config.MYSTWEAVER_SDK_KEY}` };
}

function adminHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${config.VERIKA_SERVICE_TOKEN}` };
}

export async function fetchFlags(): Promise<Record<string, FlagValue>> {
  const res = await fetch(`${config.MYSTWEAVER_API_URL}/sdk/flags`, {
    headers: sdkHeaders(),
  });
  if (!res.ok) throw new Error(`MystWeaver flags: ${res.status}`);
  const data = (await res.json()) as { flags: Record<string, FlagValue> };
  return data.flags;
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
      ...adminHeaders(),
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
    { headers: adminHeaders() }
  );
  if (!res.ok) throw new Error(`MystWeaver audit: ${res.status}`);
  return (await res.json()) as AuditEntry[];
}

export async function fetchExperiments(): Promise<Experiment[]> {
  const res = await fetch(`${config.MYSTWEAVER_API_URL}/api/experiments`, {
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error(`MystWeaver experiments: ${res.status}`);
  return (await res.json()) as Experiment[];
}
