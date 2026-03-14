resource "google_service_account" "varunai_api" {
  account_id   = "varunai-api"
  display_name = "Varunai API Service Account"
}

# Secret Manager access
resource "google_project_iam_member" "varunai_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Managed Prometheus read
resource "google_project_iam_member" "varunai_monitoring_viewer" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Cloud Trace
resource "google_project_iam_member" "varunai_trace_user" {
  project = var.project_id
  role    = "roles/cloudtrace.user"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Allow unauthenticated access to Cloud Run (Verika handles app-level auth)
resource "google_cloud_run_v2_service_iam_member" "varunai_api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.varunai_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Allow unauthenticated access to OTel Collector (services send telemetry)
resource "google_cloud_run_v2_service_iam_member" "otel_collector_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.otel_collector.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Allow unauthenticated access to Grafana (embedded in dashboard)
resource "google_cloud_run_v2_service_iam_member" "grafana_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.grafana.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Trace write (OTel Collector exports traces)
resource "google_project_iam_member" "varunai_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Monitoring metric writer (OTel Collector exports metrics)
resource "google_project_iam_member" "varunai_monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Cloud Logging writer (OTel Collector exports logs)
resource "google_project_iam_member" "varunai_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Cloud Logging
resource "google_project_iam_member" "varunai_logging_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Artifact Registry Writer (CI/CD docker push)
resource "google_project_iam_member" "varunai_ar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Cloud Run Developer (CI/CD deploy)
resource "google_project_iam_member" "varunai_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Firebase Hosting Admin (CI/CD client deploy)
resource "google_project_iam_member" "varunai_firebase_hosting" {
  project = var.project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}

# Service Account User (required for Cloud Run deployments)
resource "google_project_iam_member" "varunai_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}
