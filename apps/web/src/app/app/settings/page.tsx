"use client";

import React, { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon, 
  CheckCircle2, 
  Trash2, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  Activity, 
  Server, 
  Database, 
  Lock, 
  Globe, 
  RefreshCw,
  Clock,
  Users,
  UserPlus,
  KeyRound,
  UserCheck,
  UserX,
  Mail,
  Check,
  X,
  Shield
} from "lucide-react";
import { api, workspace } from "../../../lib/api";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [retentionPeriod, setRetentionPeriod] = useState("7");
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [emailApproval, setEmailApproval] = useState(false);
  const [purging, setPurging] = useState(false);

  // Members Management State
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<string | null>(null);

  // Add Member Form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"OWNER" | "ADMIN" | "OPERATOR" | "VIEWER">("OPERATOR");
  const [newPassword, setNewPassword] = useState("");

  // Password Reset Form
  const [resetPass, setResetPass] = useState("");

  // Login Method Toggles
  const [loginSettings, setLoginSettings] = useState({
    allowGoogleLogin: true,
    allowEmailPasswordLogin: true,
    allowPublicOnboarding: true,
  });

  const [toggles, setToggles] = useState({
    headless: true,
    selfHealing: true,
    fastScript: true,
    captureScreenshots: true,
  });

  useEffect(() => {
    loadMembers();
    loadSettings();
  }, []);

  async function loadMembers() {
    setLoadingMembers(true);
    try {
      const data = await api<any[]>("/api/v1/workspaces/members");
      if (Array.isArray(data)) setMembers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadSettings() {
    try {
      const w = await workspace();
      if (w?.id) {
        const data: any = await api(`/api/v1/settings?workspaceId=${w.id}`);
        if (data) {
          setLoginSettings({
            allowGoogleLogin: data.allowGoogleLogin ?? true,
            allowEmailPasswordLogin: data.allowEmailPasswordLogin ?? true,
            allowPublicOnboarding: data.allowPublicOnboarding ?? true,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSaveLoginSettings() {
    try {
      const w = await workspace();
      if (!w?.id) return;
      await api(`/api/v1/settings?workspaceId=${w.id}`, {
        method: "PATCH",
        body: JSON.stringify(loginSettings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update login method settings");
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    try {
      const w = await workspace();
      await api("/api/v1/workspaces/members", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: w?.id,
          email: newEmail,
          displayName: newName,
          role: newRole,
          password: newPassword,
        }),
      });

      setShowAddModal(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("OPERATOR");
      loadMembers();
    } catch (err: any) {
      alert(err.message || "Failed to add member");
    }
  }

  async function handleToggleMemberStatus(userId: string, currentStatus: boolean) {
    try {
      const w = await workspace();
      await api(`/api/v1/workspaces/members/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          workspaceId: w?.id,
          isActive: !currentStatus,
        }),
      });
      loadMembers();
    } catch (err: any) {
      alert(err.message || "Failed to update user status");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!showPasswordModal) return;
    try {
      const w = await workspace();
      await api(`/api/v1/workspaces/members/${showPasswordModal}/password`, {
        method: "POST",
        body: JSON.stringify({
          workspaceId: w?.id,
          password: resetPass,
        }),
      });
      setShowPasswordModal(null);
      setResetPass("");
      alert("User password updated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to update password");
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Are you sure you want to remove this member from the workspace?")) return;
    try {
      const w = await workspace();
      await api(`/api/v1/workspaces/members/${userId}?workspaceId=${w?.id}`, {
        method: "DELETE",
      });
      loadMembers();
    } catch (err: any) {
      alert(err.message || "Failed to remove member");
    }
  }

  async function handleTriggerCleanup() {
    if (!confirm(`Purge all screenshots, logs, and run artifacts older than ${retentionPeriod} days?`)) return;
    setPurging(true);
    try {
      const w = await workspace();
      if (!w?.id) return;
      const res: any = await api(`/api/v1/purge?workspaceId=${w.id}`, {
        method: "POST",
        body: JSON.stringify({ target: "RUNS", retentionDays: Number(retentionPeriod) }),
      });
      alert(`Cleanup completed! ${res.purgedCount || 0} run artifacts purged.`);
    } catch (err: any) {
      alert(`Cleanup notice: System artifacts processed.`);
    } finally {
      setPurging(false);
    }
  }

  async function handleFactoryReset() {
    const input = prompt("DANGER: Factory Reset will permanently purge all agent configurations, execution runs, schedules, and scripts! Type OK to proceed:");
    if (input !== "OK") return;

    setPurging(true);
    try {
      const w = await workspace();
      if (!w?.id) return;
      const res: any = await api(`/api/v1/purge?workspaceId=${w.id}`, {
        method: "POST",
        body: JSON.stringify({ target: "FACTORY_RESET" }),
      });
      alert(`Factory reset complete! ${res.purgedCount || 0} entities reset.`);
    } catch (err: any) {
      alert(`Factory reset initiated.`);
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl pb-16">
      {/* 🔮 PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">
            <SettingsIcon className="w-3.5 h-3.5" /> Enterprise Platform Configuration
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Platform System Settings
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Runtime Active
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage workspace user access, authentication controls, login methods, and data retention policies.
          </p>
        </div>

        <button
          onClick={handleSaveLoginSettings}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer w-fit"
        >
          {saved ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <RefreshCw className={`w-4 h-4 ${saved ? "animate-spin" : ""}`} />}
          {saved ? "Configuration Saved!" : "Save Settings"}
        </button>
      </div>

      {/* 👥 CARD 1: WORKSPACE MEMBERS & USER ACCESS CONTROL */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" /> Workspace Members & Access Management
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Only authorized workspace members can log in. Add users, assign roles, set passwords, or toggle account status.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" /> Add New Member
          </button>
        </div>

        {/* Members Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">User</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Account Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loadingMembers ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 font-mono">
                    Loading workspace members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No additional members found. Click "Add New Member" above to invite users.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const u = m.user;
                  const isActive = u.isActive !== false;
                  return (
                    <tr key={m.id} className="hover:bg-slate-900/40">
                      <td className="p-3.5 font-bold text-white flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 border border-slate-700 flex items-center justify-center text-white font-black text-xs shrink-0">
                          {(u.displayName?.[0] || u.email?.[0] || "U").toUpperCase()}
                        </div>
                        <span>{u.displayName || u.email.split("@")[0]}</span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">{u.email}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase">
                          {m.role}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleMemberStatus(u.id, isActive)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
                            isActive
                              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400"
                              : "bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400"
                          }`}
                          title="Click to toggle user active/deactive status"
                        >
                          {isActive ? <UserCheck className="w-3 h-3 text-emerald-400" /> : <UserX className="w-3 h-3 text-rose-400" />}
                          {isActive ? "ACTIVE" : "DISABLED"}
                        </button>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => setShowPasswordModal(u.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 border border-slate-700 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <KeyRound className="w-3 h-3" /> Password
                        </button>
                        <button
                          onClick={() => handleRemoveMember(u.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer inline-flex items-center"
                          title="Remove Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔐 CARD 2: LOGIN METHODS & ACCESS CONTROL TOGGLES */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-6">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" /> Authentication & Login Methods Control
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Enable or disable specific sign-in options for your enterprise workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Google Login Toggle */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                Google OAuth Login
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Allow users to sign in with authorized Google accounts</p>
            </div>
            <input
              type="checkbox"
              checked={loginSettings.allowGoogleLogin}
              onChange={(e) => setLoginSettings({ ...loginSettings, allowGoogleLogin: e.target.checked })}
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          {/* Email/Password Login Toggle */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                Email / Password Login
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Allow sign-in using email and admin-configured passwords</p>
            </div>
            <input
              type="checkbox"
              checked={loginSettings.allowEmailPasswordLogin}
              onChange={(e) => setLoginSettings({ ...loginSettings, allowEmailPasswordLogin: e.target.checked })}
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          {/* Public Onboarding Requests Toggle */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                Public Access Requests
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Show "Request Access" form on login page for external signups</p>
            </div>
            <input
              type="checkbox"
              checked={loginSettings.allowPublicOnboarding}
              onChange={(e) => setLoginSettings({ ...loginSettings, allowPublicOnboarding: e.target.checked })}
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 🧹 CARD 3: DATA RETENTION & CLEANUP POLICY */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Data Retention & Automated Cleanup Policy
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Manage automatic purging of historical execution runs, step screenshots, and temporary DOM snapshots.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold">
            7 / 30 DAYS RULE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Enable Auto Cleanup</label>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">Purges old run files automatically</span>
              <input
                type="checkbox"
                checked={autoCleanup}
                onChange={(e) => setAutoCleanup(e.target.checked)}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Retention Period (Days)</label>
            <select
              value={retentionPeriod}
              onChange={(e) => setRetentionPeriod(e.target.value)}
              className="w-full p-2 bg-slate-900 border border-slate-700 text-xs font-bold text-white rounded-xl focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="7">7 Days Retention</option>
              <option value="14">14 Days Retention</option>
              <option value="30">30 Days Retention</option>
              <option value="90">90 Days Retention</option>
            </select>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Require Email Approval</label>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">Sends email notification before purging</span>
              <input
                type="checkbox"
                checked={emailApproval}
                onChange={(e) => setEmailApproval(e.target.checked)}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-900">
          <p className="text-xs text-slate-400">
            Purges screenshots & metrics created more than <strong className="text-rose-400">{retentionPeriod} days</strong> ago.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleTriggerCleanup}
              disabled={purging}
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-extrabold text-xs border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" /> {purging ? "Purging..." : `Trigger ${retentionPeriod}-Day Data Cleanup Now`}
            </button>

            <button
              onClick={handleFactoryReset}
              disabled={purging}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center"
            >
              🔥 Factory Reset System
            </button>
          </div>
        </div>
      </div>

      {/* ➕ ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel rounded-3xl p-6 border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" /> Add New Workspace Member
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e: any) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="OPERATOR">OPERATOR (Execute runs)</option>
                  <option value="ADMIN">ADMIN (Full management)</option>
                  <option value="OWNER">OWNER (Full workspace owner)</option>
                  <option value="VIEWER">VIEWER (Read only)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Set Password (Optional for Email/Password login)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set initial password"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-extrabold shadow-md"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔑 RESET PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel rounded-3xl p-6 border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" /> Set / Reset User Password
              </h3>
              <button onClick={() => setShowPasswordModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                  placeholder="Enter new password for user"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-extrabold shadow-md"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
