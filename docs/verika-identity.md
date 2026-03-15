# Verika identity (Workload Identity) for CI

This document describes how the CI pipeline obtains the `VERIKA_SERVICE_TOKEN` securely using Workload Identity and Secret Manager.

Recommended setup (performed once by a GCP admin):

1. Create a Google Service Account for CI, for example `varunai-ci@varunai-490119.iam.gserviceaccount.com`.

2. Create a secret in Secret Manager containing the Verika service token:

```bash
gcloud secrets create VERIKA_SERVICE_TOKEN --replication-policy="automatic"
echo -n "<verika-token>" | gcloud secrets versions add VERIKA_SERVICE_TOKEN --data-file=-
```

3. Grant the CI service account access to the secret:

```bash
gcloud secrets add-iam-policy-binding VERIKA_SERVICE_TOKEN \
  --member="serviceAccount:varunai-ci@varunai-490119.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

4. Configure Workload Identity Federation for GitHub Actions (already used elsewhere in the repo). Ensure the Workload Identity Pool provider is allowed to impersonate `varunai-ci`.

5. Update repository variables:

- `GCP_PROJECT_NUMBER` — set to your GCP project number in GitHub repo variables.

How the CI job uses this:

- The e2e workflow authenticates using `google-github-actions/auth` with the configured Workload Identity provider.
- After `gcloud` is available, the workflow runs `gcloud secrets versions access latest --secret=VERIKA_SERVICE_TOKEN` and exports it into the job environment as `VERIKA_SERVICE_TOKEN`.
- The `scripts/ci/e2e.sh` script reads `VERIKA_SERVICE_TOKEN` and performs an authenticated health check against the Verika endpoint.

Notes and alternatives:

- If you prefer not to use Secret Manager, you can set `VERIKA_SERVICE_TOKEN` as a repository secret; change the workflow to provide it directly as an env var.
- Ensure the secret value is the token Verika accepts as a Bearer token for service-to-service access.
