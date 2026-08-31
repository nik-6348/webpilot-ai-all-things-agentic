"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Play,
  CheckCircle2,
  GitCommit,
  ShieldCheck,
  Code,
  Save,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Activity,
  History,
  Eye,
  X,
  FileText,
  Database,
  Copy,
  Check,
  Edit3,
  Rocket,
  RefreshCw,
  CalendarClock,
  Loader2
} from "lucide-react";
import { api } from "../../../../lib/api";
import { ScheduleModal } from "../../../../components/ScheduleModal";

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<any>(null);
  const [approval, setApproval] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promptGoal, setPromptGoal] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [activeVersionObj, setActiveVersionObj] = useState<any>(null);
  const [scriptCode, setScriptCode] = useState("");

  // Schema Editor State
  const [schemaFields, setSchemaFields] = useState<Array<{ fieldName: string; fieldType: string; required: boolean; description: string }>>([]);

  function loadVersionData(v: any) {
    setActiveVersionObj(v);
    const schemaObj = v?.workflowSpec?.extractionSchema || v?.extractionSchema;

    let rawFields: any[] = [];
    if (Array.isArray(schemaObj)) {
      rawFields = schemaObj;
    } else if (Array.isArray(schemaObj?.fields)) {
      rawFields = schemaObj.fields;
    }

    if (rawFields.length > 0) {
      setSchemaFields(
        rawFields.map((f: any) => ({
          fieldName: f.name || f.fieldName || "field",
          fieldType: f.type || f.fieldType || "text",
          required: Boolean(f.required),
          description: f.description || "Extracted data field",
        }))
      );
    } else {
      setSchemaFields([
        { fieldName: "product_name", fieldType: "text", required: true, description: "Title or name of the product" },
        { fieldName: "price", fieldType: "text", required: true, description: "Item price or amount" },
        { fieldName: "product_url", fieldType: "url", required: false, description: "Link to product detail page" }
      ]);
    }

    setScriptCode(v?.playwrightScriptCode || "");
  }

  async function loadData() {
    try {
      const x = await api<any>(`/api/v1/agents/${id}`);
      setAgent(x);
      setName(x.name || "");
      setDescription(x.description || "");
      setPromptGoal(x.goal || "");
      setTargetUrl(x.targetUrl || "");

      const activeVer = x.versions?.find((v: any) => v.id === x.activeVersionId) || x.versions?.find((v: any) => v.status === "DRAFT") || x.versions?.[0];
      if (activeVer) loadVersionData(activeVer);

      const aps = await api<any[]>(`/api/v1/approvals?workspaceId=${x.workspaceId}`).catch(() => []);
      if (Array.isArray(aps)) {
        setApproval(aps.find((p) => p.run?.agentId === id && p.type === "PLAN"));
      }
    } catch (e) {
      console.error("Agent load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  const safeFields = Array.isArray(schemaFields) ? schemaFields : [];

  const handleAddField = () => {
    setSchemaFields([
      ...safeFields,
      { fieldName: `field_${safeFields.length + 1}`, fieldType: "text", required: false, description: "Custom field hint" }
    ]);
  };

  const handleRemoveField = (index: number) => {
    setSchemaFields(safeFields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, key: string, value: any) => {
    const updated = [...safeFields];
    if (updated[index]) {
      (updated[index] as any)[key] = value;
      setSchemaFields(updated);
    }
  };

  async function handleApprove() {
    if (!approval) return;
    try {
      await api(`/api/v1/approvals/${approval.id}/approve`, { method: "POST" });
      if (approval.runId) {
        window.location.href = `/app/runs/${approval.runId}`;
      } else {
        await loadData();
      }
    } catch (e: any) {
      alert(`Approval error: ${e.message}`);
    }
  }

  const [runningAgent, setRunningAgent] = useState(false);

  async function handleRunNow() {
    setRunningAgent(true);
    try {
      const out: any = await api("/api/v1/runs", {
        method: "POST",
        body: JSON.stringify({ agentId: id, triggerType: "MANUAL" }),
      });
      if (out?.id) {
        window.location.href = `/app/runs/${out.id}`;
      } else {
        setRunningAgent(false);
      }
    } catch (e: any) {
      alert(`Run launch error: ${e.message}`);
      setRunningAgent(false);
    }
  }

  async function handleSaveAsNewVersion(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const draft = activeVersionObj || agent?.versions?.find((v: any) => v.status === "DRAFT") || agent?.versions?.[0];
    try {
      if (name !== agent.name || description !== agent.description || promptGoal !== agent.goal || targetUrl !== agent.targetUrl) {
        await api(`/api/v1/agents/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, description, goal: promptGoal, targetUrl }),
        });
      }

      if (draft) {
        const updatedSpec = {
          ...draft.workflowSpec,
          goal: promptGoal,
          startUrl: targetUrl,
          extractionSchema: {
            fields: safeFields.map((f) => ({
              name: f.fieldName,
              type: ["string", "number", "boolean", "date", "url", "array"].includes(f.fieldType) ? f.fieldType : "string",
              required: f.required,
              description: f.description,
            })),
          },
        };

        await api(`/api/v1/agents/${id}/versions/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify({ workflowSpec: updatedSpec }),
        });
      }
      alert("Prompt & Schema updated successfully!");
      await loadData();
    } catch (e: any) {
      alert(`Save error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAgent() {
    if (!confirm(`Are you sure you want to delete scraper agent "${agent?.name}"?`)) return;
    try {
      await api(`/api/v1/agents/${id}`, { method: "DELETE" });
      router.push("/app/agents");
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    }
  }

  async function handleToggleAgentStatus() {
    const newStatus = agent?.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await api(`/api/v1/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setAgent({ ...agent, status: newStatus });
    } catch (e: any) {
      alert(`Status toggle error: ${e.message}`);
    }
  }

  async function handleActivateVersion(versionId: string) {
    try {
      await api(`/api/v1/agents/${id}/versions/${versionId}/activate`, { method: "POST" });
      alert("Version successfully activated as PRODUCTION!");
      await loadData();
    } catch (e: any) {
      alert(`Activation error: ${e.message}`);
    }
  }

  const [showPromptModal, setShowPromptModal] = useState(false);
  const [modalPromptInput, setModalPromptInput] = useState("");

  const handleCopyCode = () => {
    if (!scriptCode) return;
    navigator.clipboard.writeText(scriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  async function handleSavePromptModal(e: React.FormEvent) {
    e.preventDefault();
    if (!modalPromptInput.trim()) return;
    setSaving(true);
    try {
      const updatedGoal = modalPromptInput.trim();

      // 1. Update Agent Goal & trigger Gemini AI plan re-generation on backend!
      await api(`/api/v1/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description,
          goal: updatedGoal,
          targetUrl,
          regenerateSchema: true,
        }),
      });

      setShowPromptModal(false);
      alert("AI Agent updated! Gemini AI generated fresh plan & extraction schema.");
      await loadData();
    } catch (e: any) {
      alert(`Prompt update error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVersion() {
    if (!activeVersionObj) return;
    if (agent?.versions?.length <= 1) {
      alert("Cannot delete the only version of this scraper agent.");
      return;
    }
    if (!confirm(`Are you sure you want to delete version "${activeVersionObj.label}"?`)) return;
    try {
      await api(`/api/v1/agents/${id}/versions/${activeVersionObj.id}`, { method: "DELETE" });
      alert(`Version ${activeVersionObj.label} deleted!`);
      await loadData();
    } catch (e: any) {
      alert(`Delete version error: ${e.message}`);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-8 text-center text-slate-400 font-bold">
        Agent not found. <Link href="/app/agents" className="text-sky-400 hover:underline">Back to Agents</Link>
      </div>
    );
  }

  const sortedVersions = [...(agent.versions || [])].reverse();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 🔮 TOP NAVIGATION & ACTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <Link href="/app/agents" className="text-xs text-sky-400 font-bold hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Agents Directory
            </Link>
            <span className="text-xs text-slate-500 font-mono">Agent ID: {id}</span>
            <button
              type="button"
              onClick={handleToggleAgentStatus}
              className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all flex items-center gap-1.5 ${
                agent.status === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
              title="Click to toggle Active / Disabled state"
            >
              <span className={`w-2 h-2 rounded-full ${agent.status === "ACTIVE" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              {agent.status === "ACTIVE" ? "AGENT ACTIVE" : "AGENT DISABLED"}
            </button>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
            <Bot className="w-7 h-7 text-sky-400 shrink-0" /> {agent.name}
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">{agent.description || agent.goal}</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowScheduleModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CalendarClock className="w-4 h-4 text-sky-400" /> Schedule Trigger
          </button>

          <button
            type="button"
            onClick={handleDeleteAgent}
            className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-xs hover:bg-rose-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Delete Scraper Agent
          </button>

          {approval ? (
            <button
              onClick={handleApprove}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve Plan & Launch
            </button>
          ) : (
            <button
              onClick={handleRunNow}
              disabled={runningAgent}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {runningAgent ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Play className="w-4 h-4 fill-white" />}
              {runningAgent ? "Launching Run..." : "Execute Agent Run"}
            </button>
          )}
        </div>
      </div>

      {/* 🏷️ TOP VERSION CONTROL SELECTOR & TOOLBAR */}
      <div className="glass-panel rounded-2xl p-4 border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
            <History className="w-4 h-4" /> Version:
          </div>
          <select
            value={activeVersionObj?.id || ""}
            onChange={(e) => {
              const selectedVer = sortedVersions.find((v: any) => v.id === e.target.value);
              if (selectedVer) loadVersionData(selectedVer);
            }}
            className="bg-slate-950 border border-slate-700 text-white font-bold text-xs rounded-xl p-2.5 focus:border-sky-500 focus:outline-none cursor-pointer"
          >
            {sortedVersions.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.label || "v1.0"} {v.status === "PRODUCTION" ? "(PRODUCTION)" : "(DRAFT)"} - {new Date(v.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
            activeVersionObj?.status === "PRODUCTION" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
          }`}>
            {activeVersionObj?.status === "PRODUCTION" ? "✓ PRODUCTION" : "⚠️ DRAFT VERSION"}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {activeVersionObj?.status !== "PRODUCTION" && (
            <button
              type="button"
              onClick={() => handleActivateVersion(activeVersionObj.id)}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Rocket className="w-3.5 h-3.5" /> Activate as Production
            </button>
          )}

          <button
            type="button"
            onClick={handleDeleteVersion}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700 text-slate-300 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Delete this specific version draft"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Version
          </button>
        </div>
      </div>

      {/* 📐 FULL WIDTH CONFIGURATION & SCHEMA EDITOR */}
      <form onSubmit={handleSaveAsNewVersion} className="glass-panel rounded-2xl p-6 border-slate-800 flex flex-col gap-6 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Scraper Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Default Target Web URL</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sky-300 font-mono text-xs focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 font-bold mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-sky-500 focus:outline-none"
          />
        </div>

        {/* 🎯 NATURAL LANGUAGE PROMPT GOAL (READ-ONLY DISPLAY WITH EDIT MODAL BUTTON) */}
        <div className="glass-panel rounded-xl p-5 border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <label className="block text-white font-extrabold text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" /> Natural Language Prompt Goal
            </label>
            <button
              type="button"
              onClick={() => {
                setModalPromptInput(promptGoal);
                setShowPromptModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-sky-400" /> Edit Prompt Goal
            </button>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 text-white font-sans text-xs leading-relaxed">
            <p className="text-slate-200 text-xs leading-relaxed font-mono">
              {promptGoal}
            </p>
          </div>
        </div>

        {/* 📋 TARGET DATA EXTRACTION SCHEMA TABLE */}
        <div className="glass-panel rounded-xl p-5 border-slate-800 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="font-extrabold text-white text-xs">Structured Output Schema ({safeFields.length} fields)</span>
            </div>
            <button
              type="button"
              onClick={handleAddField}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-2">Field Name</th>
                  <th className="p-2">Data Type</th>
                  <th className="p-2">Required?</th>
                  <th className="p-2">Description / AI Hint</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {safeFields.map((field, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-2">
                      <input
                        type="text"
                        value={field.fieldName}
                        onChange={(e) => handleFieldChange(idx, "fieldName", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs font-bold text-white focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={field.fieldType}
                        onChange={(e) => handleFieldChange(idx, "fieldType", e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs font-mono text-slate-200 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="text">text</option>
                        <option value="number">number</option>
                        <option value="array">array</option>
                        <option value="url">url</option>
                        <option value="date">date</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => handleFieldChange(idx, "required", e.target.checked)}
                          className="w-3.5 h-3.5 accent-sky-500 rounded"
                        />
                        <span className={`text-[11px] font-bold ${field.required ? "text-emerald-400" : "text-slate-400"}`}>
                          {field.required ? "Required" : "Optional"}
                        </span>
                      </label>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={field.description || ""}
                        onChange={(e) => handleFieldChange(idx, "description", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveField(idx)}
                        className="p-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 💻 PLAYWRIGHT SCRIPT CODE VIEWER */}
        <div className="glass-panel rounded-xl p-5 border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-sky-400" />
              <span className="font-extrabold text-white text-xs">Playwright Script Code ({activeVersionObj?.label || "v1.0"})</span>
            </div>

            {scriptCode ? (
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-sky-400" />}
                {copiedCode ? "Copied!" : "Copy Code"}
              </button>
            ) : null}
          </div>

          {scriptCode ? (
            <textarea
              rows={8}
              value={scriptCode}
              onChange={(e) => setScriptCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-emerald-300 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-sky-500"
            />
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col gap-2">
              <span className="font-bold flex items-center gap-1.5">
                ⚡ Fast Path Script Code Available
              </span>
              <p className="text-[11px] text-slate-300">
                Executing an agent run generates a deterministic Playwright script for instant zero-LLM fast-path re-runs.
              </p>
            </div>
          )}
        </div>

        {/* 💾 DEDICATED SAVE SCHEMA & VERSION CHANGES BUTTON */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving Changes..." : "💾 Save Schema & Version Changes"}
          </button>
        </div>
      </form>

      {/* ✏️ PROMPT EDITOR MODAL */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-xl w-full rounded-2xl p-6 border-slate-800 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-400" /> Edit Natural Language Prompt
              </h3>
              <button
                type="button"
                onClick={() => setShowPromptModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromptModal} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">
                  Update Automation Prompt Goal
                </label>
                <textarea
                  rows={4}
                  value={modalPromptInput}
                  onChange={(e) => setModalPromptInput(e.target.value)}
                  required
                  placeholder="e.g. open flipkart and extract top 5 expensive phones - name, price, rating"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white text-xs font-mono leading-relaxed focus:border-sky-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Saving updated prompt goal will automatically discover & regenerate extraction schema fields (`name`, `price`, `rating`).
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:opacity-90 text-white font-extrabold text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${saving ? "animate-spin" : ""}`} /> {saving ? "Updating..." : "✨ Update Prompt & Auto-Regenerate Schema"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📅 SHARED ENTERPRISE SCHEDULE MODAL */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        wsId={agent?.workspaceId}
        agent={agent}
      />
    </div>
  );
}
