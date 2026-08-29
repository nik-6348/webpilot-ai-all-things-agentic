output "artifact_registry" { value="${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}" }
output "artifact_bucket" { value=google_storage_bucket.artifacts.name }
output "database_secret" { value=google_secret_manager_secret.database_url.secret_id }
output "cloud_sql_connection_name" { value=google_sql_database_instance.postgres.connection_name }
output "api_service_account" { value=google_service_account.api.email }
output "worker_service_account" { value=google_service_account.worker.email }
output "notifier_service_account" { value=google_service_account.notifier.email }
output "web_service_account" { value=google_service_account.web.email }
output "task_invoker_service_account" { value=google_service_account.task_invoker.email }
output "scheduler_invoker_service_account" { value=google_service_account.scheduler_invoker.email }
output "pubsub_invoker_service_account" { value=google_service_account.pubsub_invoker.email }
output "firebase_api_key" { value=data.google_firebase_web_app_config.web.api_key sensitive=true }
output "firebase_auth_domain" { value=data.google_firebase_web_app_config.web.auth_domain }
output "firebase_project_id" { value=var.project_id }
