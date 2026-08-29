"use client";
import { useEffect, useState } from "react";
import { api, workspace } from "../../../lib/api";
export default function Approvals() {
  const [a, setA] = useState<any[]>([]);
  async function load() {
    const w = await workspace();
    if (w) setA(await api(`/api/v1/approvals?workspaceId=${w.id}`));
  }
  useEffect(() => {
    load();
  }, []);
  async function act(id: string, verb: string) {
    await api(`/api/v1/approvals/${id}/${verb}`, { method: "POST" });
    load();
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Human-in-the-loop</div>
          <h1>Approvals</h1>
        </div>
      </div>
      <div className="grid3">
        {a.map((x) => (
          <div className="card" key={x.id}>
            <span className="badge warn">{x.type}</span>
            <h3>{x.run?.agent?.name || "WebPilot"}</h3>
            <p className="muted">{x.reason}</p>
            <div className="actions">
              <button
                className="btn primary"
                onClick={() => act(x.id, "approve")}
              >
                Approve
              </button>
              <button className="btn" onClick={() => act(x.id, "reject")}>
                Reject
              </button>
            </div>
          </div>
        ))}
        {!a.length && (
          <div className="card empty">Nothing needs your attention.</div>
        )}
      </div>
    </>
  );
}
