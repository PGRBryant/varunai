<p align="center">
  <img src="docs/assets/varunai-wordmark.svg" alt="VARUNAI" width="320" />
</p>

<h3 align="center">
  The Observability Hub
</h3>

<p align="center">
  <em>A thousand eyes. One screen. Complete clarity.</em>
</p>

<p align="center">
  <a href="#architecture">Architecture</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#the-demo-moment">The Demo Moment</a> &bull;
  <a href="#ecosystem">Ecosystem</a> &bull;
  <a href="ROADMAP.md">Roadmap</a> &bull;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/PGRBryant/varunai/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/PGRBryant/varunai/ci.yml?label=CI&style=flat-square" alt="CI" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License" />
  </a>
  <a href="https://nodejs.org">
    <img src="https://img.shields.io/badge/node-%3E%3D20-green?style=flat-square" alt="Node" />
  </a>
</p>

---

## What is Varunai?

**Varunai** (vuh-ROO-nigh) is the observability hub for an internal ecosystem of services. It has two functions:

1. **Critical infrastructure** that collects traces, metrics, and structured logs from every service via OpenTelemetry
2. **A beautiful dashboard** that displays and controls the entire ecosystem from one screen

The name plays on three things:
- **Varuna** — the Vedic guardian of Rta (cosmic order), who sees with a thousand eyes
- **AI** — Gemini powers the intelligence layer
- **Eye** — the literal function, stated plainly

