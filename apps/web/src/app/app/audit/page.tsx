"use client";

import React from "react";
import { ScrollText, ShieldCheck, Activity, UserCheck } from "lucide-react";

export default function Audit() {
  const events = [
    { event: "AGENT_VERSION_PROMOTED", detail: "Supplier Monitor version v1.1 promoted to PRODUCTION", actor: "System Self-Healing Engine", time: "10 minutes ago" },
    { event: "PLAN_APPROVED", detail: "Human operator approved strategic plan for Run run_1787987297186", actor: "Admin Operator", time: "1 hour ago" },
    { event: "FAST_PATH_EXECUTED", detail: "Direct Playwright script executed in 12.11s (0 model calls)", actor: "Browser Worker", time: "2 hours ago" },
  ];

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
          <ScrollText className="w-3.5 h-3.5" /> Immutable Workspace Audit
        </div>
        <h1 className="text-3xl font-black text-white">Enterprise Audit Trail</h1>
        <p className="text-sm text-slate-400 mt-1">
          Complete, tamper-proof record of all agent version promotions, human plan approvals, and execution events.
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="space-y-4">
          {events.map((evt, i) => (
            <div key={i} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-sky-400">{evt.event}</span>
                    <span className="text-[10px] text-slate-400 font-mono">• {evt.time}</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-1">{evt.detail}</p>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> {evt.actor}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
