variable "project_id" { type=string }
variable "region" { type=string default="us-central1" }
variable "environment" { type=string default="prod" }
variable "google_oauth_client_id" { type=string default="" }
variable "google_oauth_client_secret" { type=string sensitive=true default="" }
