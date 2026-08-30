"use client";

import React from "react";
import { Plug, Mail, Webhook, Cloud, MessageSquare, CheckCircle2 } from "lucide-react";

export default function Integrations() {
  const integrations = [
    { name: "Resend Email Notifications", desc: "Automated execution reports sent directly to recipient inbox.", icon: Mail, status: "Connected", color: "text-emerald-400" },
    { name: "Custom Webhooks", desc: "POST JSON extraction payloads to external API endpoints.", icon: Webhook, status: "Active", color: "text-sky-400" },
    { name: "GCP Cloud Run & Storage", desc: "Enterprise cloud worker scaling and Google Cloud Storage artifacts.", icon: Cloud, status: "Configured", color: "text-cyan-400" },
    { name: "Slack Alerts", desc: "Notify team channels on agent recovery or verification challenges.", icon: MessageSquare, status: "Ready", color: "text-purple-400" },
  ];

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
          <Plug className="w-3.5 h-3.5" /> WebPilot Ecosystem Hub
        </div>
        <h1 className="text-3xl font-black text-white">Integrations & Webhooks</h1>
        <p className="text-sm text-slate-400 mt-1">
          Connect your automated web RPA pipelines to notifications, webhooks, and cloud storage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {item.status}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-white">{item.name}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end">
                <button className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors">
                  Configure Settings
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
