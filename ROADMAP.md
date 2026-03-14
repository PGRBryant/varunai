# Varunai Roadmap

> Phased delivery plan for the Varunai Observability Hub.
> Each phase has clear entry criteria, deliverables, and exit criteria.

---

## Overview

```
Phase 0        Phase 1          Phase 2          Phase 3          Phase 4
Prerequisites  Core Infra       The Dashboard    Demo Assist      V2 Horizons
──────────── ► ────────────── ► ────────────── ► ────────────── ► ──────────
  1 week         1-2 weeks        2-3 weeks        1-2 weeks       Ongoing
```

**V1 Target:** One live Room 404 session, ~15 minutes, on stage.
Everything is built to make that moment exceptional.

---

## Phase 0 — Prerequisites & Integration Contracts

**Goal:** Ensure every upstream dependency is in place before writing application code.

### Tasks

- [ ] **Verika: Register varunai service identity**
  - varunai registered in Verika service registry
  - Capabilities granted: `flag.write`, `session.read`, `audit.read`, `metrics.read`, `stream.subscribe`
  - Human token with `varunai.presenter` role supported
  - See [docs/verika-integration.md](docs/verika-integration.md)

- [ ] **MystWeaver: Confirm integration surface**
  - Verika auth paths added: `metrics.read`, `stream.subscribe`, `audit.read`
  - `reason` field accepted on `PATCH /api/flags/:key`
  - Pub/Sub `flag-updates` topic grants subscriber to varunai SA
  - See [docs/mystweaver-integration.md](docs/mystweaver-integration.md)

- [ ] **Room 404: Add session endpoint**
  - `GET /api/session/current` implemented (session.read via Verika)
  - `traceContext` field added to WebSocket JOIN message
  - See [docs/room404-integration.md](docs/room404-integration.md)

- [x] **GCP Project: varunai-490119 created**
  - APIs enabled: Cloud Run, Secret Manager, Artifact Registry, Managed Prometheus, Cloud Trace, Cloud Logging, Firebase Hosting
  - Billing account linked

- [x] **Secrets provisioned**
  - `gemini-api-key` in Secret Manager (placeholder — replace with real key)
  - `grafana-admin-password` in Secret Manager
  - `grafana-secret-key` in Secret Manager

### Exit Criteria
- All upstream integration contracts documented and acknowledged
- GCP project ready with APIs enabled
- Varunai service identity active in Verika

---

## Phase 1 — Core Infrastructure

**Goal:** Deploy the foundational infrastructure. Nothing user-facing yet, but the pipes are connected.

### Tasks

- [x] **Terraform: Apply base infrastructure**
  - Service accounts and IAM bindings (`iam.tf`)
  - Secret Manager secrets (`secrets.tf`)
  - Artifact Registry repositories (`artifact_registry.tf`)
  - Workload Identity Federation for GitHub Actions (`workload_identity.tf`)

- [ ] **OTel Collector: Deploy**
  - `otel-collector/config.yaml` finalized
  - Cloud Run service running (`cloud_run.tf`)
  - Receiving OTLP/HTTP on port 4318
  - Exporting to Cloud Trace, Managed Prometheus, Cloud Logging
  - Health check passing

- [ ] **@internal/telemetry: Publish v0.1.0**
  - Package built and published to GitHub Packages
  - Repository dispatch triggers sent to mystweaver, room404, verika repos
  - Integration instructions in each repo's integration doc

- [ ] **Grafana: Deploy**
  - Grafana OSS on Cloud Run (single instance, never scale to zero)
  - Data sources provisioned: Managed Prometheus, Cloud Trace, Cloud Logging
  - Custom theme applied matching Varunai design system
  - Dashboard JSON models loaded via provisioning

- [ ] **CI/CD: Pipelines operational**
  - `ci.yml` — lint, typecheck, test on PRs
  - `deploy-api.yml` — build, push, deploy on main
  - `deploy-client.yml` — build, deploy to Firebase on main
  - `publish-telemetry.yml` — publish on tags

- [x] **Varunai API: Base deployment**
  - Fastify server running on Cloud Run
  - `/health` endpoint returning status
  - CORS and WebSocket configured
  - Environment variables wired from Secret Manager

### Exit Criteria
- `GET /health` returns 200 from Cloud Run
- OTel Collector receiving and exporting telemetry
- Grafana accessible with themed dashboards (even if empty data)
- CI pipeline green on a test PR

---

## Phase 2 — The Dashboard

