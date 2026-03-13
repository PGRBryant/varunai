resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = "varunai-images"
  format        = "DOCKER"
  description   = "Docker images for Varunai services"
}

resource "google_artifact_registry_repository" "npm" {
  location      = var.region
  repository_id = "varunai-packages"
  format        = "NPM"
  description   = "NPM packages (@internal/telemetry)"
}
