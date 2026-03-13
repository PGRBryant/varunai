resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "gemini-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "grafana_admin_password" {
  secret_id = "grafana-admin-password"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "grafana_secret_key" {
  secret_id = "grafana-secret-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "otel_collector_config" {
  secret_id = "otel-collector-config"
  replication {
    auto {}
  }
}
