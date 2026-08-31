"use client";
import { getFirebaseAuth } from "./firebase";
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) {
    headers.set("Content-Type", "application/json");
  } else if (init.method && ["POST", "PUT", "PATCH"].includes(init.method.toUpperCase())) {
    init.body = JSON.stringify({});
    headers.set("Content-Type", "application/json");
  }
  if (process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS !== "true") {
    const auth = getFirebaseAuth();
    const token = await auth?.currentUser?.getIdToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const isServer = typeof window === "undefined";
  const targetUrl = isServer
    ? `${process.env.INTERNAL_API_URL || "http://localhost:4000"}${path}`
    : `/backend${path}`;

  const r = await fetch(targetUrl, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!r.ok) throw new Error((await r.text()) || `${r.status}`);
  return r.json();
}
export async function workspace() {
  const rows = await api<any[]>("/api/v1/workspaces");
  if (!Array.isArray(rows) || rows.length === 0) return null;

  if (typeof window !== "undefined") {
    const savedId = localStorage.getItem("webpilot_workspace_id");
    if (savedId) {
      const match = rows.find((r) => r.workspaceId === savedId || r.workspace?.id === savedId);
      if (match?.workspace) return match.workspace;
    }
  }
  return rows[0]?.workspace || null;
}
