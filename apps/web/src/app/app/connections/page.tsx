"use client";

import React, { useEffect, useState } from "react";
import { Zap, ShieldCheck, Key, Plus, Lock, X, CheckCircle2, Edit2, Trash2, Sparkles } from "lucide-react";
import { api, workspace } from "../../../lib/api";
import { useToast } from "../../../components/Toast";
import { ConfirmDialog } from "../../../components/ConfirmDialog";

export default function Connections() {
  const toast = useToast();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadConnections() {
    try {
      const w = await workspace();
      if (w?.id) {
        const res = await api<any[]>(`/api/v1/connections?workspaceId=${w.id}`);
        if (Array.isArray(res)) setConnections(res);
      }
    } catch (e) {
      console.error("Connections load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setName("");
    setDomain("example.com");
    setUser("");
    setPass("");
    setShowModal(true);
  };

  const handleOpenEdit = (conn: any) => {
    setEditingId(conn.id);
    setName(conn.name);
    setDomain(conn.allowedDomains?.[0] || "example.com");
    setUser("");
    setPass("");
    setShowModal(true);
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !user.trim()) return;
    setSubmitting(true);

    try {
      const w = await workspace();
      if (!w?.id) throw new Error("Workspace context missing");

      if (editingId) {
        // Update Existing Connection
        await api(`/api/v1/connections/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            allowedDomains: [domain || "example.com"],
            credentials: {
              username: user,
              password: pass,
            },
          }),
        });
      } else {
        // Create New Connection
        await api("/api/v1/connections", {
          method: "POST",
          body: JSON.stringify({
            workspaceId: w.id,
            name,
            allowedDomains: [domain || "example.com"],
            credentials: {
              username: user,
              password: pass,
            },
          }),
        });
      }

      await loadConnections();
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save encrypted credentials");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api(`/api/v1/connections/${deleteTarget.id}`, { method: "DELETE" });
      await loadConnections();
      toast.success("Connection deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete connection");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
            <Zap className="w-3.5 h-3.5" /> SecretVault KMS Encryption
          </div>
          <h1 className="text-3xl font-black text-white">Target Site Connections Vault</h1>
          <p className="text-sm text-slate-400 mt-1">
            Encrypted credentials vault for target site automated RPA login. Passwords are KMS encrypted and never stored in plain text.
          </p>
        </div>

        {/* 🌟 GLOWING GRADIENT THEME CREATE BUTTON */}
        <button
          onClick={handleOpenAdd}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0 border border-indigo-400/30 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Encrypted Credentials
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading credentials vault...</div>
      ) : connections.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
          <Lock className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-extrabold text-white">No Credentials Configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Public web automation requires 0 credentials. If your target site requires login, click below to add encrypted credentials.
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-extrabold text-xs hover:opacity-90 transition-all shadow-md shadow-indigo-500/20"
          >
            Add First Site Connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {connections.map((c) => (
            <div key={c.id} className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> SecretVault Encrypted
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    KMS Token: {c.id.slice(0, 10)}...
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-white">{c.name}</h3>
                <p className="text-xs font-mono text-sky-400 mt-1">
                  Allowed Domains: {c.allowedDomains?.join(", ") || "example.com"}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] text-slate-400">
                  Fields: {c.credentialFields?.join(", ") || "username, password"}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-[11px] transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Edit Key
                  </button>

                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Delete Credentials"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete connection?"
        description={`This permanently deletes the encrypted credentials for "${deleteTarget?.name}". Any agent still referencing this connection will fail to authenticate on its next run.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 🔐 MODAL: CREATE / EDIT ENCRYPTED CREDENTIALS */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">SecretVault KMS Encryption</span>
                <h2 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  {editingId ? "Update Site Credentials" : "Create Encrypted Credentials"}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Target Account Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. E-Commerce Supplier Portal Account"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Allowed Target Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Login Username / Email</label>
                  <input
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Login Password</label>
                  <input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
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
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-md shadow-indigo-500/25 transition-all cursor-pointer"
                >
                  {submitting ? "Encrypting & Saving..." : editingId ? "Update Credentials" : "Save Encrypted Credentials"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
