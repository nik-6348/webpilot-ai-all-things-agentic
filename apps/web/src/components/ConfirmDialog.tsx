"use client";
import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  impact?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** If set, the confirm button stays disabled until the user types this exact string. */
  typedConfirmation?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Replaces window.confirm()/window.prompt() for destructive actions.
// Native confirm() gives no room for impact detail (how many schedules,
// how many runs) and native prompt()'s "type OK" pattern has no visual
// weight for what is usually the single most destructive action on a
// page. This is keyboard-accessible (Escape to cancel, focus trap-lite,
// autofocus) and shows real impact before the user commits.
export function ConfirmDialog({
  open,
  title,
  description,
  impact,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  typedConfirmation,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      setTyped("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    if (!typedConfirmation) confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, typedConfirmation]);

  if (!open) return null;

  const locked = Boolean(typedConfirmation) && typed !== typedConfirmation;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-start gap-3 p-6 pb-4">
          <div
            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
              danger ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
            }`}
          >
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-dialog-title" className="text-sm font-bold text-white">
              {title}
            </h2>
            <div className="mt-1.5 text-xs text-slate-400 leading-relaxed">{description}</div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="shrink-0 text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {impact && impact.length > 0 && (
          <div className="mx-6 mb-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
            <ul className="space-y-1">
              {impact.map((line, i) => (
                <li key={i} className="text-[11px] font-semibold text-rose-300 flex items-start gap-1.5">
                  <span className="mt-1 w-1 h-1 rounded-full bg-rose-400 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {typedConfirmation && (
          <div className="mx-6 mb-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Type <span className="font-mono text-rose-400">{typedConfirmation}</span> to confirm
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-rose-500"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-900"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={locked}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors ${
              danger ? "bg-rose-600 hover:bg-rose-500" : "bg-sky-600 hover:bg-sky-500"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
