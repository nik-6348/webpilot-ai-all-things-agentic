"use client";

import React, { useEffect, useState } from "react";
import { Plug, Mail, Webhook, Cloud, MessageSquare, CheckCircle2, Clock, MessageCircle, Send } from "lucide-react";
import { api, workspace } from "../../../lib/api";
import { useToast } from "../../../components/Toast";

const STATIC_CATALOG = [
  {
    key: "resend",
    name: "Resend Email Notifications",
    desc: "Automated execution reports and onboarding approval emails sent directly via Resend REST API.",
    icon: Mail,
    status: "Active",
    comingSoon: false,
    color: "text-emerald-400",
  },
  {
    key: "gcs",
    name: "GCP Cloud Storage (GCS)",
    desc: "Enterprise cloud worker artifact storage for screenshots, DOM snapshots, and JSON extraction files.",
    icon: Cloud,
    status: "Configured",
    comingSoon: false,
    color: "text-cyan-400",
  },
  {
    key: "gmail",
    name: "Gmail Workspace Dispatcher",
    desc: "Direct OAuth 2.0 Gmail integration for sending automated email workflows and notification digests.",
    icon: Send,
    status: "Coming Soon",
    comingSoon: true,
    color: "text-rose-400",
  },
  {
    key: "google_chat",
    name: "Google Chat Webhook",
    desc: "Instant alert notifications dispatched to Google Chat spaces on task failure or verification challenge.",
    icon: MessageCircle,
    status: "Coming Soon",
    comingSoon: true,
    color: "text-sky-400",
  },
  {
    key: "webhooks",
    name: "Custom REST Webhooks",
    desc: "POST JSON extraction payloads to external API endpoints and webhooks.",
    icon: Webhook,
    status: "Coming Soon",
    comingSoon: true,
    color: "text-amber-400",
  },
];

export default function Integrations() {
  const toast = useToast();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [slackIntegration, setSlackIntegration] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  async function load() {
    try {
      const w = await workspace();
      if (!w?.id) return;
      setWorkspaceId(w.id);
      const rows = await api<any[]>(`/api/v1/integrations?workspaceId=${w.id}`);
      setSlackIntegration(rows.find((r) => r.provider === "SLACK") || null);
    } catch (e) {
      console.error("Integrations load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleConnectSlack() {
    if (!workspaceId) return;
    setConnecting(true);
    try {
      const res = await api<{ url: string }>("/api/v1/integrations/slack/connect", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      window.location.href = res.url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start Slack connection");
      setConnecting(false);
    }
  }

  const slackConnected = slackIntegration?.status === "CONNECTED";
  const slackCard = {
    key: "slack",
    name: "Slack Channel Alerts",
    desc: "Post live extraction results and approval notifications directly to team Slack channels.",
    icon: MessageSquare,
    status: slackConnected ? `Connected — ${slackIntegration?.displayName || "Slack"}` : "Not Connected",
    comingSoon: false,
    color: "text-purple-400",
  };

  const integrations = [slackCard, ...STATIC_CATALOG];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
          <Plug className="w-3.5 h-3.5" /> WebPilot Ecosystem Hub
        </div>
        <h1 className="text-3xl font-black text-white">Integrations & Connectors</h1>
        <p className="text-sm text-slate-400 mt-1">
          Connect your automated web RPA pipelines to notifications, email services, webhooks, and cloud storage.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading integrations...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((item) => {
            const Icon = item.icon;
            const isSlack = item.key === "slack";
            const active = isSlack ? slackConnected : !item.comingSoon;
            return (
              <div
                key={item.key}
                className={`glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4 border ${
                  active ? "border-emerald-500/30" : "border-slate-800/80 bg-slate-950/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    {active ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {item.status}
                      </span>
                    ) : isSlack ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                        Not Connected
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" /> Coming Soon
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-white">{item.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">
                    {isSlack ? (slackConnected ? "Production Ready" : "OAuth Required") : item.comingSoon ? "In Development" : "Production Ready"}
                  </span>
                  {isSlack ? (
                    <button
                      onClick={handleConnectSlack}
                      disabled={connecting || slackConnected}
                      className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                        slackConnected
                          ? "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
                          : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer disabled:opacity-50"
                      }`}
                    >
                      {slackConnected ? "Connected" : connecting ? "Redirecting..." : "Connect Slack"}
                    </button>
                  ) : (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
