# ── Varunai API ────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "varunai_api" {
  name     = "varunai-api"
  location = var.region

  depends_on = [
    google_secret_manager_secret_version.gemini_api_key,
    google_secret_manager_secret_version.verika_service_token,
    google_secret_manager_secret_version.mystweaver_sdk_key,
  ]

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

      env {
        name  = "GRAFANA_URL"
        value = google_cloud_run_v2_service.grafana.uri
      }

      env {
        name = "VERIKA_SERVICE_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.verika_service_token.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "VERIKA_ENDPOINT"
        value = var.verika_endpoint
      }

      env {
        name  = "VERIKA_SERVICE_ID"
        value = var.verika_service_id
      }

      env {
        name  = "MYSTWEAVER_API_URL"
        value = var.mystweaver_api_url
      }

      env {
        name = "MYSTWEAVER_SDK_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.mystweaver_sdk_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "ROOM404_API_URL"
        value = var.room404_api_url
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

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/varunai-images/otel-collector:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      ports {
        container_port = 4318
      }

      startup_probe {
        tcp_socket {
          port = 4318
        }
        initial_delay_seconds = 5
        period_seconds        = 3
        failure_threshold     = 5
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
      image = "${var.region}-docker.pkg.dev/${var.project_id}/varunai-images/grafana:latest"

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

      env {
        name  = "GF_SECURITY_ALLOW_EMBEDDING"
        value = "true"
      }

      env {
        name  = "GF_SERVER_SERVE_FROM_SUB_PATH"
        value = "false"
      }

      ports {
        container_port = 3000
      }

      startup_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 6
      }
    }

    service_account = google_service_account.varunai_api.email
  }
}
