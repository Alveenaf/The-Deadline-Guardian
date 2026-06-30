import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  severity?: "danger" | "warning" | "info";
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Yes, delete",
  cancelText = "Cancel",
  severity = "danger"
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const severityColor = severity === "danger"
    ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
    : severity === "warning"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
      : "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";

  const confirmBtnColor = severity === "danger" 
    ? "bg-rose-600 hover:bg-rose-500 text-white" 
    : severity === "warning"
      ? "bg-amber-600 hover:bg-amber-500 text-white"
      : "bg-indigo-600 hover:bg-indigo-500 text-white";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0B0F19]/80 backdrop-blur-md"
        />

        {/* Dialog Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="relative w-full max-w-md bg-[#13192B] border border-white/10 rounded-2xl p-5 shadow-2xl z-10 overflow-hidden text-left"
        >
          {/* Top colored accent line */}
          <div className={`absolute top-0 left-0 w-full h-[2px] ${
            severity === "danger" 
              ? "bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" 
              : severity === "warning"
                ? "bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"
                : "bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"
          }`} />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex gap-4 items-start">
            <div className={`p-2.5 rounded-xl border ${severityColor}`}>
              {severity === "danger" ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 space-y-1.5">
              <h3 className="text-sm font-bold text-white tracking-tight leading-none pt-1">{title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">{message}</p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${confirmBtnColor}`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
