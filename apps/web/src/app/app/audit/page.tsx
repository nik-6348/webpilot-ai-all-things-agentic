"use client";
import { useEffect, useState } from "react";
import { api, workspace } from "../../../lib/api";
export default function Audit() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    workspace()
      .then((w) => w && api<any[]>(`/api/v1/audit?workspaceId=${w.id}`))
      .then((x) => x && setRows(x));
  }, []);
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Append-only history</div>
          <h1>Audit log</h1>
          <p className="muted">
            Consequential workspace actions are recorded for review.
          </p>
        </div>
      </div>
      <div className="card table">
        <div className="tr head">
          <span>Time</span>
          <span>Action</span>
          <span>Resource</span>
          <span>Actor</span>
        </div>
        {rows.map((r) => (
          <div className="tr" key={r.id}>
            <span>{new Date(r.createdAt).toLocaleString()}</span>
            <span>{r.action}</span>
            <span>
              {r.resourceType}
              {r.resourceId ? ` · ${r.resourceId.slice(0, 8)}` : ""}
            </span>
            <span>{r.actorId?.slice(0, 8) || "system"}</span>
          </div>
        ))}
        {!rows.length && <p className="muted">No audit events yet.</p>}
      </div>
    </>
  );
}