**Goal:** Build the React shell with all four quadrant panels. Real data flowing.

### Tasks

- [ ] **Design system: tokens.css + Tailwind config**
  - All CSS custom properties defined
  - Tailwind theme extended with Varunai palette
  - Google Fonts loaded (Cinzel Decorative, Rajdhani, Share Tech Mono)
  - Design rules enforced (metric values in Share Tech Mono, etc.)

- [ ] **StatusBar component**
  - VARUNAI wordmark (Cinzel Decorative, ember-gold, appears once)
  - Service health dots (spirit-teal/ember-gold/warning-red)
  - Pulsing animation on health check
  - Live clock (Share Tech Mono)

- [ ] **SessionPanel component**
  - Room 404 live session state
  - Player count, floor distribution bars, completion rate, avg score
  - Leaderboard top 5
  - Polling Room 404 via `/api/session/current` every 2 seconds

- [ ] **TraceFeedPanel component**
  - Real-time audit event feed from WebSocket
  - Caller → target with capability and status
  - Timestamps in Share Tech Mono
  - Auto-scroll with most recent at top
  - 60-second rolling window (V1)

- [ ] **FlagsPanel component**
  - All current MystWeaver flag values
  - Status dots (active/inactive)
  - Inline editor: click → input + APPLY button (no modal)
  - Optimistic update + PATCH via Verika

- [ ] **MetricsPanel component**
  - Grafana embedded via iframe
  - Fixed 15-minute window (V1)
  - Themed to be visually indistinguishable from React shell
  - Kiosk mode, dark theme

- [ ] **WebSocket client**
  - Auto-reconnect with 3-second backoff
  - Typed message dispatch to Zustand stores
  - AUTH → SUBSCRIBE flow on connect
  - Channel-based subscriptions: session, flags, assist, audit

- [ ] **Zustand stores**
  - `sessionStore` — Room 404 session state
  - `flagStore` — flag values with optimistic updates
  - `assistStore` — suggestion lifecycle (set, confirm, dismiss)
  - `eventStore` — rolling event buffer (max 100 events)

- [ ] **Varunai API: Data routes**
  - `GET /api/session/current` — proxy to Room 404
  - `GET /api/flags/current` — proxy to MystWeaver
  - `PATCH /api/flags/:key` — write via Verika
  - `GET /api/audit/stream` — SSE from Verika audit log
  - `GET /api/experiments/active` — proxy to MystWeaver
  - `WS /ws` — real-time event broadcast

- [ ] **Pub/Sub integration**
  - `POST /internal/pubsub/flag-updates` handler
  - Decode base64 message, broadcast FLAG_CHANGED to WS clients
  - Sub-200ms flag change propagation to dashboard

### Exit Criteria
- Dashboard renders all four panels with live data
- Flag changes from dashboard propagate to MystWeaver within 200ms
- Trace feed shows cross-service calls in real time
- Grafana panels visually seamless with React shell

---

## Phase 3 — Gemini Demo Assist (Highest Priority Feature)

**Goal:** The AI copilot that makes the demo's closing argument.

### Tasks

- [ ] **Assist context builder**
  - `buildAssistContext()` assembles session + flags + metrics + experiments
  - Pulls from Room 404, MystWeaver, and Prometheus
  - Recent flag change history (last 90 seconds)
  - Stuck player detection (below floor 7 for > 2 minutes)

- [ ] **Gemini integration**
  - `generateSuggestion(context, question?)` calls Gemini 1.5 Flash
  - System prompts for proactive and reactive modes
  - JSON response parsing with structured AssistSuggestion schema
  - 3-second timeout with silent failure

- [ ] **Suggestion evaluation**
  - `shouldSurfaceSuggestion()` gates on:
    - Confidence > 0.7
    - Flag exists in MystWeaver registry
    - Value is valid for flag type
    - No suggestion in last 60 seconds
    - Flag not changed in last 2 minutes

- [ ] **Proactive assist loop**
  - Runs every 30 seconds
  - Evaluates session state against trigger thresholds:
    - 40%+ players stuck below floor 7 for > 2 minutes
    - Completion rate drops > 30% vs. session average
    - Multiple consecutive AI service timeouts
    - Leaderboard compression
    - Task timer failure spikes
  - At most one suggestion visible at a time
  - New suggestion replaces existing if higher priority

