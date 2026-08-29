const API = process.env.API_BASE || "http://localhost:4000/api/v1";
const DEMO = process.env.DEMO_BASE || "http://localhost:4200";
const j = async (url, init = {}) => {
  const r = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};
async function waitRun(id) {
  for (let i = 0; i < 90; i++) {
    const r = await j(`${API}/runs/${id}`);
    if (r.status === "COMPLETED") return r;
    if (["FAILED", "REJECTED", "CANCELLED"].includes(r.status))
      throw new Error(JSON.stringify(r));
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("run timeout");
}
let health = await j(`${DEMO}/health/live`);
if (health.version !== "v1")
  await fetch(`${DEMO}/admin/toggle`, { method: "POST", redirect: "manual" });
if (health.challenge)
  await fetch(`${DEMO}/admin/challenge`, {
    method: "POST",
    redirect: "manual",
  });
let ws = (await j(`${API}/workspaces`))[0]?.workspace;
if (!ws)
  ws = await j(`${API}/workspaces`, {
    method: "POST",
    body: JSON.stringify({ name: "E2E", slug: `e2e-${Date.now()}` }),
  });
const created = await j(`${API}/agents`, {
  method: "POST",
  body: JSON.stringify({
    workspaceId: ws.id,
    name: `Supplier Monitor ${Date.now()}`,
    goal: "Open purchase orders and extract ID, supplier, status, ETA and amount.",
    targetUrl: "http://demo-portal:4200",
    allowedDomains: ["demo-portal"],
    requirePlanApproval: true,
  }),
});
const aps = await j(`${API}/approvals?workspaceId=${ws.id}`);
const plan = aps.find((x) => x.runId === created.run.id);
if (!plan) throw new Error("plan approval missing");
await j(`${API}/approvals/${plan.id}/approve`, { method: "POST" });
const first = await waitRun(created.run.id);
if (!first.version || first.version.label !== "v1.0")
  throw new Error("v1.0 not learned");
const second = await j(`${API}/runs`, {
  method: "POST",
  body: JSON.stringify({ agentId: created.agent.id, triggerType: "MANUAL" }),
});
const secondDone = await waitRun(second.id);
if (secondDone.modelCallCount !== 0)
  throw new Error(`fast path used ${secondDone.modelCallCount} model calls`);
await fetch(`${DEMO}/admin/toggle`, { method: "POST", redirect: "manual" });
const third = await j(`${API}/runs`, {
  method: "POST",
  body: JSON.stringify({ agentId: created.agent.id, triggerType: "MANUAL" }),
});
const healed = await waitRun(third.id);
if (healed.recoveryCount < 1) throw new Error("recovery did not run");
const agent = await j(`${API}/agents/${created.agent.id}`);
if (
  !agent.versions.some((v) => v.label === "v1.1" && v.status === "PRODUCTION")
)
  throw new Error("v1.1 not promoted");
console.log("DEMO E2E PASS", {
  first: first.id,
  fast: secondDone.id,
  healed: healed.id,
});
