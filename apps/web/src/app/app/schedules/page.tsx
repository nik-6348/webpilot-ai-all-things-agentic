"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Plus, Play, Trash2, Edit3, Power, Calendar, Zap, Target, Sparkles } from "lucide-react";
import { api, workspace } from "../../../lib/api";
import { ScheduleModal, cleanAgentTitle } from "../../../components/ScheduleModal";

function parseCronDetails(cron: string): { mode: string; summary: string; days: number[]; timeStr: string | null } {
  if (!cron) return { mode: "RECURRING", summary: "Daily at 09:00 UTC", days: [1, 2, 3, 4, 5], timeStr: "09:00" };

  if (cron.includes("*/")) {
    const match = cron.match(/\*\/(\d+)/);
    const interval = match && match[1] ? match[1] : "1";
    return {
      mode: "HOURLY",
      summary: `Every ${interval} Hour(s) Interval`,
      days: [],
      timeStr: null,
    };
  }

  const parts = cron.split(" ");
  if (parts.length >= 5 && parts[0] !== undefined && parts[1] !== undefined && parts[2] !== undefined && parts[3] !== undefined && parts[4] !== undefined) {
    const min = parts[0].padStart(2, "0");
    const hr = parts[1].padStart(2, "0");
    const dayOfMonth = parts[2];
    const month = parts[3];
    const daysPart = parts[4];

    if (dayOfMonth !== "*" && month !== "*") {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(month, 10) - 1;
      const mStr = monthNames[mIdx] || `Month ${month}`;
      return {
        mode: "ONE_TIME",
        summary: `One-Time: ${mStr} ${dayOfMonth} at ${hr}:${min} UTC`,
        days: [],
        timeStr: `${hr}:${min}`,
      };
    }

    let activeDayNums: number[] = [];
    if (daysPart === "*") {
      activeDayNums = [1, 2, 3, 4, 5, 6, 0];
    } else {
      activeDayNums = daysPart.split(",").map((d) => parseInt(d, 10)).filter((d) => !isNaN(d));
    }

    return {
      mode: "RECURRING",
      summary: `Recurring at ${hr}:${min} UTC`,
      days: activeDayNums,
      timeStr: `${hr}:${min}`,
    };
  }

  return { mode: "RECURRING", summary: cron, days: [], timeStr: null };
}

