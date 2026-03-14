resource "google_monitoring_uptime_check_config" "varunai_api" {
  display_name = "varunai-api-health"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimprefix(google_cloud_run_v2_service.varunai_api.uri, "https://")
    }
  }
}

resource "google_monitoring_uptime_check_config" "grafana" {
  display_name = "grafana-health"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/api/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimprefix(google_cloud_run_v2_service.grafana.uri, "https://")
    }
  }
}

resource "google_monitoring_uptime_check_config" "otel_collector" {
  display_name = "otel-collector-health"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimprefix(google_cloud_run_v2_service.otel_collector.uri, "https://")
    }
  }
}

# Alert policy for Gemini errors - deferred until custom metric exists
# resource "google_monitoring_alert_policy" "gemini_errors" {
#   display_name = "Gemini API Error Rate > 20%"
#   combiner     = "OR"
#   conditions {
#     display_name = "Gemini error rate"
#     condition_threshold {
#       filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"varunai-api\" AND metric.type = \"logging.googleapis.com/user/varunai_assist_errors\""
#       duration        = "300s"
#       comparison      = "COMPARISON_GT"
#       threshold_value = 0.2
#     }
#   }
#   notification_channels = []
# }
