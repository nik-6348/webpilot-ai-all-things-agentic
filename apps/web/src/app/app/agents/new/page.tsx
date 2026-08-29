"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, workspace } from "../../../../lib/api";
export default function NewAgent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    name: "Daily Supplier Monitor",
    description: "Tracks supplier purchase-order exceptions",
    goal: "Every day open the supplier portal, go to purchase orders, extract PO ID, supplier, status, ETA and amount, then flag delayed orders.",
    targetUrl: "http://demo-portal:4200",
    allowedDomains: "demo-portal",
  });
  useEffect(() => {
    workspace()
      .then((w) => w && api<any[]>(`/api/v1/connections?workspaceId=${w.id}`))
      .then((x) => x && setConnections(x));
  }, []);
  async function submit(e: any) {
    e.preventDefault();
    setLoading(true);
    try {
      const w = await workspace();
      const out = await api<any>("/api/v1/agents", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          workspaceId: w.id,
          allowedDomains: form.allowedDomains.split(",").map((x) => x.trim()),
          connectionId: connectionId || undefined,
          requirePlanApproval: true,
        }),
      });
      router.push(`/app/agents/${out.agent.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Agent studio</div>
          <h1>Describe the work</h1>
          <p className="muted">
            Gemini will turn this into an approval-ready plan and extraction
            schema.
          </p>
        </div>
      </div>
      <form className="card form" onSubmit={submit}>
        <div className="cols2">
          <Field label="Agent name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Target URL">
            <input
              value={form.targetUrl}
              onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
            />
          </Field>
        </div>
        <Field label="What should WebPilot do?">
          <textarea
            value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value })}
          />
        </Field>
        <Field label="Allowed domains">
          <input
            value={form.allowedDomains}
            onChange={(e) =>
              setForm({ ...form, allowedDomains: e.target.value })
            }
          />
        </Field>
        <Field label="Authorized connection">
          <select
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
          >
            <option value="">No login required</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <button className="btn primary" disabled={loading}>
          {loading ? "Gemini is planning…" : "Generate plan"}
        </button>
        {err && <div className="danger">{err}</div>}
      </form>
    </>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
