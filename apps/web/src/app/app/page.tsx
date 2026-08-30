"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Play,
  Zap,
  Bot,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Activity,
  CheckCircle2
} from "lucide-react";
import { api, workspace } from "../../lib/api";

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const ws = await workspace();
        if (ws?.id) {
          const [anRes, runsRes] = await Promise.all([
            api(`/api/v1/analytics?workspaceId=${ws.id}`).catch(() => null),
            api(`/api/v1/runs?workspaceId=${ws.id}`).catch(() => [])
          ]);
          setAnalytics(anRes);
          if (Array.isArray(runsRes)) {
            setRuns(runsRes.slice(0, 5));
          }
        }
      } catch (e) {
        console.error("Dashboard data load error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleQuickLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    setLaunching(true);

    try {
      const ws = await workspace();
      if (!ws?.id) throw new Error("Workspace not loaded");

      const res = await api("/api/v1/agents", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: ws.id,
          name: `Agent Run ${Date.now()}`,
          goal: quickPrompt,
          targetUrl: "https://google.com",
          allowedDomains: ["*"],
          requirePlanApproval: false
        })
      });

      if (res?.run?.id) {
        window.location.href = `/app/runs/${res.run.id}`;
      } else {
        alert("Run launched! Redirecting to runs...");
        window.location.href = "/app/runs";
      }
    } catch (err: any) {
      alert(err.message || "Failed to launch quick run");
      setLaunching(false);
    }
  };

  const stats = analytics || { runs: 0, completed: 0, zeroLlm: 0, modelCalls: 0 };

  return (
    <div className="space-y-8">
      {/* 🔮 PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
            <Activity className="w-3.5 h-3.5" /> Command Center Operations
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Autonomous Executive Operations</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time analytics, zero-LLM fast path tracking, and live agent activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/app/agents/new"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Create New Agent
          </Link>
        </div>
      </div>

      {/* 📈 STATS METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Play}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10 border-sky-500/30"
          label="Total Agent Executions"
          value={loading ? "..." : stats.runs ?? 0}
          subtitle="Lifetime run count"
        />
        <StatCard
          icon={CheckCircle2}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/30"
          label="Completed Successfully"
          value={loading ? "..." : stats.completed ?? 0}
          subtitle="100% extracted runs"
        />
        <StatCard
          icon={Zap}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10 border-amber-500/30"
          label="Zero-LLM Fast Path Runs"
          value={loading ? "..." : stats.zeroLlm ?? 0}
          subtitle="Instant script execution"
        />
        <StatCard
          icon={Bot}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10 border-indigo-500/30"
          label="Total Model Calls"
          value={loading ? "..." : stats.modelCalls ?? 0}
          subtitle="Gemini AI reasoning calls"
        />
      </div>

      {/* ⚡ QUICK LAUNCHER & ARCHITECTURE SIGNAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launcher Form */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
            <Zap className="w-4 h-4 text-amber-400" /> Instant Task Launcher
          </div>
          <h2 className="text-xl font-black text-white">Execute Autonomous Web Agent Task</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Type any web automation instruction (e.g. login, search products, extract pricing). WebPilot will analyze the page, generate Playwright scripts, and execute automatically.
          </p>

          <form onSubmit={handleQuickLaunch} className="mt-6 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder="e.g. Open https://ai.nik6348.in/ and login with email rajputnik911@gmail.com..."
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={launching || !quickPrompt.trim()}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              {launching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Launching...
                </>
              ) : (
                <>
                  Launch Agent <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Zero-LLM Architecture Signal Card */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
              <TrendingUp className="w-4 h-4" /> Zero-LLM Efficiency
            </div>
            <h3 className="text-base font-extrabold text-white">Fast Path Optimization</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Healthy repeat runs trend toward <b className="text-white font-bold">zero model calls</b>. Gemini AI reasoning is reserved for first-time observation and self-healing. Re-runs execute compiled Playwright scripts in milliseconds!
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-400">Target Fast Path Rate:</span>
            <span className="text-emerald-400 font-mono">98.5% Fast Path</span>
          </div>
        </div>
      </div>

      {/* 📜 RECENT EXECUTIONS TABLE */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-extrabold text-white">Recent Agent Executions</h3>
            <p className="text-xs text-slate-400">Live feed of recent automated task runs.</p>
          </div>
          <Link href="/app/runs" className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1">
            View All Runs <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs rounded-xl bg-slate-950/40 border border-slate-900">
            No agent executions found. Launch a task above to start!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 px-3">Run ID</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Trigger Mode</th>
                  <th className="pb-3 px-3">Created At</th>
                  <th className="pb-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {runs.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-bold text-sky-400">{r.id}</td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        r.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : r.status === "FAILED"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-300">
                      {r.triggerType || "MANUAL"}
                    </td>
                    <td className="py-3.5 px-3 text-slate-400 font-mono">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "Just now"}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <Link
                        href={`/app/runs/${r.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] transition-colors"
                      >
                        Inspect Run
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, iconColor, iconBg, label, value, subtitle }: any) {
  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-3xl font-black text-white tracking-tight">{value}</div>
        <div className="text-[11px] font-medium text-slate-400 mt-1">{subtitle}</div>
      </div>
    </div>
  );
}
