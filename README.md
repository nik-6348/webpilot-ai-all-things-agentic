# WebPilot AI

**Autonomous Web Operations Platform — understand once, run deterministically, heal when the web changes.**

WebPilot converts a natural-language web task into an approval-ready typed workflow, learns the workflow against a live browser with Gemini 3.7 Flash through Google ADK, stores an immutable `WorkflowSpec`, and executes healthy repeat runs with Playwright **without Gemini reasoning calls**. If the site changes, WebPilot captures the failure context, invokes a bounded Recovery Agent, independently verifies the patch, creates a new immutable version, and resumes the run.

## Live deployment

Running now on Google Cloud (Cloud Run + Cloud SQL + Vertex AI + Cloud Tasks + Pub/Sub + Secret Manager):

- **App:** https://webpilot-web-536937000866.us-central1.run.app
- **API + Swagger:** https://webpilot-api-536937000866.us-central1.run.app/docs
- **Demo portal (DOM-drift trigger):** https://webpilot-demo-536937000866.us-central1.run.app

Sign in with Google to try it. The worker and notifier are intentionally private (Cloud Tasks/Pub/Sub only, no public ingress).

## What is implemented

- Separate deployables: Next.js web, NestJS/Fastify control API, Fastify/Playwright browser worker, notification worker, reproducible demo portal.
- Google Identity Platform / Firebase Google sign-in.
- Google ADK TypeScript Planner, live Navigator, Recovery Agent, independent Verifier.
- Vertex AI / `gemini-3.7-flash` model path (plus `MOCK_AI=true` deterministic local demo mode).
- Typed `WorkflowSpec` and deterministic Playwright execution. No `eval()` / `new Function()` model-code execution.
- Human plan approval, high-risk action approval, recovery approval, CAPTCHA/human-verification pause.
- Immutable agent versions, manual draft editing, version activation and manual version runs.
- Zero-reasoning fast path on healthy repeat runs.
- Failure checkpoint → screenshot/DOM context → minimal repair → sandbox replay → independent verifier → low-risk auto-promotion or human approval → resume.
- Cloud SQL PostgreSQL + Prisma 7 relational domain model.
- Cloud Storage artifacts, Cloud Tasks run dispatch, Pub/Sub operational events, Cloud Scheduler recurring runs, Secret Manager connection vault.
- Slack OAuth, signed/expiring OAuth state, signed slash commands scoped to the connected Slack workspace, Slack notifications.
- Gmail API and Google Chat notification adapters.
- SSRF/private-network/metadata blocking in production, redirect/browser-request guard, allowed-domain boundary, web-content prompt-injection boundary, secret redaction.
- Workspace RBAC, audit log, idempotency keys, worker leases and step checkpoints.
- Docker Compose local stack, separate Docker images, Terraform, Cloud Build, Prisma migration, deterministic DOM-drift demo E2E script.

## Repository

```text
apps/
  web/              Next.js 16 marketing + product dashboard
  api/              NestJS + Fastify control plane
  browser-worker/   Private Playwright execution plane
  notifier/         Pub/Sub → Slack/Gmail/Google Chat notifications
  demo-portal/      Reproducible V1/V2 DOM drift portal
packages/
  agents/           Google ADK agents
  contracts/        Zod cross-service contracts
  workflow-engine/  patch/version/risk/compiler helpers
  security/         URL, SSRF, prompt boundary, redaction
  database/         Prisma 7 + Cloud SQL model/migrations
  gcp/              GCS/Tasks/PubSub/Secrets/Scheduler adapters
  observability/    structured logging + OpenTelemetry API
infra/terraform/     Google Cloud infrastructure
scripts/             validation / integration helpers
tests/               black-box demo workflow
```

## Local deterministic demo

The recommended local path uses Docker Compose. It runs real Playwright and persistence but sets `MOCK_AI=true` so the V1→V2 healing scenario is reproducible without cloud credentials.

```bash
corepack enable
cp .env.example .env

docker compose up --build -d
node tests/demo-e2e.mjs
```

Open:

- Web: http://localhost:3000
- API + Swagger: http://localhost:4000/docs
- Demo portal: http://localhost:4200
- Worker health: http://localhost:4100/health/live

