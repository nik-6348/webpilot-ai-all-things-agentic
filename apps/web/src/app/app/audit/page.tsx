"use client";

import React, { useEffect, useState } from "react";
import { ScrollText, ShieldCheck, Activity, UserCheck } from "lucide-react";
import { api, workspace } from "../../../lib/api";

export default function Audit() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuditLogs() {
      try {
        const w = await workspace();
        if (w?.id) {
          const res = await api<any[]>(`/api/v1/workspaces/audit?workspaceId=${w.id}`);
          if (Array.isArray(res)) setEvents(res);
        }
      } catch (e) {
        console.error("Audit load error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadAuditLogs();
  }, []);

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
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading workspace audit trail...</div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No audit log events recorded yet. Perform agent runs or approvals to see live audit logs.
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((evt) => (
              <div key={evt.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-sky-400">{evt.action}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        • {evt.createdAt ? new Date(evt.createdAt).toLocaleString() : "Just now"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white mt-1">
                      Resource: {evt.resourceType} ({evt.resourceId || "global"})
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Actor ID: {evt.actorId?.slice(0, 10) || "System Engine"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