export default function Schedules() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeScheduleForModal, setActiveScheduleForModal] = useState<any>(null);
  const [wsId, setWsId] = useState("");

  async function loadSchedules() {
    try {
      const w = await workspace();
      if (w?.id) {
        setWsId(w.id);
        const [scRes, agRes] = await Promise.all([
          api(`/api/v1/schedules?workspaceId=${w.id}`).catch(() => []),
          api(`/api/v1/agents?workspaceId=${w.id}`).catch(() => []),
        ]);
        if (Array.isArray(scRes)) setSchedules(scRes);
        if (Array.isArray(agRes)) setAgents(agRes);
      }
    } catch (e) {
      console.error("Schedules load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchedules();
  }, []);

  async function handleToggleEnabled(sc: any) {
    const newEnabled = sc.enabled === false ? true : false;
    try {
      await api(`/api/v1/schedules/${sc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: newEnabled }),
      });
      setSchedules(schedules.map((s) => (s.id === sc.id ? { ...s, enabled: newEnabled } : s)));
    } catch (err: any) {
      alert(`Toggle status error: ${err.message}`);
    }
  }

  async function handleTriggerManual(scId: string) {
    try {
      await api(`/api/v1/schedules/${scId}/trigger-manual`, { method: "POST" });
      alert("Cron schedule manually triggered! Check Execution Runs Inspector.");
    } catch (err: any) {
      alert(`Trigger error: ${err.message}`);
    }
  }

  async function handleDeleteSchedule(scId: string) {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    try {
      await api(`/api/v1/schedules/${scId}`, { method: "DELETE" });
      setSchedules(schedules.filter((s) => s.id !== scId));
    } catch (err: any) {
      alert(`Delete schedule error: ${err.message}`);
    }
  }

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
          onClick={() => {
            setActiveScheduleForModal(null);
            setShowModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer"
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
          <button
            onClick={() => {
              setActiveScheduleForModal(null);
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-colors cursor-pointer"
          >
            Create Your First Schedule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map((sc) => {
            const cronInfo = parseCronDetails(sc.cronExpression);
            const isEnabled = sc.enabled !== false;

            return (
              <div key={sc.id} className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-indigo-500/30 transition-all">
                <div className="space-y-3">
                  {/* Top Badge Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(sc)}
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all flex items-center gap-1.5 ${
                        isEnabled
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                          : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
                      }`}
                      title="Click to toggle Active / Disabled"
                    >
                      <span className={`w-2 h-2 rounded-full ${isEnabled ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                      {isEnabled ? "ACTIVE CRON" : "DISABLED"}
                    </button>

                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-sky-400 flex items-center gap-1">
                      {cronInfo.mode === "HOURLY" && <Zap className="w-3 h-3 text-amber-400" />}
                      {cronInfo.mode === "ONE_TIME" && <Target className="w-3 h-3 text-rose-400" />}
                      {cronInfo.mode === "RECURRING" && <Calendar className="w-3 h-3 text-sky-400" />}
                      {cronInfo.mode}
                    </span>
                  </div>

                  {/* Title & Target Agent */}
                  <div>
                    <h3 className="text-base font-extrabold text-white line-clamp-1">{sc.name || "Scheduled Pipeline"}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Target Agent:{" "}
                      <Link
                        href={`/app/agents/${sc.agentId}`}
                        className="text-sky-400 hover:underline font-extrabold transition-colors"
                      >
                        {cleanAgentTitle(sc.agent?.name, sc.agent?.goal)} →
                      </Link>
                    </p>
                  </div>

                  {/* Inset Schedule Timing Box */}
                  <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        EXECUTION TIMING
                      </span>
                      <span className="text-xs font-mono font-extrabold text-sky-300">
                        {cronInfo.summary}
                      </span>
                    </div>

                    {/* Active Days Pills for RECURRING schedules */}
                    {cronInfo.mode === "RECURRING" && (
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                          ACTIVE EXECUTION DAYS
                        </span>
                        <div className="flex items-center gap-1">
                          {[
                            { num: 1, label: "Mon" },
                            { num: 2, label: "Tue" },
                            { num: 3, label: "Wed" },
                            { num: 4, label: "Thu" },
                            { num: 5, label: "Fri" },
                            { num: 6, label: "Sat" },
                            { num: 0, label: "Sun" },
                          ].map((day) => {
                            const isDayActive = cronInfo.days.includes(day.num);
                            return (
                              <span
                                key={day.num}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                  isDayActive
                                    ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                                    : "bg-slate-950/60 border-slate-900 text-slate-600 opacity-40"
                                }`}
                              >
                                {day.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
                  <button
                    onClick={() => handleTriggerManual(sc.id)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 font-bold text-[11px] border border-indigo-500/30 flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-indigo-300" /> Trigger Now
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleEnabled(sc)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isEnabled ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-800/80 text-slate-400 border-slate-700"
                      }`}
                      title={isEnabled ? "Disable Schedule" : "Enable Schedule"}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveScheduleForModal(sc);
                        setShowModal(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-colors cursor-pointer"
                      title="Edit Schedule"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteSchedule(sc.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                      title="Delete Schedule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📅 SHARED ENTERPRISE SCHEDULE MODAL */}
      <ScheduleModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setActiveScheduleForModal(null);
        }}
        wsId={wsId}
        agents={agents}
        existingSchedule={activeScheduleForModal}
        onSuccess={loadSchedules}
      />
    </div>
  );
}
