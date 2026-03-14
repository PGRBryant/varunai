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

# Cloud Logging
resource "google_project_iam_member" "varunai_logging_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${google_service_account.varunai_api.email}"
}
