"use client";
import { useEffect, useState } from "react";
import { api, workspace } from "../../../lib/api";
export default function Schedules() {
  const [s, setS] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [agentId, setAgentId] = useState("");
  const [cron, setCron] = useState("0 9 * * *");
  async function load() {
    const w = await workspace();
    if (!w) return;
    const [ss, aa] = await Promise.all([
      api<any[]>(`/api/v1/schedules?workspaceId=${w.id}`),
      api<any[]>(`/api/v1/agents?workspaceId=${w.id}`),
    ]);
    setS(ss);
    setAgents(aa);
    if (!agentId && aa[0]) setAgentId(aa[0].id);
  }
  useEffect(() => {
    load();
  }, []);
  async function create(e: any) {
    e.preventDefault();
    const w = await workspace();
    await api("/api/v1/schedules", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: w.id,
        agentId,
        name: "Daily automation",
        cronExpression: cron,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    load();
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Background execution</div>
          <h1>Schedules</h1>
        </div>
      </div>
      <div className="cols2">
        <form className="card form" onSubmit={create}>
          <div className="field">
            <label>Agent</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cron expression</label>
            <input value={cron} onChange={(e) => setCron(e.target.value)} />
          </div>
          <button className="btn primary">Create Cloud Scheduler job</button>
        </form>
        <div className="card">
          <h3>Configured schedules</h3>
          <table className="table">
            <tbody>
              {s.map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.name}</b>
                    <div className="muted">{x.agent.name}</div>
                  </td>
                  <td>
                    <code>{x.cronExpression}</code>
                    <div className="muted">{x.timezone}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!s.length && <div className="empty">No schedules yet.</div>}
        </div>
      </div>
    </>
  );
}
