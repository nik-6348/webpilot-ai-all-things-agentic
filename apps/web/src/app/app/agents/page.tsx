"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, workspace } from "../../../lib/api";
export default function Agents() {
  const [a, setA] = useState<any[]>([]);
  useEffect(() => {
    workspace()
      .then((w) => w && api(`/api/v1/agents?workspaceId=${w.id}`))
      .then((x) => x && setA(x));
  }, []);
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Agent directory</div>
          <h1>Agents</h1>
        </div>
        <Link className="btn primary" href="/app/agents/new">
          Create agent
        </Link>
      </div>
      <div className="card">
        {a.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Active version</th>
                <th>Runs</th>
              </tr>
            </thead>
            <tbody>
              {a.map((x) => (
                <tr key={x.id}>
                  <td>
                    <Link href={`/app/agents/${x.id}`}>
                      <b>{x.name}</b>
                    </Link>
                    <div className="muted">{x.description}</div>
                  </td>
                  <td>
                    <span className="badge good">{x.status}</span>
                  </td>
                  <td>{x.activeVersionId ? "Production" : "Learning"}</td>
                  <td>
                    <Link href={`/app/runs?agentId=${x.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">No agents yet.</div>
        )}
      </div>
    </>
  );
}
