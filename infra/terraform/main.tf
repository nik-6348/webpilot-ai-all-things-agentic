locals { prefix="webpilot-${var.environment}" apis=toset(["run.googleapis.com","sqladmin.googleapis.com","aiplatform.googleapis.com","cloudtasks.googleapis.com","pubsub.googleapis.com","cloudscheduler.googleapis.com","secretmanager.googleapis.com","artifactregistry.googleapis.com","identitytoolkit.googleapis.com","firebase.googleapis.com","cloudbuild.googleapis.com","logging.googleapis.com","monitoring.googleapis.com","cloudtrace.googleapis.com"]) }
resource "google_project_service" "apis" { for_each=local.apis service=each.value disable_on_destroy=false }
resource "google_artifact_registry_repository" "repo" { depends_on=[google_project_service.apis] location=var.region repository_id="${local.prefix}-containers" format="DOCKER" }
resource "google_storage_bucket" "artifacts" { name="${var.project_id}-${local.prefix}-artifacts" location=var.region uniform_bucket_level_access=true force_destroy=false lifecycle_rule { condition { age=90 } action { type="Delete" } } }
resource "google_cloud_tasks_queue" "runs" { depends_on=[google_project_service.apis] name="${local.prefix}-runs" location=var.region rate_limits { max_concurrent_dispatches=20 max_dispatches_per_second=10 } retry_config { max_attempts=5 min_backoff="5s" max_backoff="300s" max_doublings=5 } }
resource "google_pubsub_topic" "events" { name="${local.prefix}-events" }
resource "random_password" "db" { length=32 special=true override_special="-_" }
resource "google_sql_database_instance" "postgres" { name="${local.prefix}-postgres" database_version="POSTGRES_17" region=var.region settings { tier="db-custom-1-3840" availability_type="ZONAL" disk_autoresize=true backup_configuration { enabled=true point_in_time_recovery_enabled=true } ip_configuration { ipv4_enabled=true } } deletion_protection=false }
resource "google_sql_database" "db" { name="webpilot" instance=google_sql_database_instance.postgres.name }
resource "google_sql_user" "app" { name="webpilot" instance=google_sql_database_instance.postgres.name password=random_password.db.result }
locals { db_url="postgresql://webpilot:${urlencode(random_password.db.result)}@localhost:5432/webpilot?host=%2Fcloudsql%2F${replace(google_sql_database_instance.postgres.connection_name,":","%3A")}" }
resource "google_secret_manager_secret" "database_url" { secret_id="${local.prefix}-database-url" replication { auto {} } }
resource "google_secret_manager_secret_version" "database_url" { secret=google_secret_manager_secret.database_url.id secret_data=local.db_url }
resource "google_secret_manager_secret" "runtime" { for_each=toset(["slack-client-id","slack-client-secret","slack-signing-secret","slack-state-secret","gmail-oauth","google-chat-webhook"]) secret_id="${local.prefix}-${each.key}" replication { auto {} } }
resource "google_service_account" "web" { account_id="${local.prefix}-web" display_name="WebPilot web" }
resource "google_service_account" "api" { account_id="${local.prefix}-api" display_name="WebPilot API" }
resource "google_service_account" "worker" { account_id="${local.prefix}-worker" display_name="WebPilot browser worker" }
resource "google_service_account" "notifier" { account_id="${local.prefix}-notifier" display_name="WebPilot notifier" }
resource "google_service_account" "task_invoker" { account_id="${local.prefix}-task-invoker" display_name="Cloud Tasks worker invoker" }
resource "google_service_account" "scheduler_invoker" { account_id="${local.prefix}-scheduler" display_name="Cloud Scheduler API invoker" }
resource "google_service_account" "pubsub_invoker" { account_id="${local.prefix}-pubsub" display_name="PubSub notifier invoker" }
locals { project_roles={
 api=["roles/cloudsql.client","roles/cloudtasks.enqueuer","roles/cloudscheduler.admin","roles/secretmanager.secretAccessor","roles/pubsub.publisher"],
 worker=["roles/cloudsql.client","roles/aiplatform.user","roles/storage.objectAdmin","roles/secretmanager.secretAccessor","roles/pubsub.publisher"],
 notifier=["roles/cloudsql.client","roles/secretmanager.secretAccessor"],
 web=[]
} }
resource "google_project_iam_member" "api_roles" { for_each=toset(local.project_roles.api) project=var.project_id role=each.value member="serviceAccount:${google_service_account.api.email}" }
resource "google_project_iam_member" "worker_roles" { for_each=toset(local.project_roles.worker) project=var.project_id role=each.value member="serviceAccount:${google_service_account.worker.email}" }
resource "google_project_iam_member" "notifier_roles" { for_each=toset(local.project_roles.notifier) project=var.project_id role=each.value member="serviceAccount:${google_service_account.notifier.email}" }
resource "google_service_account_iam_member" "api_act_as_task" { service_account_id=google_service_account.task_invoker.name role="roles/iam.serviceAccountUser" member="serviceAccount:${google_service_account.api.email}" }
resource "google_service_account_iam_member" "api_act_as_scheduler" { service_account_id=google_service_account.scheduler_invoker.name role="roles/iam.serviceAccountUser" member="serviceAccount:${google_service_account.api.email}" }
resource "google_firebase_project" "firebase" { provider=google project=var.project_id depends_on=[google_project_service.apis] }
resource "google_firebase_web_app" "web" { provider=google project=var.project_id display_name="WebPilot Web" depends_on=[google_firebase_project.firebase] }
data "google_firebase_web_app_config" "web" { provider=google web_app_id=google_firebase_web_app.web.app_id depends_on=[google_firebase_web_app.web] }
resource "google_identity_platform_config" "auth" { project=var.project_id autodelete_anonymous_users=true sign_in { email { enabled=false password_required=false } anonymous { enabled=false } } depends_on=[google_project_service.apis] }
resource "google_identity_platform_default_supported_idp_config" "google" { count=var.google_oauth_client_id!=""&&var.google_oauth_client_secret!=""?1:0 project=var.project_id enabled=true idp_id="google.com" client_id=var.google_oauth_client_id client_secret=var.google_oauth_client_secret depends_on=[google_identity_platform_config.auth] }
