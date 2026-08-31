#!/usr/bin/env bash
# One-shot production deploy: build every image, run migrations, deploy all
# 5 Cloud Run services with production env vars (no LOCAL_* bypass flags,
# MOCK_AI=false — this is the automated equivalent of what cloudbuild.yaml
# does, using the concrete resources scripts/gcp-provision.sh created
# instead of `terraform output`, since Terraform isn't available in this
# environment today. Safe to re-run; every step is idempotent.
set -euo pipefail

PROJECT_ID="webpilot-ai-hackathon"
REGION="us-central1"
REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/webpilot"
SQL_CONN="webpilot-ai-hackathon:us-central1:webpilot-postgres"
DB_SECRET="webpilot-database-url"
BUCKET="webpilot-ai-hackathon-artifacts"
QUEUE="webpilot-runs"
TOPIC="webpilot-events"

API_SA="webpilot-api@${PROJECT_ID}.iam.gserviceaccount.com"
WORKER_SA="webpilot-worker@${PROJECT_ID}.iam.gserviceaccount.com"
NOTIFIER_SA="webpilot-notifier@${PROJECT_ID}.iam.gserviceaccount.com"
WEB_SA="webpilot-web@${PROJECT_ID}.iam.gserviceaccount.com"
TASK_SA="webpilot-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
SCHED_SA="webpilot-scheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
PUBSUB_SA="webpilot-pubsub-invoker@${PROJECT_ID}.iam.gserviceaccount.com"

SHA="${SHA:-$(git rev-parse --short HEAD)}"

# SKIP_BUILD=true reuses images already built+pushed by
# scripts/cloudbuild-images.yaml (Cloud Build has much better network
# throughput to the npm registry than local Docker Desktop does on this
# machine — a single local `pnpm install` inside the api image took 20+
# minutes vs ~11s on Cloud Build). Same script either way; this just skips
# redoing work that's already done.
if [ "${SKIP_BUILD:-false}" != "true" ]; then
  FIREBASE_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY:?set NEXT_PUBLIC_FIREBASE_API_KEY}"
  FIREBASE_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-${PROJECT_ID}.firebaseapp.com}"

  echo "== Configuring docker auth for Artifact Registry =="
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

  echo "== Building images (tag: $SHA) =="
  docker build -f docker/api.Dockerfile      -t "$REPO/api:$SHA"      .
  docker build -f docker/worker.Dockerfile   -t "$REPO/worker:$SHA"   .
  docker build -f docker/notifier.Dockerfile -t "$REPO/notifier:$SHA" .
  docker build -f docker/demo.Dockerfile     -t "$REPO/demo:$SHA"     .
  docker build -f docker/web.Dockerfile \
    --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="$FIREBASE_KEY" \
    --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$FIREBASE_DOMAIN" \
    --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="$PROJECT_ID" \
    -t "$REPO/web:$SHA" .

  echo "== Pushing images =="
  for image in api worker notifier demo web; do
    docker push "$REPO/$image:$SHA"
  done
else
  echo "== SKIP_BUILD=true — reusing images already pushed for tag $SHA =="
fi

echo "== Running migration (Cloud Run Job) =="
if gcloud run jobs describe webpilot-migrate --region "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud run jobs update webpilot-migrate \
    --image "$REPO/api:$SHA" --region "$REGION" --project "$PROJECT_ID" \
    --service-account "$API_SA" --set-cloudsql-instances "$SQL_CONN" \
    --set-secrets DATABASE_URL="$DB_SECRET:latest",DIRECT_URL="$DB_SECRET:latest" \
    --command=pnpm --args=--filter,@webpilot/database,migrate:deploy
else
  gcloud run jobs create webpilot-migrate \
    --image "$REPO/api:$SHA" --region "$REGION" --project "$PROJECT_ID" \
    --service-account "$API_SA" --set-cloudsql-instances "$SQL_CONN" \
    --set-secrets DATABASE_URL="$DB_SECRET:latest",DIRECT_URL="$DB_SECRET:latest" \
    --command=pnpm --args=--filter,@webpilot/database,migrate:deploy
fi
gcloud run jobs execute webpilot-migrate --region "$REGION" --project "$PROJECT_ID" --wait

echo "== Deploying worker (private) =="
gcloud run deploy webpilot-worker \
  --image "$REPO/worker:$SHA" --region "$REGION" --project "$PROJECT_ID" \
  --service-account "$WORKER_SA" --no-allow-unauthenticated \
  --add-cloudsql-instances "$SQL_CONN" \
  --set-secrets DATABASE_URL="$DB_SECRET:latest" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GOOGLE_GENAI_USE_VERTEXAI=true,GEMINI_MODEL=gemini-3.7-flash,ARTIFACT_BUCKET=$BUCKET,PUBSUB_TOPIC=$TOPIC,LOCAL_ARTIFACTS=false,LOCAL_SECRETS=false,LOCAL_PUBSUB=false,LOCAL_TASKS=false,MOCK_AI=false,ALLOW_PRIVATE_DEMO=false,HEADLESS=true" \
  --concurrency=1 --memory=2Gi --cpu=2 --timeout=900 --min-instances=0 --max-instances=5
