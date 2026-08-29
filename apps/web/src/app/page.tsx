"use client";
import { useEffect, useState } from "react";
import { api, workspace } from "../lib/api";
import Link from "next/link";
export default function Dashboard() {
  const [data, setData] = useState<any>();
  useEffect(() => {
    workspace()
      .then(
        (w: { id: string } | null) =>
          w && api(`/api/v1/analytics?workspaceId=${w.id}`),
      )
      .then(setData);
  }, []);
  const d = data || {};
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Command center</div>
          <h1>Autonomous operations</h1>
          <p className="muted">
            See what WebPilot is doing, what it healed, and where it needs you.
          </p>
        </div>
        <Link className="btn primary" href="/app/agents/new">
          New agent
        </Link>
      </div>
      <div className="stats">
        <Stat label="Runs" value={d.runs ?? "—"} />
        <Stat label="Completed" value={d.completed ?? "—"} />
        <Stat label="Zero-LLM runs" value={d.zeroLlm ?? "—"} />
        <Stat label="Model calls" value={d.modelCalls ?? "—"} />
      </div>
      <div className="card">
        <h3>Architecture signal</h3>
        <p className="muted">
          Healthy repeat runs should trend toward{" "}
          <b style={{ color: "white" }}>zero model calls</b>. Gemini is reserved
          for first-time understanding and recovery.
        </p>
      </div>
    </>
  );
}
function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="card">
      <div className="muted">{label}</div>
      <div className="metric">{value}</div>
    </div>
  );
}
