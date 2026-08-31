"use client";

import React from "react";
import { Plug, Mail, Webhook, Cloud, MessageSquare, CheckCircle2, Clock, Sparkles, MessageCircle, Send } from "lucide-react";

export default function Integrations() {
  const integrations = [
    {
      name: "Resend Email Notifications",
      desc: "Automated execution reports and onboarding approval emails sent directly via Resend REST API.",
      icon: Mail,
      status: "Active",
      comingSoon: false,
      color: "text-emerald-400",
    },
    {
      name: "GCP Cloud Storage (GCS)",
      desc: "Enterprise cloud worker artifact storage for screenshots, DOM snapshots, and JSON extraction files.",
      icon: Cloud,
      status: "Configured",
      comingSoon: false,
      color: "text-cyan-400",
    },
    {
      name: "Gmail Workspace Dispatcher",
      desc: "Direct OAuth 2.0 Gmail integration for sending automated email workflows and notification digests.",
      icon: Send,
      status: "Coming Soon",
      comingSoon: true,
      color: "text-rose-400",
    },
    {
      name: "Google Chat Webhook",
      desc: "Instant alert notifications dispatched to Google Chat spaces on task failure or verification challenge.",
      icon: MessageCircle,
      status: "Coming Soon",
      comingSoon: true,
      color: "text-sky-400",
    },
    {
      name: "Slack Channel Alerts",
      desc: "Post live extraction results and approval notifications directly to team Slack channels.",
      icon: MessageSquare,
      status: "Coming Soon",
      comingSoon: true,
      color: "text-purple-400",
    },
    {
      name: "Custom REST Webhooks",
      desc: "POST JSON extraction payloads to external API endpoints and webhooks.",
      icon: Webhook,
      status: "Coming Soon",
      comingSoon: true,
      color: "text-amber-400",
    },
  ];

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
          <Plug className="w-3.5 h-3.5" /> WebPilot Ecosystem Hub
        </div>
        <h1 className="text-3xl font-black text-white">Integrations & Connectors</h1>
        <p className="text-sm text-slate-400 mt-1">
          Connect your automated web RPA pipelines to notifications, email services, webhooks, and cloud storage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={`glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4 border ${
                item.comingSoon ? "border-slate-800/80 bg-slate-950/40" : "border-emerald-500/30"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  {item.comingSoon ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" /> Coming Soon
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {item.status}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-white">{item.name}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">
                  {item.comingSoon ? "In Development" : "Production Ready"}
                </span>
                <button
                  disabled={item.comingSoon}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                    item.comingSoon
                      ? "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
                      : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer"
                  }`}
                >
                  {item.comingSoon ? "Coming Soon" : "Configure"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
