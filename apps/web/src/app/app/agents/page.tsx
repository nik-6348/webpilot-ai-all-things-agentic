"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Sparkles, Clock } from "lucide-react";
import { api, workspace } from "../../../lib/api";
import { ScheduleModal, cleanAgentTitle } from "../../../components/ScheduleModal";

export default function Agents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsId, setWsId] = useState("");

  // Schedule Modal State
  const [scheduleModalAgent, setScheduleModalAgent] = useState<any>(null);

  useEffect(() => {
    async function loadAgents() {
      try {
        const ws = await workspace();
        if (ws?.id) {
          setWsId(ws.id);
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {agents.map((ag) => {
            const isProd = Boolean(ag.activeVersionId);
            const cleanTitle = cleanAgentTitle(ag.name, ag.goal);
            const targetUrlStr = ag.targetUrl || ag.versions?.[0]?.workflowSpec?.startUrl || "https://www.flipkart.com";
            const promptStr = ag.goal || ag.description || ag.versions?.[0]?.workflowSpec?.goal || "Automated web scraping task";

            return (
              <div key={ag.id} className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4 border-slate-800 bg-slate-950/60 hover:border-sky-500/40 transition-all">
                {/* 🏷️ TOP BADGE & VERSION LOGS COUNT */}
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    isProd
                      ? "bg-sky-500/10 text-sky-400 border-sky-500/40 shadow-sm shadow-sky-500/10"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/40"
                  }`}>
                    {isProd ? "ACTIVE: V1.0" : "DRAFT MODE"}
                  </span>

                  <span className="text-xs text-slate-500 font-mono">
                    {ag.versions?.length || 1} Version Log(s)
                  </span>
                </div>

                {/* 📌 CLEAN AGENT TITLE */}
                <div>
                  <Link href={`/app/agents/${ag.id}`}>
                    <h3 className="text-lg font-extrabold text-white hover:text-sky-400 transition-colors line-clamp-1">
                      {cleanTitle}
                    </h3>
                  </Link>
                </div>

                {/* 📦 NESTED DARK INSET CONFIG BOX */}
                <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-0.5">
                      TARGET URL
                    </span>
                    <a
                      href={targetUrlStr}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono font-bold text-sky-400 hover:underline block truncate"
                    >
                      {targetUrlStr}
                    </a>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-0.5">
                      SYSTEM PROMPT INSTRUCTION
                    </span>
                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed font-sans">
                      {promptStr}
                    </p>
                  </div>
                </div>

                {/* ⚙️ FOOTER BUTTON ACTIONS */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleModalAgent(ag)}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-sky-400" /> Schedule
                  </button>

                  <Link
                    href={`/app/agents/${ag.id}`}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 via-sky-500 to-cyan-400 hover:opacity-95 text-slate-950 font-black text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center gap-1.5"
                  >
                    Inspect Details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📅 ENTERPRISE SCHEDULE MODAL */}
      <ScheduleModal
        isOpen={Boolean(scheduleModalAgent)}
        onClose={() => setScheduleModalAgent(null)}
        wsId={wsId}
        agent={scheduleModalAgent}
      />
    </div>
  );
}
