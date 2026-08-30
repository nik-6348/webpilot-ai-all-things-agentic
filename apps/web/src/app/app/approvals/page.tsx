"use client";

import React, { useEffect, useState } from "react";
import { CheckSquare, CheckCircle2, XCircle, AlertCircle, ShieldAlert, Sparkles } from "lucide-react";
import { api, workspace } from "../../../lib/api";

export default function Approvals() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadApprovals() {
    try {
      const w = await workspace();
      if (w?.id) {
        const res = await api(`/api/v1/approvals?workspaceId=${w.id}`);
        if (Array.isArray(res)) setApprovals(res);
      }
    } catch (e) {
      console.error("Approvals load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals();
  }, []);

  async function handleAction(id: string, verb: "approve" | "reject") {
    try {
      await api(`/api/v1/approvals/${id}/${verb}`, { method: "POST" });
      await loadApprovals();
    } catch (e: any) {
      alert(e.message || `Failed to ${verb} approval`);
    }
  }

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
          <CheckSquare className="w-3.5 h-3.5" /> Human-In-The-Loop Governance
        </div>
        <h1 className="text-3xl font-black text-white">Pending Plan Approvals</h1>
        <p className="text-sm text-slate-400 mt-1">
          Review and approve AI-generated strategic plans before browser automation execution.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading pending approvals queue...</div>
      ) : approvals.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-extrabold text-white">All Clear! No Pending Approvals</h3>
          <p className="text-xs text-slate-400">
            No agent plans require human intervention right now. Autonomous workers are running cleanly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {approvals.map((ap) => (
            <div key={ap.id} className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4 border-amber-500/20">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {ap.type || "PLAN_APPROVAL"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ID: {ap.id.slice(0, 10)}...
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-white">
                  {ap.run?.agent?.name || "Autonomous Web Agent Plan"}
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {ap.reason || "Review proposed navigation steps and domain boundaries."}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center gap-3">
                <button
                  onClick={() => handleAction(ap.id, "approve")}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve Plan
                </button>
                <button
                  onClick={() => handleAction(ap.id, "reject")}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs transition-colors border border-slate-700"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
