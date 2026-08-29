# Architecture

## Service boundaries

### `apps/web`

Public Next.js 16 marketing and product UI. It has no database credentials and no browser runtime. Server-side `/backend/*` proxies authenticated product calls to the control API using the runtime `API_URL`.

### `apps/api`

NestJS + Fastify control plane. Owns users/workspaces, agents, versions, approvals, schedules, integrations, connections, run creation, analytics and audit. It never launches Chromium. Browser jobs are dispatched through Cloud Tasks.

### `apps/browser-worker`

Private Cloud Run execution plane with concurrency 1 initially. Owns Playwright, discovery, deterministic execution, checkpoints, challenge detection, recovery replay and version promotion. It obtains secrets by reference from Secret Manager.

### `apps/notifier`

Private Pub/Sub push consumer. Converts operational events into Slack, Gmail API and Google Chat notifications.

### `apps/demo-portal`

A deterministic portal used only to demonstrate and test DOM drift. V1 uses one stable locator and V2 deliberately changes it.

## Intelligence boundary

```text
NEW WORKFLOW
User goal → Planner → human approval → live Navigator → WorkflowSpec v1.0

HEALTHY REPEAT
WorkflowSpec → deterministic Playwright → validation → result
                         model reasoning calls = 0

DRIFT
step fails → DOM + screenshot + error → Recovery Agent → WorkflowPatch
          → sandbox replay → independent Verifier → immutable version → resume
```

`WorkflowSpec` is the source of truth. Generated JavaScript is an audit/export artifact only; it is not evaluated dynamically.

## Async/state model

- `Run` is durable PostgreSQL state.
- Cloud Tasks dispatches one concrete run and controls retry/backoff.
- `idempotencyKey` prevents accidental duplicate run creation.
- `leaseOwner/leaseExpiresAt` prevents concurrent workers on one run.
- `RunStep` checkpoints completed/failed actions.
- Pub/Sub broadcasts operational events to notification/analytics consumers.
- Cloud Scheduler creates a Run through the API; it never calls Chromium directly.

## Persistence

Cloud SQL contains transactional metadata and state. GCS contains screenshots, failure evidence, downloaded artifacts, result JSON, and version audit artifacts. Secret Manager contains website credentials and integration secrets.
