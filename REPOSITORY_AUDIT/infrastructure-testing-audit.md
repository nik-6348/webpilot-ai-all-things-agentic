# Infrastructure, Notification, Database & Testing Audit

Covers: `apps/notifier`, `apps/demo-portal`, `packages/observability`, `packages/database`, `infra/terraform`, `docker/*`, `docker-compose.yml`, `cloudbuild.yaml`, `scripts/*`, `tests/*`, `docs/*`, root config. See `final-gap-report.md` §11–19 for synthesized findings; this file is the full supporting evidence.

## 1. Notifier Audit (`apps/notifier/src/main.ts`)

**Verdict: genuinely wired, not a stub — but conditionally dead in every deployment configuration shipped in this repo.**

- `POST /internal/events` (:71-77) accepts a real Pub/Sub push envelope (`req.body.message.data`, base64+JSON) or a raw JSON body, decodes it, calls `notify()`.
- `notify()` (:55-69) loads `Run`+`Agent` from Postgres by `payload.runId`, builds one text message, fires Slack/Google Chat/Gmail in parallel via `Promise.allSettled` — correct fan-out with independent failure isolation.
- **Slack** (:7-23): looks up a `CONNECTED` integration, pulls the OAuth token from Secret Manager, calls `chat.postMessage`. Real, but gated on `metadata.defaultChannel`, which nothing in `integrations.controller.ts`'s Slack connect flow ever sets — Slack notifications silently no-op (`if (!channel) return;`, line 14) even for a fully connected workspace.
- **Google Chat** (:24-31): plain webhook POST, gated on `GOOGLE_CHAT_WEBHOOK` — empty in both `docker-compose.yml` and `.env.example`.
- **Gmail** (:32-54): real Gmail API OAuth2-refresh-token send, gated on `GMAIL_OAUTH_SECRET_REF`/`GMAIL_SENDER` — also empty everywhere in this repo, only populated by `scripts/configure-integrations.sh` in a real deploy.
- What triggers a notification: publishing happens in `packages/gcp`'s `EventBus.publish()`, which is a **no-op under `LOCAL_PUBSUB=true`** — the docker-compose/`.env.example` default. So in the shipped local/demo path, events are dropped before reaching the notifier — correct code, structurally unreachable.

**Findings:**
- P2 — Slack requires `metadata.defaultChannel`, never set anywhere in the codebase. Dead-on-arrival for any connected workspace without an undocumented manual PATCH.
- P2 — Notification pipeline has zero automated test coverage and is unreachable end-to-end locally.

## 2. Demo Portal Audit (`apps/demo-portal/src/main.ts`)

**Verdict: real, minimal, in-memory DOM-drift toggle.**

- Module-level state `version: "v1"|"v2"`, `challenge: boolean` (:3-4) — no persistence, resets on restart.
- `GET /admin` (:56-64) renders a control panel; `POST /admin/toggle` (:65-68) flips version and redirects — v1 renders `.order-row/.order-id/...`, v2 renders differently-attributed markup (`data-testid="orders-action"`), while underlying data is unchanged. This exactly matches the hardcoded selectors baked into the `MOCK_AI` canned plan (`.order-row`, `.order-id`).
- `POST /admin/challenge` (:69-72) flips a boolean making `/orders` return a fake CAPTCHA page — real, simple human-verification trigger.
- Trigger surface is only these admin HTTP endpoints (no env var / boot-time control). `tests/demo-e2e.mjs:24-31,63` drives this exact mechanism, matching `docs/hackathon/DEMO.md:15-17`.

**Findings:**
- P3 (informational) — `/admin/toggle` and `/admin/challenge` have zero auth. Fine for a hackathon demo, but `cloudbuild.yaml:124` deploys the demo portal with `--allow-unauthenticated` — in production, anyone can toggle the public demo's state.

## 3. Database Audit

- **Seed** (`packages/database/prisma/seed.ts`): pure demo/bootstrap data — one `demo@webpilot.local` user, one "Demo Workspace", `OWNER` membership, default `WorkspaceSetting`. Idempotent (`upsert` throughout). The demo's actual "orders" content lives in `apps/demo-portal`, not seeded into the DB.
- **Migrations**: real, versioned — `packages/database/prisma/migrations/migration_lock.toml` + a single `202608290001_init/migration.sql`. Not relying on `db push`. `prisma.config.ts:23-26` wires migration path + seed command correctly. Both `docker-compose.yml`'s `migrate` service (`condition: service_completed_successfully`) and `cloudbuild.yaml:64-77`'s migration Cloud Run Job correctly run schema changes before dependent services start.
- **Client** (`packages/database/src/index.ts`): `@prisma/adapter-pg` + real `pg.Pool`, dotenv fallback to root `.env`, throws hard if `DATABASE_URL` missing (:17) rather than silently misbehaving.

