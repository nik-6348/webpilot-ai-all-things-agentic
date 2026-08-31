"use client";

import React, { useEffect, useState } from "react";
import { CheckSquare, CheckCircle2, XCircle, UserPlus, Building, Mail, Sparkles } from "lucide-react";
import { api, workspace } from "../../../lib/api";
import { useToast } from "../../../components/Toast";

export default function Approvals() {
  const toast = useToast();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlOverrides, setUrlOverrides] = useState<Record<string, string>>({});

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
      const correctedUrl = urlOverrides[id]?.trim();
      await api(`/api/v1/approvals/${id}/${verb}`, {
        method: "POST",
        body: correctedUrl ? JSON.stringify({ correctedUrl }) : undefined,
      });
      await loadApprovals();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${verb} approval`);
    }
  }

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
          <CheckSquare className="w-3.5 h-3.5" /> Human-In-The-Loop Governance
        </div>
        <h1 className="text-3xl font-black text-white">Pending Approvals Queue</h1>
        <p className="text-sm text-slate-400 mt-1">
          Review AI agent execution plans and public user onboarding access requests.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 font-mono">Loading pending approvals queue...</div>
      ) : approvals.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-3 border border-slate-800">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-extrabold text-white">All Clear! No Pending Approvals</h3>
          <p className="text-xs text-slate-400">
            No pending agent execution plans or user signup access requests right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {approvals.map((ap) => {
            const isOnboarding = ap.type === "ONBOARDING";
            const payload = ap.payload || {};

            return (
              <div
                key={ap.id}
                className={`glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4 border ${
                  isOnboarding ? "border-sky-500/30 bg-sky-950/10" : "border-amber-500/30"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isOnboarding
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {isOnboarding ? "👤 USER ONBOARDING" : ap.type || "PLAN_APPROVAL"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      ID: {ap.id.slice(0, 10)}...
                    </span>
                  </div>

                  {isOnboarding ? (
                    <div className="space-y-2">
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-sky-400" /> {payload.name || "Access Applicant"}
                      </h3>
                      <p className="text-xs font-mono text-sky-300 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> {payload.email}
                      </p>
                      {payload.requestedWorkspaceName && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-500" /> Workspace: <strong className="text-slate-200">{payload.requestedWorkspaceName}</strong>
                        </p>
                      )}
                      {payload.reason && (
                        <p className="text-xs text-slate-400 italic bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 mt-2">
                          "{payload.reason}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        {ap.run?.agent?.name || "Autonomous Web Agent Plan"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {ap.reason || "Review proposed navigation steps and domain boundaries."}
                      </p>
                      {ap.type === "HUMAN_VERIFICATION" && (
                        <div className="mt-3 space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Target URL (edit if this got stuck on the wrong site)
                          </label>
                          <input
                            type="text"
                            defaultValue={ap.run?.agent?.targetUrl || ""}
                            placeholder="https://example.com"
                            onChange={(e) =>
                              setUrlOverrides((prev) => ({ ...prev, [ap.id]: e.target.value }))
                            }
                            className="w-full text-xs font-mono bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center gap-3">
                  <button
                    onClick={() => handleAction(ap.id, "approve")}
                    className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg ${
                      isOnboarding
                        ? "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/25 cursor-pointer"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 cursor-pointer"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> {isOnboarding ? "Approve Access" : ap.type === "HUMAN_VERIFICATION" ? "Approve & Resume" : "Approve Plan"}
                  </button>
                  <button
                    onClick={() => handleAction(ap.id, "reject")}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs transition-colors border border-slate-700 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
