"use client";

import React, { useState } from "react";
import { Settings as SettingsIcon, Save, Key, Mail, Bot, Shield, CheckCircle2 } from "lucide-react";

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    aiServiceUrl: "http://localhost:3008/v1/messages",
    aiModel: "gemini-2.5-pro-fable",
    resendApiKey: "",
    senderEmail: "WebPilot AI <onboarding@resend.dev>",
    gcsBucket: "webpilot-enterprise-artifacts",
    useDockerRunner: false
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
            <SettingsIcon className="w-3.5 h-3.5" /> System Configuration
          </div>
          <h1 className="text-3xl font-black text-white">Platform Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage global AI model parameters, email notification keys, and GCS artifact storage.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
        >
          {saved ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
          {saved ? "Settings Saved!" : "Save Settings"}
        </button>
      </div>

      <form onSubmit={handleSave} className="glass-panel rounded-2xl p-6 md:p-8 space-y-6 max-w-4xl">
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Bot className="w-4 h-4 text-indigo-400" /> Gemini AI Reasoning Model Credentials
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">AI Service API Endpoint</label>
              <input
                type="text"
                value={form.aiServiceUrl}
                onChange={(e) => setForm({ ...form, aiServiceUrl: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Default AI Model</label>
              <input
                type="text"
                value={form.aiModel}
                onChange={(e) => setForm({ ...form, aiModel: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Mail className="w-4 h-4 text-cyan-400" /> Notification Credentials (Resend)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Resend API Key</label>
              <input
                type="password"
                value={form.resendApiKey}
                placeholder="re_..."
                onChange={(e) => setForm({ ...form, resendApiKey: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Sender Email Identity</label>
              <input
                type="text"
                value={form.senderEmail}
                onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Shield className="w-4 h-4 text-emerald-400" /> GCP Cloud Storage & Execution Engine
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Google Cloud Storage (GCS) Bucket Name</label>
            <input
              type="text"
              value={form.gcsBucket}
              onChange={(e) => setForm({ ...form, gcsBucket: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
