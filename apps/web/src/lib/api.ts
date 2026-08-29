"use client";
import { getFirebaseAuth } from "./firebase";
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS !== "true") {
    const auth = getFirebaseAuth();
    const token = await auth?.currentUser?.getIdToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const r = await fetch(`/backend${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!r.ok) throw new Error((await r.text()) || `${r.status}`);
  return r.json();
}
export async function workspace() {
  const rows = await api<any[]>("/api/v1/workspaces");
  return rows[0]?.workspace || null;
}
