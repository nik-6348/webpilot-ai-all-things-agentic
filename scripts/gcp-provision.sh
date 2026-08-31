#!/usr/bin/env bash
# One-shot, idempotent GCP infra provisioning for WebPilot AI production.
# Mirrors infra/terraform/main.tf (Terraform itself isn't installed on this
# machine today; this is the fast-path equivalent so we can go live within
# the time budget — safe to re-run, and to reconcile into `terraform import`
# later without re-provisioning).
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-webpilot-ai-hackathon}"
REGION="${TASK_LOCATION:-us-central1}"
PREFIX="webpilot"
DB_INSTANCE="${PREFIX}-postgres"
DB_NAME="webpilot"
DB_USER="webpilot"
BUCKET="${PROJECT_ID}-artifacts"

echo "== [1/8] Enabling required APIs =="
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudtasks.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  identitytoolkit.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project "$PROJECT_ID"

echo "== [2/8] Cloud SQL instance (this is the slow step, ~5-10min) =="
if ! gcloud sql instances describe "$DB_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud sql instances create "$DB_INSTANCE" \
    --project "$PROJECT_ID" \
    --database-version=POSTGRES_17 \
    --region="$REGION" \
    --edition=ENTERPRISE \
    --tier=db-custom-1-3840 \
    --availability-type=ZONAL \
    --storage-auto-increase \
    --backup \
    --enable-point-in-time-recovery \
    --no-deletion-protection
else
  echo "  already exists, skipping create"
fi

DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

echo "== [3/8] Database + user =="
gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE" --project "$PROJECT_ID" 2>&1 | grep -v "already exists" || true
gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE" --password="$DB_PASSWORD" --project "$PROJECT_ID" 2>&1 | grep -v "already exists" || \
  gcloud sql users set-password "$DB_USER" --instance="$DB_INSTANCE" --password="$DB_PASSWORD" --project "$PROJECT_ID"

CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE" --project "$PROJECT_ID" --format='value(connectionName)')
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo "== [4/8] GCS bucket for run artifacts (screenshots, DOM, results) =="
if ! gcloud storage buckets describe "gs://${BUCKET}" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" --project "$PROJECT_ID" --location="$REGION"
  gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file=/dev/stdin <<'EOF'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 90}}]}
EOF
fi

echo "== [5/8] Service accounts (least-privilege, matches Terraform design) =="
for sa in web api worker notifier task-invoker scheduler-invoker pubsub-invoker; do
  gcloud iam service-accounts create "${PREFIX}-${sa}" --project "$PROJECT_ID" --display-name "WebPilot ${sa}" 2>&1 | grep -v "already exists" || true
done

API_SA="${PREFIX}-api@${PROJECT_ID}.iam.gserviceaccount.com"
WORKER_SA="${PREFIX}-worker@${PROJECT_ID}.iam.gserviceaccount.com"
NOTIFIER_SA="${PREFIX}-notifier@${PROJECT_ID}.iam.gserviceaccount.com"
TASK_INVOKER_SA="${PREFIX}-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_INVOKER_SA="${PREFIX}-scheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com"

grant() { gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$1" --role="$2" --condition=None >/dev/null; }
grant "$API_SA" roles/cloudsql.client
grant "$API_SA" roles/cloudtasks.enqueuer
grant "$API_SA" roles/cloudscheduler.admin
grant "$API_SA" roles/secretmanager.admin # not secretAccessor alone -- the API creates new
# secrets per Connection/Slack-OAuth-token at request time (secretAccessor only permits
# reading existing ones, not secretmanager.secrets.create)
grant "$API_SA" roles/pubsub.publisher
grant "$API_SA" roles/aiplatform.user
# The API serves run screenshots/artifacts directly to the browser
# (GET /runs/:id/artifact) -- it reads from GCS itself, it doesn't just
# enqueue work for the worker to read, so it needs its own read access.
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:$API_SA" --role="roles/storage.objectViewer" >/dev/null
# Firebase Admin's createCustomToken() (email/password login session bridge)
# needs the API's own service account to be able to sign blobs for itself
# via the IAM Credentials API -- this is NOT implied by any of the roles
# above and is not automatic on Cloud Run, despite using the same identity.
gcloud iam service-accounts add-iam-policy-binding "$API_SA" \
  --member="serviceAccount:$API_SA" --role="roles/iam.serviceAccountTokenCreator" \
  --project "$PROJECT_ID" >/dev/null
grant "$WORKER_SA" roles/cloudsql.client
grant "$WORKER_SA" roles/aiplatform.user
grant "$WORKER_SA" roles/storage.objectAdmin
grant "$WORKER_SA" roles/secretmanager.secretAccessor
grant "$WORKER_SA" roles/pubsub.publisher
grant "$NOTIFIER_SA" roles/cloudsql.client
grant "$NOTIFIER_SA" roles/secretmanager.secretAccessor

echo "== [6/8] Secret Manager =="
put_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --project "$PROJECT_ID" --data-file=- >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$name" --project "$PROJECT_ID" --replication-policy=automatic --data-file=- >/dev/null
  fi
}
put_secret "${PREFIX}-database-url" "$DATABASE_URL"
# Stable HMAC key behind the short-lived signed artifact URLs (see
# apps/api/src/modules/runs.controller.ts). Only created once -- unlike
# put_secret above, re-running this must NOT rotate it, since that would
# invalidate every link already handed out to a browser tab.
if ! gcloud secrets describe "${PREFIX}-internal-worker-token" --project "$PROJECT_ID" >/dev/null 2>&1; then
  openssl rand -hex 32 | gcloud secrets create "${PREFIX}-internal-worker-token" \
    --project "$PROJECT_ID" --replication-policy=automatic --data-file=- >/dev/null
fi

echo "== [7/8] Cloud Tasks queue + Pub/Sub topic =="
gcloud tasks queues create webpilot-runs --project "$PROJECT_ID" --location="$REGION" 2>&1 | grep -v "already exist" || true
gcloud pubsub topics create webpilot-events --project "$PROJECT_ID" 2>&1 | grep -v "already exist" || true

echo "== [8/8] Artifact Registry repo for Docker images =="
gcloud artifacts repositories create webpilot --project "$PROJECT_ID" --location="$REGION" --repository-format=docker 2>&1 | grep -v "already exist" || true

echo ""
echo "DONE. Connection name: $CONNECTION_NAME"
echo "Database URL stored in Secret Manager as ${PREFIX}-database-url"
echo "Service accounts: $API_SA / $WORKER_SA / $NOTIFIER_SA"
