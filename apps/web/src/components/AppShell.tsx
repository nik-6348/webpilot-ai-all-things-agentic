"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  PlayCircle,
  CheckSquare,
  CalendarClock,
  Plug,
  Zap,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { workspace } from "../lib/api";

interface NavLinkItem {
  href: string;
  icon: any;
  label: string;
  badgeKey?: string;
}

const links: NavLinkItem[] = [
  { href: "/app", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/app/agents", icon: Bot, label: "Agents" },
  { href: "/app/runs", icon: PlayCircle, label: "Runs Inspector" },
  { href: "/app/approvals", icon: CheckSquare, label: "Approvals Queue", badgeKey: "approvals" },
  { href: "/app/schedules", icon: CalendarClock, label: "Schedules" },
  { href: "/app/integrations", icon: Plug, label: "Integrations" },
  { href: "/app/connections", icon: Zap, label: "Connections Vault" },
  { href: "/app/audit", icon: ScrollText, label: "Audit Trail" },
  { href: "/app/settings", icon: Settings, label: "Platform Settings" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentWs, setCurrentWs] = useState<any>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
    workspace().then((ws) => {
      if (ws) setCurrentWs(ws);
    }).catch(() => {});
  }, []);

  const isCollapsed = mounted ? collapsed : false;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex overflow-x-hidden">
      {/* 🔮 GLASSMORPHISM SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-[#0a0f1d]/90 backdrop-blur-xl border-r border-slate-800/80 transition-all duration-300 flex flex-col justify-between ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/60">
            <Link href="/app" className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 p-[1px] shadow-lg shadow-indigo-500/20 shrink-0">
                <div className="w-full h-full bg-[#0d1322] rounded-[11px] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                </div>
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1">
                    WebPilot<span className="text-cyan-400 font-mono">.AI</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest -mt-1">
                    Enterprise RPA
                  </span>
                </div>
              )}
            </Link>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Workspace Pill */}
          {!isCollapsed && (
            <div className="mx-3 mt-4 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-slate-200 truncate">
                    {currentWs?.name || "E2E Workspace"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 truncate">
                    {currentWs?.slug || "workspace-main"}
                  </span>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 mt-2">
            {links.map(({ href, icon: Icon, label, badgeKey }) => {
              const isActive = pathname === href || (href !== "/app" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600/90 to-sky-600/80 text-white shadow-md shadow-indigo-500/20 border border-indigo-400/30"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  }`}
                  title={label}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                    {!isCollapsed && <span>{label}</span>}
                  </div>

                  {!isCollapsed && badgeKey === "approvals" && pendingApprovalsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Profile & Status */}
        <div className="p-3 border-t border-slate-800/60">
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : "px-2 py-1.5"}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 p-[1px] shrink-0">
              <div className="w-full h-full bg-[#0d1322] rounded-full flex items-center justify-center text-sky-400 font-black text-xs">
                AI
              </div>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                  Enterprise Node <UserCheck className="w-3 h-3 text-emerald-400 inline" />
                </span>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Worker Active
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 🚀 MAIN CONTENT CONTAINER */}
      <main className={`flex-1 min-w-0 transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-64"}`}>
        <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
