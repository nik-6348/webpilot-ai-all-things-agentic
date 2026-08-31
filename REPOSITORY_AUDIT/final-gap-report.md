# WebPilot AI — Forensic Repository Audit & Production Readiness Report

**Method:** Every claim below is backed by a file:line reference from the actual repository. Nothing here is inferred from README text, comments, or filenames alone — every feature was traced through its real call chain (UI → API client → backend route → service logic → DB/worker → response) before being classified. No code was modified during this audit.

**Scope covered:** all 5 apps (`web`, `api`, `browser-worker`, `notifier`, `demo-portal`), all 7 packages (`agents`, `contracts`, `database`, `gcp`, `observability`, `security`, `workflow-engine`), Terraform, Docker, Cloud Build, tests, docs. ~6,800 lines of hand-written TypeScript were read in full (not sampled).

---

## 1. Executive Summary

**What works, for real:** The core technical bet of this product — teach a workflow once with Gemini via Google ADK, freeze it into an immutable `WorkflowSpec`, replay it deterministically with Playwright at zero LLM cost, and self-heal with a bounded recover→sandbox-verify→independently-verify→promote loop when the site drifts — is **genuinely implemented**, not faked. `apps/browser-worker/src/engine.ts` really does skip all model calls on a healthy fast-path run, really does call Gemini only on failure, really does replay the patch in a fresh headless context before trusting it, and really does gate risky promotions behind human approval. This is the single most impressive, most real part of the codebase, and it is rare for a hackathon build to get this far on the hard part.

**What doesn't work:** Nearly everything *around* that core is either half-wired or silently broken. The headline failure is that **the entire self-service login path is a dead end**: the email/password login endpoint never produces a token the API guard will accept, so every user who signs up through "Request Access" → gets approved → logs in with a password ends up bounced back to the login screen with no error message, forever (§5, F-1). A second, independently severe bug means **any admin-added teammate whose email later matches a real Google account will crash Google Sign-In with an unhandled database error** (§5, F-2). A **public, unauthenticated endpoint lets anyone who knows a `runId` download any artifact from any workspace** — screenshots, extracted business data, compiled automation scripts — by walking the `path` query parameter (§5, F-3). The flagship, most-reproducible local demo (`docker compose up` + the README's own instructions) runs with `MOCK_AI=true`, which means the "AI planner" **returns a hardcoded canned purchase-order plan regardless of what the user typed** — the single most marketed capability of the product is not exercised by its own recommended demo path (§5, F-4). And there is **no CI pipeline and no real test suite** — every package wires up `node --test` with zero test files, so `pnpm test` passes vacuously on code that includes the project's own SSRF/domain-boundary security control (§5, F-9, F-10).

**Current production readiness: Functional hackathon build, with one genuinely production-grade subsystem (the fast-path/self-heal engine and its GCP IAM/Terraform scaffolding) sitting inside an otherwise pre-production shell.** See §25 for the full justification of this rating.

**Biggest risks, ranked:**
1. Broken authentication (two distinct bugs, one of which is a hard 500 crash) blocks real multi-user use today.
2. A public artifact-download endpoint breaks workspace data isolation — this is the one finding that should be treated as an active vulnerability, not just a gap.
3. No CI, no tests, and a deploy pipeline (`cloudbuild.yaml`) that pushes straight to 100% production traffic with no gate, no rollback, and no health check.
4. The flagship demo experience doesn't exercise the AI it's built to showcase, which will surprise anyone who reads the code after watching the demo.
5. Extensive drift between what the UI promises (Slack "Coming Soon", "Enterprise AES-256 Protection", 44 native `alert()`/`confirm()`/`prompt()` dialogs standing in for real UI) and what's actually built or true.

---

## 2. Current Architecture (as built, not as intended)

```
Next.js 16 (apps/web)                     — no DB access, proxies via /backend/[...path] → API_URL
        │  (Authorization: Bearer <firebase-idToken>, attached only if Firebase session exists)
        ▼
NestJS + Fastify API (apps/api)           — 10 controllers, NO service layer (controllers hold all logic directly),
        │                                    single AuthGuard (Firebase ID token OR LOCAL_AUTH_BYPASS)
        ├──▶ Cloud SQL / Postgres (Prisma 7, packages/database) — 16 models, real versioned migrations
        ├──▶ packages/gcp — GCS / Cloud Tasks / Pub/Sub / Secret Manager / Cloud Scheduler adapters,
        │      EVERY ONE has a LOCAL_* env-flag bypass to local disk / no-op / direct HTTP
        └──▶ Cloud Tasks ──▶ Fastify worker (apps/browser-worker)
                                   │
                                   ├─ Playwright (real browser automation, SSRF-guarded navigation)
                                   ├─ packages/agents — Gemini/Vertex calls via @google/adk + @google/genai,
                                   │    4 independent single-shot structured-output functions
                                   │    (planWorkflow / navigateDiscovery / recoverWorkflow / verifyRecovery),
                                   │    NOT a persistent multi-agent session — see §10
                                   ├─ packages/workflow-engine — patch/version/risk/compiler helpers (real)
                                   └─ packages/security — SSRF/domain-boundary guard (real, with one
                                        global kill-switch: ALLOW_PRIVATE_DEMO)
        ▲
        └── Pub/Sub (real code, but DROPPED not queued when LOCAL_PUBSUB=true — the demo default)
                   ▼
            apps/notifier — real Slack/Gmail/Google Chat dispatch, correctly implemented,
                              but structurally unreachable in the shipped demo config
```

**Two things the README implies that the code does not do:**
- `packages/agents/src/orchestrator.ts` defines a full `MultiAgentOrchestrator` class (registry pattern, saga lifecycle, event bus) that is **never instantiated anywhere in the codebase** outside its own file — confirmed by repo-wide grep. The real execution path in `engine.ts` uses its own bespoke `discover()`/`fast()`/`recover()` functions instead. This class was added in the commit titled *"feat: implement enterprise multi-agent orchestrator"* but is dead code (§14).
- There is no service/repository layer anywhere in `apps/api` — every controller (`apps/api/src/modules/*.controller.ts`) talks to Prisma directly. This isn't necessarily wrong at this scale, but it means "NestJS + Fastify control plane" understates how thin the architecture actually is: it's 10 files of controller-embedded business logic, not a layered application.

---

## 3. Repository Statistics

