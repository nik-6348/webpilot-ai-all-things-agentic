"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
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
  ShieldCheck,
  UserCheck,
  LogOut,
  ChevronDown,
  Plus,
  Check,
  Edit3,
  Trash2,
  Building2,
  X,
  AlertTriangle
} from "lucide-react";
import { api, workspace } from "../lib/api";
import { getFirebaseAuth, signOut } from "../lib/firebase";
import WebPilotLogo from "./WebPilotLogo";

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

const UserAvatar = ({ user }: { user: any }) => {
  const [imgErr, setImgErr] = useState(false);
  const initial = (user?.displayName?.[0] || user?.email?.[0] || "U").toUpperCase();
  const photo = !imgErr && user?.photoURL ? user.photoURL : null;

  return photo ? (
    <img
      src={photo}
      alt={user?.displayName || "User Avatar"}
      onError={() => setImgErr(true)}
      className="w-8.5 h-8.5 rounded-full border border-sky-400/60 object-cover shrink-0 shadow-md shadow-sky-500/20"
    />
  ) : (
    <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-sky-500 via-indigo-500 to-cyan-400 p-[1.5px] shrink-0 shadow-md shadow-sky-500/20">
      <div className="w-full h-full bg-[#0d1527] rounded-full flex items-center justify-center text-cyan-300 font-black text-xs">
        {initial}
      </div>
    </div>
  );
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentWs, setCurrentWs] = useState<any>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<any[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  // Workspace Switcher & CRUD Modals State
  const [showWsDropdown, setShowWsDropdown] = useState(false);
  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [showEditWsModal, setShowEditWsModal] = useState(false);
  const [showDeleteWsModal, setShowDeleteWsModal] = useState(false);

  const [newWsName, setNewWsName] = useState("");
  const [newWsSlug, setNewWsSlug] = useState("");

  const [editWsName, setEditWsName] = useState("");
  const [editWsSlug, setEditWsSlug] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [wsError, setWsError] = useState("");

  useEffect(() => {
    setMounted(true);

    if (process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS === "true") {
      setUser({
        displayName: "Demo User",
        email: "demo@webpilot.local",
        photoURL: null,
      });
      setAuthLoading(false);
      loadWorkspaceData();
    } else {
      const auth = getFirebaseAuth();
      if (!auth) {
        router.replace("/login");
        return;
      }
      const unsub = onAuthStateChanged(auth, (u) => {
        if (!u) {
          router.replace("/login");
        } else {
          setUser(u);
          setAuthLoading(false);
          loadWorkspaceData();
        }
      });
      return () => unsub();
    }
  }, [router]);

  async function loadWorkspaceData() {
    try {
      const wsList = await api<any[]>("/api/v1/workspaces");
      if (Array.isArray(wsList)) setAllWorkspaces(wsList);

      const activeWs = await workspace();
      if (activeWs) {
        setCurrentWs(activeWs);
        setEditWsName(activeWs.name || "");
        setEditWsSlug(activeWs.slug || "");
      }
    } catch (e) {
      console.error(e);
    }
  }

  const switchWorkspace = (ws: any) => {
    if (!ws?.id) return;
    localStorage.setItem("webpilot_workspace_id", ws.id);
    setCurrentWs(ws);
    setShowWsDropdown(false);
    window.location.reload();
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    setActionLoading(true);
    setWsError("");
    try {
      const slug = newWsSlug.trim() || newWsName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      const created = await api("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newWsName, slug }),
      });

      if (created?.id) {
        localStorage.setItem("webpilot_workspace_id", created.id);
        setShowCreateWsModal(false);
        setNewWsName("");
        setNewWsSlug("");
        window.location.reload();
      }
    } catch (err: any) {
      setWsError(err.message || "Failed to create workspace.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWs?.id || !editWsName.trim()) return;

    setActionLoading(true);
    setWsError("");
    try {
      const updated = await api(`/api/v1/workspaces/${currentWs.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editWsName, slug: editWsSlug }),
      });

      if (updated?.id) {
        setCurrentWs(updated);
        setShowEditWsModal(false);
        loadWorkspaceData();
      }
    } catch (err: any) {
      setWsError(err.message || "Failed to update workspace.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWs?.id) return;

    setActionLoading(true);
    setWsError("");
    try {
      await api(`/api/v1/workspaces/${currentWs.id}`, {
        method: "DELETE",
      });

      localStorage.removeItem("webpilot_workspace_id");
      setShowDeleteWsModal(false);
      window.location.reload();
    } catch (err: any) {
      setWsError(err.message || "Failed to delete workspace. Ensure you belong to another workspace first.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    if (process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS !== "true") {
      const auth = getFirebaseAuth();
      if (auth) await signOut(auth);
    }
    router.replace("/login");
  };

  const isCollapsed = mounted ? collapsed : false;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center p-4 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-mono text-slate-400 font-bold tracking-wider">
          Verifying workspace credentials...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex overflow-x-hidden">
      {/* 🔮 DARK OBSIDIAN SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-[#090d16] border-r border-slate-800/80 transition-all duration-300 flex flex-col justify-between ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* 🌟 FLOATING SIDEBAR TOGGLE */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-5 z-50 w-7 h-7 rounded-full bg-[#0e1626] border border-slate-700 hover:border-sky-400 text-slate-400 hover:text-white shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-sky-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-sky-400" />
          )}
        </button>

        <div>
          {/* Brand Header */}
          <div className={`h-16 px-4 flex items-center ${isCollapsed ? "justify-center" : "justify-start"} border-b border-slate-800/60 overflow-hidden`}>
            <Link href="/app" className="flex items-center">
              <WebPilotLogo size="md" collapsed={isCollapsed} />
            </Link>
          </div>

          {/* 🏢 INTERACTIVE WORKSPACE SWITCHER PILL */}
          {!isCollapsed && (
            <div className="mx-3 mt-4 relative">
              <button
                onClick={() => setShowWsDropdown(!showWsDropdown)}
                className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/40 transition-all duration-200 flex items-center justify-between cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-cyan-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-xs font-bold text-slate-100 truncate group-hover:text-sky-300 transition-colors">
                      {currentWs?.name || "E2E Workspace"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 truncate">
                      {currentWs?.slug || "workspace-main"}
                    </span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showWsDropdown ? "rotate-180 text-sky-400" : ""}`} />
              </button>

              {/* 🔮 WORKSPACE SWITCHER DROPDOWN MENU */}
              {showWsDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#0d1424] border border-slate-700/90 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2">Workspaces</span>
                    <button
                      onClick={() => {
                        setShowWsDropdown(false);
                        setShowCreateWsModal(true);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 px-2 py-0.5 rounded-lg hover:bg-sky-500/10 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New</span>
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                    {allWorkspaces.map((m: any) => {
                      const ws = m.workspace || m;
                      const isActive = ws?.id === currentWs?.id;
                      return (
                        <div
                          key={ws.id}
                          onClick={() => switchWorkspace(ws)}
                          className={`w-full p-2 rounded-xl flex items-center justify-between text-left text-xs transition-all cursor-pointer ${
                            isActive
                              ? "bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold"
                              : "hover:bg-slate-800/60 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Building2 className={`w-4 h-4 shrink-0 ${isActive ? "text-sky-400" : "text-slate-400"}`} />
                            <div className="flex flex-col overflow-hidden">
                              <span className="truncate">{ws.name}</span>
                              <span className="text-[10px] font-mono text-slate-500 truncate">{ws.slug}</span>
                            </div>
                          </div>

                          {isActive && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* ACTIVE WORKSPACE ACTION FOOTER */}
                  <div className="p-2 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <button
                      onClick={() => {
                        setShowWsDropdown(false);
                        setEditWsName(currentWs?.name || "");
                        setEditWsSlug(currentWs?.slug || "");
                        setShowEditWsModal(true);
                      }}
                      className="flex items-center gap-1 text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Rename</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowWsDropdown(false);
                        setShowDeleteWsModal(true);
                      }}
                      className="flex items-center gap-1 text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-2">
            {links.map(({ href, icon: Icon, label, badgeKey }) => {
              const isActive = pathname === href || (href !== "/app" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center ${
                    isCollapsed ? "justify-center" : "justify-between"
                  } px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-slate-800/90 text-sky-400 border border-sky-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                  }`}
                  title={label}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-sky-400" : "text-slate-400"}`} />
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
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : "justify-between px-2 py-1.5"}`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <UserAvatar user={user} />
              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                    {user?.displayName || user?.email?.split("@")[0] || "Enterprise User"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    {user?.email || "active@session"}
                  </span>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* 🚀 MAIN CONTENT CONTAINER */}
      <main className={`flex-1 min-w-0 transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-64"}`}>
        <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* ➕ MODAL: CREATE WORKSPACE */}
      {showCreateWsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b101c] border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-100">Create New Workspace</h3>
              </div>
              <button
                onClick={() => setShowCreateWsModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {wsError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
                {wsError}
              </div>
            )}

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Automation Team"
                  value={newWsName}
                  onChange={(e) => {
                    setNewWsName(e.target.value);
                    if (!newWsSlug) {
                      setNewWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"));
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Workspace Slug
                </label>
                <input
                  type="text"
                  placeholder="e.g. sales-automation"
                  value={newWsSlug}
                  onChange={(e) => setNewWsSlug(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowCreateWsModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md shadow-sky-500/20 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ MODAL: RENAME WORKSPACE */}
      {showEditWsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b101c] border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-100">Rename Workspace</h3>
              </div>
              <button
                onClick={() => setShowEditWsModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {wsError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
                {wsError}
              </div>
            )}

            <form onSubmit={handleEditWorkspace} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  value={editWsName}
                  onChange={(e) => setEditWsName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Workspace Slug
                </label>
                <input
                  type="text"
                  value={editWsSlug}
                  onChange={(e) => setEditWsSlug(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowEditWsModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🗑️ MODAL: DELETE WORKSPACE */}
      {showDeleteWsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b101c] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
              <div className="w-9 h-9 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Delete Workspace</h3>
                <p className="text-[11px] text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            {wsError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
                {wsError}
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-rose-400">{currentWs?.name}</strong>? All agents, runs, schedules, and configuration in this workspace will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowDeleteWsModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
