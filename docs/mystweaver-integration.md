# MystWeaver Integration Requirements for Varunai

This document specifies the exact changes needed in the MystWeaver codebase to support Varunai as a consumer.

---

## Existing Endpoints Varunai Reads

Varunai already calls these MystWeaver endpoints (see `apps/varunai-api/src/clients/mystweaver.ts`):

| Endpoint | Method | Purpose |
|---|---|---|
| `/sdk/flags` | GET | Fetch all flag configurations for the assist context |
| `/sdk/stream` | GET (SSE) | Real-time flag change stream (not yet wired in V1, planned) |
| `/api/flags/:key` | PATCH | Write flag values when assist suggestions are applied |
| `/api/audit` | GET | Fetch audit log entries for the dashboard |
| `/api/experiments` | GET | Fetch active experiments |
| `/metrics` | GET | Prometheus metrics endpoint (scraped by OTel collector) |

All requests carry `Authorization: Bearer <VERIKA_SERVICE_TOKEN>` where the token is a Verika-issued service account token for the `varunai` service.

## Change 1: Add Verika Auth Paths for Varunai Capabilities

MystWeaver's auth middleware must recognize and enforce the following Verika capabilities when Varunai's service token is presented:

| Capability | Used by | MystWeaver endpoint |
|---|---|---|
| `metrics.read` | Varunai OTel collector scraping `/metrics` | GET `/metrics` |
| `stream.subscribe` | Varunai subscribing to SSE flag updates | GET `/sdk/stream` |
| `audit.read` | Varunai fetching audit log | GET `/api/audit` |
| `flag.write` | Varunai applying assist suggestions | PATCH `/api/flags/:key` |

### Middleware Changes

MystWeaver's Verika auth middleware (typically in `packages/server/src/middleware/verika.ts` or similar) validates tokens by calling Verika's `POST /api/tokens/validate` endpoint. The response includes a `capabilities` array. MystWeaver must check that the required capability is present.

**If MystWeaver already uses a generic capability check**, no code change is needed -- just ensure the Verika registry grants these capabilities to the `varunai` service (see `docs/verika-integration.md`).

**If MystWeaver hardcodes allowed callers or uses a simple role check**, update the middleware to check capabilities:

```typescript
// packages/server/src/middleware/verika.ts

import type { FastifyRequest, FastifyReply } from 'fastify';

interface TokenValidation {
  valid: boolean;
  subject: string;
  roles: string[];
  capabilities: string[];
}

export function requireCapability(capability: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);

    const res = await fetch(`${process.env.VERIKA_API_URL}/api/tokens/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VERIKA_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      return reply.status(401).send({ error: 'Token validation failed' });
    }

    const validation = (await res.json()) as TokenValidation;

    if (!validation.valid) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    if (!validation.capabilities.includes(capability)) {
      return reply.status(403).send({
        error: `Missing capability: ${capability}`,
        required: capability,
        subject: validation.subject,
      });
    }

    // Attach validated identity to request for downstream use
    (request as any).verikaSubject = validation.subject;
    (request as any).verikaCapabilities = validation.capabilities;
  };
}
```

Apply to routes:

```typescript
// In the route registration
app.get('/metrics', { preHandler: requireCapability('metrics.read') }, metricsHandler);
app.get('/sdk/stream', { preHandler: requireCapability('stream.subscribe') }, streamHandler);
app.get('/api/audit', { preHandler: requireCapability('audit.read') }, auditHandler);
app.patch('/api/flags/:key', { preHandler: requireCapability('flag.write') }, flagPatchHandler);
```

**Note:** The `/sdk/flags` GET endpoint uses the existing SDK auth flow (SDK key or service token with `flag.read` capability). No change needed if Varunai's service token already has `flag.read`.

## Change 2: Confirm Pub/Sub `flag-updates` Topic Grants Subscriber Role

MystWeaver publishes flag change events to a Google Cloud Pub/Sub topic (likely `projects/<project>/topics/flag-updates`). Varunai subscribes to this topic via a push subscription that hits `POST /api/pubsub/flag-updates` on varunai-api.

**What needs to happen:**

1. The `flag-updates` topic must exist in the MystWeaver GCP project.
2. The Varunai service account (`varunai-api@varunai-prod.iam.gserviceaccount.com`) must have `roles/pubsub.subscriber` on a subscription to that topic.
3. A push subscription must be configured pointing to `https://varunai-api.run.app/api/pubsub/flag-updates`.

