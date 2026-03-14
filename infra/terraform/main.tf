terraform {
  required_version = ">= 1.5.0"

  backend "gcs" {
    bucket = "varunai-terraform-state"
    prefix = "terraform/state"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "GCP project ID"
  default     = "varunai-490119"
}

variable "region" {
  description = "GCP region"
  default     = "us-central1"
}

variable "verika_endpoint" {
  description = "Verika API endpoint URL"
  default     = "https://verika-api-hdzhlg4y7a-ue.a.run.app"
}

variable "verika_service_id" {
  description = "Service ID registered in Verika's service registry"
  default     = "varunai"
}

variable "mystweaver_api_url" {
  description = "MystWeaver API base URL"
  default     = "https://mystweaver-api-afhjeehpqa-uc.a.run.app"
}

variable "room404_api_url" {
  description = "Room 404 API base URL"
  default     = "https://room404-game-server-dev-aed45jff7q-uc.a.run.app"
}
