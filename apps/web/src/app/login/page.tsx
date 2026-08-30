"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ShieldCheck, ArrowRight, Lock } from "lucide-react";
import { googleLogin } from "../../lib/firebase";
import { api } from "../../lib/api";

export default function Login() {
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setErr("");
    try {
      if (process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS !== "true") {
        await googleLogin();
      }
      const ws = await api<any[]>("/api/v1/workspaces");
      if (!ws || !ws.length) {
        await api("/api/v1/workspaces", {
          method: "POST",
          body: JSON.stringify({
            name: "My WebPilot Workspace",
            slug: `workspace-${Date.now()}`,
          }),
        });
      }
      router.push("/app");
    } catch (e: any) {
      setErr(e.message || "Login authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full glass-panel rounded-3xl p-8 relative z-10 space-y-6 text-center shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-cyan-400 p-[1px] mx-auto shadow-lg shadow-indigo-500/25">
          <div className="w-full h-full bg-[#0d1322] rounded-[15px] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-cyan-400" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
            WebPilot<span className="text-cyan-400 font-mono">.AI</span>
          </h1>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
            Autonomous Enterprise RPA Platform
          </span>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Continue with your authorized credentials to access your autonomous web RPA workspace.
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Authenticating...
            </>
          ) : (
            <>
              Continue to Workspace <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {err && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400">
            ❌ {err}
          </div>
        )}

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] font-mono text-slate-500">
          <Lock className="w-3 h-3 text-emerald-400" /> Enterprise AES-256 Workspace Protection
        </div>
      </div>
    </div>
  );
}
