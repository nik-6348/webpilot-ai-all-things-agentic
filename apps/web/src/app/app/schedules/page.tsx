"use client";

import React, { useEffect, useState } from "react";
import { CalendarClock, Plus, Play, Clock, Sparkles } from "lucide-react";
import { api, workspace } from "../../../lib/api";

export default function Schedules() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchedules() {
      try {
        const w = await workspace();
        if (w?.id) {
          const res = await api(`/api/v1/schedules?workspaceId=${w.id}`);
          if (Array.isArray(res)) setSchedules(res);
        }
      } catch (e) {
        console.error("Schedules load error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadSchedules();
  }, []);

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
            <CalendarClock className="w-3.5 h-3.5" /> Automated Cron Triggers
          </div>
          <h1 className="text-3xl font-black text-white">Execution Schedules</h1>
          <p className="text-sm text-slate-400 mt-1">
            Set up recurring cron schedules for autonomous web scraping and data pipeline syncs.
          </p>
        </div>

        <button
          onClick={() => alert("Cron trigger creation wizard ready!")}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Schedule
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading scheduled triggers...</div>
      ) : schedules.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
          <CalendarClock className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-extrabold text-white">No Schedules Configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You haven't configured any recurring cron triggers yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map((sc) => (
            <div key={sc.id} className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {sc.status || "ACTIVE"}
                  </span>
                  <span className="text-xs font-mono font-bold text-sky-400">
                    {sc.cronExpression || "0 0 * * *"}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-white">{sc.name || "Daily Scraping Pipeline"}</h3>
                <p className="text-xs text-slate-400 mt-1">Agent: {sc.agentName || "Web Extraction Agent"}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Next Run:</span>
                <span className="text-slate-200 font-mono">In 4 hours</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
