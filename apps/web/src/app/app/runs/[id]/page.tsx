"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";
export default function Run() {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<any>();
  useEffect(() => {
    const load = () => api(`/api/v1/runs/${id}`).then(setR);
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [id]);
  if (!r) return <div className="muted">Loading run…</div>;
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Run inspector</div>
          <h1>{r.agent.name}</h1>
          <p className="muted">{r.id}</p>
        </div>
        <span className="badge good">{r.status}</span>
      </div>
      <div className="stats">
        <Stat l="Mode" v={r.executionMode} />
        <Stat l="Gemini calls" v={r.modelCallCount} />
        <Stat l="Recovery attempts" v={r.recoveryCount} />
        <Stat l="Version" v={r.version?.label || "Learning"} />
      </div>
      <div className="runGrid">
        <div className="card">
          <h3>Autonomous timeline</h3>
          {r.events.map((e: any) => (
            <div className="eventLine" key={e.id}>
              <b>{e.eventType}</b>
              <div className="muted">{e.message}</div>
              <small className="muted">
                {new Date(e.createdAt).toLocaleTimeString()}
              </small>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Result</h3>
          <pre className="code">
            {JSON.stringify(r.result || { status: r.status }, null, 2)}
          </pre>
          <h3>Recovery evidence</h3>
          <pre className="code">{JSON.stringify(r.recoveries, null, 2)}</pre>
        </div>
      </div>
    </>
  );
}
function Stat({ l, v }: { l: string; v: any }) {
  return (
    <div className="card">
      <div className="muted">{l}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
    </div>
  );
}
