"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PlayCircle, Zap, Bot, Search, Filter, ArrowRight, Activity, Clock } from "lucide-react";
import { api, workspace } from "../../../lib/api";

export default function Runs() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

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

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
            <PlayCircle className="w-3.5 h-3.5" /> Execution Logs & Inspector
          </div>
          <h1 className="text-3xl font-black text-white">Execution History</h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete audit trail of autonomous AI agent runs, fast path zero-LLM executions, and screen observations.
          </p>
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
            placeholder="Filter runs by Agent Name or Run ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {["ALL", "COMPLETED", "FAST_PATH", "FAILED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === st
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {st === "ALL" ? "All Runs" : st === "FAST_PATH" ? "⚡ Fast Path" : st}
            </button>
          ))}
        </div>
      </div>

      {/* 📜 RUNS TABLE */}
      <div className="glass-panel rounded-2xl p-6">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading execution logs...</div>
        ) : filteredRuns.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">No matching execution runs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 px-3">Agent Name</th>
                  <th className="pb-3 px-3">Run ID</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Execution Mode</th>
                  <th className="pb-3 px-3">Gemini Calls</th>
                  <th className="pb-3 px-3">Started Timestamp</th>
                  <th className="pb-3 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRuns.map((r) => {
                  const isFastPath = r.executionMode === "FAST_PATH" || r.modelCallCount === 0;
                  return (
                    <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-3">
                        <Link href={`/app/runs/${r.id}`} className="font-extrabold text-white hover:text-sky-400 transition-colors">
                          {r.agent?.name || "Autonomous Agent"}
                        </Link>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-400 text-[11px]">{r.id}</td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          r.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : r.status === "FAILED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 w-fit ${
                          isFastPath
                            ? "bg-purple-500/15 text-purple-300 border border-purple-500/40"
                            : "bg-sky-500/15 text-sky-300 border border-sky-500/40"
                        }`}>
                          {isFastPath ? <Zap className="w-3 h-3 text-purple-400" /> : <Bot className="w-3 h-3 text-sky-400" />}
                          {isFastPath ? "FAST PATH" : "DISCOVERY"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-300">
                        {r.modelCallCount ?? 0} calls
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-400 text-[11px]">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <Link
                          href={`/app/runs/${r.id}`}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                        >
                          Inspect <ArrowRight className="w-3 h-3 text-sky-400" />
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
