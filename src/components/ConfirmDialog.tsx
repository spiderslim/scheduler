import React, { useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useModalA11y } from '../lib/useModalA11y';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmDialogProps {
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ options, onConfirm, onCancel }: ConfirmDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useModalA11y(!!options, containerRef, onCancel);

  if (!options) return null;

  const { title, message, confirmLabel = 'Confirm', danger = true } = options;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm transition-colors"
        onClick={onCancel}
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={containerRef}
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 pointer-events-auto"
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                danger
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-500'
                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{message}</p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm rounded transition-colors ${
                danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
