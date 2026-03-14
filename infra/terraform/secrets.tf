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

resource "google_secret_manager_secret" "verika_service_token" {
  secret_id = "verika-service-token"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "mystweaver_sdk_key" {
  secret_id = "mystweaver-sdk-key"
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

# ── Placeholder secret versions (replace with real values later) ──

resource "google_secret_manager_secret_version" "gemini_api_key" {
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = "PLACEHOLDER_REPLACE_ME"
}

resource "google_secret_manager_secret_version" "grafana_admin_password" {
  secret      = google_secret_manager_secret.grafana_admin_password.id
  secret_data = "admin"
}

resource "google_secret_manager_secret_version" "grafana_secret_key" {
  secret      = google_secret_manager_secret.grafana_secret_key.id
  secret_data = "varunai-grafana-secret"
}

resource "google_secret_manager_secret_version" "verika_service_token" {
  secret      = google_secret_manager_secret.verika_service_token.id
  secret_data = "PLACEHOLDER_REPLACE_WITH_VERIKA_TOKEN"
}

resource "google_secret_manager_secret_version" "mystweaver_sdk_key" {
  secret      = google_secret_manager_secret.mystweaver_sdk_key.id
  secret_data = "PLACEHOLDER_REPLACE_WITH_SDK_KEY"
}

resource "google_secret_manager_secret_version" "otel_collector_config" {
  secret      = google_secret_manager_secret.otel_collector_config.id
  secret_data = "# placeholder otel config"
}