Varunai is paired with [Verika](https://github.com/PGRBryant/verika) (identity). Verika answers *"What are you?"* Varunai answers *"What are you doing?"*

---

## The Demo Moment

Varunai V1 is optimized for exactly one use case: **one live Room 404 session, approximately 15 minutes, on stage in front of an audience.**

The closing argument of the demo is the **Gemini Demo Assist** — an AI copilot that watches the live game session and suggests feature flag changes in real time:

```
ASSIST: Completion rate dropped 30%. Consider: task-timer 8 -> 10
"Players are timing out on floors 6-8. Extending by 2s should
 recover momentum without eliminating challenge."    [CONFIRM] [x]
```

The presenter confirms. The flag propagates through MystWeaver to 47 live players in under 200ms. The entire trace — from Gemini suggestion to player-side effect — appears in the dashboard in real time.

---

## Architecture

```
                          ┌─────────────────────────────────┐
                          │          VARUNAI HUB             │
                          │                                  │
                          │  ┌──────────┐  ┌──────────────┐ │
                          │  │  React   │  │   Grafana    │ │
         Audience /       │  │  Shell   │  │  (embedded)  │ │
         Presenter        │  └────┬─────┘  └──────┬───────┘ │
              │           │       │               │          │
              │           │  ┌────┴───────────────┴───────┐ │
              └──────────►│  │       Varunai API           │ │
                          │  │   (Fastify + Gemini Assist) │ │
                          │  └──┬─────┬──────┬─────────┬──┘ │
                          └─────┼─────┼──────┼─────────┼────┘
                                │     │      │         │
               ┌────────────────┘     │      │         └─────────────┐
               │                      │      │                       │
               ▼                      ▼      ▼                       ▼
     ┌─────────────────┐   ┌──────────────┐  ┌──────────────┐  ┌──────────┐
     │   MystWeaver     │   │   Room 404   │  │    Verika    │  │   OTel   │
     │  Feature Flags   │   │  Multiplayer │  │   Identity   │  │Collector │
     │  & Experiments   │   │    Game      │  │  & Service   │  │          │
     │                  │   │              │  │    Mesh      │  │ ┌──────┐ │
     │ /sdk/flags       │   │ /api/session │  │              │  │ │Traces│ │
     │ /sdk/stream SSE  │   │   /current   │  │ token.valid  │  │ │Metric│ │
     │ /api/flags PATCH │   │              │  │ audit.stream │  │ │ Logs │ │
     │ /api/audit       │   │              │  │              │  │ └──────┘ │
     │ /metrics         │   │              │  │              │  │          │
     └─────────────────┘   └──────────────┘  └──────────────┘  └──────────┘
           │                      │                │                │
           └──────────────────────┴────────────────┘                │
                    All services ship telemetry via OTLP            │
                    ────────────────────────────────────────────────┘
                                                         ▼
                                              Cloud Trace / Managed
                                              Prometheus / Cloud Logging
```

### The Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  VARUNAI        ● mystweaver  ● room404  ● verika        14:32:01  │
├───────────────────────────┬─────────────────────────────────────────┤
│  ROOM 404 SESSION         │  LIVE TRACE FEED                       │
│  GHOST-7  ·  47 players   │  14:32:01 game-server → mystweaver     │
│  Floor distribution bars  │  flag.evaluate.bulk  47req  12ms       │
│  Completion: 71%          │  14:32:03 [PRESENTER] → mystweaver     │
│  Leaderboard top 5        │  flag.write  task-timer  8→5  ✓        │
├───────────────────────────┼─────────────────────────────────────────┤
│  ACTIVE FLAGS             │  GRAFANA: error rate / latency          │
│  ● game.task-timer    8s  │  time-series, last 15 minutes           │
│  ● game.lives-per-floor 3│                                          │
│  ○ rooms.ai-prompt  OFF   │                                          │
├───────────────────────────┴─────────────────────────────────────────┤
│  ASSIST: Completion rate dropped 30%. Consider: task-timer 8→10    │
│  [CONFIRM]  [✕]                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Ecosystem

| Service | Project ID | Varunai Reads | Varunai Writes |
|---------|-----------|---------------|----------------|
| **MystWeaver** | `mystweaver-489920` | Metrics, audit log, SSE stream, flag state | Flag values (via Verika `flag.write`) |
| **Room 404** | `room404-490104` | Live session state (players, floors, scores) | — |
| **Verika** | `verika-490105` | Audit stream (who called what, when) | — |
| **Varunai** | `varunai-490119` | Self-monitoring | — |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | Turborepo + pnpm workspaces |
| **Language** | TypeScript (strict mode everywhere) |
| **Client** | React 18 + Vite 5, Zustand, Tailwind CSS, Framer Motion |
| **API** | Node.js 20, Fastify v4, Zod |
| **AI** | Google Gemini 1.5 Flash |
| **Observability** | OpenTelemetry → Cloud Trace + Managed Prometheus + Cloud Logging |
| **Visualization** | Grafana OSS (self-hosted, themed to match) |
| **Auth** | Verika (service mesh identity) |
| **Infra** | GCP Cloud Run, Firebase Hosting, Terraform |
| **CI/CD** | GitHub Actions with Workload Identity Federation |

---

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- A GCP project with the services described above (or mock them for local dev)

### Install & Run

```bash
# Clone
git clone https://github.com/PGRBryant/varunai.git
cd varunai

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Start all services in development
pnpm dev
```

This starts:
- **Client** at `http://localhost:5173` (Vite dev server)
- **API** at `http://localhost:8080` (Fastify)

The client proxies API requests to the backend automatically.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `VERIKA_SERVICE_TOKEN` | Varunai's Verika service identity token |
| `MYSTWEAVER_API_URL` | MystWeaver API base URL |
| `ROOM404_API_URL` | Room 404 game server base URL |
| `VERIKA_API_URL` | Verika API base URL |
| `GRAFANA_URL` | Grafana instance URL |

### Deploy

Deployments are automated via GitHub Actions on push to `main`:

- **API** — `deploy-api.yml`: Builds Docker image, pushes to Artifact Registry, deploys to Cloud Run (triggers on changes to `apps/varunai-api/` or `packages/shared/`)
- **Client** — `deploy-client.yml`: Builds React app, deploys to Firebase Hosting via WIF auth (triggers on changes to `apps/client/` or `packages/shared/`)
- **Telemetry** — `publish-telemetry.yml`: Publishes `@internal/telemetry` to GitHub Packages (triggers on `v*` tags)

For manual infrastructure changes:

```bash
cd infra/terraform
terraform init
terraform apply
```

---

## Project Structure

```
varunai/
├── apps/
│   ├── client/              # React dashboard shell
│   │   ├── src/
│   │   │   ├── components/  # Dashboard panels
│   │   │   ├── stores/      # Zustand state
│   │   │   ├── hooks/       # WebSocket, data fetching
│   │   │   └── styles/      # Design tokens, Tailwind
│   │   └── index.html
│   └── varunai-api/         # Fastify backend
│       └── src/
│           ├── routes/      # HTTP + WS endpoints
│           ├── assist/      # Gemini integration
│           ├── clients/     # MystWeaver, Room 404, Verika
│           └── config.ts
├── packages/
│   ├── shared/              # TypeScript types (zero runtime deps)
│   └── telemetry/           # @internal/telemetry (OTel package)
├── otel-collector/          # OTel Collector config
├── grafana/                 # Dashboard JSON models + provisioning
├── infra/terraform/         # GCP infrastructure
├── docs/                    # Integration guides + V2 specs
└── .github/workflows/       # CI/CD pipelines
```

---

## Design System

Varunai shares the Room 404 color palette with distinct typography optimized for data readability at presentation distance.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-void-black` | `#0A0A0F` | Background |
| `--color-shadow-blue` | `#0D1B2A` | Panel backgrounds |
| `--color-ember-gold` | `#C8922A` | Primary metric values |
| `--color-spirit-teal` | `#00F5C4` | Healthy states, secondary values |
| `--color-warning-red` | `#FF3B3B` | Error states |
| `--color-ghost-white` | `#E8E8F0` | Text |
| **Rajdhani** | Body font | Navigation, labels |
| **Share Tech Mono** | Mono font | All data values, timestamps |
| **Cinzel Decorative** | Display font | Wordmark only |

---

## Current Status

**Phase 1 (Core Infrastructure)** and **Phase 2 (The Dashboard)** are complete. All services are deployed and CI/CD is green.

| Service | URL | Status |
|---------|-----|--------|
| Dashboard | [`varunai-dashboard.web.app`](https://varunai-dashboard.web.app) | Deployed |
| API | [`varunai-api-qk3n3mly6q-uc.a.run.app`](https://varunai-api-qk3n3mly6q-uc.a.run.app/health) | Deployed |
| Grafana | [`grafana-qk3n3mly6q-uc.a.run.app`](https://grafana-qk3n3mly6q-uc.a.run.app) | Deployed |
| OTel Collector | [`otel-collector-qk3n3mly6q-uc.a.run.app`](https://otel-collector-qk3n3mly6q-uc.a.run.app) | Deployed |

**Next:** Phase 3 — Gemini Demo Assist. See the [Roadmap](ROADMAP.md) for the full plan.

---

## License

```
Copyright 2026 Varunai Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

<p align="center">
  <strong>Varuna sees. Varunai shows.</strong><br/>
  <em>A thousand eyes. One screen.</em>
</p>
