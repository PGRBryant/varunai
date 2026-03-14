# Contributing to Varunai

Varunai is the observability hub for our internal service ecosystem (MystWeaver, Room 404, Verika). This guide covers the most common contribution workflows.

## Development Setup

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- pnpm 9+

### Install and Run

```bash
pnpm install
pnpm dev          # starts all apps via Turborepo
```

`pnpm dev` launches the API server (`apps/varunai-api`, default port 8080) and the Vite client (`apps/client`).

### Environment Variables

The API validates its environment with Zod on startup (`apps/varunai-api/src/config.ts`). Required/notable variables:

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8080` | API listen port |
| `GEMINI_API_KEY` | (empty) | Required for the assist loop to generate suggestions |
| `VERIKA_SERVICE_TOKEN` | (empty) | Service-to-service auth with Verika |
| `MYSTWEAVER_API_URL` | `https://mystweaver-api.run.app` | Override for local dev |
| `ROOM404_API_URL` | `https://room404-api.run.app` | Override for local dev |
| `VERIKA_API_URL` | `https://verika-api.run.app` | Override for local dev |
| `GRAFANA_URL` | `http://localhost:3000` | Grafana base URL |
| `GCP_PROJECT_ID` | `varunai-490119` | GCP project for Pub/Sub, secrets, etc. |

The client reads `VITE_GRAFANA_URL` (defaults to `http://localhost:3000`).

Create a `.env` file at the repo root or in `apps/varunai-api/` with the values you need. Never commit secrets.

---

## Adding a New Data Source to the Dashboard

Varunai's `MetricsPanel` embeds Grafana dashboards via iframe. To add a new data source:

### 1. Add a Grafana datasource provisioning YAML

Create a file under `grafana/provisioning/datasources/` (e.g., `my-source.yaml`):

```yaml
apiVersion: 1
datasources:
  - name: MySource
    type: prometheus          # or loki, tempo, etc.
    access: proxy
    url: http://my-source:9090
    isDefault: false
    editable: false
```

### 2. Create a dashboard JSON

Add the dashboard JSON model to `grafana/dashboards/`. Use the datasource name from step 1 in panel targets. Export from Grafana UI or author by hand.

### 3. Embed in MetricsPanel (if needed)

If the new source powers a separate dashboard (not panels on the existing `ecosystem-overview` dashboard), update `apps/client/src/components/MetricsPanel.tsx`:

- Change `dashboardUid` or add an additional iframe pointing to the new dashboard UID.
- Pass any required template variables via the URL query string.

---

## Adding a New Gemini Suggestion Trigger

The assist loop runs every 30 seconds in `apps/varunai-api/src/assist/loop.ts`. It builds context, calls Gemini, and gates output through evaluation thresholds.

### Modify evaluation thresholds

Edit `apps/varunai-api/src/assist/evaluation.ts`. The gating constants are:

- `MIN_CONFIDENCE` (0.7) -- minimum Gemini confidence score to surface a suggestion.
- `MIN_INTERVAL_MS` (60 000) -- debounce window between suggestions.
- `RECENTLY_CHANGED_MS` (120 000) -- suppress suggestions for flags that were just changed.

Add new guard clauses to `shouldSurfaceSuggestion()` as needed.

### Add new session-state signals

1. Extend the `AssistContext` type in `packages/shared/src/assist.ts`. Add new fields under `session`, `metrics`, or a new top-level key.
2. Populate those fields in `apps/varunai-api/src/assist/context.ts` inside `buildAssistContext()`. The context builder fetches live data from Room 404 and MystWeaver -- add new API calls or derived computations there.
3. Update the Gemini prompt in `apps/varunai-api/src/assist/prompts/index.ts` so the model knows about the new signal and can act on it.

### Example: adding a "high error rate" trigger

1. Add `errorRate` population in `context.ts` (currently `0` with a TODO).
2. Add a clause in `evaluation.ts`: if `context.metrics.errorRate > 0.05`, auto-boost urgency.
3. Reference it in the prompt so Gemini explains the error spike in its reasoning.

---

## Updating Grafana Dashboards

Dashboard JSON models live in version control under `grafana/dashboards/`. Provisioning config lives under `grafana/provisioning/`.

### Workflow

1. Edit the dashboard in the Grafana UI (local or staging).
2. Export the JSON model via **Dashboard settings > JSON Model** (or the Grafana HTTP API).
3. Save the JSON to `grafana/dashboards/<dashboard-name>.json`. Keep the `uid` field stable so iframe URLs and bookmarks do not break.
4. Commit. Grafana's provisioning file watcher picks up changes on restart.

### Provisioning config

`grafana/provisioning/dashboards/default.yaml` should point at the dashboards directory:

```yaml
apiVersion: 1
providers:
  - name: default
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

Keep dashboard UIDs stable. The `MetricsPanel` component references `ecosystem-overview` by UID.

---

## Adding a New Metric to the OTel Collector

### 1. Update the collector config

Edit `otel-collector/config.yaml`. Add the new metric to the relevant receiver, processor, or pipeline. For a Prometheus scrape target, add the metric name to the `metrics` filter list so it is not dropped.

### 2. Add a metric constant

Add the canonical name to `packages/shared/src/metrics.ts`:

```ts
// Under the appropriate service section
export const ROOM404_NEW_METRIC = 'room404_new_metric';
```

This file is the single source of truth. Use the exported constant everywhere -- application code, tests, and Grafana JSON queries -- to prevent string drift.

### 3. Reference in Grafana

If the metric should appear on a dashboard, add a panel in the relevant `grafana/dashboards/*.json` file that queries the metric by its canonical name.

---

## Code Style

- **TypeScript strict mode** is enforced via `tsconfig.base.json` (`strict: true`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
- **No `any`**. Use `unknown` and narrow, or define a proper type.
- **Zod validation at boundaries**. All external input (env vars, HTTP request bodies, WebSocket messages) must be parsed through a Zod schema before use. See `apps/varunai-api/src/config.ts` for the pattern.
- **Turborepo** runs lint, typecheck, and test across all packages. Run `pnpm lint` and `pnpm typecheck` before pushing.

---

## V1/V2 TODO Convention

Deferred work uses the format:

```
// TODO(varunai-v2): Short description of the feature.
// Triggers when: <condition that makes the work relevant>.
// Estimated effort: <time estimate>.
// See docs/<slug>.md
```

- **V1** TODOs are bugs or gaps that should be fixed before the next demo.
- **V2** TODOs are features deferred until an external dependency or use case materializes (e.g., multi-session support blocked on Room 404 orchestration changes).

When resolving a TODO, delete the comment block and its companion `docs/<slug>.md` design note (if one exists). Do not leave stale TODOs.

---

## License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). By contributing, you agree that your contributions will be licensed under the same terms.
