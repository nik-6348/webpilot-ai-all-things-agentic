"use client";

import React from "react";
import { Zap, ShieldCheck, Key, Plus, Lock } from "lucide-react";

export default function Connections() {
  const secrets = [
    { domain: "ai.nik6348.in", account: "rajputnik911@gmail.com", status: "AES-256 Encrypted", lastUsed: "10 minutes ago" },
    { domain: "flipkart.com", account: "rpa_bot_user", status: "AES-256 Encrypted", lastUsed: "2 hours ago" },
  ];

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
            <Zap className="w-3.5 h-3.5" /> Secure Credentials Vault
          </div>
          <h1 className="text-3xl font-black text-white">Target Site Connections</h1>
          <p className="text-sm text-slate-400 mt-1">
            Encrypted target login accounts, auth tokens, and session cookies for automated RPA login.
          </p>
        </div>

        <button className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-500 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Credentials
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {secrets.map((item, i) => (
          <div key={i} className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> {item.status}
                </span>
                <span className="text-[11px] font-mono text-slate-400">Last used: {item.lastUsed}</span>
              </div>

              <h3 className="text-base font-extrabold text-white">{item.domain}</h3>
              <p className="text-xs font-mono text-sky-400 mt-1">Account: {item.account}</p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2">
              <button className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors">
                Edit Key
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