**Findings:**
- None material — migration infrastructure and seed strategy are one of the stronger areas of the project.
- (Cross-referenced from direct schema read, not this agent) `WorkspaceSetting` has no FK relation to `Workspace` — see `final-gap-report.md` §9.

## 4. Docker Audit

All five Dockerfiles (`api`, `web`, `worker`, `notifier`, `demo`) follow a consistent pattern: `FROM node:22-bookworm-slim` (or Playwright base for worker) → `COPY . .` → `corepack enable` → `pnpm install --no-frozen-lockfile` → `pnpm turbo build --filter=<pkg>...`.

- `docker/worker.Dockerfile:1` — `FROM mcr.microsoft.com/playwright:v1.55.0-noble` — correct choice, ships Chromium/Firefox/WebKit + OS deps preinstalled, no manual `apt-get` needed.
- `pnpm install --no-frozen-lockfile` in every Dockerfile — workspace-aware, but means a build can silently pick up newer dependency versions than `pnpm-lock.yaml` pins, undermining reproducibility for a project whose narrative leans on `docker compose up --build -d` reproducibility.
- `db:generate` correctly included only in `api`/`worker`/`notifier` (all touch Prisma), correctly omitted from `web`/`demo`.
- No secrets baked into any image. `web.Dockerfile` takes `NEXT_PUBLIC_FIREBASE_*` as build ARGs — intentionally public, fine. But every Dockerfile's unfiltered `COPY . .` also copies `apps/api/service-account.json` (see §9).
- No multi-stage builds, no non-root `USER` directive anywhere — hardening opportunity, not a functional defect.

**Findings:**
- P2 — `--no-frozen-lockfile` in all 5 Dockerfiles.
- P2 — `service-account.json` copied into every image (see §9).
- P3 — No multi-stage builds / non-root user.
- Positive: base image choices correct, `db:generate` inclusion split correct, no real secrets baked in today.

## 5. Terraform Audit (`infra/terraform/*.tf`)

