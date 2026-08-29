# Deploy to Google Cloud

## 1. Prerequisites

- gcloud authenticated to a project with billing
- Terraform >= 1.8
- Cloud Build service account permitted to create the resources in `infra/terraform`
- Google OAuth web client for Identity Platform

## 2. Configure Terraform Google login

Pass the OAuth client to Terraform (do not commit it):

```bash
export TF_VAR_google_oauth_client_id='...apps.googleusercontent.com'
export TF_VAR_google_oauth_client_secret='...'
```

For a Cloud Build trigger, provide these values through your protected CI secret mechanism or run the initial Terraform apply from an authorized workstation before using `cloudbuild.yaml`.

## 3. Infrastructure

```bash
cd infra/terraform
terraform init
terraform apply \
  -var="project_id=$GOOGLE_CLOUD_PROJECT" \
  -var="region=us-central1" \
  -var="environment=prod"
```

The stack provisions the required APIs, Artifact Registry, GCS bucket, Cloud Tasks queue, Pub/Sub topic, Cloud SQL PostgreSQL, Secret Manager containers, service accounts/IAM, Firebase web app and Identity Platform.

## 4. Build/deploy

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=us-central1,_ENV=prod
```

Cloud Build:

1. applies Terraform,
2. builds/pushes five service images,
3. runs the Prisma migration as a Cloud Run Job,
4. deploys the private worker,
5. deploys the API,
6. deploys the private notifier + authenticated Pub/Sub push subscription,
7. deploys the demo and web services.

## 5. Optional Slack/Gmail/Google Chat integrations

Terraform creates secret containers but intentionally does not create empty/default secret versions. Add real values yourself, then run:

```bash
PROJECT_ID="$GOOGLE_CLOUD_PROJECT" REGION=us-central1 ENV=prod \
GMAIL_SENDER='ops@example.com' ./scripts/configure-integrations.sh
```

See the script header for secret formats.

## 6. Production checks

- `ALLOW_PRIVATE_DEMO` must be false on the worker.
- worker and notifier must remain `--no-allow-unauthenticated`.
- rotate all integration secrets independently.
- verify Identity Platform authorized domains include the Cloud Run/custom web domain.
- run `pnpm preflight`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then the demo E2E against the deployed demo if desired.
