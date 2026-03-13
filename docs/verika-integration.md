# Verika Integration Requirements for Varunai

This document specifies what must be in place in Verika before Varunai can run in any environment (development or production).

---

## Overview

Verika is the authentication and authorization service for the ecosystem. Varunai depends on Verika for:

1. **Service-to-service authentication:** Varunai's API server uses a Verika-issued service account token to call MystWeaver, Room 404, and Verika itself.
2. **Human token validation:** When a presenter connects to the Varunai WebSocket, their browser token is validated against Verika.
3. **Capability-based authorization:** Every cross-service call is gated by Verika capabilities.
4. **Audit logging:** Verika records all capability checks, which Varunai displays in TraceFeedPanel.

## Prerequisite 1: Register `varunai` Service in Verika Registry

Verika maintains a service registry -- each microservice in the ecosystem is registered with its identity, allowed capabilities, and service account binding.

### Registry Entry

Add `varunai` to Verika's service registry (typically a configuration file, database seed, or Terraform resource):

```json
{
  "serviceId": "varunai",
  "displayName": "Varunai Dashboard",
  "description": "Live demo operations dashboard with AI-powered assist",
  "serviceAccountEmail": "varunai-api@varunai-prod.iam.gserviceaccount.com",
  "environment": "production",
  "capabilities": [
    "flag.write",
    "session.read",
    "audit.read",
    "metrics.read",
    "stream.subscribe"
  ],
  "registeredAt": "2026-03-13T00:00:00Z"
}
```

If Verika uses a database for the registry, this is typically done via a seed migration or an admin API call:

```bash
curl -X POST https://verika-api.run.app/api/admin/services \
  -H "Authorization: Bearer $VERIKA_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "varunai",
    "displayName": "Varunai Dashboard",
    "serviceAccountEmail": "varunai-api@varunai-prod.iam.gserviceaccount.com",
    "capabilities": ["flag.write", "session.read", "audit.read", "metrics.read", "stream.subscribe"]
  }'
```

## Prerequisite 2: Capabilities Granted

Varunai requires the following capabilities. Each maps to a specific cross-service operation:

| Capability | Used to | Target service |
|---|---|---|
| `flag.write` | Apply assist suggestions by writing flag values | MystWeaver |
| `session.read` | Fetch current session state from Room 404 | Room 404 |
| `audit.read` | Read audit log entries from MystWeaver and Verika | MystWeaver, Verika |
| `metrics.read` | Scrape `/metrics` Prometheus endpoints | MystWeaver, Room 404 |
| `stream.subscribe` | Subscribe to MystWeaver SSE flag update stream | MystWeaver |

### Capability Definition

If Verika defines capabilities in code or configuration:

```typescript
// In Verika's capability registry
const VARUNAI_CAPABILITIES = [
  {
    name: 'flag.write',
    description: 'Write feature flag values in MystWeaver',
    targetServices: ['mystweaver'],
    riskLevel: 'high',
  },
  {
    name: 'session.read',
    description: 'Read session state from Room 404',
    targetServices: ['room404'],
    riskLevel: 'low',
  },
  {
    name: 'audit.read',
    description: 'Read audit log entries',
    targetServices: ['mystweaver', 'verika'],
    riskLevel: 'medium',
  },
  {
    name: 'metrics.read',
    description: 'Read Prometheus metrics endpoints',
    targetServices: ['mystweaver', 'room404'],
    riskLevel: 'low',
  },
  {
    name: 'stream.subscribe',
    description: 'Subscribe to real-time event streams',
    targetServices: ['mystweaver'],
    riskLevel: 'low',
  },
];
```

## Prerequisite 3: Terraform IAM Bindings

The Varunai service account must have cross-project IAM bindings so it can authenticate to services running in other GCP projects.

### `varunai-prod` Terraform Configuration

