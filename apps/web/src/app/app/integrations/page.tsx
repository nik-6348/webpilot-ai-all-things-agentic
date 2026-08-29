"use client";
import { useEffect, useState } from "react";
import { api, workspace } from "../../../lib/api";
export default function Integrations() {
  const [i, setI] = useState<any[]>([]);
  const [w, setW] = useState<any>();
  async function load() {
    const x = await workspace();
    setW(x);
    if (x) setI(await api(`/api/v1/integrations?workspaceId=${x.id}`));
  }
  useEffect(() => {
    load();
  }, []);
  async function connectSlack() {
    const x: any = await api("/api/v1/integrations/slack/connect", {
      method: "POST",
      body: JSON.stringify({ workspaceId: w.id }),
    });
    location.href = x.url;
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Triggers & notifications</div>
          <h1>Integrations</h1>
        </div>
      </div>
      <div className="grid3">
        <div className="card">
          <h3>Slack</h3>
          <p className="muted">
            Signed commands, triggers, approvals and notifications.
          </p>
          <button className="btn primary" onClick={connectSlack}>
            {i.some((x) => x.provider === "SLACK")
              ? "Reconnect"
              : "Connect Slack"}
          </button>
        </div>
        <div className="card">
          <h3>Gmail</h3>
          <p className="muted">
            Google-native email notifications via the Gmail API.
          </p>
          <span className="badge">Secret Manager configured</span>
        </div>
        <div className="card">
          <h3>Google Chat</h3>
          <p className="muted">Operational events and human approval alerts.</p>
          <span className="badge">Webhook adapter</span>
        </div>
      </div>
    </>
  );
}
