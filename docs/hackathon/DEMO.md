# 4-minute hackathon demo

## 0:00–0:30 — Problem
Show the landing page and explain that browser automations are cheap when stable but brittle when websites change; fully agentic browsing on every run is flexible but expensive and slower.

## 0:30–1:15 — Teach once
Create **Daily Supplier Monitor** against the demo portal. Show the generated plan/schema, approve it, and open the Run Inspector while the Navigator uses the live browser. End on production `v1.0`.

## 1:15–1:45 — Deterministic repeat
Run the agent again. Highlight `FAST_PATH`, completed extraction, and `modelCallCount = 0` for that run. Compare first-run vs repeat latency/calls.

## 1:45–2:15 — Break reality
Open the demo portal admin page and switch V1 → V2. V2 removes/renames the original Orders locator. Run the same production version.

## 2:15–3:15 — Self-heal
Show:

```text
FAST_PATH_FAILED
→ screenshot + compact DOM captured
→ Recovery Agent diagnoses locator drift
→ minimal failed-step patch
→ sandbox replay
→ independent Verifier PASS
→ v1.1-draft → v1.1 production
→ run resumes and extracts records
```

Show the immutable version list and the recovery attempt evidence.

## 3:15–3:40 — Human control
Show Approvals. Explain that high-risk actions and CAPTCHA/human verification do not auto-execute; they checkpoint and wait for an authorized person.

## 3:40–4:00 — Google Cloud proof
Show Cloud Run services, Cloud SQL, Cloud Tasks, Pub/Sub, GCS, Secret Manager and Vertex AI/Cloud logs. Close with:

> Gemini is the mind when intelligence is needed. WebPilot turns the learned work into deterministic execution and wakes Gemini up again only when reality changes.
