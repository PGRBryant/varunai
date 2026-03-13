resource "google_monitoring_monitored_project" "varunai" {
  provider      = google-beta
  metrics_scope = "locations/global/metricsScopes/${var.project_id}"
  name          = var.project_id
}
