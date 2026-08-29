import { NextRequest, NextResponse } from "next/server";
async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const base = process.env.API_URL || "http://localhost:4000";
  const target = new URL(`/${path.join("/")}`, base);
  req.nextUrl.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  const headers = new Headers(req.headers);
  headers.delete("host");
  const body = ["GET", "HEAD"].includes(req.method)
    ? undefined
    : await req.text();
  const r = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });
  return new NextResponse(r.body, { status: r.status, headers: r.headers });
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const PUT = proxy;
