# Uptime checks REMOVED — they were costing ~$3-5/day by keeping all 3
# Cloud Run services warm via cold-start pings every 60s from multiple
# global regions. Varunai is a demo tool, not a production service.
#
# Services now scale to true zero when nobody is using the dashboard.
# The dashboard itself wakes varunai-api on first load (one cold start).
# Grafana wakes when its iframe loads. OTel collector wakes on first trace.
#
# To re-enable monitoring for a production deployment, uncomment below.

# resource "google_monitoring_uptime_check_config" "varunai_api" {
#   display_name = "varunai-api-health"
#   timeout      = "10s"
#   period       = "300s"  # 5 min, not 60s — reduces cold-start cost
#   http_check {
#     path         = "/health"
#     port         = 443
#     use_ssl      = true
#     validate_ssl = true
#   }
#   monitored_resource {
#     type = "uptime_url"
#     labels = {
#       project_id = var.project_id
#       host       = trimprefix(google_cloud_run_v2_service.varunai_api.uri, "https://")
#     }
#   }
# }
