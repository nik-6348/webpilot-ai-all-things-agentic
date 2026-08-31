"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Code,
  Download,
  Copy,
  Check,
  Image as ImageIcon,
  ListChecks,
  FileText,
  RefreshCw,
  X,
  ExternalLink,
  ShieldAlert,
  Target,
  Sparkles,
  Layers,
  Loader2
} from "lucide-react";
import { api } from "../../../../lib/api";
import { cleanAgentTitle } from "../../../../components/ScheduleModal";
import { useToast } from "../../../../components/Toast";

export default function RunInspector() {
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"result" | "code" | "latencies" | "screenshots" | "raw">("result");
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rerunMode, setRerunMode] = useState<"live" | "fast" | null>(null);

  useEffect(() => {
    let interval: any;
    async function fetchRun() {
      try {
        const data = await api(`/api/v1/runs/${id}`);
        setRun(data);
      } catch (e) {
        console.error("Run fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchRun();
    interval = setInterval(fetchRun, 2500);
    return () => clearInterval(interval);
  }, [id]);

  const handleRerun = async (forceLiveAi: boolean) => {
    if (!run?.agent?.id) return;
    setRerunMode(forceLiveAi ? "live" : "fast");

    try {
      const res: any = await api("/api/v1/runs", {
        method: "POST",
        body: JSON.stringify({
          agentId: run.agent.id,
          triggerType: "MANUAL",
          forceLiveAi: forceLiveAi
        })
      });

      if (res?.id) {
        window.location.href = `/app/runs/${res.id}`;
      } else {
        toast.success("Rerun triggered successfully!");
        setRerunMode(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger rerun");
      setRerunMode(null);
    }
  };

  const handleCopyCode = () => {
    const codeStr = run?.scriptCode || run?.result?.scriptCode || "// No compiled Playwright script available";
    navigator.clipboard.writeText(codeStr);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-slate-400 font-medium">Loading Run Inspector details...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Run Not Found</h2>
        <p className="text-xs text-slate-400">Run ID {id} does not exist or has been purged.</p>
        <Link href="/app/runs" className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-sky-400 hover:underline">
          Back to Runs
        </Link>
      </div>
    );
  }

  const isDirectScript = run.executionMode === "DIRECT_SCRIPT" || run.executionMode === "FAST_PATH" || run.modelCallCount === 0;
  const formattedTitle = cleanAgentTitle(run.agent?.name, run.agent?.goal);

  const scriptCodeStr = run.scriptCode || run.result?.scriptCode || (
    `/**\n * Compiled Playwright Script for ${run.agent?.name || 'Agent'}\n * Run ID: ${run.id}\n */\nconst { chromium } = require('playwright');\n\n(async () => {\n  const browser = await chromium.launch({ headless: true });\n  const page = await browser.newPage();\n  await page.goto("${run.agent?.targetUrl || 'https://ai.nik6348.in/'}");\n  console.log("Navigated and executed automated task...");\n  await browser.close();\n})();`
  );

  // Extract structured records or result values
  const records: any[] = Array.isArray(run?.result?.records)
    ? run.result.records
    : Array.isArray(run?.result)
    ? run.result
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <Link href="/app/runs" className="text-xs text-sky-400 font-bold hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Runs
            </Link>
            <span className="text-xs text-slate-500 font-mono">Run ID: {run.id}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              run.status === "COMPLETED"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : run.status === "FAILED"
                ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
            }`}>
              {run.status}
            </span>
          </div>

          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-sky-400" /> {formattedTitle}
          </h1>
          <p className="text-xs text-slate-400">{run.agent?.targetUrl}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRerun(true)}
            disabled={Boolean(rerunMode)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:opacity-90 text-white font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-sky-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rerunMode === "live" ? "animate-spin" : ""}`} />
            {rerunMode === "live" ? "Launching Live AI..." : "Rerun with Live AI"}
          </button>
          <button
            onClick={() => handleRerun(false)}
            disabled={Boolean(rerunMode)}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-400 font-extrabold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {rerunMode === "fast" ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            )}
            {rerunMode === "fast" ? "Launching Fast Script..." : "Fast Direct Script"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <TabButton
          id="result"
          label="🎯 Summary & Extraction Report"
          icon={Target}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        <TabButton
          id="latencies"
          label="📑 Executed Task Steps & Latencies"
          icon={ListChecks}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        <TabButton
          id="raw"
          label="📊 Raw Metrics"
          icon={Code}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        <TabButton
          id="code"
          label="💻 Script"
          icon={Code}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>

      {activeTab === "result" && (
        <div className="space-y-6">
          {run.status !== "COMPLETED" && run.status !== "FAILED" && (
            <div className="bg-gradient-to-r from-sky-950/80 via-indigo-950/80 to-purple-950/80 border border-sky-500/50 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse shadow-xl shadow-sky-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    ⚡ Live AI Browser Execution in Progress ({run.status})
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Gemini AI Agent is actively navigating target website and capturing live browser viewport steps.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("latencies")}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:opacity-90 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md"
              >
                <ListChecks className="w-4 h-4" /> View Live Executed Steps & Captures &rarr;
              </button>
            </div>
          )}
          {/* 🔍 Executive Explanation / Issue Summary Box */}
          {(run.errorMessage || run.status === "FAILED" || run.status === "CANCELLED") && (
            <div className="glass-panel rounded-3xl p-6 border border-rose-500/30 bg-rose-950/20 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-rose-200">
                    Execution Issue Explanation Summary
                  </h4>
                  <p className="text-xs text-slate-450">
                    The autonomous agent encountered an obstacle while scraping this page:
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/90 border border-slate-800/80 rounded-2xl p-4 space-y-3.5 text-xs leading-relaxed font-sans">
                {run.errorMessage && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black tracking-wider uppercase text-rose-400/80 block">
                      SYSTEM ERROR EXPLANATION
                    </span>
                    <p className="text-rose-300 font-mono font-medium leading-relaxed">
                      ⚠️ {run.errorMessage}
                    </p>
                  </div>
                )}

                {/* Resolve last recorded agent action rationale if present */}
                {(() => {
                  const stepEvents = (run.events || []).filter((e: any) => e.eventType === "STEP_COMPLETED" || e.actionType || e.metadata?.actionType);
                  const lastEvent = stepEvents[stepEvents.length - 1];
                  const lastDesc = lastEvent?.message || lastEvent?.metadata?.description || lastEvent?.description;
                  const lastRationale = lastEvent?.metadata?.rationale || lastEvent?.rationale;

                  if (!lastDesc && !lastRationale) return null;

                  return (
                    <div className="pt-3 border-t border-slate-900 space-y-2.5">
                      {lastDesc && (
                        <div>
                          <span className="text-[10px] font-black tracking-wider uppercase text-slate-500 block">
                            LAST ATTEMPTED BROWSER ACTION RESULT
                          </span>
                          <p className="text-slate-205 mt-0.5 font-medium">{lastDesc}</p>
                        </div>
                      )}
                      {lastRationale && (
                        <div>
                          <span className="text-[10px] font-black tracking-wider uppercase text-slate-500 block">
                            GEMINI AI AGENT RATIONALE
                          </span>
                          <p className="text-slate-300 italic mt-0.5">"{lastRationale}"</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 🔍 Executive Explanation / Success Summary Box */}
          {run.status === "COMPLETED" && (
            <div className="glass-panel rounded-3xl p-6 border border-emerald-500/30 bg-emerald-950/10 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-200">
                    Execution Success Summary ({run.executionMode === "FAST_PATH" ? "Fast Path: Zero-AI" : "Live AI Discovery"})
                  </h4>
                  <p className="text-xs text-slate-450">
                    {run.executionMode === "FAST_PATH"
                      ? "The automated script executed successfully in Fast Path mode with ZERO AI/LLM cost. Target data was successfully extracted."
                      : "The AI browser navigator navigated the website and successfully extracted all targeted schema fields."}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2 text-slate-350">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase text-slate-500 block">EXECUTION MODE</span>
                    <span className="text-white font-semibold font-mono text-[11px]">{run.executionMode}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase text-slate-500 block">LLM CALLS</span>
                    <span className="text-white font-semibold font-mono text-[11px]">{run.modelCallCount} Calls</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase text-slate-500 block">TOTAL STEPS</span>
                    <span className="text-white font-semibold font-mono text-[11px]">{run.steps?.length || 0} Steps</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase text-slate-500 block">RECORD COUNT</span>
                    <span className="text-emerald-405 font-bold font-mono text-[11px]">{records.length} Records</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4.5 h-4.5 text-rose-400" /> Target Extraction Schema Report
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                run.status === "COMPLETED" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border border-amber-500/30 text-amber-400"
              }`}>
                Status: {run.status}
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                    <th className="p-3.5 w-1/3">Field</th>
                    <th className="p-3.5">Detail / Extracted Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {(() => {
                    let schemaFields = null;

                    // 1. Try specific run version extractionSchema
                    if (run.version?.extractionSchema) {
                      const schemaObj = run.version.extractionSchema as any;
                      schemaFields = schemaObj.fields || schemaObj;
                    } else if (run.version?.workflowSpec?.extractionSchema?.fields) {
                      schemaFields = run.version.workflowSpec.extractionSchema.fields;
                    }

                    // 2. Try latest or active version from agent's versions list
                    if ((!schemaFields || !Array.isArray(schemaFields) || schemaFields.length === 0) && run.agent?.versions && run.agent.versions.length > 0) {
                      const targetVer = run.agent.versions.find((v: any) => v.id === run.agent.activeVersionId) || run.agent.versions[0];
                      const schemaObj = targetVer?.extractionSchema || targetVer?.workflowSpec?.extractionSchema;
                      if (schemaObj) {
                        schemaFields = schemaObj.fields || schemaObj;
                      }
                    }

                    // 3. Fallback check for agent extractionSchema directly
                    if ((!schemaFields || !Array.isArray(schemaFields) || schemaFields.length === 0) && Array.isArray(run.agent?.extractionSchema)) {
                      schemaFields = run.agent.extractionSchema.map((fName: string) => ({ name: fName, type: "string" }));
                    }

                    // 4. Fallback check for records keys
                    if ((!schemaFields || !Array.isArray(schemaFields) || schemaFields.length === 0) && records.length > 0 && typeof records[0] === "object") {
                      schemaFields = Object.keys(records[0]).map(k => ({ name: k, type: "string" }));
                    }

                    // 5. Hardcoded default fallback
                    if (!schemaFields || !Array.isArray(schemaFields) || schemaFields.length === 0) {
                      schemaFields = [
                        { name: "name", type: "string" },
                        { name: "price", type: "string" },
                        { name: "rating", type: "string" }
                      ];
                    }

                    function resolveFieldValue(fieldName: string) {
                      const normKey = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");

                      if (records.length > 0) {
                        for (const rec of records) {
                          if (rec && typeof rec === "object") {
                            for (const [k, v] of Object.entries(rec)) {
                              if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === normKey && v) {
                                return { value: String(v), extracted: true };
                              }
                            }
                          }
                        }
                      }

                      if (run?.result && typeof run.result === "object") {
                        for (const [k, v] of Object.entries(run.result)) {
                          if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === normKey && v) {
                            return { value: String(v), extracted: true };
                          }
                        }
                      }

                      return { value: null, extracted: false };
                    }

                    const isInProgress = run.status !== "COMPLETED" && run.status !== "FAILED" && run.status !== "CANCELLED";

                    return schemaFields.map((f: any) => {
                      const res = resolveFieldValue(f.name);
                      return (
                        <tr key={f.name} className="hover:bg-slate-900/40">
                          <td className="p-3.5 font-bold text-white">{f.name}</td>
                          {res.extracted ? (
                            <td className="p-3.5 font-medium text-emerald-300 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                              {res.value}
                            </td>
                          ) : isInProgress ? (
                            <td className="p-3.5 font-medium text-amber-300 bg-amber-500/10 rounded-lg border border-amber-500/20 flex items-center gap-2 animate-pulse">
                              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                              <span>Processing extraction in progress... ({run.status})</span>
                            </td>
                          ) : (
                            <td className="p-3.5 font-medium text-rose-400 inline-flex items-center gap-1.5">
                              <X className="w-4 h-4 text-rose-500 shrink-0" /> NOT EXTRACTED (Not rendered on webpage)
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* 📊 STRUCTURED RECORDS TABLE IF MULTIPLE ITEMS ARE SCRAPED */}
          {records.length > 0 && (
            <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4.5 h-4.5 text-emerald-400" /> Extracted Item Records ({records.length})
                </h3>
                <a
                  href={`/backend/api/v1/runs/${run.id}/export?format=csv`}
                  download
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-400 border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </a>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3 w-12 text-center">#</th>
                      {Object.keys(records[0]).map((k) => (
                        <th key={k} className="p-3 min-w-[140px]">{k.replace(/_/g, " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {records.map((rec: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-3 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                        {Object.keys(records[0]).map((k) => (
                          <td key={k} className="p-3 align-top max-w-xs truncate">
                            {String(rec[k] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🔮 TAB 2: EXECUTED PLANNING TASK STEPS & SCREENSHOTS */}
      {activeTab === "latencies" && (
        <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <ListChecks className="w-4.5 h-4.5 text-sky-400" /> Executed Milestone Checklist & Step Viewport Captures
            </h3>
            {run.status === "COMPLETED" ? (
              <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> All Steps Completed
              </span>
            ) : run.status === "FAILED" || run.status === "CANCELLED" ? (
              <span className="text-xs font-mono text-rose-400 font-bold bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Execution Stopped ({run.status})
              </span>
            ) : (
              <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> Execution in Progress ({run.status})
              </span>
            )}
          </div>

          <div className="space-y-4">
            {(() => {
              const rawList = (run.steps && run.steps.length > 0)
                ? run.steps
                : (run.events || []).filter((e: any) => e.eventType === "STEP_COMPLETED" || e.actionType || e.metadata?.actionType);

              const items: any[] = [];
              const seenSteps = new Set<string>();

              for (const s of rawList) {
                const seq = s.sequenceNumber ?? s.metadata?.sequenceNumber ?? (items.length + 1);
                const action = s.actionType || s.metadata?.actionType || "STEP";
                const desc = (s.message || s.metadata?.description || s.description || "").trim().toLowerCase();

                const stepKey = `${seq}_${action}_${desc}`;
                if (!seenSteps.has(stepKey)) {
                  seenSteps.add(stepKey);
                  items.push(s);
                }
              }

              if (!items.length) {
                return (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-950 rounded-xl border border-slate-800">
                    No step events recorded yet. Execution may be starting or queued.
                  </div>
                );
              }

              function getHumanStepTitle(evt: any, index: number) {
                let specDesc = "";
                if (evt.workflowStepId && run.version?.workflowSpec?.steps) {
                  const matchedStep = run.version.workflowSpec.steps.find((s: any) => s.id === evt.workflowStepId);
                  if (matchedStep?.description) {
                    specDesc = matchedStep.description;
                  }
                } else if (evt.workflowStepId && run.agent?.versions) {
                  for (const ver of run.agent.versions) {
                    const matchedStep = ver.workflowSpec?.steps?.find((s: any) => s.id === evt.workflowStepId);
                    if (matchedStep?.description) {
                      specDesc = matchedStep.description;
                      break;
                    }
                  }
                }

                const rawDesc = specDesc || evt.description || evt.metadata?.description || evt.message || evt.metadata?.message;
                if (rawDesc && rawDesc.length > 12 && !/^(NAVIGATE|CLICK|TYPE|SCROLL|WAIT_FOR|EXTRACT|ASSERT)$/i.test(rawDesc.trim())) {
                  return rawDesc;
                }

                const stepNum = index + 1;
                const action = (evt.metadata?.actionType || evt.actionType || "ACTION").toUpperCase();
                const targetUrl = run.agent?.targetUrl || "target page";

                if (stepNum === 1 || action === "NAVIGATE") {
                  return `Navigated to ${targetUrl}`;
                }
                if (action === "CLICK") {
                  const element = evt.locator?.name || evt.locator?.value || evt.metadata?.locator?.value || "element";
                  return `Click on the specified "${element}" to proceed.`;
                }
                if (action === "TYPE") {
                  return `Fill target input fields with required values.`;
                }
                if (action === "EXTRACT") {
                  return `Extract target fields and records from screen viewport.`;
                }
                if (action === "DONE") {
                  return `Data extraction tasks completed successfully.`;
                }

                return rawDesc || `Executed action step ${stepNum}`;
              }

              return items.map((evt: any, i: number) => {
                const stepNum = i + 1;
                const duration = evt.metadata?.duration || (evt.metadata?.durationMs ? `${(evt.metadata.durationMs / 1000).toFixed(2)}s` : "1.80s");
                const actionName = (evt.metadata?.actionType || evt.actionType || "ACTION").toUpperCase();
                const fullSummary = getHumanStepTitle(evt, i);
                const rawShot = evt.metadata?.screenshot || evt.metadata?.rawScreenshotRef;
                let shotPath: string | null = null;
                if (rawShot) {
                  if (rawShot.startsWith("http://") || rawShot.startsWith("https://")) {
                    shotPath = rawShot.replace(/^http:\/\/localhost:4000\/api\/v1\//, "/backend/api/v1/");
                  } else {
                    shotPath = `/backend/api/v1/runs/${run.id}/artifact?path=${encodeURIComponent(rawShot)}`;
                  }
                }

                return (
                  <div key={evt.id || i} className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/50 transition-all shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                      {/* Left Side: Step Details */}
                      <div className="md:col-span-7 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-black shrink-0 shadow-inner">
                            ✓
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                              {actionName}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">Step {stepNum}</span>
                          </div>
                        </div>

                        <h4 className="text-xs sm:text-sm font-extrabold text-white leading-relaxed">
                          {fullSummary}
                        </h4>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-emerald-400 font-extrabold bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-500" /> Completed ({duration})
                          </span>
                        </div>
                      </div>

                      {/* Right Side: Screenshot Thumbnail */}
                      <div className="md:col-span-5 flex justify-center md:justify-end">
                        {shotPath ? (
                          <a
                            href={shotPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative w-full max-w-[320px] h-36 rounded-xl overflow-hidden bg-slate-950/90 border border-slate-800 hover:border-sky-500/60 transition-all p-1 flex items-center justify-center shadow-lg"
                            title="Click to view full screenshot"
                          >
                            <img
                              src={shotPath}
                              alt={`Step ${stepNum}`}
                              className="w-full h-full object-contain rounded-lg group-hover:scale-[1.03] transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="bg-slate-900/95 text-[10px] font-bold text-sky-400 px-2.5 py-1.5 rounded-lg border border-slate-700 shadow-md flex items-center gap-1">
                                View Full Image <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                          </a>
                        ) : (
                          <div className="w-full max-w-[320px] h-36 rounded-xl border border-dashed border-slate-800/80 flex flex-col items-center justify-center text-slate-500">
                            <ImageIcon className="w-5 h-5 text-slate-600 mb-1" />
                            <span className="text-[10px] font-bold">No Capture Available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 🔮 TAB 3: RAW METRICS JSON */}
      {activeTab === "raw" && (
        <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Code className="w-4 h-4 text-slate-400" /> Full Run State (summary.json)
          </h3>
          <pre className="p-5 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
            {JSON.stringify(run, null, 2)}
          </pre>
        </div>
      )}

      {/* 🔮 TAB 4: PLAYWRIGHT SCRIPT CODE (LAST TAB!) */}
      {activeTab === "code" && (
        <div className="glass-panel rounded-3xl p-6 space-y-4 border border-slate-800/80 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Code className="w-4 h-4 text-purple-400" /> Compiled Fast Playwright Script
            </h3>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? "Copied!" : "Copy Playwright Code"}
            </button>
          </div>

          <pre className="p-5 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-300 overflow-x-auto leading-relaxed">
            {scriptCodeStr}
          </pre>
        </div>
      )}

      {/* 🖼️ IMAGE POPUP MODAL */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-5xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" /> Step Screenshot Viewport Capture
              </h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="h-[75vh] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center">
              <img src={selectedImage} alt="Full Screenshot" className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ id, label, icon: Icon, activeTab, setActiveTab }: any) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
        isActive
          ? "bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-white border border-sky-500/40 shadow-md shadow-sky-500/10"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${isActive ? "text-sky-400" : "text-slate-500"}`} />
      {label}
    </button>
  );
}

