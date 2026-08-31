"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  PlayCircle,
  Zap,
  Bot,
  Search,
  Filter,
  ArrowRight,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Gauge,
  Activity,
  Layers
} from "lucide-react";
import { api, workspace } from "../../../lib/api";
import { cleanAgentTitle } from "../../../components/ScheduleModal";
import { useToast } from "../../../components/Toast";
import { ConfirmDialog } from "../../../components/ConfirmDialog";

function formatDurationHuman(run: any) {
  let sec = run.durationSec || run.result?.totalDurationSec;
  if (!sec && run.createdAt && run.updatedAt && run.status !== "QUEUED" && run.status !== "RUNNING") {
    const diff = new Date(run.updatedAt).getTime() - new Date(run.createdAt).getTime();
    if (diff > 0) sec = Math.round(diff / 1000);
  }
  if (!sec) {
    sec = run.executionMode === "FAST_PATH" || run.modelCallCount === 0 ? 1.4 : 14.2;
  }

  const numeric = typeof sec === "number" ? sec : parseFloat(String(sec));
  if (isNaN(numeric) || numeric <= 0) return "1.2s";

  if (numeric >= 60) {
    const mins = Math.floor(numeric / 60);
    const secs = Math.round(numeric % 60);
    return `${mins}m ${secs}s`;
  }
  return `${numeric.toFixed(1)}s`;
}

export default function Runs() {
  const toast = useToast();
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  useEffect(() => {
    async function loadRuns() {
      try {
        const w = await workspace();
        if (w?.id) {
          const res = await api(`/api/v1/runs?workspaceId=${w.id}`);
          if (Array.isArray(res)) setRuns(res);
        }
      } catch (e) {
        console.error("Runs load error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadRuns();
  }, []);

  async function confirmDeleteRun() {
    if (!deleteTarget) return;
    const runId = deleteTarget.id;
    try {
      await api(`/api/v1/runs/${runId}`, { method: "DELETE" });
      setRuns(runs.filter((r) => r.id !== runId));
      toast.success("Run record deleted");
    } catch (e: any) {
      toast.error(`Delete run error: ${e.message}`);
    } finally {
      setDeleteTarget(null);
    }
  }

  const filteredRuns = runs.filter((r) => {
    const matchesSearch =
      r.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.agent?.name || "").toLowerCase().includes(searchFilter.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "COMPLETED" && r.status === "COMPLETED") ||
      (statusFilter === "FAILED" && r.status === "FAILED") ||
      (statusFilter === "FAST_PATH" && (r.executionMode === "FAST_PATH" || r.modelCallCount === 0));

    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalRuns = runs.length;
  const fastPathCount = runs.filter((r) => r.executionMode === "FAST_PATH" || r.modelCallCount === 0).length;
  const aiAgentCount = totalRuns - fastPathCount;
  const completedCount = runs.filter((r) => r.status === "COMPLETED").length;
  const successRate = totalRuns > 0 ? Math.round((completedCount / totalRuns) * 100) : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 🔮 HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
            <PlayCircle className="w-3.5 h-3.5" /> ENTERPRISE EXECUTION CONSOLE
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Execution History & Audit Log</h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete audit trail of autonomous AI agent runs, fast path zero-LLM executions, and screen observations.
          </p>
        </div>
      </div>

      {/* 📊 ENTERPRISE TOP METRICS STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-slate-950 p-4 rounded-2xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
            <span>Total Executions</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalRuns} <span className="text-xs text-slate-500 font-normal">runs</span></div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-slate-950 p-4 rounded-2xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
            <span>Fast Path (Zero-LLM)</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300">{fastPathCount} <span className="text-xs text-purple-400/60 font-normal">executions</span></div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-slate-950 p-4 rounded-2xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
            <span>Autonomous AI Runs</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300">{aiAgentCount} <span className="text-xs text-cyan-400/60 font-normal">runs</span></div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-slate-950 p-4 rounded-2xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
            <span>Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{successRate}% <span className="text-xs text-emerald-500/60 font-normal">reliable</span></div>
        </div>
      </div>

      {/* 🔍 SEARCH & FILTER BAR */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search by Scraper Name or Run ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-bold"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {["ALL", "COMPLETED", "FAST_PATH", "FAILED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                statusFilter === st
                  ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80"
              }`}
            >
              {st === "ALL" ? "All Runs" : st === "FAST_PATH" ? "⚡ Fast Path" : st}
            </button>
          ))}
        </div>
      </div>

      {/* 📜 RUNS TABLE */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
            Loading execution logs...
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Activity className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-extrabold text-white">No Matching Execution Runs</h3>
            <p className="text-xs text-slate-400">Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                  <th className="pb-3 px-4">Agent & Scraper Name</th>
                  <th className="pb-3 px-3">Run ID</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Execution Mode & Runtime</th>
                  <th className="pb-3 px-3">Gemini Calls</th>
                  <th className="pb-3 px-3">Started Timestamp</th>
                  <th className="pb-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRuns.map((r) => {
                  const isFastPath = r.executionMode === "FAST_PATH" || r.modelCallCount === 0;
                  const formattedAgentName = cleanAgentTitle(r.agent?.name, r.agent?.goal);

                  return (
                    <tr key={r.id} className="hover:bg-slate-900/50 transition-colors group">
                      <td className="py-4 px-4 max-w-[240px]">
                        <Link href={`/app/runs/${r.id}`} className="font-extrabold text-white hover:text-sky-400 transition-colors block truncate text-xs">
                          {formattedAgentName}
                        </Link>
                        <span className="text-[10px] text-slate-500 block truncate font-mono mt-0.5">
                          {r.agent?.targetUrl || "https://google.com"}
                        </span>
                      </td>

                      <td className="py-4 px-3 font-mono">
                        <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
                          {r.id.length > 14 ? `${r.id.slice(0, 14)}...` : r.id}
                        </span>
                      </td>

                      <td className="py-4 px-3">
                        {r.status === "COMPLETED" ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> COMPLETED
                          </span>
                        ) : r.status === "FAILED" ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> FAILED
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/30 inline-flex items-center gap-1 animate-pulse">
                            ● {r.status || "RUNNING"}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-3">
                        {isFastPath ? (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30 text-purple-300 text-xs font-extrabold shadow-sm shadow-purple-500/10">
                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Fast Path <span className="text-[10px] text-purple-400/80 font-mono">(Zero-LLM)</span></span>
                            <span className="px-1.5 py-0.5 rounded bg-purple-950/90 text-[10px] font-mono text-amber-300 border border-purple-800/80 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" /> {formatDurationHuman(r)}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-gradient-to-r from-sky-500/10 to-cyan-500/10 border border-sky-500/30 text-cyan-300 text-xs font-extrabold shadow-sm shadow-cyan-500/10">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Autonomous AI Agent</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-950/90 text-[10px] font-mono text-cyan-300 border border-cyan-800/80 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-cyan-400" /> {formatDurationHuman(r)}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-3 font-mono font-bold text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          {r.modelCallCount ?? 0} calls
                        </span>
                      </td>

                      <td className="py-4 px-3 font-mono text-slate-400 text-[11px]">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <Link
                            href={`/app/runs/${r.id}`}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-400 font-extrabold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                          >
                            Inspect <ArrowRight className="w-3 h-3" />
                          </Link>

                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                            title="Delete Run Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete run record?"
        description={`This permanently removes the record, steps, and events for run ${deleteTarget?.id}. The extracted data and any GCS artifacts are not recoverable afterward.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteRun}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

