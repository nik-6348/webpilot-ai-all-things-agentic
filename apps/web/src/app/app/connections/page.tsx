"use client";
import { useEffect, useState } from "react";
import { api, workspace } from "../../../lib/api";
export default function Connections() {
  const [c, setC] = useState<any[]>([]);
  const [name, setName] = useState("Supplier Portal");
  const [domain, setDomain] = useState("portal.example.com");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  async function load() {
    const w = await workspace();
    if (w) setC(await api(`/api/v1/connections?workspaceId=${w.id}`));
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e: any) {
    e.preventDefault();
    const w = await workspace();
    await api("/api/v1/connections", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: w.id,
        name,
        allowedDomains: [domain],
        credentials: { username: user, password: pass },
      }),
    });
    setPass("");
    load();
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="kicker">Secret Manager vault</div>
          <h1>Connections</h1>
          <p className="muted">
            Credentials never enter prompts or generated workflows.
          </p>
        </div>
      </div>
      <div className="cols2">
        <form className="card form" onSubmit={save}>
          <Field l="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field l="Allowed domain">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} />
          </Field>
          <Field l="Username">
            <input value={user} onChange={(e) => setUser(e.target.value)} />
          </Field>
          <Field l="Password">
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </Field>
          <button className="btn primary">Store securely</button>
        </form>
        <div className="card">
          <h3>Configured connections</h3>
          {c.map((x) => (
            <div
              key={x.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <b>{x.name}</b>
              <div className="muted">
                {(x.credentialFields || []).join(", ")} • configured
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{l}</label>
      {children}
    </div>
  );
}
