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
  FileText
} from "lucide-react";
import { api } from "../../../../lib/api";

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<any>(null);
  const [approval, setApproval] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Selected Version Modal Inspector
  const [selectedVersion, setSelectedVersion] = useState<any>(null);

  // Schema Editor State (Human Readable Schema)
  const [schemaFields, setSchemaFields] = useState<Array<{ fieldName: string; fieldType: string; required: boolean; description: string }>>([
    { fieldName: "Product ID / Order ID", fieldType: "text", required: true, description: "Unique identifier for the item" },
    { fieldName: "Supplier Name", fieldType: "text", required: true, description: "Vendor or seller name" },
    { fieldName: "Status", fieldType: "text", required: true, description: "Current execution status" },
    { fieldName: "ETA / Date", fieldType: "date", required: false, description: "Estimated delivery timestamp" },
    { fieldName: "Total Amount", fieldType: "number", required: true, description: "Total price or financial value" }
  ]);

  async function loadData() {
    try {
      const x = await api<any>(`/api/v1/agents/${id}`);
      setAgent(x);

      const draft = x.versions?.find((v: any) => v.status === "DRAFT");
      if (draft && draft.workflowSpec?.extractionSchema) {
        setSchemaFields(draft.workflowSpec.extractionSchema);
      }

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

  const handleAddField = () => {
    setSchemaFields([
      ...schemaFields,
      { fieldName: `New Field ${schemaFields.length + 1}`, fieldType: "text", required: false, description: "Field description" }
    ]);
  };

  const handleRemoveField = (index: number) => {
    setSchemaFields(schemaFields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, key: string, value: any) => {
    const updated = [...schemaFields];
    (updated[index] as any)[key] = value;
    setSchemaFields(updated);
  };

  async function handleApprove() {
    if (!approval) return;
    await api(`/api/v1/approvals/${approval.id}/approve`, { method: "POST" });
    await loadData();
  }

  async function handleRunNow() {
    const out: any = await api("/api/v1/runs", {
      method: "POST",
      body: JSON.stringify({ agentId: id, triggerType: "MANUAL" }),
    });
    if (out?.id) router.push(`/app/runs/${out.id}`);
  }

  async function handleSaveDraft() {
    const v = agent.versions.find((v: any) => v.status === "DRAFT");
    if (!v) return;
    await api(`/api/v1/agents/${id}/versions/${v.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        workflowSpec: {
          ...(v.workflowSpec || {}),
          extractionSchema: schemaFields
        }
      }),
    });
    alert("Saved draft extraction schema!");
    loadData();
  }

  async function handleActivateVersion(v: any) {
    await api(`/api/v1/agents/${id}/versions/${v.id}/activate`, {
      method: "POST",
    });
    setSelectedVersion(null);
    loadData();
  }

  async function handleRunVersion(v: any) {
    const out: any = await api(`/api/v1/agents/${id}/versions/${v.id}/run`, {
      method: "POST",
    });
    if (out?.id) router.push(`/app/runs/${out.id}`);
  }

  if (loading) {
    return <div className="py-20 text-center text-xs text-slate-400">Loading agent configuration...</div>;
  }

  if (!agent) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-lg font-bold text-white">Agent Not Found</h2>
        <Link href="/app/agents" className="text-xs font-bold text-sky-400 hover:underline">
          Back to Agents Directory
        </Link>
      </div>
    );
  }

  const draftVersion = agent.versions?.find((v: any) => v.status === "DRAFT");
  const prodVersion = agent.versions?.find((v: any) => v.status === "PRODUCTION");

  return (
    <div className="space-y-8">
      {/* 🔮 HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <Link href="/app/agents" className="text-xs text-sky-400 font-bold hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Agents
            </Link>
            <span className="text-xs text-slate-500 font-mono">Agent ID: {agent.id}</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {agent.status || "ACTIVE"}
            </span>
          </div>

          <h1 className="text-3xl font-black text-white">{agent.name}</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">{agent.goal}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunNow}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-white" /> Run Agent Now
          </button>
        </div>
      </div>

      {/* 📈 STATS METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <span className="text-xs font-bold text-slate-400">Active Production Version</span>
          <div className="text-2xl font-black text-white mt-2 font-mono flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-indigo-400" /> {prodVersion?.label || "v1.0 (Initial)"}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <span className="text-xs font-bold text-slate-400">Total Immutable Versions</span>
          <div className="text-2xl font-black text-white mt-2 font-mono flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" /> {agent.versions?.length || 1} Versions
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <span className="text-xs font-bold text-slate-400">Executed Runs</span>
          <div className="text-2xl font-black text-white mt-2 font-mono flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" /> {agent.runs?.length || 0} Executions
          </div>
        </div>
      </div>

      {/* 🔮 HUMAN-READABLE EXTRACTION SCHEMA BUILDER */}
      <div className="glass-panel rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" /> Target Extraction Schema (Human-Readable)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Define expected data fields, types, and required validation rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddField}
              className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sky-400 font-bold text-xs transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>

            {draftVersion && (
              <button
                onClick={handleSaveDraft}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-colors flex items-center gap-1 shadow-md shadow-indigo-500/20"
              >
                <Save className="w-3.5 h-3.5" /> Save Schema
              </button>
            )}

            {approval && (
              <button
                onClick={handleApprove}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-colors flex items-center gap-1 shadow-md shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Run
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {schemaFields.map((field, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Field Name */}
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Field Name</label>
                  <input
                    type="text"
                    value={field.fieldName}
                    onChange={(e) => handleFieldChange(idx, "fieldName", e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Field Type */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Type</label>
                  <select
                    value={field.fieldType}
                    onChange={(e) => handleFieldChange(idx, "fieldType", e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-sky-400 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="date">date</option>
                    <option value="array">array</option>
                    <option value="url">url</option>
                  </select>
                </div>

                {/* Required Switch */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rule</label>
                  <button
                    type="button"
                    onClick={() => handleFieldChange(idx, "required", !field.required)}
                    className={`w-full px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-colors ${
                      field.required
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    {field.required ? "Required" : "Optional"}
                  </button>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                  <input
                    type="text"
                    value={field.description}
                    onChange={(e) => handleFieldChange(idx, "description", e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveField(idx)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors shrink-0 self-end md:self-center"
                title="Remove Field"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 📜 IMMUTABLE VERSION HISTORY TABLE */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" /> Immutable Version History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="pb-3 px-3">Version Tag</th>
                <th className="pb-3 px-3">Source Origin</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {agent.versions?.map((v: any) => (
                <tr key={v.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-3 font-mono font-bold text-white flex items-center gap-2">
                    <GitCommit className="w-4 h-4 text-indigo-400" /> {v.label}
                  </td>
                  <td className="py-3.5 px-3 text-slate-400 font-medium">{v.source || "AI Discovery"}</td>
                  <td className="py-3.5 px-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      v.status === "PRODUCTION"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right space-x-2">
                    <button
                      onClick={() => setSelectedVersion(v)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Version Details
                    </button>

                    <button
                      onClick={() => handleRunVersion(v)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] transition-colors"
                    >
                      Run
                    </button>

                    {v.status !== "PRODUCTION" && (
                      <button
                        onClick={() => handleActivateVersion(v)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors"
                      >
                        Promote to Production
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔍 INTERACTIVE VERSION DETAILS MODAL */}
      {selectedVersion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Version Details Inspector</span>
                <h2 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
                  <GitCommit className="w-5 h-5 text-indigo-400" /> {selectedVersion.label} ({selectedVersion.status})
                </h2>
              </div>
              <button
                onClick={() => setSelectedVersion(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Instruction Prompt</h4>
                <p className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white leading-relaxed">
                  {selectedVersion.prompt || agent.goal}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Configured Extraction Schema Fields</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(selectedVersion.workflowSpec?.extractionSchema || schemaFields).map((f: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                      <span className="font-bold text-white">{f.fieldName}</span>
                      <span className="font-mono text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                        {f.fieldType} ({f.required ? "Required" : "Optional"})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setSelectedVersion(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
              >
                Close Inspector
              </button>

              <div className="flex items-center gap-2">
                {selectedVersion.status !== "PRODUCTION" && (
                  <button
                    onClick={() => handleActivateVersion(selectedVersion)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-colors shadow-md shadow-indigo-500/20"
                  >
                    Promote to Production
                  </button>
                )}

                <button
                  onClick={() => handleRunVersion(selectedVersion)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-colors shadow-md shadow-emerald-500/20"
                >
                  Run Version Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