- [ ] **AssistBar component**
  - Floating suggestion card with Framer Motion entrance animation
  - Shows: flag, from → to, reasoning, predicted effect, urgency badge
  - CONFIRM button → PATCH flag → "Applied" toast
  - DISMISS button → 90-second cooldown
  - Reactive input: "Ask Varunai..." placeholder
  - Default state: "SESSION NOMINAL — No changes recommended"

- [ ] **Flag application flow**
  - On CONFIRM: PATCH to MystWeaver via Verika
  - Audit entry: `changedBy: "varunai"`, `onBehalfOf: "presenter@demo.com"`, `assistReason`
  - Propagation via Pub/Sub + SSE to Room 404 clients
  - Trace appears in Varunai's own trace feed
  - Confirmation card collapses to toast

- [ ] **Reactive mode**
  - Presenter types free-form question
  - Question sent as ASSIST_QUERY via WebSocket (or POST /api/assist/suggest)
  - Gemini responds with same structured suggestion card
  - Same confirm/dismiss flow

- [ ] **Silent failure everywhere**
  - Gemini timeout → no suggestion shown
  - MystWeaver unreachable → "SESSION NOMINAL"
  - Verika token failure → "SESSION NOMINAL"
  - Presenter never sees a broken state in the assist panel

### Exit Criteria
- Proactive suggestions appear when session state warrants them
- Reactive questions produce relevant flag change suggestions
- Full flow works: suggest → confirm → flag change → trace visible
- All failures are silent — presenter sees "SESSION NOMINAL"

---

## Phase 4 — V2 Horizons (Documented, Not Built)

These features are specified in detail but not implemented. Each has a trigger condition, implementation guide, and effort estimate in `docs/`.

### 4a. Flexible Time Windows
- **Trigger:** Post-demo analytics become a use case
- **Effort:** 1 week
- **Spec:** [docs/v2-time-windows.md](docs/v2-time-windows.md)
- [ ] Time window picker in React shell
- [ ] Grafana query variable API integration
- [ ] SessionContext.windowStartMs/windowEndMs become user-selected

### 4b. Multi-Session Support
- **Trigger:** Room 404 orchestration supports multiple concurrent sessions
- **Effort:** 1 week (UI) + Room 404 orchestration
- **Spec:** [docs/v2-multi-session.md](docs/v2-multi-session.md)
- [ ] Session selector dropdown in StatusBar
- [ ] Session list API in Room 404
- [ ] SessionContext.sessionId becomes dynamic

### 4c. Anomaly Narration
- **Trigger:** After demo assist is stable and proven valuable
- **Effort:** 2 weeks
- **Spec:** [docs/v2-anomaly-narration.md](docs/v2-anomaly-narration.md)
- [ ] Gemini interprets metric anomalies in plain language
- [ ] ANOMALY_NARRATION event type in WebSocket protocol
- [ ] Narration cards in TraceFeedPanel alongside raw events

### 4d. SRE & Security Narration
- **Trigger:** After anomaly narration is stable
- **Effort:** 3 weeks
- **Spec:** [docs/v2-sre-security-narration.md](docs/v2-sre-security-narration.md)
- [ ] Verika audit stream anomaly detection
- [ ] Cross-service call pattern analysis
- [ ] Natural language SRE/security insights in dashboard

---

## Release Milestones

| Milestone | Target | Description |
|-----------|--------|-------------|
| **v0.1.0** | Phase 1 complete | Infrastructure deployed, telemetry flowing |
| **v0.2.0** | Phase 2 complete | Dashboard live with real data |
| **v1.0.0** | Phase 3 complete | Demo-ready with Gemini assist |
| **v1.1.0** | Phase 4a | Flexible time windows |
| **v1.2.0** | Phase 4b | Multi-session support |
| **v2.0.0** | Phase 4c + 4d | AI-powered narration layer |

---

## How to Track Progress

This roadmap uses GitHub Issues for tracking. Each task above maps to an issue labeled with its phase:

- `phase:0-prerequisites`
- `phase:1-infrastructure`
- `phase:2-dashboard`
- `phase:3-assist`
- `phase:4-v2`

Use the [GitHub Project Board](../../projects) for kanban-style tracking across phases.

---

## V1 / V2 Philosophy

> V1 is optimized for the 15-minute demo moment. Nothing exists in V1 for any other reason.
> V2 is documented, not built. Every `TODO(varunai-v2)` in the code includes a trigger condition, effort estimate, and docs reference.

This distinction is the design, not a compromise.

---

<p align="center">
  <em>Licensed under Apache 2.0</em>
</p>
