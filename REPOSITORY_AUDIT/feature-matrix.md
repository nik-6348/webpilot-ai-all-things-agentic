# Feature Trace Matrix

UI / API / DB / Worker / GCP / Tests / Status, for every major product feature. Status legend: ✅ implemented & wired · 🟡 partial · 🔴 not implemented · 🟣 broken · 🔵 implemented but not integrated · N/A not applicable to this feature.

| Feature | UI | API | DB | Worker | GCP | Tests | Status |
|---|---|---|---|---|---|---|---|
| Google Sign-In | ✅ | ✅ | ✅ | N/A | ✅ | ❌ | Working |
| Email/password login | ✅ | ✅ | ✅ | N/A | N/A | ❌ | 🟣 Broken — no session token ever issued (F-1) |
| Self-service onboarding (Request Access → approve → login) | ✅ | ✅ | ✅ | N/A | ✅ (email) | ❌ | 🟣 Broken end-to-end (F-1, F-2) |
| Agent creation + AI plan | ✅ | ✅ | ✅ | N/A | ✅ | 🟡 (demo path mocked) | Partial |
| Plan approval | ✅ | ✅ | ✅ | N/A | N/A | ✅ (e2e) | Working |
| Discovery run (live AI navigation) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 (mocked by default) | Working, undertested |
| Fast-path zero-LLM replay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (e2e) | Working, with stale-data caveat (F-5) |
| Self-healing recovery (fail→patch→sandbox-verify→independent-verify→promote→resume) | 🟡 (approval UI lacks impact detail) | ✅ | ✅ | ✅ | ✅ | ✅ (e2e) | Working — best-implemented subsystem |
| Version management (edit / activate / run version) | ✅ | ✅ | ✅ | N/A | ✅ | ❌ | Working |
| Version delete | ✅ (button exists, always fails) | ❌ no route | ❌ | N/A | N/A | ❌ | 🔴 Not implemented (phantom UI feature) |
| Run history / export | ✅ (CSV export link broken) | ✅ | ✅ | N/A | ✅ | ❌ | Partial |
| Schedules (create/list/toggle) | ✅ | 🟡 update doesn't sync to Cloud Scheduler; disabled schedules keep firing (F-8) | ✅ | N/A | 🟡 | ❌ | Partial |
| Connections/credentials vault | ✅ | ✅ | ✅ | ✅ (consumed at run time) | ✅ | ❌ | Working |
| Approvals (plan / recovery / high-risk / CAPTCHA) | ✅ | ✅ | ✅ | ✅ | N/A | ✅ (e2e, partial coverage) | Working |
| CAPTCHA / human-verification pause | 🟡 | ✅ | ✅ | 🟡 (naive text-match detection, likely misses iframe widgets) | N/A | ❌ | Partial |
| Slack integration | ❌ UI says "Coming Soon", zero frontend calls | ✅ (OAuth + HMAC-verified commands, real) | ✅ | N/A | N/A | ❌ | 🔵 Implemented, not integrated |
| Gmail / Google Chat notifications | ❌ no UI at all | 🔵 real code | 🔵 | N/A | 🔵 | ❌ | 🔵 Implemented, unreachable by default (LOCAL_PUBSUB drops the trigger) |
| Analytics dashboard | ✅ | ✅ (real DB-derived, not fake) | ✅ | N/A | N/A | ❌ | Working |
| Audit log | ✅ | ✅ | ✅ | N/A | N/A | ❌ | Working |
| Workspace RBAC | ✅ | ✅ (one role-check bug, F-7) | ✅ | N/A | N/A | ❌ | Working, one confirmed hole |
| Data retention / purge | ✅ (2 of 4 targets do anything) | 🟡 AGENTS/SCHEDULES targets silently no-op | ✅ | N/A | N/A | ❌ | Partial |
| Public artifact access control | — | 🟣 `@Public()` endpoint, path unvalidated against `:id` | — | — | — | ❌ | 🟣 Broken — active access-control bug (F-3) |
| Observability / tracing | N/A | 🔵 package unused anywhere | N/A | 🔵 | 🟡 (APIs enabled, nothing behind them) | ❌ | 🔴 Not really implemented |
| CI/CD | N/A | N/A | N/A | N/A | N/A | ❌ | 🔴 Does not exist |

Full evidence and file:line citations for every row are in `final-gap-report.md` and the three supporting audit files in this folder.
