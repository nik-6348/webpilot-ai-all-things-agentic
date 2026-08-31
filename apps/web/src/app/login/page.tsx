"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Lock, Mail, KeyRound, UserPlus, CheckCircle, ShieldCheck } from "lucide-react";
import { googleLogin } from "../../lib/firebase";
import { api } from "../../lib/api";

export default function Login() {
  const [activeTab, setActiveTab] = useState<"LOGIN" | "SIGNUP_REQUEST">("LOGIN");
  const [authMethods, setAuthMethods] = useState<{
    allowGoogleLogin: boolean;
    allowEmailPasswordLogin: boolean;
    allowPublicOnboarding: boolean;
  }>({
    allowGoogleLogin: true,
    allowEmailPasswordLogin: true,
    allowPublicOnboarding: true,
  });

  // Email / Password Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup Request Form State
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqWorkspace, setReqWorkspace] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqPassword, setReqPassword] = useState("");

  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/backend/api/v1/auth/methods")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.allowGoogleLogin === "boolean") {
          setAuthMethods(data);
        }
      })
      .catch(() => {});
  }, []);

  async function handleGoogleLogin() {
    setLoading(true);
    setErr("");
    setSuccessMsg("");
    try {
      if (process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS !== "true") {
        await googleLogin();
      }
      const ws = await api<any[]>("/api/v1/workspaces");
      if (!ws || !ws.length) {
        await api("/api/v1/workspaces", {
          method: "POST",
          body: JSON.stringify({
            name: "My WebPilot Workspace",
            slug: `workspace-${Date.now()}`,
          }),
        });
      }
      router.push("/app");
    } catch (e: any) {
      setErr(e.message || "Google authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    setSuccessMsg("");
    try {
      const res = await api<any>("/api/v1/auth/login-email", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (res?.user) {
        // Save local session hint
        localStorage.setItem("webpilot_user", JSON.stringify(res.user));
        router.push("/app");
      } else {
        throw new Error("Invalid credentials");
      }
    } catch (e: any) {
      setErr(e.message || "Email/password login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    setSuccessMsg("");
    try {
      const res = await api<any>("/api/v1/auth/signup-request", {
        method: "POST",
        body: JSON.stringify({
          name: reqName,
          email: reqEmail,
          workspaceName: reqWorkspace,
          reason: reqReason,
          password: reqPassword,
        }),
      });

      setSuccessMsg(res.message || "Onboarding request submitted! Administrator has been notified.");
      setReqName("");
      setReqEmail("");
      setReqWorkspace("");
      setReqReason("");
      setReqPassword("");
    } catch (e: any) {
      setErr(e.message || "Failed to submit onboarding request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full glass-panel rounded-3xl p-8 relative z-10 space-y-6 text-center shadow-2xl border border-slate-800">
        {/* Brand Icon Header */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-cyan-400 p-[1px] mx-auto shadow-lg shadow-indigo-500/25">
          <div className="w-full h-full bg-[#0d1322] rounded-[15px] flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-cyan-400" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
            WebPilot<span className="text-cyan-400 font-mono">.AI</span>
          </h1>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
            Autonomous Enterprise RPA Platform
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => { setActiveTab("LOGIN"); setErr(""); setSuccessMsg(""); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "LOGIN"
                ? "bg-slate-800 text-sky-400 border border-sky-500/30 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          {authMethods.allowPublicOnboarding && (
            <button
              type="button"
              onClick={() => { setActiveTab("SIGNUP_REQUEST"); setErr(""); setSuccessMsg(""); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "SIGNUP_REQUEST"
                  ? "bg-slate-800 text-sky-400 border border-sky-500/30 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Request Access
            </button>
          )}
        </div>

        {/* TAB 1: SIGN IN */}
        {activeTab === "LOGIN" && (
          <div className="space-y-4 text-left">
            {authMethods.allowGoogleLogin && (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-sky-400 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>
            )}

            {authMethods.allowGoogleLogin && authMethods.allowEmailPasswordLogin && (
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-[1px] bg-slate-800"></div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">or</span>
                <div className="flex-1 h-[1px] bg-slate-800"></div>
              </div>
            )}

            {authMethods.allowEmailPasswordLogin && (
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@organization.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In to Workspace <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: REQUEST ACCESS / SIGNUP */}
        {activeTab === "SIGNUP_REQUEST" && (
          <form onSubmit={handleSignupRequest} className="space-y-3 text-left">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                placeholder="Nik Sharma"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Work Email *
              </label>
              <input
                type="email"
                required
                value={reqEmail}
                onChange={(e) => setReqEmail(e.target.value)}
                placeholder="nik@organization.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Workspace / Company Name
              </label>
              <input
                type="text"
                value={reqWorkspace}
                onChange={(e) => setReqWorkspace(e.target.value)}
                placeholder="Acme Automation Team"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Desired Password (Optional)
              </label>
              <input
                type="password"
                value={reqPassword}
                onChange={(e) => setReqPassword(e.target.value)}
                placeholder="Set password for account"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Use Case / Reason
              </label>
              <textarea
                rows={2}
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="Automated web scraping and autonomous RPA workflow testing..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 transition-all resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:opacity-95 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  Submitting Request...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Submit Access Request
                </>
              )}
            </button>
          </form>
        )}

        {err && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400 text-left">
            ❌ {err}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 text-left flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] font-mono text-slate-500">
          <Lock className="w-3 h-3 text-emerald-400" /> Enterprise AES-256 Workspace Protection
        </div>
      </div>
    </div>
  );
}