**Terraform snippet** (in the MystWeaver or shared infrastructure repo):

```hcl
resource "google_pubsub_topic" "flag_updates" {
  name    = "flag-updates"
  project = var.mystweaver_project_id
}

resource "google_pubsub_subscription" "varunai_flag_updates" {
  name    = "varunai-flag-updates"
  topic   = google_pubsub_topic.flag_updates.id
  project = var.mystweaver_project_id

  push_config {
    push_endpoint = "https://varunai-api.run.app/api/pubsub/flag-updates"

    oidc_token {
      service_account_email = "varunai-api@varunai-prod.iam.gserviceaccount.com"
    }
  }

  ack_deadline_seconds = 20
  retain_acked_messages = false
  message_retention_duration = "600s"
}

resource "google_pubsub_subscription_iam_member" "varunai_subscriber" {
  subscription = google_pubsub_subscription.varunai_flag_updates.id
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:varunai-api@varunai-prod.iam.gserviceaccount.com"
}
```

**If MystWeaver manages its own Pub/Sub via application code**, ensure the publish call includes the full event payload:

```typescript
// MystWeaver flag write handler -- after persisting the change
await pubSubClient.topic('flag-updates').publishMessage({
  json: {
    key: flagKey,
    value: newValue,
    previousValue: oldValue,
    changedBy: request.verikaSubject,  // from auth middleware
    traceId: span.spanContext().traceId,
    reason: request.body.reason,       // See Change 3
    timestamp: Date.now(),
  },
});
```

## Change 3: Add `reason` Field to PATCH `/api/flags/:key` Request Body

Varunai sends a `reason` field when applying assist suggestions (see `patchFlag()` in `mystweaver.ts`):

```typescript
body: JSON.stringify({ value, reason }),
```

MystWeaver must accept and persist this field for audit enrichment.

### Request Schema Change

```typescript
// Before
interface PatchFlagBody {
  value: FlagValue;
}

// After
interface PatchFlagBody {
  value: FlagValue;
  reason?: string;  // Optional -- backward compatible
}
```

### Persist to Audit Log

In the flag PATCH handler, include `reason` in the audit entry:

```typescript
// In the flag PATCH route handler
app.patch<{ Params: { key: string }; Body: PatchFlagBody }>(
  '/api/flags/:key',
  { preHandler: requireCapability('flag.write') },
  async (request, reply) => {
    const { key } = request.params;
    const { value, reason } = request.body;

    const previousValue = await getFlagValue(key);
    await setFlagValue(key, value);

    // Write audit entry with reason
    await writeAuditEntry({
      action: 'flag.update',
      actor: (request as any).verikaSubject,
      target: `flag:${key}`,
      metadata: {
        previousValue,
        newValue: value,
        reason: reason ?? null,   // <-- NEW
        traceId: getTraceId(),
      },
    });

    // Publish to Pub/Sub
    await publishFlagUpdate({
      key,
      value,
      previousValue,
      changedBy: (request as any).verikaSubject,
      reason: reason ?? null,      // <-- NEW
      traceId: getTraceId(),
    });

    return reply.send({ value, traceId: getTraceId() });
  },
);
```

### Zod Validation Update

If MystWeaver uses Zod for request validation:

```typescript
const patchFlagSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  reason: z.string().max(500).optional(),  // <-- NEW
});
```

## Summary of Changes

| # | Change | Scope | Breaking? |
|---|---|---|---|
| 1 | Verika capability checks on protected endpoints | Middleware | No (additive) |
| 2 | Pub/Sub subscriber role for varunai SA | Terraform/IAM | No (additive) |
| 3 | Accept `reason` in PATCH `/api/flags/:key` | Route handler + schema | No (optional field) |

All changes are non-breaking and additive. Existing MystWeaver consumers are unaffected.
