"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Bot, Globe, Shield, FileText, Lock, Play, Zap, Plus, X, CheckCircle2 } from "lucide-react";
import { api, workspace } from "../../../../lib/api";

export default function NewAgent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"single" | "advanced">("single");
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [err, setErr] = useState("");

  // Create Connection Modal state
  const [showConnModal, setShowConnModal] = useState(false);
  const [newConnName, setNewConnName] = useState("");
  const [newConnDomain, setNewConnDomain] = useState("");
  const [newConnUser, setNewConnUser] = useState("");
  const [newConnPass, setNewConnPass] = useState("");
  const [connLoading, setConnLoading] = useState(false);

  // Single Prompt Launcher State
  const [singlePrompt, setSinglePrompt] = useState("");

  // Advanced Agent Config Form State
  const [form, setForm] = useState({
    name: "Web Scraping Agent",
    description: "Public web data extraction task",
    goal: "Open target web page and extract requested information cleanly.",
    targetUrl: "https://example.com",
    allowedDomains: "*",
  });

  async function loadConnections() {
    try {
      const w = await workspace();
      if (w?.id) {
        const res = await api<any[]>(`/api/v1/connections?workspaceId=${w.id}`);
        if (Array.isArray(res)) setConnections(res);
      }
    } catch (e) {
      console.error("Connections load error:", e);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  // Handle 1-Click Single Prompt Execution with Smart URL & Wildcard Domain Parsing
  async function handleSinglePromptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!singlePrompt.trim()) return;
    setLoading(true);
    setErr("");

    try {
      const w = await workspace();
      if (!w?.id) throw new Error("Workspace context missing");

      // Smart Auto-extract URL / Domain Parser
      let extractedUrl = "https://www.google.com";
      const urlMatch = singlePrompt.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) {
        extractedUrl = urlMatch[0];
      } else {
        const domainMatch = singlePrompt.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i);
        if (domainMatch) {
          extractedUrl = `https://${domainMatch[0]}`;
        } else if (singlePrompt.toLowerCase().includes("flipkart")) {
          extractedUrl = "https://www.flipkart.com";
        } else if (singlePrompt.toLowerCase().includes("amazon")) {
          extractedUrl = "https://www.amazon.in";
        }
      }

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

  // Handle Create Credentials Modal Submit
  async function handleCreateConnection(e: React.FormEvent) {
    e.preventDefault();
    if (!newConnName.trim() || !newConnUser.trim()) return;
    setConnLoading(true);

    try {
      const w = await workspace();
      if (!w?.id) throw new Error("Workspace not loaded");

      const created = await api<any>("/api/v1/connections", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: w.id,
          name: newConnName,
          allowedDomains: [newConnDomain || "example.com"],
          credentials: {
            username: newConnUser,
            password: newConnPass,
          },
        }),
      });

      await loadConnections();
      if (created?.id) {
        setConnectionId(created.id);
      }
      setShowConnModal(false);
      setNewConnName("");
      setNewConnUser("");
      setNewConnPass("");
    } catch (err: any) {
      alert(err.message || "Failed to save encrypted credentials");
    } finally {
      setConnLoading(false);
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
          Run web automation tasks cleanly using a single prompt instruction or advanced agent studio.
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
          <Zap className="w-3.5 h-3.5 text-amber-300" /> Single Prompt Quick Launcher
        </button>

        <button
          onClick={() => setMode("advanced")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            mode === "advanced"
              ? "bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-cyan-300" /> Advanced Agent Studio & Credentials Vault
        </button>
      </div>

      {/* 🚀 MODE 1: SINGLE PROMPT QUICK LAUNCHER */}
      {mode === "single" && (
        <form onSubmit={handleSinglePromptSubmit} className="glass-panel rounded-2xl p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" /> Automation Goal / Prompt Instruction
            </label>
            <textarea
              value={singlePrompt}
              onChange={(e) => setSinglePrompt(e.target.value)}
              placeholder="e.g. open flipkart and extract top 5 highest expensive phones..."
              className="w-full h-40 px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed font-mono"
              required
            />
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center text-xs text-emerald-300">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Public Web Automation Mode: No target site login credentials required.
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
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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

      {/* 🤖 MODE 2: ADVANCED AGENT STUDIO & CREDENTIALS VAULT DROPDOWN */}
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
                placeholder="e.g. E-Commerce Order Extraction Agent"
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
                placeholder="e.g. https://portal.example.com"
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
                placeholder="e.g. *, example.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Target Credentials Vault
                </label>
                <button
                  type="button"
                  onClick={() => setShowConnModal(true)}
                  className="text-[11px] font-bold text-sky-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Create New
                </button>
              </div>

              <select
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="">Public Web Automation (No Login Required)</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    🔑 {c.name} ({c.allowedDomains?.join(", ") || "Encrypted KMS Vault"})
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

      {/* 🔐 MODAL: CREATE ENCRYPTED SITE CREDENTIALS */}
      {showConnModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">SecretVault KMS Encryption</span>
                <h2 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                  <Lock className="w-4 h-4 text-emerald-400" /> Create Encrypted Credentials
                </h2>
              </div>
              <button
                onClick={() => setShowConnModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateConnection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Target Account Name</label>
                <input
                  type="text"
                  value={newConnName}
                  onChange={(e) => setNewConnName(e.target.value)}
                  placeholder="e.g. Portal Admin Account"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Allowed Target Domain</label>
                <input
                  type="text"
                  value={newConnDomain}
                  onChange={(e) => setNewConnDomain(e.target.value)}
                  placeholder="e.g. example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Login Username / Email</label>
                  <input
                    type="text"
                    value={newConnUser}
                    onChange={(e) => setNewConnUser(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Login Password</label>
                  <input
                    type="password"
                    value={newConnPass}
                    onChange={(e) => setNewConnPass(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-mono">
                🔒 Security Guarantee: Passwords are zero-knowledge encrypted in SecretVault (KMS Key). PostgreSQL DB only stores an encrypted KMS reference ID.
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConnModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connLoading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20"
                >
                  {connLoading ? "Encrypting & Saving..." : "Save Encrypted Credentials"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
