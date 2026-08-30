"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Bot, Globe, Shield, FileText, Lock } from "lucide-react";
import { api, workspace } from "../../../../lib/api";

export default function NewAgent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    name: "Daily Supplier Monitor",
    description: "Tracks supplier purchase-order exceptions and delayed items.",
    goal: "Every day open the supplier portal, go to purchase orders, extract PO ID, supplier, status, ETA and amount, then flag delayed orders.",
    targetUrl: "http://demo-portal:4200",
    allowedDomains: "demo-portal",
  });

  useEffect(() => {
    workspace()
      .then((w) => w && api<any[]>(`/api/v1/connections?workspaceId=${w.id}`))
      .then((x) => x && setConnections(x))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.goal.trim()) return;
    setLoading(true);
    setErr("");

    try {
      const w = await workspace();
      if (!w?.id) throw new Error("Workspace context missing");

      const out = await api<any>("/api/v1/agents", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          workspaceId: w.id,
          allowedDomains: form.allowedDomains.split(",").map((x) => x.trim()),
          connectionId: connectionId || undefined,
          requirePlanApproval: true,
        }),
      });

      if (out?.agent?.id) {
        router.push(`/app/agents/${out.agent.id}`);
      } else {
        router.push("/app/agents");
      }
    } catch (e: any) {
      setErr(e.message || "Failed to create agent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* 🔮 HEADER */}
      <div className="flex flex-col gap-2">
        <Link href="/app/agents" className="text-xs text-sky-400 font-bold hover:underline flex items-center gap-1 w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Agents Directory
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">
          <Sparkles className="w-3.5 h-3.5" /> Agent Studio Builder
        </div>
        <h1 className="text-3xl font-black text-white">Configure New Web Agent</h1>
        <p className="text-sm text-slate-400">
          Describe the automation goal. Gemini AI will analyze the target site and generate an approval-ready plan & schema.
        </p>
      </div>

      {/* 📜 FORM CONTAINER */}
      <form onSubmit={submit} className="glass-panel rounded-2xl p-6 md:p-8 space-y-6">
        {/* Agent Name & Target URL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-indigo-400" /> Agent Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Supplier PO Tracker"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-400" /> Target Website URL
            </label>
            <input
              type="text"
              value={form.targetUrl}
              onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
              placeholder="e.g. http://demo-portal:4200"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Goal / Instruction Prompt */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> What Should WebPilot Do? (Goal Prompt)
          </label>
          <textarea
            value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value })}
            placeholder="Describe the exact step-by-step navigation and extraction goals..."
            className="w-full h-36 px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed"
            required
          />
        </div>

        {/* Allowed Domains & Connection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> Allowed Security Domains
            </label>
            <input
              type="text"
              value={form.allowedDomains}
              onChange={(e) => setForm({ ...form, allowedDomains: e.target.value })}
              placeholder="e.g. demo-portal, supplier.domain.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" /> Authorized Login Credentials
            </label>
            <select
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="">No Login Credentials Required</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.account || c.domain})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-purple-400" /> Description & Notes
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief explanation of agent purpose..."
            className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {err && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400">
            ❌ {err}
          </div>
        )}

        {/* Submit Action */}
        <div className="pt-4 border-t border-slate-800/80 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Gemini AI is Planning Agent...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Generate Strategic Plan & Create Agent
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