| README claim | Provisioned? | Evidence |
|---|---|---|
| Cloud Run | **Not in Terraform** — deployed imperatively via `gcloud run deploy` in `cloudbuild.yaml` | `cloudbuild.yaml:79-129` |
| Cloud SQL | Yes | `main.tf:8-10` |
| Vertex AI | API + IAM only (correct — no provisionable resource) | `main.tf:1,24` |
| GCS | Yes (90-day lifecycle rule) | `main.tf:4` |
| Cloud Tasks | Yes | `main.tf:5` |
| Pub/Sub | Topic only — push subscription created imperatively in `cloudbuild.yaml:110-121` | `main.tf:6` |
| Cloud Scheduler | IAM/invoker only — jobs created dynamically at runtime via `CloudSchedulerClient` (correct design, they're user-defined data) | `main.tf:1,23` |
| Secret Manager | Yes — `database_url` fully provisioned; 6 integration secret containers created replication-only, no version (intentional, per `docs/runbooks/DEPLOY_GCP.md:51-60`) | `main.tf:12-14` |
| Identity Platform | Yes | `main.tf:33-37` |
| IAM per-service SAs | Yes, and genuinely least-privilege | `main.tf:15-30` |

**IAM is a genuine strength.** Six distinct SAs (`web`, `api`, `worker`, `notifier`, `task_invoker`, `scheduler_invoker`, `pubsub_invoker`), each narrowly scoped (`main.tf:22-27`): `api` gets cloudsql.client/cloudtasks.enqueuer/cloudscheduler.admin/secretmanager.secretAccessor/pubsub.publisher; `worker` gets cloudsql.client/aiplatform.user/storage.objectAdmin/secretmanager.secretAccessor/pubsub.publisher; `notifier` gets cloudsql.client/secretmanager.secretAccessor only; `web` gets **no project roles at all**. No `roles/editor`/`roles/owner` anywhere.

**Findings:**
- P2 — README/architecture diagram lists Cloud Run as provisioned infra, but it's `cloudbuild.yaml`-imperative, not Terraform — `terraform apply` alone never yields a working deployment.
- P3 — Pub/Sub push subscription also imperative, not reproducible via `terraform apply`/`destroy` alone.
- Positive: IAM least-privilege design is well-executed, better than most hackathon projects.

## 6. CI/CD Audit

**Confirmed: no `.github` directory exists.** Zero GitHub Actions, zero CI pipeline of any kind. `docs/VALIDATION.md:16-18` itself admits a full local `pnpm install`/`typecheck`/`test`/`build` was never executed in the generation environment (DNS failure) — no confirmed evidence this codebase has ever built cleanly end-to-end.

`cloudbuild.yaml` is a **deploy-only** pipeline: Step 1 blind `terraform apply -auto-approve`, no plan review gate. Step 2 `docker build` for all 5 images, no lint/typecheck/test step anywhere. Step 3 runs the Prisma migration Cloud Run Job then sequentially deploys worker→api→notifier(+subscription)→demo→web, with no rollback and no health-check gate between deploys. No `pnpm lint`/`typecheck`/`test`/`preflight` invocation anywhere in `cloudbuild.yaml`, despite all four being the documented "acceptance gate" (`docs/VALIDATION.md:26-29`, `docs/runbooks/DEPLOY_GCP.md:68`) — **that gate is manual and unenforced.**

**Findings:**
- P0 — No CI pipeline; every documented quality gate is manual and unenforced; nothing prevents a broken build/failing test/lint violation from deploying straight to production.
- P1 — `cloudbuild.yaml`'s deploy step has no rollback and no post-deploy health check.

## 7. Testing Audit

- `tests/demo-e2e.mjs` — genuine black-box, full-lifecycle test. Exercises: portal reset → workspace/agent creation → plan approval → first run reaching v1.0 → second run taking FAST_PATH with `modelCallCount === 0` (proving deterministic replay skips the model) → DOM-version toggle → third run self-heals (`recoveryCount >= 1`) and promotes v1.1 to PRODUCTION. A legitimately strong assertion of the core value proposition. Single happy-path script (no negative-path/error-injection, no CAPTCHA-pause assertion), run manually, not invoked by any CI.
- `tests/test-ai.mjs` — thin manual smoke script calling `planWorkflow()` against a live model; `console.log`/`console.error` only, no `assert`, no non-zero exit on failure. A connectivity probe, not a test.
- **Unit/integration suite: confirmed absent.** Zero `*.test.ts`/`*.spec.ts` anywhere under `apps/**`/`packages/**` (only hits are inside `node_modules/.pnpm/zod@*`, third-party internals). Yet every package/app defines `"test": "node --test"` in its `package.json`. With no test files to discover, `pnpm test` → `turbo test` → 12 parallel `node --test` invocations **passes vacuously, exit code 0** — a "green" signal that tests nothing. `packages/agents`, `packages/workflow-engine`, and `packages/security` (the SSRF/domain-boundary control) have zero unit coverage.

**Findings:**
- P0 — Zero real unit/integration tests anywhere; every package's test script silently no-ops.
- Positive: `tests/demo-e2e.mjs` is well-designed and substantive — undermined only by never running in CI.
- P3 — `tests/test-ai.mjs` has no assertions/exit codes despite being named as a test.

## 8. Observability Audit (`packages/observability/src/index.ts`)

**Verdict: a thin structured-logging wrapper, not an OpenTelemetry integration, despite importing the OTel API.**

22 lines total. `tracer = trace.getTracer("webpilot")` (line 2) obtains a tracer handle from `@opentelemetry/api`, but **no SDK is configured anywhere** — no `NodeSDK`/`BasicTracerProvider`, no exporter, no span processor. Without a registered provider, `@opentelemetry/api` is a documented no-op — any `tracer.startSpan(...)` call would run without error but produce no observable trace data. `log()`/`error()` (:3-22) are real, functional, Cloud-Logging-compatible structured JSON loggers (severity/event/timestamp) — genuinely useful and correctly shaped.

**Usage**: grep for `@webpilot/observability` across the repo finds it only in `pnpm-lock.yaml` and the two `package.json` files declaring the dependency — **no application source file actually imports/calls `log`, `error`, or `tracer`.** Declared as a dependency of `apps/browser-worker`, never used in that app's source.

**Findings:**
- P1 — Package is effectively dead code: declared, never used. README's Cloud Trace/observability claims aren't backed by any actual instrumentation.
- P2 — Exported `tracer` is non-functional without SDK/exporter registration; will silently no-op if anyone starts relying on it.

## 9. Documentation-vs-Reality

- `docs/security/SECURITY.md:13` ("`ALLOW_PRIVATE_DEMO=true` exists only for local demo, must be false in production") — **confirmed correctly enforced**: `docker-compose.yml:43` sets it true; `cloudbuild.yaml:84` explicitly sets it false for the deployed worker. Documentation matches implementation.
- `SECURITY.md:29` ("Internal worker invocation uses Cloud Run IAM + Cloud Tasks OIDC in production") — consistent with `cloudbuild.yaml:79-88` (`--no-allow-unauthenticated` worker + `roles/run.invoker` granted only to `task_invoker`).
- `SECURITY.md:29` ("Scheduler triggers verify Google OIDC") — consistent with `scheduler_invoker` SA + `SCHEDULER_AUDIENCE` wiring.
- `DEPLOY_GCP.md:64-68` explicitly instructs the operator to *manually* run `pnpm preflight`/`typecheck`/`test`/`build` before deploying — the doc is honest that this is a manual runbook step, not automated (directly ties to the CI finding in §6), but it means production safety depends entirely on a human remembering to run — and correctly interpreting the vacuous pass of — an empty test suite.
- `SECURITY.md:6` ("Model output is never executed through eval/new Function/shell/dynamic import") — actively checked by `scripts/preflight.mjs:30-34,44-57`, which greps the tree for `new Function(`/`eval(`/`metadata.google.internal` and fails the build on a match (with a documented, scoped allowlist for `packages/security`'s own filtering logic). Real, working — but per §6, never invoked by any automated pipeline.
- No specific false claim found comparing `SECURITY.md`'s IAM/credential claims against Terraform.

**Findings:**
- P1 — Documented "acceptance gate"/"production checks" are manual, human-run commands with no automated enforcement.
- Positive — every specific security claim checked was found accurately implemented; `SECURITY.md` does not overstate what's built, in contrast to the demo/CI-facing documentation.

### Extra finding — committed empty service-account file

`apps/api/service-account.json` is git-tracked (`git ls-files` confirms), 0 bytes, absent from both `.gitignore` and `.dockerignore`. Every Dockerfile's unfiltered `COPY . .` copies it into the build context. No `GOOGLE_APPLICATION_CREDENTIALS` reference exists anywhere in the codebase — nothing currently reads this file; it appears to be a local `gcloud`/ADC tooling artifact.

**Finding (P1/P2, dangerous pattern, not yet an active leak):** a developer who populates it locally with a real service-account key (very natural given the filename/location) and runs an unreviewed `git add -A` will commit a live GCP credential. Recommend: add `apps/api/service-account.json` and a generic `**/service-account*.json` pattern to `.gitignore` and `.dockerignore`; `git rm --cached` the tracked file now; if any real key was ever placed there and pushed, rotate it regardless of current (empty) content.

## 10. Config Inventory — env vars in code vs `.env.example`

**Present and consistent:** `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_GENAI_USE_VERTEXAI`, `GEMINI_MODEL`, `DATABASE_URL`, `DIRECT_URL`, `ARTIFACT_BUCKET`, `TASK_QUEUE`, `TASK_LOCATION`, `WORKER_URL`, `API_URL`, `FIREBASE_PROJECT_ID`, `LOCAL_AUTH_BYPASS`, `LOCAL_USER_EMAIL`, `INTERNAL_WORKER_TOKEN`, `SLACK_CLIENT_ID/SECRET/SIGNING_SECRET/STATE_SECRET/REDIRECT_URI`, `GMAIL_SENDER`, `GMAIL_OAUTH_SECRET_REF`, `GOOGLE_CHAT_WEBHOOK`, `LOCAL_TASKS/PUBSUB/SCHEDULER/ARTIFACTS/SECRETS`, `ALLOW_PRIVATE_DEMO`, `MOCK_AI`, `API_PUBLIC_URL`, `SCHEDULER_AUDIENCE`, `TASK_INVOKER_SA`, `SCHEDULER_INVOKER_SA`, `WORKER_AUDIENCE`, `PUBSUB_TOPIC`.

**Discrepancies:**
- `CORS_ORIGINS` — used in `apps/api/src/main.ts:16` (has a safe default), set explicitly in `docker-compose.yml:65`, but **absent from `.env.example`**.
- `RESEND_API_KEY`/`RESEND_FROM_EMAIL` — used in `apps/api/src/modules/email.service.ts:13-14` (a separate Resend-based transactional email path, unrelated to the notifier's Gmail path) but **entirely absent from `.env.example`**. Falls back gracefully to a console-logged "SIMULATED RESEND EMAIL" when unset, but a reader of `.env.example` has no way to discover this integration exists at all.
- **`MOCK_AI` mismatch**: `.env.example:34` sets `MOCK_AI=false` (implying live Vertex calls on a fresh `cp .env.example .env`), while `docker-compose.yml:44` sets `MOCK_AI=true` for the documented flagship path. The two "getting started" surfaces disagree on the single most consequential flag in the project, with no cross-reference explaining the discrepancy in either file.
- `INTERNAL_API_URL` usage could not be confirmed from files in this audit's scope — flagged for a follow-up grep against `apps/web`/`apps/browser-worker`.

**Findings:**
- P2 — `CORS_ORIGINS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` missing from `.env.example`.
- P2 — `.env.example`'s `MOCK_AI=false` default directly contradicts `docker-compose.yml`'s `MOCK_AI=true` default.
