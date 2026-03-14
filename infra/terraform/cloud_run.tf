# ── Varunai API ────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "varunai_api" {
  name     = "varunai-api"
  location = var.region

  depends_on = [google_secret_manager_secret_version.gemini_api_key]

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/varunai-images/varunai-api:latest"

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      ports {
        container_port = 8080
      }
    }

    max_instance_request_concurrency = 100

    service_account = google_service_account.varunai_api.email
  }
}

# ── OTel Collector ─────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "otel_collector" {
  name     = "otel-collector"
  location = var.region

  depends_on = [google_secret_manager_secret_version.otel_collector_config]

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = "gcr.io/cloudrun/hello:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name = "OTEL_CONFIG"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.otel_collector_config.secret_id
            version = "latest"
          }
        }
      }

      ports {
        container_port = 4318
      }
    }

    service_account = google_service_account.varunai_api.email
  }
}

# ── Grafana ────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "grafana" {
  name     = "grafana"
  location = var.region

  depends_on = [
    google_secret_manager_secret_version.grafana_admin_password,
    google_secret_manager_secret_version.grafana_secret_key,
  ]

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = "grafana/grafana-oss:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name = "GF_SECURITY_ADMIN_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.grafana_admin_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GF_SECURITY_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.grafana_secret_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "GF_AUTH_ANONYMOUS_ENABLED"
        value = "true"
      }

      env {
        name  = "GF_AUTH_ANONYMOUS_ORG_ROLE"
        value = "Viewer"
      }

      ports {
        container_port = 3000
      }
    }

    service_account = google_service_account.varunai_api.email
  }
}