| Metric | Count |
|---|---|
| Apps | 5 (`web`, `api`, `browser-worker`, `notifier`, `demo-portal`) |
| Packages | 7 (`agents`, `contracts`, `database`, `gcp`, `observability`, `security`, `workflow-engine`) |
| Hand-written TS/TSX files (excl. generated/dist/node_modules) | 85, ~6,818 LOC |
| API controllers / REST endpoints | 10 controllers / ~54 routes |
| Prisma DB models | 16 |
| Frontend screens/routes | 14 |
| Automated CI workflows | **0** (no `.github` directory exists) |
| Real unit/integration test files (`*.test.ts`/`*.spec.ts`) | **0** (every package's `node --test` script passes vacuously) |
| Black-box E2E test scripts | 2 (`tests/demo-e2e.mjs` — substantive; `tests/test-ai.mjs` — unasserted smoke script) |
| `window.alert()`/`confirm()`/`prompt()` call sites | 44, across 10 frontend files |
| Reusable Toast/ConfirmDialog/Modal design-system components | 0 |
| Literal `TODO`/`FIXME` code comments | 0 (the "Coming Soon" / hardcoded-demo pattern is used instead — see §20) |
| Committed empty credential-shaped file | 1 (`apps/api/service-account.json`, git-tracked, 0 bytes) |
| GCP services with LOCAL_* bypass flags | 5 of 5 (GCS, Cloud Tasks, Pub/Sub, Secret Manager, Cloud Scheduler) |

---

## 4. Feature Completion Summary

| Classification | Count | Examples |
|---|---|---|
| ✅ Fully implemented | 15 | Fast-path zero-LLM execution, self-heal recover→sandbox-verify→independent-verify→promote loop, Slack OAuth+HMAC command flow (backend), workspace RBAC scoping on reads, agent/run/schedule/connection CRUD, analytics from real DB data, Terraform IAM least-privilege, Prisma migrations |
| 🟡 Partially implemented | 14 | Schedule update (DB updates, Cloud Scheduler job never re-synced), Run cancel (soft flag only, no worker preemption), CAPTCHA detection (naive text-match, likely misses iframe-based Turnstile/Cloudflare widgets), extraction ("AI schema" mostly bypassed by generic heuristic scraper), observability (structured logging real, tracer inert, package unused) |
| 🔴 Not implemented | 6 | Agent-version delete (frontend calls a route that doesn't exist), CI/CD pipeline, real test suite, purge "AGENTS"/"SCHEDULES" targets (silently no-op), Slack UI wiring (backend exists, frontend never calls it) |
| 🟠 Hardcoded / demo only | 9 | `MOCK_AI=true` canned PO plan, Flipkart-specific CSS-class heuristics in extraction, `"google.com"`/`"Public Scraper"` string-literal special cases in agent creation, fabricated run-duration fallback numbers, hardcoded personal-domain fallback URL in compiled script view |
| 🟣 Broken / incorrect | 5 | Email/password login produces no session, duplicate-email Google sign-in crash, frozen stale-data replay risk on fast-path EXTRACT/DONE steps, CSV export link bypasses the API proxy (404s), destructive-action errors masked with fake success text |
| 🔵 Implemented but not integrated | 4 | `MultiAgentOrchestrator` class, `packages/observability` (never imported anywhere), Slack backend (no frontend caller), `RunsController.batchDelete` (no frontend caller) |
| ⚫ Dead / obsolete | 1 | `packages/agents/src/orchestrator.ts` |

---

## 5. Critical P0 Issues

### F-1 — Email/password login is a complete dead end (broken auth, self-service onboarding non-functional)
**Files:** `apps/web/src/app/login/page.tsx:74-97`, `apps/web/src/lib/api.ts:14-18`, `apps/web/src/components/AppShell.tsx:119-127`, `apps/api/src/modules/auth.controller.ts:50-96`, `apps/api/src/common/auth.guard.ts:37-49`

`POST /api/v1/auth/login-email` correctly validates email+password (SHA-256 hash compare) and returns a plain user object — but issues **no token, session, or cookie of any kind**. The frontend's only reaction is `localStorage.setItem("webpilot_user", ...)` then `router.push("/app")`. Every subsequent API call goes through `apps/web/src/lib/api.ts`, which attaches `Authorization: Bearer` **only** from `getFirebaseAuth()?.currentUser?.getIdToken()` — and email/password login never touches Firebase. `AppShell.tsx`'s `onAuthStateChanged` listener fires with `u = null` and immediately `router.replace("/login")`, with **no error, no toast, nothing** — the user is silently bounced back to the login screen.

**Impact:** The entire "Request Access" self-service onboarding flow (signup request → admin approval → email/password login) that the product visibly invests a full UI in is unusable outside `LOCAL_AUTH_BYPASS=true` environments. This is not a UX nit — it is the primary alternate-to-Google auth path, fully built end to end, and it does not work.
**Fix:** Either exchange the validated password login for a real Firebase custom token (`admin.auth().createCustomToken()`) that the frontend signs in with via `signInWithCustomToken`, or have `AppShell` treat a valid `localStorage.webpilot_user` + a corresponding server-side session cookie as an equally valid identity, and have `AuthGuard` accept that session type. In either case, surface a real error state instead of the current silent redirect loop.
**Test:** After email/password login, assert a subsequent `GET /api/v1/agents` returns 200, not 401.

### F-2 — Duplicate-email collision crashes Google Sign-In with an unhandled 500
**Files:** `apps/api/src/modules/workspaces.controller.ts:72-81`, `apps/api/src/modules/approvals.controller.ts:44-53`, `apps/api/src/common/auth.guard.ts:50-59`, `packages/database/prisma/schema.prisma:44-56` (`User.email @unique`, `User.identityProviderUid @unique`)

Both "Add Member" (workspace admin adds a teammate with an email+password) and "Approve Onboarding" create a `User` row with a **synthetic** `identityProviderUid` (`user-${Date.now()}-${random}`) — never a real Firebase UID. If that same email later signs in via Google, `AuthGuard.canActivate` runs `prisma.user.upsert({ where: { identityProviderUid: <real Firebase uid> }, create: { email, ... } })`. Because no row matches the real UID, Prisma attempts a `create` — which collides with the pre-existing row on the `email @unique` constraint. This throws an **unhandled Prisma `P2002` error**, propagating as an uncaught 500 with no graceful handling anywhere in `AuthGuard`.
**Impact:** Any workspace admin who pre-adds a teammate by email, or approves an onboarding request, for someone who later signs in with Google using that same address, breaks that person's login entirely with a raw server error.
**Fix:** In `AuthGuard`, `findFirst({where:{OR:[{identityProviderUid: uid},{email}]}})` before create; if an email match exists with a synthetic UID, update it in place to the real UID instead of blind-creating.
**Test:** Add member by email in Settings, then attempt Google sign-in with that same address — must succeed, not 500.

### F-3 — Public, unauthenticated endpoint exposes any workspace's run artifacts (broken access control / IDOR)
**File:** `apps/api/src/modules/runs.controller.ts:186-231`

`GET /api/v1/runs/:id/artifact?path=<artifactPath>` is decorated `@Public()` (bypasses `AuthGuard` entirely). Even when a caller *is* authenticated, the code explicitly swallows a `ForbiddenException` from `requireWorkspace` with a comment claiming this is "to allow public image viewing." Critically, `artifactPath` is a **fully attacker-controlled query parameter never validated against the resource identified by `:id`** — it's passed straight to `ArtifactStore.get(artifactPath)`. Anyone who knows or obtains a `runId` (which is embedded in shareable screenshot/export URLs throughout the app) can pass an arbitrary `path` and retrieve **any** artifact in the bucket: another run's screenshots, the full extracted `result.json` business data, or another agent's compiled `workflow.audit.js` (which reveals the target site's form structure and business logic).
**Impact:** Workspace data isolation is broken for anything stored via `ArtifactStore` — this is the one finding in this audit that should be treated as an exploitable vulnerability, not a design gap.
**Fix:** Require authentication on this route; validate that `path` starts with `runs/${id}/` (or resolve the artifact reference server-side from the `Run` row's own stored references, never from a client-supplied arbitrary path); keep `requireWorkspace` failures as hard 403s.
**Test:** As a Workspace-B user (or anonymous), request a Workspace-A run's artifact — must return 403/404, and must return 403/404 for any `path` not literally owned by `:id`.

### F-4 — The flagship local demo never calls Gemini; the "AI plan" is a hardcoded canned response
**Files:** `packages/agents/src/index.ts:352-398` (`planWorkflow` mock branch), `docker-compose.yml:44` (`MOCK_AI: "true"` on the browser-worker service), README.md:50 ("recommended local path… sets `MOCK_AI=true`")

When `MOCK_AI=true` — the default for `docker compose up --build -d`, the README's own recommended and most reproducible path — `planWorkflow()` ignores the user's actual goal text almost entirely and returns a **fixed, hardcoded** "Monitor supplier purchase-order exceptions" plan with hardcoded CSS selectors (`.order-row`, `.order-id`, `.supplier`, `.status`, `.eta`, `.amount`) regardless of what URL or goal was typed.
**Impact:** Anyone who runs the documented demo and then reads the code will discover the headline "AI understands your goal and designs a workflow" capability is not exercised at all in that path — it's scripted. This is honest in code (clearly gated by an explicit `MOCK_AI` flag, not disguised), but it is materially misleading as the *recommended* demo experience, and it means the AI planning path has never been demo-verified end-to-end by the project's own primary onboarding flow.
**Fix:** Either make the mock plan actually reflect the user's submitted goal/URL structurally (even if canned per-field), or change the recommended demo instructions to make explicit that `MOCK_AI=true` bypasses real AI planning, and provide a documented `MOCK_AI=false` path with real credentials as the "see the AI itself" demo.

### F-5 — Fast-path "zero reasoning" replay risks returning permanently stale, frozen data
**Files:** `apps/browser-worker/src/browser.ts:255-276` (`EXTRACT`/`DONE` cases in `executeStep`), `apps/browser-worker/src/engine.ts:442-460`

`executeStep`'s `EXTRACT` and `DONE` cases both check `step.value` for a leading `"["` and, if present, **return the parsed literal JSON immediately without touching the live page**. Because `WorkflowStep.value` is whatever the Navigator (Gemini) put in its decision during discovery, and that value gets frozen permanently into the persisted `WorkflowSpec`, **any discovery run where Gemini's response embedded the extracted records directly in `action.value` will replay that exact frozen dataset forever on every future fast-path run**, never re-scraping the live site. This directly contradicts the "healthy repeat run re-executes against the live site" premise the whole self-healing narrative depends on (a site could change entirely and the fast path would report success with day-one data).
**Impact:** Silent, hard-to-detect data staleness — the kind of bug that looks like a working feature in a demo and fails quietly in production.
**Fix:** The `EXTRACT`/`DONE` step contract should never persist literal scraped values into the reusable `WorkflowStep`; extraction should always be locator/schema-driven at replay time. Add a schema-level constraint (or a runtime assertion in `applyPatch`/version creation) rejecting a persisted `EXTRACT`/`DONE` step whose `value` looks like a serialized data array.
**Test:** Run discovery once, capture `result.records`; wait, then genuinely change the site's underlying data (or use the demo portal's toggle) and re-run fast path — assert the new run's records differ from the frozen first run's, when the live site content differs.

### F-6 — CLICK-action risk classification is entirely LLM self-assessed, undermining the human-approval safety net
**File:** `packages/workflow-engine/src/index.ts:22-39` (`classifyRisk`)

`classifyRisk` treats `CLICK` risk as exactly `step.risk`, whatever the Planner/Navigator/Recovery agent assigned, defaulting to `LOW` per the Zod schema default (`packages/contracts/src/index.ts:48`). There is no independent, structural classifier (e.g., a keyword check for "delete", "pay", "purchase", "submit payment" in the step description) forcing `HIGH` regardless of model output. `requiresApproval()` (`engine.ts:131-170`) only pauses for `HIGH`.
**Impact:** A miscalibrated or adversarially-influenced model response (see F-13, prompt injection) can let a genuinely dangerous click — a real payment submission, an account deletion — execute unattended, because the entire safety gate is delegated to the same model whose output it's supposed to check.
**Fix:** Add an independent, non-LLM risk floor: keyword/heuristic detection over the step description/URL that force-elevates risk to at least `MEDIUM`/`HIGH` regardless of the model's self-reported value, before `classifyRisk` is trusted for the approval gate.

### F-7 — `VIEWER` role can delete an entire agent and all its run history
**File:** `apps/api/src/modules/agents.controller.ts:364-371`

`DELETE /agents/:id` allows roles `["OWNER","ADMIN","OPERATOR","VIEWER"]` — every other mutating endpoint in this controller (create, update, activate version, run version) restricts to `["OWNER","ADMIN","OPERATOR"]`, excluding `VIEWER`. This one endpoint includes `VIEWER`, almost certainly a copy-paste error, and it is the single most destructive endpoint in the controller (cascades through `RunEvent`/`RunStep`/`Approval`/`ModelInvocation`/`Run`/`Schedule`/`AgentVersion`/`Agent`).
**Impact:** A user meant to have read-only access can permanently delete production agents and their entire run history.
**Fix:** Change the role list to `["OWNER","ADMIN","OPERATOR"]`.
**Test:** As a `VIEWER`, `DELETE /agents/:id` must return 403.

### F-8 — Schedule update does not propagate to Cloud Scheduler; `enabled: false` does not stop execution
**Files:** `apps/api/src/modules/schedules.controller.ts:124-141` (`update`), `:61-93` (`trigger`)

`PATCH /schedules/:id` updates the DB row's `cronExpression`/`timezone`/`enabled` fields but never calls `SchedulerService().upsert(...)` again — the real Cloud Scheduler job keeps firing on its original cron forever. Worse, the public `trigger` endpoint never checks `schedule.enabled` before creating a `Run` — toggling a schedule "off" in the UI has **zero effect** on whether it keeps executing.
**Impact:** A user who disables or reschedules a recurring automation via the UI will continue to see it run on the old schedule, potentially against a site/account they believed they'd stopped automating.
**Fix:** `update()` must re-call `SchedulerService().upsert()` (and `.remove()` when transitioning to disabled) with the new cron/timezone; `trigger()` must check `s.enabled` and no-op (204, not a new Run) if false.
**Test:** Disable a schedule, then hit its `trigger` endpoint directly — must not create a Run.

### F-9 — No CI/CD pipeline exists; deploys go straight to production with zero automated gate
**Files:** confirmed absent `.github/`, `cloudbuild.yaml` (full read by audit agent)

There is no GitHub Actions (or any) CI. `cloudbuild.yaml` builds and deploys directly with no `pnpm lint`/`typecheck`/`test`/`preflight` step anywhere in it, no rollback mechanism, and no health-check gate between sequential service deploys. `docs/VALIDATION.md` itself admits a full `pnpm install && pnpm build` was never executed even once in the project's own generation environment (DNS failure) — meaning **there is no confirmed evidence this codebase has ever built cleanly end-to-end.**
**Fix:** Add a required GitHub Actions workflow (`pnpm install --frozen-lockfile && pnpm preflight && pnpm typecheck && pnpm test && pnpm build`) gating merges to `main`, and insert the same sequence as a required step before `build-images` in `cloudbuild.yaml`.

### F-10 — Zero real unit/integration tests; `pnpm test` passes vacuously
**Files:** every `apps/*/package.json` and `packages/*/package.json` (`"test": "node --test"`), confirmed zero `*.test.ts`/`*.spec.ts` files anywhere outside `node_modules`

Every package wires a test script that discovers no files and exits 0. This is worst for `packages/security` (the SSRF/domain-boundary enforcement — the project's core safety control) and `packages/workflow-engine` (the fast-path/discovery/recovery state machine), neither of which has a single line of automated unit coverage. The only real verification of any of this logic is one manual E2E script (`tests/demo-e2e.mjs`, which is genuinely well-designed, see §18) that nothing in CI ever runs.
**Fix:** Minimum viable: unit tests for `assertSafeUrl` (SSRF bypass cases, `ALLOW_PRIVATE_DEMO` scoping, wildcard/domain matching edge cases per F-14) and `classifyRisk`/`applyPatch`/`nextVersionLabel`, wired into the CI workflow from F-9.

---

## 6. Frontend Findings

Full detail: `REPOSITORY_AUDIT/frontend-audit.md`. Headline points:

- 24 files read in full. Core CRUD (agents, runs, schedules, connections, approvals, workspace members) is genuinely wired to real backend endpoints — this is not a mockup.
- **Agent-version delete is a phantom feature**: the UI calls `DELETE /agents/:id/versions/:versionId`, which does not exist on the backend (only whole-agent delete exists). The frontend's own error handler swallows the resulting failure (`.catch(() => {})`) and then unconditionally shows `alert("Version ... deleted!")` — a guaranteed false-positive success message (`apps/web/src/app/app/agents/[id]/page.tsx:283-297`).
- **CSV export is broken**: `runs/[id]/page.tsx:465` links to a bare `/api/v1/...` path instead of routing through the app's own `/backend` proxy that every other call uses — it 404s against the Next.js server.
- **Integrations page is 100% static** — a hardcoded array with no `useEffect`/`api()` call at all (`integrations/page.tsx:6-56`), labeling Slack/Gmail/Google Chat "Coming Soon" even though Slack's backend OAuth flow is fully implemented and unused by any frontend code (confirmed by full-source grep).
- Destructive-action failure messages are deliberately overwritten with calm, false-sounding text (e.g., `"Factory reset initiated."` shown even when the request failed) — `settings/page.tsx:203,223`.
- No shared `Toast`/`ConfirmDialog`/`Modal`/`EmptyState`/`Spinner` component exists anywhere; every page hand-rolls its own, with heavy duplication. One correct exception exists (the workspace-delete confirm flow in `AppShell.tsx`) proving the team knew the right pattern but never generalized it.

## 7. UI/UX Findings

**44 `window.alert()`/`confirm()`/`prompt()` call sites across 10 files** — full table in `frontend-audit.md`. Nine are destructive-action confirmations (delete agent, delete version, delete connection, delete run, delete schedule, remove member, purge/cleanup, and a `window.prompt("type OK")` gate on the single most destructive action in the app, Factory Reset) using generic one-line native dialogs with no impact detail (linked schedule counts, run history counts). The remaining 35 are success/error toasts standing in for a real notification system. Recommended replacement pattern per site is in `frontend-audit.md` §3, following the shape:

```
Delete Agent
Current:  window.confirm("Are you sure...?")
Target:   Destructive ConfirmDialog — agent name, active schedule count,
          run history count, Cancel / Delete (typed confirmation if
          any schedules are active)
```

Missing loading/error states: every page's *initial data load* failure is `console.error`-only with no visible UI feedback (indistinguishable from a genuinely empty list); every *mutation* failure at least surfaces via `alert()`. No page has a dedicated error state distinct from its empty state.

## 8. API & CRUD Findings

| Entity | Create | List | Detail | Update | Delete | Notes |
|---|---|---|---|---|---|---|
| Agents | ✅ | ✅ | ✅ | ✅ | ✅ (but see F-7, wrong roles) | |
| Agent Versions | ✅ (implicit) | ✅ | ✅ | ✅ | ❌ no backend route (frontend calls a nonexistent one) | |
| Runs | ✅ | ✅ | ✅ | n/a | ✅ | unused `batch-delete` endpoint, no frontend caller |
| Schedules | ✅ | ✅ | ✅ | 🟡 DB only, Cloud Scheduler never re-synced (F-8) | ✅ | |
| Connections | ✅ | ✅ | ✅ | ✅ | ✅ | correctly redacts secret refs |
| Approvals | n/a | ✅ | ✅ | ✅ approve/reject | n/a | |
| Workspace Members | ✅ | ✅ | ✅ | ✅ | ✅ | weak password policy, min 4 chars |
| Workspaces | ✅ | ✅ | ✅ | ✅ | ✅ | correctly cascades via DB-level `onDelete: Cascade` |
| Integrations | 🔵 backend only | 🔵 backend only | n/a | 🔵 backend only | n/a | zero frontend wiring, see §6 |

Authorization pattern across controllers is consistently correct (fetch-by-id, then `requireWorkspace(resource.workspaceId, roles)` before returning/mutating) **except** F-7 (VIEWER-can-delete) and F-3 (public artifact endpoint). No other IDOR was found in the 10 controllers read in full — this is a genuine strength worth crediting; the pattern was clearly applied deliberately, just missed in two places.

`admin.controller.ts`'s `purgeData` declares `target: "AGENTS"|"SCHEDULES"` in its type signature but only implements `"RUNS"` and `"FACTORY_RESET"` — calling it with `"AGENTS"` or `"SCHEDULES"` silently returns `{ok:true, purgedCount:0}` and writes an audit log claiming the purge happened, having done nothing.

## 9. Database Findings

16 models, correctly normalized, with real versioned Prisma migrations (not `db push`-only) sequenced before service startup in both `docker-compose.yml` and `cloudbuild.yaml`. Cascade behavior is correctly configured at the DB level (`onDelete: Cascade` from `Workspace`/`Agent`/`Run` down through every child table), so workspace/agent/run deletion is safe despite the app-layer manual-cascade code in some controllers being partially redundant with it.

One schema defect found: **`WorkspaceSetting` has no `@relation` to `Workspace` at all** (`schema.prisma:309-322`) — `workspaceId` is a plain `@id` string with no foreign key. Deleting a workspace leaves its settings row permanently orphaned (no cascade possible without a relation), and nothing enforces that a `WorkspaceSetting.workspaceId` actually references a real workspace. Low-severity but worth a migration to add the missing FK.

## 10. AI / ADK / Gemini Findings

**Real, not decorative.** `packages/agents/src/index.ts` uses actual `@google/adk` (`LlmAgent`, `InMemoryRunner`) and `@google/genai` (`GoogleGenAI`) SDKs, with genuine structured output (Zod → JSON Schema via `zod-to-json-schema`, passed as `responseSchema`), a real fallback path (ADK empty response → direct GenAI SDK call), and real exponential-backoff retry (4 attempts, jittered) on the fallback path.

**But it is not the deep multi-agent system the naming implies.** Each of the four "agents" (Planner/Navigator/Recovery/Verifier) is an independent, single-shot function call with `disallowTransferToParent`/`disallowTransferToPeers` set — there is no agent-to-agent handoff, no persistent session (`InMemoryRunner.sessionService.createSession()` is called fresh on every single invocation and discarded), and no tool-use loop within a single agent call. This is honestly closer to **"structured prompt → validated JSON, four times, with retries"** than a true agentic system with memory or live tool orchestration — which is not a criticism of the engineering (it's a reasonable, working design), just a correction to the marketing framing in the README ("Google ADK TypeScript Planner, live Navigator... sessions/state used?" — answer: technically, but not meaningfully leveraged).

`MultiAgentOrchestrator` (`packages/agents/src/orchestrator.ts`) — a fully-built alternative registry/saga-pattern orchestration class — is dead code, never instantiated anywhere (§14).

`WEB_CONTENT_BOUNDARY` (a static prompt-injection warning string) is consistently included in all three navigation-facing agent instructions — a real, if purely prompt-level, mitigation (see F-13 for its limits).

## 11. Browser Worker Findings

`engine.ts`/`browser.ts` genuinely implement: lease-based run acquisition (prevents two workers claiming the same run), a 25-step anti-loop guard during discovery, per-step checkpointing (`RunStep` upserts), a network-level SSRF guard on every sub-resource request (`installNetworkGuard`, routed through `assertSafeUrl` on every request, not just navigations), and clean browser lifecycle (`finally { await browser.close() }` on every path).

Two real gaps: (1) `Run.cancel()` only flips a DB status flag — nothing in the step-execution loop polls for cancellation, so an in-flight browser automation cannot actually be stopped mid-run (§8, not separately numbered as P0 but a genuine reliability gap); (2) `assertSafeUrl` performs a live DNS lookup on **every single sub-resource request** the page makes (images, fonts, XHR, everything), which is a real latency/flakiness risk on image-heavy pages, not just a security control.

## 12. Self-Healing Findings

This is the best-implemented subsystem in the repository. Verified end-to-end in `engine.ts`'s `recover()` function: failure detected → DOM+screenshot captured → previous successful state available via replay from `spec.startUrl` → Gemini `recoverWorkflow()` called → `applyPatch()` produces a minimal single-step patch → `sandboxVerify()` replays the patch in a **fresh headless browser context**, refusing to replay past any high-risk prior step → independent `verifyRecovery()` Gemini call (explicitly instructed "the repair agent cannot approve itself") → `RecoveryAttempt` row persisted → on `PASS` verdict, a new immutable `DRAFT` `AgentVersion` is created → risk-gated: `LOW` risk + `autoPromoteLowRisk` setting auto-promotes to `PRODUCTION` and resumes the *same run*; anything else creates an `Approval` row and pauses (`WAITING_RECOVERY_APPROVAL`); on later approval, `executeRun()` checks for an approved `RECOVERY` approval and promotes+resumes correctly. Every stage in the audit prompt's Part 26 checklist is genuinely present. The only material weakness is F-6 (LLM-self-assessed CLICK risk) undermining the approval gate's trustworthiness at the margins.

## 13. Scheduler & Async Findings

Cloud Tasks and Cloud Scheduler dispatch code is real (`packages/gcp/src/index.ts`), and Cloud Scheduler triggers are genuinely OIDC-verified in production (`schedules.controller.ts:61-75`, `OAuth2Client().verifyIdToken()`). But: F-8 (schedule updates don't propagate; disabled schedules keep firing) is a confirmed, concrete break in this subsystem. Idempotency keys exist on every `Run` creation path (`idempotencyKey: unique`), which is a genuine strength for duplicate-delivery protection.

## 14. Slack / Gmail / Google Chat Findings

**Slack backend is real and well-implemented**: OAuth connect/callback with signed, expiring state; slash-command signature verification with `crypto.timingSafeEqual` and a 300-second replay window — this is correctly done, better than most hackathon integrations. **It is completely unused by the frontend** (§6) and, per the infra audit, Slack notifications are dead-on-arrival even for a connected workspace because nothing in the OAuth flow ever sets `metadata.defaultChannel`, which `apps/notifier/src/main.ts` requires before it will post.

Gmail and Google Chat notifier code paths are real (OAuth2 refresh-token Gmail send, plain webhook POST for Chat) but gated on env vars (`GMAIL_OAUTH_SECRET_REF`, `GOOGLE_CHAT_WEBHOOK`) that are empty in every environment file in this repo and only populated by a production-only script — meaning these paths are real but **never exercised by anything in this repository**, including the E2E test.

The entire notification pipeline is additionally unreachable in the shipped demo config because `LOCAL_PUBSUB=true` makes `EventBus.publish()` a silent no-op — events that should trigger notifications are dropped, not queued, before they ever reach the notifier.

## 15. GCP Findings

| GCP Service | Code Exists | Terraform Exists | Runtime Usage (default config) | Complete? |
|---|---|---|---|---|
| Cloud Run | n/a (deploy target) | ❌ not Terraform-managed — deployed imperatively via `gcloud run deploy` in `cloudbuild.yaml` | Real in prod deploy | 🟡 |
| Cloud SQL | ✅ | ✅ | ✅ | ✅ |
| Vertex AI / Gemini | ✅ | ✅ (API enabled + IAM only, correct — no provisionable resource) | 🟡 bypassed by `MOCK_AI=true` in the default demo | 🟡 |
| Cloud Storage | ✅ | ✅ | 🔴 bypassed by `LOCAL_ARTIFACTS=true` default | 🟡 |
| Cloud Tasks | ✅ | ✅ | 🔴 bypassed by `LOCAL_TASKS=true` default (direct HTTP call instead) | 🟡 |
| Pub/Sub | ✅ | 🟡 topic only; push subscription created imperatively in `cloudbuild.yaml`, not Terraform | 🔴 dropped entirely under `LOCAL_PUBSUB=true` default | 🟡 |
| Cloud Scheduler | ✅ | 🟡 IAM/invoker only — jobs created dynamically at runtime (correct design, they're user data) | 🔴 no-op under `LOCAL_SCHEDULER=true` default | 🟡 |
| Secret Manager | ✅ | ✅ (`database_url` seeded; integration secrets left version-less by design) | 🔴 bypassed by `LOCAL_SECRETS=true` default (writes to local disk instead) | 🟡 |
| Identity Platform | ✅ | ✅ | 🔴 bypassed entirely by `LOCAL_AUTH_BYPASS=true` default | 🟡 |
| Cloud Logging/Monitoring/Trace | 🟡 structured logging real; OTel tracer has no SDK/exporter registered | ✅ APIs enabled | 🔴 `packages/observability` never imported anywhere | 🟡 |
| Artifact Registry / Cloud Build | ✅ | n/a | ✅ | ✅ |

**The pattern across every row is the same**: real, correct GCP-native code exists for every claimed service, and every single one of them is bypassed by an env-flag default to a local/no-op equivalent in both `docker-compose.yml` and `.env.example`. This is a legitimate, common pattern for local development — but it means **none of the "cloud-native architecture" claims in the README have been exercised end-to-end by anything in this repository's own test/demo tooling**, only by (unverifiable, undocumented) manual production deploys.

## 16. Security Findings

Ranked by severity; F-1/F-2/F-3/F-6/F-7 above are the P0/P1 core. Additional findings:

- **F-11 (P1) — Weak, hardcoded-salt password hashing.** `apps/api/src/modules/auth.controller.ts:29-31`: `crypto.createHash("sha256").update(password + ":webpilot_salt_2026").digest("hex")`. Unsalted-per-user, fast-hash password storage — vulnerable to rainbow-table/GPU brute force, and the single hardcoded salt string means every deployment of this codebase shares the same salt. Should be bcrypt/scrypt/argon2 with a per-user random salt.
- **F-12 (P2) — Weak password policy.** `SetPasswordSchema` (`workspaces.controller.ts:25-28`) requires only `min(4)` characters for admin-set passwords.
- **F-13 (P2, accepted-risk, documented for awareness) — Prompt injection mitigation is prompt-level only.** `WEB_CONTENT_BOUNDARY` is a static instruction string, not a structural isolation boundary; the real backstop is the domain allowlist (`assertSafeUrl`) plus the approval gate for `HIGH` risk actions — which F-6 shows is itself LLM-self-assessed. A sufficiently adversarial page could still influence in-domain actions (form submissions, same-domain link clicks) that the model doesn't flag as high-risk.
- **F-14 (P2) — `ALLOW_PRIVATE_DEMO` is a global SSRF kill-switch, not scoped to the demo host.** `packages/security/src/index.ts:33-38,101-105`: when true, it disables the private-IP DNS check for **any** hostname, not just `localhost`/`demo-portal` as its name implies. It is correctly set to `false` in `cloudbuild.yaml`'s production deploy (verified), but the naming invites a future copy-paste mistake into a production env file.
- **F-15 (P3) — Non-timing-safe internal worker token comparison.** `apps/browser-worker/src/main.ts:11`: `req.headers["x-internal-token"] !== process.env.INTERNAL_WORKER_TOKEN` — plain string compare, unlike the correctly `timingSafeEqual`-guarded Slack signature check. Low real-world exploitability (internal network only), but inconsistent with the standard set elsewhere in the codebase.
- **F-16 (P1/P2) — Committed, empty, un-ignored credential-shaped file.** `apps/api/service-account.json` is git-tracked, 0 bytes today, absent from both `.gitignore` and `.dockerignore`, and copied into every Docker image via unfiltered `COPY . .`. No code currently reads it (`GOOGLE_APPLICATION_CREDENTIALS` is never referenced), but its presence invites a future accidental credential commit. Add it (and a generic pattern) to both ignore files and `git rm --cached` it now.
- **Positive finding worth stating plainly**: authorization scoping across all 10 controllers is otherwise consistently correct (fetch-then-check-workspace-membership pattern), Terraform IAM is genuine least-privilege with zero `editor`/`owner` grants, and `scripts/preflight.mjs` performs a real static check against `eval`/`new Function`/GCP-metadata-hostname references — a legitimate, working defense-in-depth layer, just never run in CI (F-9).

## 17. Observability Findings

`packages/observability/src/index.ts` (22 lines) provides real, Cloud-Logging-compatible structured JSON logging (`log()`/`error()`) — genuinely useful as written. But its exported OpenTelemetry `tracer` has no SDK or exporter registered anywhere in the codebase, so any span it produces goes nowhere. More importantly: **the package is never imported by any application source file** — it's declared as a dependency of `apps/browser-worker` but never called. There is no request-ID/run-ID/trace-ID correlation implemented anywhere despite `run_id`/`agent_id`/`version_id`/`step_id` all existing as natural correlation keys in the schema. Cloud Trace/Monitoring APIs are enabled in Terraform with nothing behind them.

## 18. Testing Findings

`tests/demo-e2e.mjs` is a genuinely strong, substantive black-box test — it exercises the full teach→fast-path(0 model calls)→drift→self-heal→promote lifecycle with real assertions, not a superficial smoke check. `tests/test-ai.mjs` is an unasserted manual connectivity probe (no `assert`, no failing exit code) mislabeled by its filename as a test. Beyond these two scripts, **zero automated unit/integration coverage exists anywhere in the monorepo** (F-10) — most concerning for `packages/security` and `packages/workflow-engine`. Neither script runs in any CI pipeline, because none exists (F-9).

## 19. DevOps / Deployment Findings

Docker: all 5 Dockerfiles use appropriate, consistent base images (notably the correct `mcr.microsoft.com/playwright` base for the worker, avoiding manual Chromium dependency wrangling), correctly include/exclude `prisma generate` per service's actual needs, and bake in no real secrets. But every one uses `pnpm install --no-frozen-lockfile`, undermining build reproducibility, and none use multi-stage builds or a non-root user.

Terraform: genuinely strong IAM design (6 distinct least-privilege service accounts, zero `editor`/`owner` grants) and correctly provisions Cloud SQL/GCS/Cloud Tasks/Pub/Sub topic/Secret Manager/Identity Platform. Cloud Run services themselves and the Pub/Sub push subscription are provisioned imperatively by `cloudbuild.yaml`, not Terraform — meaning `terraform apply` alone does not yield a working deployment, which the docs don't clearly distinguish.

CI/CD: see F-9. `cloudbuild.yaml` deploys sequentially (migration job → worker → api → notifier+subscription → demo → web) with no rollback and no health-check gate between steps.

## 20. Hardcoded & Mock Data Report

| Location | Value/Type | Classification |
|---|---|---|
| `packages/agents/src/index.ts:352-398` | Entire canned PO-monitoring plan under `MOCK_AI=true` | Dangerous hardcode — is the default demo path (F-4) |
| `packages/agents/src/index.ts:109` | `GOOGLE_CLOUD_PROJECT \|\| "webpilot-ai-hackathon"` | Dangerous hardcode — silent fallback masking missing config |
| `apps/api/src/modules/agents.controller.ts:106,117` | Special-cased string literals `"google.com"` and `"Public Scraper"` altering create-agent business logic | Demo-specific logic embedded in production controller |
| `apps/browser-worker/src/browser.ts:80-81` | Flipkart-specific hashed CSS class selectors (`div[class*='cPH']`, `div[class*='75W']`) in the generic extraction fallback | Dangerous hardcode — site-specific heuristics presented as general-purpose |
| `apps/web/src/app/app/agents/new/page.tsx:65-77` | Hardcoded `flipkart`/`amazon` keyword→URL mapping | Demo-specific business rule in frontend |
| `apps/web/src/app/app/runs/page.tsx:30-42` | Fabricated fallback run duration (`1.4s`/`14.2s`/`"1.2s"`) when no real timing exists | Fake metric — displays invented data as if real |
| `apps/web/src/app/app/runs/[id]/page.tsx:119` | Hardcoded personal domain `https://ai.nik6348.in/` as ultimate script-view fallback | Dangerous/embarrassing hardcode for a production code path |
| `apps/web/src/app/app/settings/page.tsx:432` | Static `"7 / 30 DAYS RULE"` label disconnected from actual `retentionPeriod` state | Misleading demo copy |
| `apps/api/service-account.json` | Committed, empty, credential-shaped file | Dangerous pattern (F-16) |

## 21. Dead / Unused Code

- `packages/agents/src/orchestrator.ts` (`MultiAgentOrchestrator`, `IAgent`, full saga/registry pattern, ~270 lines) — confirmed via repo-wide grep to be instantiated nowhere outside its own file. The real engine (`engine.ts`) implements its own bespoke flow instead.
- `packages/observability` — declared as a dependency, never imported/called by any application source.
- `RunsController.batchDelete` (`runs.controller.ts:249-268`) — real, working endpoint with no frontend caller.
- Frontend `settings/page.tsx` toggle state (`headless`, `selfHealing`, `fastScript`, `captureScreenshots`) — declared, defaulted true, rendered nowhere, wired to no save handler.

## 22. Documentation Mismatches

| README/doc claim | Reality |
|---|---|
| "Google ADK TypeScript Planner, live Navigator, Recovery Agent, independent Verifier" (implies deep multi-agent system) | Four independent single-shot structured-output calls with no persistent session or agent handoff (§10) |
| "Slack OAuth… Slack notifications" listed as implemented | Backend real; frontend shows "Coming Soon" and never calls it; notifications dead-on-arrival without an undocumented manual `defaultChannel` PATCH |
| "Zero-reasoning fast path on healthy repeat runs" | True for model calls, but extraction on that path can silently replay frozen discovery-time data forever (F-5) |
| "docker compose up... reproducible V1→V2 healing scenario" as the recommended path | Runs with `MOCK_AI=true`, meaning the "AI plan" step is a hardcoded canned response, not demonstrated AI reasoning (F-4) |
| `docs/VALIDATION.md`/`docs/runbooks/DEPLOY_GCP.md` list `pnpm preflight/typecheck/test/build` as the "acceptance gate" | These are manual, human-run commands with no automated enforcement anywhere (F-9); `test` passes vacuously (F-10) |
| `docs/security/SECURITY.md` claims (ALLOW_PRIVATE_DEMO scoping, worker/scheduler OIDC, no-eval static check) | **All independently verified accurate** — this document does not overstate what's built, in contrast to the demo/CI framing elsewhere |

---

## 23. Feature Matrix

| Feature | UI | API | DB | Worker | GCP | Tests | Status |
|---|---|---|---|---|---|---|---|
| Google Sign-In | ✅ | ✅ | ✅ | N/A | ✅ | ❌ | Working |
| Email/password login | ✅ | ✅ | ✅ | N/A | N/A | ❌ | 🟣 Broken (F-1) |
| Self-service onboarding (Request Access) | ✅ | ✅ | ✅ | N/A | ✅ (email) | ❌ | 🟣 Broken end-to-end (F-1, F-2) |
| Agent creation + AI plan | ✅ | ✅ | ✅ | N/A | ✅ | 🟡 (demo path only, mocked) | Partial |
| Plan approval | ✅ | ✅ | ✅ | N/A | N/A | ✅ (e2e) | Working |
| Discovery run (live AI navigation) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 (mocked by default) | Working, undertested |
| Fast-path zero-LLM replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (e2e) | Working, with F-5 caveat |
| Self-healing recovery | 🟡 (approval UI works, no impact detail) | ✅ | ✅ | ✅ | ✅ | ✅ (e2e) | Working — best subsystem |
| Version management (edit/activate/run) | ✅ | ✅ | ✅ | N/A | ✅ | ❌ | Working |
| Version delete | ✅ (button exists) | ❌ | ❌ | N/A | N/A | ❌ | 🔴 Not implemented |
| Run history / export | ✅ (export broken) | ✅ | ✅ | N/A | ✅ | ❌ | Partial |
| Schedules | ✅ | 🟡 (update doesn't sync) | ✅ | N/A | 🟡 | ❌ | Partial (F-8) |
| Connections/credentials vault | ✅ | ✅ | ✅ | ✅ (consumed at run time) | ✅ | ❌ | Working |
| Approvals (plan/recovery/high-risk/CAPTCHA) | ✅ | ✅ | ✅ | ✅ | N/A | ✅ (e2e, partial) | Working |
| CAPTCHA/human-verification pause | 🟡 | ✅ | ✅ | 🟡 (naive text-match detection) | N/A | ❌ | Partial |
| Slack integration | ❌ (UI says "Coming Soon") | ✅ | ✅ | N/A | N/A | ❌ | 🔵 Implemented, not integrated |
| Gmail/Google Chat notifications | ❌ (no UI at all) | 🔵 | 🔵 | N/A | 🔵 | ❌ | 🔵 Implemented, unreachable by default |
| Analytics dashboard | ✅ | ✅ (real DB-derived) | ✅ | N/A | N/A | ❌ | Working |
| Audit log | ✅ | ✅ | ✅ | N/A | N/A | ❌ | Working |
| Workspace RBAC | ✅ | ✅ (mostly correct, F-7 exception) | ✅ | N/A | N/A | ❌ | Working |
| Data retention/purge | ✅ (2 of 4 targets work) | 🟡 | ✅ | N/A | N/A | ❌ | Partial |
| Observability/tracing | N/A | 🔵 (unused package) | N/A | 🔵 | 🟡 (APIs enabled, nothing behind them) | ❌ | 🔴 Not really implemented |

---

## 24. Enterprise Production Target Architecture

The existing topology (§2) is directionally correct and should **not** be rearchitected — it should be *finished*. The target state is the same shape with every bypass closed and every gap in §5–§21 addressed:

```
Next.js (Cloud Run) ──▶ NestJS API (Cloud Run, thin service layer added)
                             │
        ┌────────────────────┼─────────────────────┐
        ▼                    ▼                      ▼
   Cloud SQL          Cloud Tasks (real,       Vertex AI / Gemini
   (unchanged,          no LOCAL_TASKS          (unchanged, remove
    add WorkspaceSetting  in prod)               google.com/PublicScraper
    FK — §9)                  │                   hardcodes)
                               ▼
                     Browser Worker (Cloud Run, private)
                          │
                          ├─ Google ADK/Vertex (unchanged)
                          ├─ GCS (real, no LOCAL_ARTIFACTS in prod)
                          └─ Pub/Sub (real, no LOCAL_PUBSUB in prod)
                                    │
                                    ▼
                          Notifier (Cloud Run, private)
                          ├─ Slack (frontend wired, defaultChannel set on connect)
                          ├─ Gmail
                          └─ Google Chat
```

Additions, not replacements:
- A real session/token bridge for password login (or its removal in favor of Google-only auth, if that's the simpler production decision).
- A minimal service layer in `apps/api` between controllers and Prisma, primarily to make the authorization/business-rule logic unit-testable (ties directly to F-10).
- `packages/observability` actually wired into request/run lifecycle logging with `runId`/`agentId`/`versionId`/`stepId` correlation, plus a real OTel SDK+exporter registration.
- CI enforcing the existing `preflight`/`typecheck`/`test`/`build` scripts (they already exist — they're just never run automatically).
- Cloud Run services and the Pub/Sub subscription migrated from `cloudbuild.yaml`'s imperative `gcloud`/`gcloud pubsub` calls into Terraform resources, so `terraform apply`/`destroy` is authoritative.

---

## 25. Production Hardening Roadmap

### Phase 0 — Baseline (½–1 day)
Get a real, confirmed-clean `pnpm install && pnpm build` (the project has never had one — `docs/VALIDATION.md`'s own admission). Add the CI workflow from F-9 immediately, even before fixing anything else, so every subsequent phase is regression-guarded.
**Acceptance:** CI green on `main`, running `preflight`+`typecheck`+`test`+`build` on every PR.

### Phase 1 — P0 Security & Auth (1–3 days)
F-1 (broken password login), F-2 (duplicate-email crash), F-3 (public artifact endpoint), F-7 (VIEWER delete), F-11 (weak password hashing).
**Acceptance:** a full multi-user flow (signup request → approve → login → use the app) works end to end without LOCAL_AUTH_BYPASS; a Workspace-B user cannot fetch a Workspace-A artifact by any path.

### Phase 2 — Broken Product Flows (2–4 days)
F-5 (frozen extraction data), F-6 (CLICK risk self-assessment), F-8 (schedule sync), agent-version delete (implement or remove the button), CSV export routing fix, purge AGENTS/SCHEDULES targets.
**Acceptance:** `demo-e2e.mjs` extended with a data-change assertion for F-5; disabling a schedule provably stops execution.

### Phase 3 — Complete CRUD & UI Honesty (2–3 days)
Wire Slack frontend to the real backend or remove the misleading "Coming Soon" label; build one reusable `ConfirmDialog`/`Toast` component and migrate the 44 native-dialog sites (destructive-action ones first); fix the settings error-masking (F-13's sibling UI issue).
**Acceptance:** zero `window.alert`/`confirm`/`prompt` remain in `apps/web/src`.

### Phase 4 — Worker & Async Reliability (2–3 days)
Implement real run cancellation (worker polls status mid-loop), tighten `ALLOW_PRIVATE_DEMO` scoping (F-14), timing-safe internal token compare (F-15), remove `apps/api/service-account.json` and add ignore patterns (F-16).

### Phase 5 — AI/Recovery Hardening (2 days)
Independent risk-floor classifier for F-6; document/scope the `MOCK_AI` demo experience honestly (F-4) or make the mock plan input-reflective.

### Phase 6 — Observability (1–2 days)
Wire `packages/observability` into request/run lifecycle with correlation IDs; register a real OTel SDK+exporter or remove the unused `tracer` export; add Cloud Monitoring dashboards/alerts for run failure rate, recovery rate, approval backlog age.

### Phase 7 — Testing (3–5 days, ongoing)
Unit tests for `packages/security` (SSRF/domain-boundary — highest priority given it's the core safety control) and `packages/workflow-engine`; integration tests for the 10 API controllers' authorization boundaries (specifically an automated regression test for F-7-style role misconfigurations).

### Phase 8 — Infrastructure Completion (2–3 days)
Move Cloud Run services + Pub/Sub subscription into Terraform; `--frozen-lockfile` in all Dockerfiles; add a deploy health-check/rollback gate to `cloudbuild.yaml`.

### Phase 9 — Enterprise Readiness Pass (ongoing)
Backups/retention policy documentation, disaster-recovery runbook, rate limiting on public endpoints (`slack/callback`, `schedules/:id/trigger`, the artifact endpoint post-fix), CORS review beyond the single hardcoded default origin.

---

## 26. Final Decision

### Current project state: **Functional hackathon build**, with one subsystem (fast-path execution + self-healing + Terraform IAM) built to a genuinely pre-production standard.

This is not a demo prototype — the core mechanism works, is well-tested by its one E2E script, and the security scaffolding around it (SSRF guard, sandboxed patch verification, independent-verifier gating, least-privilege IAM) reflects real engineering care. But it is also not pre-production as a whole system: the primary alternate authentication path is completely broken, there is a live workspace-isolation bug in the artifact endpoint, there is no CI and no real test suite protecting any of this from regressing, and the flagship demo doesn't exercise the AI it exists to showcase. A system with an active, exploitable access-control bug and no CI cannot be called pre-production regardless of how good its best subsystem is.

### What must be completed before any production deployment — a definitive checklist:

- [ ] F-1: Fix or remove the email/password login path (real Firebase token bridge, or delete the feature and its UI)
- [ ] F-2: Fix the duplicate-email upsert crash in `AuthGuard`
- [ ] F-3: Lock down the public artifact-download endpoint (this is the one true active vulnerability — do not deploy multi-tenant with this open)
- [ ] F-7: Fix the `VIEWER`-can-delete role misconfiguration
- [ ] F-11: Replace SHA-256+static-salt password hashing with bcrypt/argon2
- [ ] F-9: Stand up CI (lint/typecheck/test/build) as a merge gate
- [ ] F-10: Add real unit tests for `packages/security` and `packages/workflow-engine` at minimum
- [ ] F-5: Fix or structurally prevent frozen-data replay on fast-path EXTRACT/DONE
- [ ] F-8: Fix schedule update/disable to actually propagate to Cloud Scheduler
- [ ] Remove all `LOCAL_*`/`MOCK_AI`/`LOCAL_AUTH_BYPASS`/`ALLOW_PRIVATE_DEMO` bypass flags from any production environment file, and add a startup assertion that refuses to boot with any of them set to `true` when `NODE_ENV=production`
- [ ] F-16: Remove the committed empty `service-account.json` and ignore the pattern
- [ ] Decide and execute on Slack: wire the frontend, or remove the misleading "Coming Soon" claim
- [ ] Add the deploy health-check/rollback gate to `cloudbuild.yaml` before this pipeline is trusted with real traffic

This audit intentionally stops here. Per your instructions, no fixes have been applied — this document and the accompanying `REPOSITORY_AUDIT/*.md` files are the complete findings, awaiting your prioritization before any implementation phase begins.
