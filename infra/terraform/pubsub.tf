resource "google_pubsub_subscription" "varunai_flag_updates" {
  name  = "varunai-flag-updates"
  topic = "projects/mystweaver-489920/topics/flag-updates"

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.varunai_api.uri}/internal/pubsub/flag-updates"

    oidc_token {
      service_account_email = google_service_account.varunai_api.email
    }
  }

  ack_deadline_seconds       = 20
  message_retention_duration = "600s"
  retain_acked_messages      = false
}
