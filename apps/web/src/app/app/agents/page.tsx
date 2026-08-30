"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Sparkles, Play, ShieldCheck, Clock, ArrowRight, Layers } from "lucide-react";
import { api, workspace } from "../../../lib/api";

export default function Agents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAgents() {
      try {
        const ws = await workspace();
        if (ws?.id) {
          const res = await api(`/api/v1/agents?workspaceId=${ws.id}`);
          if (Array.isArray(res)) setAgents(res);
        }
      } catch (e) {
        console.error("Agents load error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadAgents();
  }, []);

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
            <Bot className="w-3.5 h-3.5" /> Agent Directory & Fleet
          </div>
          <h1 className="text-3xl font-black text-white">Autonomous Agent Fleet</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage deployed web RPA agents, version history, and execution schemas.
          </p>
        </div>

        <Link
          href="/app/agents/new"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> Create New Agent
        </Link>
      </div>

      {/* 🤖 AGENT CARDS GRID */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading agent directory...</div>
      ) : agents.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
          <Bot className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-extrabold text-white">No Agents Configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You haven't created any autonomous web agents in this workspace yet.
          </p>
          <Link
            href="/app/agents/new"
            className="inline-block px-4 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-500 transition-colors"
          >
            Create Your First Agent
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((ag) => (
            <div key={ag.id} className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-6 hover:border-indigo-500/40 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {ag.status || "ACTIVE"}
                  </span>

                  <span className="text-[11px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/30">
                    {ag.activeVersionId ? "PRODUCTION (v1.1)" : "LEARNING (v1.0)"}
                  </span>
                </div>

                <Link href={`/app/agents/${ag.id}`}>
                  <h3 className="text-lg font-black text-white hover:text-sky-400 transition-colors">{ag.name}</h3>
                </Link>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {ag.goal || ag.description || "Autonomous Web Extraction Agent"}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <Link
                  href={`/app/agents/${ag.id}`}
                  className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1"
                >
                  Configure Agent <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <Link
                  href={`/app/runs?agentId=${ag.id}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] transition-colors"
                >
                  View Runs
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
