"use client";

import React, { useState, useEffect } from "react";
import { CalendarClock, X, Sparkles, Calendar, Zap, Target } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "./Toast";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  wsId: string;
  agent?: any;
  agents?: any[];
  existingSchedule?: any;
  onSuccess?: () => void;
}

function truncateTitle(s: string, max = 70) {
  return s.length > max ? `${s.slice(0, max).replace(/\s+\S*$/, "")}…` : s;
}

export function cleanAgentTitle(name: string, goal?: string) {
  if (!name || name.startsWith("Agent Run") || name.startsWith("Public Scraper") || /\d{10,}/.test(name)) {
    if (goal) {
      const words = goal.split(" ").slice(0, 5).join(" ");
      return words.charAt(0).toUpperCase() + words.slice(1);
    }
    return "Autonomous Scraper Agent";
  }
  // Defensive cap for any agent (including ones created before names were
  // planner-generated) whose stored name is a full goal/summary
  // restatement rather than a short title -- lists shouldn't have to
  // render a paragraph as a name.
  return truncateTitle(name);
}

export function ScheduleModal({
  isOpen,
  onClose,
  wsId,
  agent,
  agents = [],
  existingSchedule,
  onSuccess,
}: ScheduleModalProps) {
  const toast = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleType, setScheduleType] = useState<"RECURRING" | "HOURLY" | "ONE_TIME">("RECURRING");
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [hourlyInterval, setHourlyInterval] = useState(2);
  const [oneTimeDate, setOneTimeDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [oneTimeTime, setOneTimeTime] = useState("10:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (existingSchedule) {
      setSelectedAgentId(existingSchedule.agentId || agent?.id || "");
      setScheduleName(existingSchedule.name || "");
      
      const cron = existingSchedule.cronExpression || "0 9 * * *";
      if (cron.includes("*/")) {
        setScheduleType("HOURLY");
        const match = cron.match(/\*\/(\d+)/);
        if (match) setHourlyInterval(parseInt(match[1], 10));
      } else {
        setScheduleType("RECURRING");
        const parts = cron.split(" ");
        if (parts.length >= 5) {
          const min = parts[0].padStart(2, "0");
          const hr = parts[1].padStart(2, "0");
          setSelectedTime(`${hr}:${min}`);

          const daysPart = parts[4];
          if (daysPart === "*") {
            setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
          } else {
            const parsedDays = daysPart.split(",").map((d: string) => parseInt(d, 10)).filter((d: number) => !isNaN(d));
            if (parsedDays.length > 0) setSelectedDays(parsedDays);
          }
        }
      }
    } else {
      const targetAg = agent || (agents.length > 0 ? agents[0] : null);
      if (targetAg) {
        setSelectedAgentId(targetAg.id);
        setScheduleName(`Daily Sync — ${cleanAgentTitle(targetAg.name, targetAg.goal)}`);
      } else {
        setScheduleName("Daily Sync — Scraper Pipeline");
      }
      setScheduleType("RECURRING");
      setSelectedTime("09:00");
      setSelectedDays([1, 2, 3, 4, 5]);
    }
  }, [isOpen, existingSchedule?.id]);

  if (!isOpen) return null;

  function toggleDay(dayNum: number) {
    if (selectedDays.includes(dayNum)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d: number) => d !== dayNum));
      }
    } else {
      setSelectedDays([...selectedDays, dayNum]);
    }
  }

  function getComputedCron() {
    if (scheduleType === "HOURLY") {
      return `0 */${hourlyInterval} * * *`;
    }
    if (scheduleType === "ONE_TIME") {
      const [h, m] = (oneTimeTime || "09:00").split(":");
      const d = new Date(oneTimeDate || Date.now());
      const day = d.getDate();
      const month = d.getMonth() + 1;
      return `${parseInt(m || "0", 10)} ${parseInt(h || "9", 10)} ${day} ${month} *`;
    }

    const [h, m] = (selectedTime || "09:00").split(":");
    const daysPart = selectedDays.length > 0 && selectedDays.length < 7 ? selectedDays.sort().join(",") : "*";
    return `${parseInt(m || "0", 10)} ${parseInt(h || "9", 10)} * * ${daysPart}`;
  }

  function getScheduleSummaryStr() {
    if (scheduleType === "HOURLY") return `Executes every ${hourlyInterval} hour(s)`;
    if (scheduleType === "ONE_TIME") return `One-time execution on ${oneTimeDate} at ${oneTimeTime}`;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const selectedNames = selectedDays.map((d: number) => dayNames[d]).join(", ");
    const daysText =
      selectedDays.length === 7
        ? "Everyday"
        : selectedDays.length === 5 && !selectedDays.includes(0) && !selectedDays.includes(6)
        ? "Weekdays (Mon-Fri)"
        : selectedNames;
    return `Executes ${daysText} at ${selectedTime}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetAgentId = selectedAgentId || agent?.id;
    if (!targetAgentId || !scheduleName.trim()) return;

    setSaving(true);
    const cronExpression = getComputedCron();

    try {
      if (existingSchedule?.id) {
        await api(`/api/v1/schedules/${existingSchedule.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: scheduleName,
            cronExpression,
            timezone: "UTC",
          }),
        });
      } else {
        await api("/api/v1/schedules", {
          method: "POST",
          body: JSON.stringify({
            workspaceId: wsId,
            agentId: targetAgentId,
            name: scheduleName,
            cronExpression,
            timezone: "UTC",
          }),
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`Schedule save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const activeAgent = agent || agents.find((a) => a.id === selectedAgentId);
  const displayAgentName = activeAgent ? cleanAgentTitle(activeAgent.name, activeAgent.goal) : "Target Agent";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-950/95 border border-slate-700/80 shadow-2xl shadow-cyan-500/10 rounded-3xl p-5 max-w-md w-full flex flex-col gap-3.5 relative overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500/20 to-cyan-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-md shadow-sky-500/10">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-sky-400 block">
                ENTERPRISE SCHEDULER
              </span>
              <h3 className="text-base font-black text-white tracking-tight">
                {existingSchedule ? "Edit Cron Schedule" : "Schedule Automated Trigger"}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Agent Selector */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
            Target Scraper Agent
          </label>
          {agent ? (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-extrabold text-xs truncate">
              {displayAgentName}
            </div>
          ) : (
            <select
              value={selectedAgentId}
              onChange={(e) => {
                setSelectedAgentId(e.target.value);
                const ag = agents.find((a) => a.id === e.target.value);
                if (ag) setScheduleName(`Daily Sync — ${cleanAgentTitle(ag.name, ag.goal)}`);
              }}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-extrabold text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id} className="bg-slate-950 text-white py-1">
                  {cleanAgentTitle(ag.name, ag.goal)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Schedule Name */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
            Schedule Name
          </label>
          <input
            type="text"
            value={scheduleName}
            onChange={(e) => setScheduleName(e.target.value)}
            required
            placeholder="e.g. Daily Price Tracker at 9 AM"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white font-bold focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Execution Mode Segmented Control Tabs */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
            Schedule Execution Mode
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setScheduleType("RECURRING");
              }}
              className={`py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                scheduleType === "RECURRING"
                  ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 shadow-md shadow-sky-500/20 font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Days & Time
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setScheduleType("HOURLY");
              }}
              className={`py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                scheduleType === "HOURLY"
                  ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 shadow-md shadow-sky-500/20 font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Hourly Interval
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setScheduleType("ONE_TIME");
              }}
              className={`py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                scheduleType === "ONE_TIME"
                  ? "bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 shadow-md shadow-sky-500/20 font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Target className="w-3.5 h-3.5" /> One-Time Run
            </button>
          </div>
        </div>

        {/* TYPE 1: RECURRING DAYS & TIME */}
        {scheduleType === "RECURRING" && (
          <div className="space-y-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-1">Execution Time (UTC)</label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-3 text-xs text-sky-300 font-mono font-bold focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-1.5">Select Active Execution Days</label>
              <div className="flex items-center justify-between gap-1">
                {[
                  { num: 1, label: "Mon" },
                  { num: 2, label: "Tue" },
                  { num: 3, label: "Wed" },
                  { num: 4, label: "Thu" },
                  { num: 5, label: "Fri" },
                  { num: 6, label: "Sat" },
                  { num: 0, label: "Sun" },
                ].map((day) => {
                  const isSelected = selectedDays.includes(day.num);
                  return (
                    <button
                      key={day.num}
                      type="button"
                      onClick={() => toggleDay(day.num)}
                      className={`w-8 h-8 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-gradient-to-br from-sky-400 to-cyan-500 text-slate-950 border-cyan-300 font-black shadow-md shadow-sky-500/25 scale-[1.04]"
                          : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TYPE 2: HOURLY INTERVAL */}
        {scheduleType === "HOURLY" && (
          <div className="space-y-2 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <label className="block text-[10px] font-bold text-slate-300 mb-1">Execution Hour Interval</label>
            <select
              value={hourlyInterval}
              onChange={(e) => setHourlyInterval(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
            >
              <option value={1}>Every 1 Hour (24 runs / day)</option>
              <option value={2}>Every 2 Hours (12 runs / day)</option>
              <option value={4}>Every 4 Hours (6 runs / day)</option>
              <option value={6}>Every 6 Hours (4 runs / day)</option>
              <option value={12}>Every 12 Hours (2 runs / day)</option>
            </select>
          </div>
        )}

        {/* TYPE 3: ONE-TIME RUN */}
        {scheduleType === "ONE_TIME" && (
          <div className="grid grid-cols-2 gap-2.5 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-1">Execution Date</label>
              <input
                type="date"
                value={oneTimeDate}
                onChange={(e) => setOneTimeDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-1">Time (UTC)</label>
              <input
                type="time"
                value={oneTimeTime}
                onChange={(e) => setOneTimeTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-sky-300 font-mono font-bold focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        )}

        {/* 💡 HUMAN READABLE SUMMARY BADGE */}
        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] font-bold flex items-center gap-2 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{getScheduleSummaryStr()}</span>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-sky-500 to-cyan-400 hover:opacity-95 text-slate-950 font-black text-xs shadow-lg shadow-sky-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <CalendarClock className="w-3.5 h-3.5" /> {saving ? "Saving..." : existingSchedule ? "Update Schedule" : "Save & Enable Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}