The E2E test proves:

```text
create agent
→ approve Gemini-style plan
→ discovery learns v1.0
→ repeat run has 0 navigator/recovery/verifier calls
→ demo portal switches from DOM V1 to V2
→ v1.0 fails
→ recovery patches only the failed step
→ sandbox replay + independent verifier
→ v1.1 is promoted
→ same operation completes
```

## Real Vertex AI mode

Set:

```env
MOCK_AI=false
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
GEMINI_MODEL=gemini-3.7-flash
```

Use Application Default Credentials locally:

```bash
gcloud auth application-default login
```

In Cloud Run, services use dedicated service accounts and IAM rather than model API keys.

## Google Cloud deployment

Two scripts drive the actual deployment used for the live instance above:

```bash
# One-time: provisions Cloud SQL, service accounts + IAM, Secret Manager,
# Cloud Tasks queue, Pub/Sub topic, Artifact Registry. Idempotent.
bash scripts/gcp-provision.sh

# Builds all 5 images, runs the Prisma migration as a Cloud Run Job, and
# deploys worker/api/notifier/demo/web with production env vars
# (MOCK_AI=false, no LOCAL_* bypass flags). Safe to re-run for redeploys.
bash scripts/deploy.sh
```

See [`docs/runbooks/DEPLOY_GCP.md`](docs/runbooks/DEPLOY_GCP.md) for the Terraform-based path this was originally designed around; the scripts above are the equivalent imperative path actually used to bring up the deployment linked above.

The production topology is:

```text
Next.js / Cloud Run
        ↓
NestJS API / Cloud Run
        ↓
Cloud Tasks ───────→ Private Playwright Worker / Cloud Run
        │                         │
        │                         ├─ Google ADK → Vertex AI / Gemini 3.7
        │                         ├─ Cloud Storage
        │                         └─ Pub/Sub
        ↓
Cloud SQL PostgreSQL         Private Notifier / Cloud Run
        ↑                         ├─ Slack
Cloud Scheduler                  ├─ Gmail API
                                  └─ Google Chat
```

## Security model

Read [`docs/security/SECURITY.md`](docs/security/SECURITY.md). Core rules:

1. Model output is data, never executable Node.js.
2. Webpage text is untrusted content, never system instruction.
3. Secrets stay in Secret Manager and are resolved only by the worker.
4. Workflows are restricted to explicit allowed domains.
5. Private/loopback/link-local/GCP metadata targets are blocked in production.
6. High-risk external actions require approval.
7. CAPTCHA/anti-bot verification is detected and paused for human handoff; WebPilot does not implement challenge bypass.
8. Cloud Run worker and notifier are private and invoked with Google IAM/OIDC.

## Required production configuration

Required:

- GCP project with billing
- Google OAuth client for Identity Platform Google sign-in
- Vertex AI access
- Cloud Build/Terraform deployment permissions

Optional integrations:

- Slack app credentials
- Gmail OAuth credentials/refresh token
- Google Chat webhook

Use [`scripts/configure-integrations.sh`](scripts/configure-integrations.sh) after adding Secret Manager versions.

## Validation status

Live-verified on the deployment linked above, not just built: a real discovery run (Gemini plans + navigates + extracts against a real target site), a fast-path replay of the same agent with `modelCallCount: 0`, and the self-healing loop against the demo portal's V1→V2 DOM drift (failure detected → recovery patch → sandbox replay → independent verifier → new version promoted → run resumes) were all exercised end-to-end against the live Cloud Run deployment. `pnpm install && pnpm build` passes clean from a fully fresh state (all `dist/`/generated output removed first) — see [`docs/VALIDATION.md`](docs/VALIDATION.md) for the full local build/lint/typecheck gate.

## Hackathon demo

See [`docs/hackathon/DEMO.md`](docs/hackathon/DEMO.md).

The core demo story is intentionally simple and auditable:

> AI learns a real web workflow once. Healthy repeats run without model reasoning. The web changes. Gemini wakes up, repairs only the broken step, an independent verifier checks it, a new immutable version is promoted, and the operation finishes.
