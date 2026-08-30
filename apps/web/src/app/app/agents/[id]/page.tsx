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

      const draft = x.versions?.find((v: any) => v.status === "DRAFT") || x.versions?.[0];
      const schemaObj = draft?.workflowSpec?.extractionSchema;

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

  const safeFields = Array.isArray(schemaFields) ? schemaFields : [];

  const handleAddField = () => {
    setSchemaFields([
      ...safeFields,
      { fieldName: `New Field ${safeFields.length + 1}`, fieldType: "text", required: false, description: "Field description" }
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
    const draft = agent?.versions?.find((v: any) => v.status === "DRAFT");
    if (!draft) return;
    try {
      const updatedSpec = {
        ...draft.workflowSpec,
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
      alert("Schema updated successfully!");
      await loadData();
    } catch (e: any) {
      alert(`Save error: ${e.message}`);
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

  const activeVersion = agent.versions?.find((v: any) => v.id === agent.activeVersionId) || agent.versions?.[0];
  const draftVersion = agent.versions?.find((v: any) => v.status === "DRAFT");

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* 🔮 TOP NAVIGATION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="space-y-1">
          <Link href="/app/agents" className="text-xs text-sky-400 font-bold hover:underline flex items-center gap-1 w-fit mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Agents Directory
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
              <Bot className="w-7 h-7 text-sky-400 shrink-0" /> {agent.name}
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {activeVersion?.label || "v1.0-draft"} Active
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">{agent.description || agent.goal}</p>
        </div>

        <div className="flex items-center gap-3">
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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" /> Execute Agent Run
            </button>
          )}
        </div>
      </div>

      {/* 📌 HUMAN-READABLE EXTRACTION SCHEMA EDITOR */}
      <div className="glass-panel rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Structured Output Schema (Human Readable)
            </span>
            <h2 className="text-lg font-black text-white mt-0.5">Extracted Data Fields & Mapping Rules</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddField}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1 border border-slate-700"
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
          {safeFields.map((field, idx) => (
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
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    {field.required ? "Required Field" : "Optional Field"}
                  </button>
                </div>

                {/* Field Description */}
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
                className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/30 flex items-center justify-center shrink-0 transition-colors"
                title="Remove Field"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 📜 AGENT VERSIONS HISTORY TABLE */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Version History & Lineage
            </span>
            <h2 className="text-lg font-black text-white mt-0.5">Agent Workflow Versions</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Version Label</th>
                <th className="py-3 px-4">Source Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {agent.versions?.map((v: any) => (
                <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-100 flex items-center gap-2">
                    <GitCommit className="w-3.5 h-3.5 text-sky-400" /> {v.label}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700">
                      {v.source}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {v.status === "PRODUCTION" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        PRODUCTION
                      </span>
                    )}
                    {v.status === "DRAFT" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        DRAFT
                      </span>
                    )}
                    {v.status === "ARCHIVED" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                        ARCHIVED
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                    {new Date(v.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedVersion(v)}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-[11px] border border-slate-700 inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> Inspect Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔮 MODAL: VERSION DETAILS INSPECTOR */}
      {selectedVersion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Version Inspector</span>
                <h2 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                  <GitCommit className="w-4 h-4 text-sky-400" /> {selectedVersion.label} Workflow Details
                </h2>
              </div>
              <button
                onClick={() => setSelectedVersion(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Automated Playwright Execution Steps</label>
                <div className="space-y-2">
                  {selectedVersion.workflowSpec?.steps?.map((step: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-200">{step.description}</span>
                          <span className="block text-[10px] font-mono text-slate-500 mt-0.5">Type: {step.type} | Risk: {step.risk || "LOW"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Compiled WorkflowSpec JSON</label>
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
                  {JSON.stringify(selectedVersion.workflowSpec, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedVersion(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
