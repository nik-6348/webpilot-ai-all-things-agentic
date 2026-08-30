"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Bot, Globe, Shield, FileText, Lock, Play, Zap, CheckCircle2 } from "lucide-react";
import { api, workspace } from "../../../../lib/api";

export default function NewAgent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"single" | "advanced">("single");
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [err, setErr] = useState("");

  // Single Prompt Launcher State
  const [singlePrompt, setSinglePrompt] = useState("");

  // Advanced Agent Config Form State
  const [form, setForm] = useState({
    name: "Web Scraping Agent",
    description: "Public web data extraction task",
    goal: "Open target web page and extract requested information cleanly.",
    targetUrl: "https://google.com",
    allowedDomains: "*",
  });

  useEffect(() => {
    workspace()
      .then((w) => w && api<any[]>(`/api/v1/connections?workspaceId=${w.id}`))
      .then((x) => x && setConnections(x))
      .catch(() => {});
  }, []);

  // Handle 1-Click Single Prompt Execution (Old RPA Repo Style!)
  async function handleSinglePromptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!singlePrompt.trim()) return;
    setLoading(true);
    setErr("");

    try {
      const w = await workspace();
      if (!w?.id) throw new Error("Workspace context missing");

      // Auto-extract URL if present in prompt or default to target site
      const urlMatch = singlePrompt.match(/https?:\/\/[^\s]+/i);
      const extractedUrl = urlMatch ? urlMatch[0] : "https://google.com";

      const out = await api<any>("/api/v1/agents", {
        method: "POST",
        body: JSON.stringify({
          name: `Public Scraper ${Date.now().toString().slice(-4)}`,
          description: "Public Web Automation Task",
          goal: singlePrompt,
          targetUrl: extractedUrl,
          workspaceId: w.id,
          allowedDomains: ["*"],
          requirePlanApproval: false,
        }),
      });

      if (out?.run?.id) {
        router.push(`/app/runs/${out.run.id}`);
      } else if (out?.agent?.id) {
        router.push(`/app/agents/${out.agent.id}`);
      } else {
        router.push("/app/runs");
      }
    } catch (e: any) {
      setErr(e.message || "Failed to launch web scraper agent");
    } finally {
      setLoading(false);
    }
  }

  // Handle Advanced Agent Form Submit
  async function handleAdvancedSubmit(e: React.FormEvent) {
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
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Public Web Automation Launcher
        </div>
        <h1 className="text-3xl font-black text-white">Execute Web Agent Task</h1>
        <p className="text-sm text-slate-400">
          Run public web automation tasks instantly using a single prompt instruction. No login credentials required.
        </p>
      </div>

      {/* 📌 MODE SWITCHER TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 w-fit">
        <button
          onClick={() => setMode("single")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            mode === "single"
              ? "bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-300" /> Single Prompt Quick Launcher (Fast)
        </button>

        <button
          onClick={() => setMode("advanced")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            mode === "advanced"
              ? "bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-cyan-300" /> Advanced Agent Studio & Credentials
        </button>
      </div>

      {/* 🚀 MODE 1: SINGLE PROMPT QUICK LAUNCHER (Old RPA Repo Style!) */}
      {mode === "single" && (
        <form onSubmit={handleSinglePromptSubmit} className="glass-panel rounded-2xl p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" /> Automation Goal / Prompt Instruction
            </label>
            <textarea
              value={singlePrompt}
              onChange={(e) => setSinglePrompt(e.target.value)}
              placeholder="e.g. Open https://ai.nik6348.in/ and login with email rajputnik911@gmail.com and password Shiv+Shakti=Love@143 and send message to ai and extract response..."
              className="w-full h-40 px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed font-mono"
              required
            />
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Public Web Automation Mode: No target login credentials required.
            </span>
            <span className="font-mono font-bold text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
              0 Credentials Needed
            </span>
          </div>

          {err && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400">
              ❌ {err}
            </div>
          )}

          <div className="pt-4 border-t border-slate-800/80 flex justify-end">
            <button
              type="submit"
              disabled={loading || !singlePrompt.trim()}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Launching Agent Task...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" /> Execute Agent Task Now
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* 🤖 MODE 2: ADVANCED AGENT STUDIO & OPTIONAL CREDENTIALS */}
      {mode === "advanced" && (
        <form onSubmit={handleAdvancedSubmit} className="glass-panel rounded-2xl p-6 md:p-8 space-y-6">
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

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> What Should WebPilot Do? (Goal Prompt)
            </label>
            <textarea
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="Describe the exact step-by-step navigation and extraction goals..."
              className="w-full h-32 px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> Allowed Security Domains
              </label>
              <input
                type="text"
                value={form.allowedDomains}
                onChange={(e) => setForm({ ...form, allowedDomains: e.target.value })}
                placeholder="e.g. *, demo-portal, supplier.domain.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Optional Target Credentials
              </label>
              <select
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="">Public Web Automation (No Login Required)</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.account || c.domain})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {err && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400">
              ❌ {err}
            </div>
          )}

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
                  <Sparkles className="w-4 h-4" /> Generate Plan & Save Agent
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
