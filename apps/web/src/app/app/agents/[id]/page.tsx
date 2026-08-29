"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../lib/api";
export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [a, setA] = useState<any>();
  const [approval, setApproval] = useState<any>();
  const [draftText, setDraftText] = useState("");
  async function load() {
    const x = await api<any>(`/api/v1/agents/${id}`);
    setA(x);
    const draft = x.versions.find((v: any) => v.status === "DRAFT");
    setDraftText(draft ? JSON.stringify(draft.workflowSpec, null, 2) : "");
    const aps = await api<any[]>(
      `/api/v1/approvals?workspaceId=${x.workspaceId}`,
    );
    setApproval(aps.find((p) => p.run?.agentId === id && p.type === "PLAN"));
  }
  useEffect(() => {
    load();
  }, [id]);
  async function approve() {
    await api(`/api/v1/approvals/${approval.id}/approve`, { method: "POST" });
    await load();
  }
  async function run() {
    const out: any = await api("/api/v1/runs", {
      method: "POST",
      body: JSON.stringify({ agentId: id, triggerType: "MANUAL" }),
    });
    router.push(`/app/runs/${out.id}`);
  }
  async function saveDraft() {
    const v = a.versions.find((v: any) => v.status === "DRAFT");
    await api(`/api/v1/agents/${id}/versions/${v.id}`, {
      method: "PATCH",
      body: JSON.stringify({ workflowSpec: JSON.parse(draftText) }),
    });
    load();
  }
  async function activate(v: any) {
    await api(`/api/v1/agents/${id}/versions/${v.id}/activate`, {
      method: "POST",
    });
    load();
  }
  async function runVersion(v: any) {
    const out: any = await api(`/api/v1/agents/${id}/versions/${v.id}/run`, {
      method: "POST",
    });
    router.push(`/app/runs/${out.id}`);
  }
  if (!a) return <div className="muted">Loading…</div>;
  const draft = a.versions.find((v: any) => v.status === "DRAFT");
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Agent</div>
          <h1>{a.name}</h1>
          <p className="muted">{a.goal}</p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={run}>
            Run now
          </button>
          <span className="badge good">{a.status}</span>
        </div>
      </div>
      {draft && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Draft WorkflowSpec & schema</h3>
          <p className="muted">
            Edit the typed workflow before approval. The model cannot widen your
            approved domain boundary.
          </p>
          <textarea
            className="code"
            style={{ width: "100%", minHeight: 360 }}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
          />
          <div className="actions">
            <button className="btn" onClick={saveDraft}>
              Save draft
            </button>
            {approval && (
              <button className="btn primary" onClick={approve}>
                Approve & run
              </button>
            )}
          </div>
        </div>
      )}
      <div className="grid3">
        <div className="card">
          <div className="muted">Active version</div>
          <div className="metric">
            {a.versions.find((v: any) => v.status === "PRODUCTION")?.label ||
              "—"}
          </div>
        </div>
        <div className="card">
          <div className="muted">Versions</div>
          <div className="metric">{a.versions.length}</div>
        </div>
        <div className="card">
          <div className="muted">Recent runs</div>
          <div className="metric">{a.runs.length}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Immutable version history</h3>
        <table className="table">
          <tbody>
            {a.versions.map((v: any) => (
              <tr key={v.id}>
                <td>
                  <b>{v.label}</b>
                </td>
                <td>{v.source}</td>
                <td>
                  <span className="badge">{v.status}</span>
                </td>
                <td>
                  <button className="btn" onClick={() => runVersion(v)}>
                    Run
                  </button>{" "}
                  {v.status !== "PRODUCTION" && (
                    <button className="btn" onClick={() => activate(v)}>
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