```hcl
# terraform/varunai-prod/iam.tf

# Service account for varunai-api Cloud Run service
resource "google_service_account" "varunai_api" {
  account_id   = "varunai-api"
  display_name = "Varunai API Service Account"
  project      = "varunai-prod"
}

# Grant the SA permission to invoke Cloud Run services in other projects
resource "google_cloud_run_service_iam_member" "varunai_invokes_mystweaver" {
  project  = "mystweaver-prod"
  location = var.region
  service  = "mystweaver-api"
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.varunai_api.email}"
}

resource "google_cloud_run_service_iam_member" "varunai_invokes_room404" {
  project  = "room404-prod"
  location = var.region
  service  = "room404-api"
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.varunai_api.email}"
}

resource "google_cloud_run_service_iam_member" "varunai_invokes_verika" {
  project  = "verika-prod"
  location = var.region
  service  = "verika-api"
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.varunai_api.email}"
}
```

### `verika-prod` Terraform Configuration

The Verika project must also grant the Varunai SA the ability to validate tokens:

```hcl
# terraform/verika-prod/cross-project.tf

# Allow varunai SA to call Verika's token validation endpoint
# (This is handled by the Cloud Run invoker role above, but if Verika
# uses a separate internal API, add specific IAM bindings here)

# Register varunai in Verika's service registry via Terraform
resource "google_secret_manager_secret_version" "varunai_service_token" {
  secret      = google_secret_manager_secret.service_tokens.id
  secret_data = var.varunai_service_token
}
```

### Cross-Project Service Account Bindings

If services are in separate GCP projects, the Varunai SA needs `roles/iam.serviceAccountTokenCreator` on itself and `roles/run.invoker` on target services. The complete set of bindings:

| Source SA | Target | Role | Purpose |
|---|---|---|---|
| `varunai-api@varunai-prod` | `mystweaver-api` Cloud Run (mystweaver-prod) | `roles/run.invoker` | Call MystWeaver endpoints |
| `varunai-api@varunai-prod` | `room404-api` Cloud Run (room404-prod) | `roles/run.invoker` | Call Room 404 endpoints |
| `varunai-api@varunai-prod` | `verika-api` Cloud Run (verika-prod) | `roles/run.invoker` | Validate tokens |
| `varunai-api@varunai-prod` | `flag-updates` Pub/Sub subscription (mystweaver-prod) | `roles/pubsub.subscriber` | Receive flag change events |

## Prerequisite 4: Human Token with `varunai.presenter` Role

When a presenter opens the Varunai dashboard in their browser, the client authenticates via a human token (currently hardcoded as `'dev-token'` in `useWebSocket.ts` -- this will be replaced with a real Verika-issued token).

### Role Definition

Define a `varunai.presenter` role in Verika that grants dashboard access:

```json
{
  "roleId": "varunai.presenter",
  "displayName": "Varunai Presenter",
  "description": "Can view the Varunai dashboard and apply assist suggestions",
  "capabilities": [
    "varunai.dashboard.read",
    "varunai.assist.read",
    "varunai.assist.apply",
    "varunai.flags.read",
    "varunai.flags.write",
    "varunai.audit.read"
  ]
}
```

### Token Issuance

The presenter obtains a token by authenticating with Verika (OAuth flow, CLI login, or pre-shared token for demo environments):

```bash
# Example: obtain a presenter token
curl -X POST https://verika-api.run.app/api/tokens/issue \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "presenter@example.com",
    "roles": ["varunai.presenter"],
    "expiresIn": "8h"
  }'
```

Response:

```json
{
  "token": "vk_live_abc123...",
  "expiresAt": "2026-03-13T20:00:00Z",
  "subject": "presenter@example.com",
  "roles": ["varunai.presenter"]
}
```

This token is stored in the browser (localStorage or session cookie) and sent in the WebSocket `AUTH` message.

## Prerequisite 5: Token Validation Endpoint

Varunai's API server validates human tokens by calling Verika's `POST /api/tokens/validate` endpoint (see `apps/varunai-api/src/clients/verika.ts`).

### Endpoint Contract

**Request:**

```http
POST /api/tokens/validate
Authorization: Bearer <VERIKA_SERVICE_TOKEN>
Content-Type: application/json

{
  "token": "vk_live_abc123..."
}
```

**Response (valid token):**

