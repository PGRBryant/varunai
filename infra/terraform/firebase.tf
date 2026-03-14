resource "google_firebase_hosting_site" "varunai" {
  provider = google-beta
  project  = var.project_id
  site_id  = "varunai-dashboard"
}
