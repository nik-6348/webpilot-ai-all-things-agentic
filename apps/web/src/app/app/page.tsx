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
  CheckCircle2,
  Clock
} from "lucide-react";
import { api, workspace } from "../../lib/api";

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [launching, setLaunching] = useState(false);

  async function loadData() {
    try {
      const ws = await workspace();
      if (ws?.id) {
        const anRes = await api(`/api/v1/analytics?workspaceId=${ws.id}`).catch(() => null);
        setAnalytics(anRes);
      }
    } catch (e) {
      console.error("Dashboard data load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
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
          name: `Public Scraper ${Date.now().toString().slice(-4)}`,
          goal: quickPrompt,
          targetUrl: "https://www.google.com",
          allowedDomains: ["*"],
          requirePlanApproval: true
        })
      });

      if (res?.agent?.id) {
        window.location.href = `/app/agents/${res.agent.id}`;
      } else {
        window.location.href = "/app/agents";
      }
    } catch (err: any) {
      alert(err.message || "Failed to launch quick run");
      setLaunching(false);
    }
  };

  const activeRun = analytics?.activeRun;
  const recentRuns = analytics?.recentRuns || [];

  return (
    <div className="space-y-8">
      {/* 🔮 PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
            <Activity className="w-3.5 h-3.5" /> Executive Control Dashboard
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Autonomous Platform Operations</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time analytics, fast path script speedup, and live agent activity.
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

      {/* 📈 STATS METRICS GRID (DYNAMIC NO HARDCODED METRICS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Direct Script Runs */}
        <div className="glass-panel rounded-2xl p-5 border-purple-500/30 bg-purple-500/5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> DIRECT SCRIPT RUNS
            </span>
            <div className="text-3xl font-black text-white mt-1.5">{loading ? "..." : `${analytics?.directScriptRunsCount ?? 0} Runs`}</div>
            <div className="text-xs text-purple-300/80 font-medium mt-1">Fast-Path Playwright Engine</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
            <Zap className="w-5 h-5 text-purple-300 fill-purple-300/30" />
          </div>
        </div>

        {/* Card 2: Live AI Agent Runs */}
        <div className="glass-panel rounded-2xl p-5 border-sky-500/30 bg-sky-500/5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1">
              🤖 LIVE AI AGENT RUNS
            </span>
            <div className="text-3xl font-black text-white mt-1.5">{loading ? "..." : `${analytics?.aiAgentRunsCount ?? 0} Runs`}</div>
            <div className="text-xs text-sky-300/80 font-medium mt-1">Self-Healing Code Loop</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
            <Bot className="w-5 h-5 text-sky-300" />
          </div>
        </div>

        {/* Card 3: Script Speedup */}
        <div className="glass-panel rounded-2xl p-5 border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> SCRIPT SPEEDUP
            </span>
            <div className="text-3xl font-black text-emerald-400 mt-1.5">
              {analytics?.avgScriptLatStr || "--"} <span className="text-xs font-normal text-slate-400">vs {analytics?.avgAiLatStr || "--"} AI</span>
            </div>
            <div className="text-xs text-emerald-400 font-bold mt-1">
              {analytics?.speedupMultiplier ? `~${analytics.speedupMultiplier} Faster Latency 🚀` : "No Execution Latency Yet"}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Clock className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        {/* Card 4: Total Success Rate */}
        <div className="glass-panel rounded-2xl p-5 border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">TOTAL SUCCESS RATE</span>
            <div className="text-3xl font-black text-white mt-1.5">{loading ? "..." : `${analytics?.successRate ?? 0}%`}</div>
            <div className="text-xs text-slate-400 font-medium mt-1">{analytics?.completedRuns ?? 0} of {analytics?.totalRuns ?? 0} Completed</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* 🌟 ACTIVE TASK EXECUTION BANNER */}
      {activeRun && (
        <div className="glass-panel rounded-2xl p-5 border-sky-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-sky-500/10">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full bg-sky-400 animate-ping"></span>
            <div>
              <span className="text-xs font-extrabold text-sky-300 uppercase tracking-wider block">Active Agent Task Executing</span>
              <Link href={`/app/runs/${activeRun.id}`} className="text-sm font-bold text-white hover:text-sky-300 hover:underline">
                "{activeRun.agentName || activeRun.goal}"
              </Link>
            </div>
          </div>
          <Link href={`/app/runs/${activeRun.id}`} className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center gap-1.5 shrink-0">
            Inspect Execution →
          </Link>
        </div>
      )}

      {/* ⚡ INSTANT QUICK LAUNCHER */}
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
          <Zap className="w-4 h-4 text-amber-400" /> Quick Scraper Prompt Launcher
        </div>
        <h2 className="text-xl font-black text-white">Launch New Autonomous Web Agent</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-xl">
          Enter any web scraping instruction. AI will automatically plan the strategy, build the extraction schema, and redirect you to review the agent configuration.
        </p>

        <form onSubmit={handleQuickLaunch} className="mt-6 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            placeholder="e.g. Open Flipkart, search for mobile phones, sort by price high to low, extract top 2 expensive phones with price and specs..."
            className="flex-1 px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={launching || !quickPrompt.trim()}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {launching ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Analyzing...
              </>
            ) : (
              <>
                Launch Scraper Agent <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
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

        {recentRuns.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs rounded-xl bg-slate-950/40 border border-slate-900">
            No agent executions found. Launch a task above to start!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 px-3">Agent Title</th>
                  <th className="pb-3 px-3">Run ID</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Execution Mode</th>
                  <th className="pb-3 px-3">Created At</th>
                  <th className="pb-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentRuns.map((r: any) => {
                  const isFastPath = r.executionMode === "FAST_PATH" || r.modelCallCount === 0;
                  const durationStr = r.durationSec && parseFloat(r.durationSec) > 0 ? `${parseFloat(r.durationSec).toFixed(2)}S` : "";
                  return (
                    <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-3 font-extrabold text-white">
                        <Link href={`/app/runs/${r.id}`} className="hover:text-sky-400 transition-colors">
                          {r.agentName}
                        </Link>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-400 text-[11px]">{r.id}</td>
                      <td className="py-3.5 px-3">
                        {r.status === "COMPLETED" ? (
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10">
                            COMPLETED
                          </span>
                        ) : r.status === "FAILED" ? (
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-500/10">
                            FAILED
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/40 shadow-sm shadow-sky-500/10 animate-pulse">
                            {r.status || "RUNNING"}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {isFastPath ? (
                          <span className="px-3.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20 inline-flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-purple-400" /> ⚡ DIRECT SCRIPT {durationStr ? `(${durationStr})` : ""}
                          </span>
                        ) : (
                          <span className="px-3.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/40 shadow-sm shadow-sky-500/20 inline-flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-sky-400" /> 🤖 LIVE AI AGENT {durationStr ? `(${durationStr})` : ""}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 font-mono">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "Just now"}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <Link
                          href={`/app/runs/${r.id}`}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                        >
                          Inspect <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