```json
{
  "valid": true,
  "subject": "presenter@example.com",
  "roles": ["varunai.presenter"],
  "capabilities": [
    "varunai.dashboard.read",
    "varunai.assist.read",
    "varunai.assist.apply",
    "varunai.flags.read",
    "varunai.flags.write",
    "varunai.audit.read"
  ],
  "expiresAt": "2026-03-13T20:00:00Z"
}
```

**Response (invalid/expired token):**

```json
{
  "valid": false,
  "subject": "",
  "roles": [],
  "capabilities": [],
  "reason": "Token expired"
}
```

### What Varunai Does with the Response

In `apps/varunai-api/src/routes/ws.ts`, the `AUTH` message handler should call `validateHumanToken()` and:

1. If `valid === true` and `roles` includes `varunai.presenter`: set `client.authenticated = true`.
2. If `valid === false` or role is missing: send `{ type: 'AUTH_FAILED', reason: '...' }` and close the socket.

Current code (V1) skips validation -- this is the TODO at line 49 of `ws.ts`:

```typescript
case 'AUTH':
  // TODO: validate via Verika
  client.authenticated = true;
```

The fix:

```typescript
case 'AUTH': {
  const validation = await validateHumanToken(msg.token);
  if (validation.valid && validation.roles.includes('varunai.presenter')) {
    client.authenticated = true;
    socket.send(JSON.stringify({ type: 'AUTH_OK', subject: validation.subject }));
  } else {
    socket.send(JSON.stringify({
      type: 'AUTH_FAILED',
      reason: validation.valid ? 'Missing varunai.presenter role' : 'Invalid token',
    }));
    socket.close(4001, 'Authentication failed');
  }
  break;
}
```

## Prerequisite 6: Cross-Project Service Account Bindings (Detail)

In a multi-project GCP setup, Varunai's service account lives in `varunai-prod` but needs to call services in `mystweaver-prod`, `room404-prod`, and `verika-prod`. This requires:

### 1. Cloud Run Invoker Bindings

Each target Cloud Run service must grant `roles/run.invoker` to the Varunai SA. This is shown in the Terraform section above.

### 2. Identity Token Generation

When Varunai calls a Cloud Run service, it must present an identity token (not just the Verika service token). The typical pattern on Cloud Run:

```typescript
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth();

async function getAuthHeaders(targetUrl: string): Promise<Record<string, string>> {
  const client = await auth.getIdTokenClient(targetUrl);
  const headers = await client.getRequestHeaders();
  return headers;
}
```

However, Varunai currently uses a Verika service token (not a GCP identity token) for all calls. This works if:
- The target services validate Verika tokens (not GCP identity tokens), OR
- The services are behind a load balancer that does not require GCP IAM authentication.

For production Cloud Run with `--no-allow-unauthenticated`, Varunai needs to send both:
1. A GCP identity token in the `Authorization` header (for Cloud Run IAM).
2. A Verika service token in a custom header (e.g., `X-Verika-Token`) for application-level auth.

Alternatively, if all services trust Verika tokens and Cloud Run allows unauthenticated access (with Verika handling auth at the application layer), only the Verika token is needed.

**Decision for Varunai:** Use Verika tokens at the application layer. Cloud Run services should be configured with `--allow-unauthenticated` in the demo environment, with Verika middleware handling auth. In production, add GCP identity token support as a follow-up.

## Verification Checklist

Before deploying Varunai, verify each prerequisite:

- [ ] `varunai` service is registered in Verika's service registry.
- [ ] Capabilities `flag.write`, `session.read`, `audit.read`, `metrics.read`, `stream.subscribe` are granted.
- [ ] Verika service token for `varunai` is generated and stored in Secret Manager.
- [ ] `VERIKA_SERVICE_TOKEN` environment variable is set on the varunai-api Cloud Run service.
- [ ] `varunai-api` SA has `roles/run.invoker` on mystweaver-api, room404-api, and verika-api Cloud Run services.
- [ ] `varunai-api` SA has `roles/pubsub.subscriber` on the `flag-updates` subscription.
- [ ] `varunai.presenter` role is defined in Verika.
- [ ] At least one human token with `varunai.presenter` role can be issued.
- [ ] `POST /api/tokens/validate` returns correct capabilities for both service and human tokens.
- [ ] Audit events from Varunai's calls appear in Verika's audit log.
