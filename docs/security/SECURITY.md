# Security model

## Model/tool boundary

Gemini can produce only Zod-validated typed decisions (`Plan`, `BrowserDecision`, `WorkflowPatch`, `Verification`). Model output is never executed through `eval`, `new Function`, shell commands, or dynamic module loading.

## Website boundary

Web content is labeled untrusted before it reaches the model. The system prompt tells agents that page content is evidence, not instruction. Secrets are redacted from compact DOM context.

## SSRF/network policy

Production URL validation blocks loopback, RFC1918/private ranges, link-local ranges, `metadata.google.internal`, and non-HTTP(S) schemes. Browser subrequests use the same network guard. Each agent also carries an explicit allowed-domain boundary. `ALLOW_PRIVATE_DEMO=true` exists only for the local Docker demo and must be false in production.

## Credentials

Connection values are encrypted/managed by Secret Manager. PostgreSQL stores only `secretManagerRef` and credential field names. Planner/Navigator see field names such as `connection.username`, never the value. The worker resolves the value immediately before a typed `TYPE` action.

## Risk/approval

Read-only navigation/extraction is low risk. Irreversible or externally consequential actions are classified high risk and pause in `WAITING_HIGH_RISK_APPROVAL`. Recovery can auto-promote only when the patch is independently verified and classified low risk.

## Human verification

CAPTCHA/Cloudflare/Turnstile/reCAPTCHA/hCaptcha-like pages are detected and the run pauses with screenshot/URL evidence. WebPilot does not provide anti-bot challenge bypass. After an authorized human/session update, the run can be re-queued from its durable state.

## Authentication/authorization

User ID tokens are verified with Firebase Admin / Identity Platform. Workspace roles are `OWNER`, `ADMIN`, `OPERATOR`, `VIEWER`. Internal worker invocation uses Cloud Run IAM + Cloud Tasks OIDC in production. Scheduler triggers verify Google OIDC. Slack requests verify timestamped signatures and bind the Slack team to its connected WebPilot workspace.