WORKER_URL=$(gcloud run services describe webpilot-worker --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')
gcloud run services add-iam-policy-binding webpilot-worker \
  --region "$REGION" --project "$PROJECT_ID" --member="serviceAccount:$TASK_SA" --role=roles/run.invoker --quiet

echo "== Deploying api (public) =="
gcloud run deploy webpilot-api \
  --image "$REPO/api:$SHA" --region "$REGION" --project "$PROJECT_ID" \
  --service-account "$API_SA" --allow-unauthenticated \
  --add-cloudsql-instances "$SQL_CONN" \
  --set-secrets DATABASE_URL="$DB_SECRET:latest" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,FIREBASE_PROJECT_ID=$PROJECT_ID,WORKER_URL=$WORKER_URL,WORKER_AUDIENCE=$WORKER_URL,TASK_QUEUE=$QUEUE,TASK_LOCATION=$REGION,TASK_INVOKER_SA=$TASK_SA,SCHEDULER_INVOKER_SA=$SCHED_SA,LOCAL_TASKS=false,LOCAL_SECRETS=false,LOCAL_SCHEDULER=false,LOCAL_PUBSUB=false,LOCAL_AUTH_BYPASS=false,ALLOW_PRIVATE_DEMO=false,RESEND_API_KEY=${RESEND_API_KEY:-},RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL:-},ADMIN_NOTIFY_EMAIL=${ADMIN_NOTIFY_EMAIL:-}" \
  --min-instances=0 --max-instances=10
API_URL=$(gcloud run services describe webpilot-api --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')
gcloud run services update webpilot-api --region "$REGION" --project "$PROJECT_ID" \
  --update-env-vars "API_PUBLIC_URL=$API_URL,SCHEDULER_AUDIENCE=$API_URL"

echo "== Deploying notifier (private) =="
gcloud run deploy webpilot-notifier \
  --image "$REPO/notifier:$SHA" --region "$REGION" --project "$PROJECT_ID" \
  --service-account "$NOTIFIER_SA" --no-allow-unauthenticated \
  --add-cloudsql-instances "$SQL_CONN" \
  --set-secrets DATABASE_URL="$DB_SECRET:latest" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,LOCAL_SECRETS=false"
NOTIFIER_URL=$(gcloud run services describe webpilot-notifier --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')
gcloud run services add-iam-policy-binding webpilot-notifier \
  --region "$REGION" --project "$PROJECT_ID" --member="serviceAccount:$PUBSUB_SA" --role=roles/run.invoker --quiet

SUB="webpilot-notifier"
if gcloud pubsub subscriptions describe "$SUB" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud pubsub subscriptions update "$SUB" --project "$PROJECT_ID" \
    --push-endpoint="$NOTIFIER_URL/internal/events" \
    --push-auth-service-account="$PUBSUB_SA" \
    --push-auth-token-audience="$NOTIFIER_URL"
else
  gcloud pubsub subscriptions create "$SUB" --project "$PROJECT_ID" --topic="$TOPIC" \
    --push-endpoint="$NOTIFIER_URL/internal/events" \
    --push-auth-service-account="$PUBSUB_SA" \
    --push-auth-token-audience="$NOTIFIER_URL"
fi

echo "== Deploying demo portal (public) =="
gcloud run deploy webpilot-demo \
  --image "$REPO/demo:$SHA" --region "$REGION" --project "$PROJECT_ID" --allow-unauthenticated

echo "== Deploying web (public) =="
gcloud run deploy webpilot-web \
  --image "$REPO/web:$SHA" --region "$REGION" --project "$PROJECT_ID" \
  --service-account "$WEB_SA" --allow-unauthenticated \
  --set-env-vars "API_URL=$API_URL"
WEB_URL=$(gcloud run services describe webpilot-web --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')
gcloud run services update webpilot-api --region "$REGION" --project "$PROJECT_ID" \
  --update-env-vars "CORS_ORIGINS=$WEB_URL"

echo ""
echo "==================================================================="
echo "LIVE:"
echo "  Web:      $WEB_URL"
echo "  API:      $API_URL"
echo "  Notifier: $NOTIFIER_URL (private)"
echo "  Worker:   $WORKER_URL (private)"
echo "==================================================================="
