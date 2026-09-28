"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { X, AlertTriangle, Eye, Pencil, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";

export interface ActionModalProps<T = any> {
  isOpen: boolean;
  type: "view" | "edit" | "delete" | null;
  entityTitle: string; // e.g. "Employee", "Department", "Designation", "Company"
  data: T | null;
  fields?: FieldConfig<any>[];
  schema?: z.ZodSchema<any>;
  onClose: () => void;
  onConfirmDelete?: (data: T) => Promise<void>;
  onSaveEdit?: (data: any) => Promise<void>;
  isDarkMode?: boolean;
}

export function ActionModal<T extends Record<string, any>>({
  isOpen,
  type,
  entityTitle,
  data,
  fields = [],
  schema,
  onClose,
  onConfirmDelete,
  onSaveEdit,
  isDarkMode = true,
}: ActionModalProps<T>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Reset error when modal opens/closes
  useEffect(() => {
    setErrorMessage(null);
  }, [isOpen, type, data]);

  if (!isOpen || !type || !data) return null;

  const handleDelete = async () => {
    if (!onConfirmDelete) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirmDelete(data);
      onClose();
    } catch (error: any) {
      console.error("Delete action failed:", error);
      setErrorMessage(error.message || "Failed to delete item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (formData: any) => {
    if (!onSaveEdit) return;
    try {
      setIsSubmitting(true);
      await onSaveEdit({ ...data, ...formData });
      onClose();
    } catch (error) {
      console.error("Edit action failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format keys for view mode
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/_/g, " ");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop Blur Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !isSubmitting && onClose()}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={`relative w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden z-10 ${
              isDarkMode
                ? "bg-[#0B1A30]/95 border-white/[0.12] text-white shadow-indigo-950/50"
                : "bg-white border-slate-200 text-slate-900 shadow-slate-300"
            }`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between px-6 py-4 border-b ${
                isDarkMode ? "border-white/[0.08]" : "border-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {type === "delete" && (
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
                {type === "view" && (
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Eye className="w-5 h-5" />
                  </div>
                )}
                {type === "edit" && (
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Pencil className="w-5 h-5" />
                  </div>
                )}

                <div>
                  <h3 className="font-extrabold text-base sm:text-lg tracking-tight capitalize">
                    {type === "delete" && `Delete ${entityTitle}`}
                    {type === "view" && `${entityTitle} Details`}
                    {type === "edit" && `Edit ${entityTitle}`}
                  </h3>
                  <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {type === "delete" && "This action cannot be undone."}
                    {type === "view" && `Viewing full profile for ${data.name || data.code || entityTitle}.`}
                    {type === "edit" && "Update details and save changes below."}
                  </p>
                </div>
              </div>

              <button
                disabled={isSubmitting}
                onClick={onClose}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isDarkMode
                    ? "hover:bg-slate-800 text-slate-400 hover:text-white"
                    : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* DELETE MODE */}
              {type === "delete" && (
                <div className="space-y-4">
                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                      {errorMessage}
                    </div>
                  )}

                  <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Are you sure you want to permanently delete{" "}
                    <strong className={isDarkMode ? "text-white" : "text-slate-900"}>
                      "{data.name || data.code || data.email || "this item"}"
                    </strong>
                    ? Associated data will be removed from the system.
                  </p>

                  <div
                    className={`p-3.5 rounded-xl border text-xs font-mono space-y-1 ${
                      isDarkMode
                        ? "bg-slate-900/60 border-slate-800 text-slate-300"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div>ID: {data.id}</div>
                    {data.name && <div>Name: {data.name}</div>}
                    {data.code && <div>Code: {data.code}</div>}
                    {data.email && <div>Email: {data.email}</div>}
                  </div>
                </div>
              )}

              {/* VIEW MODE */}
              {type === "view" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {Object.entries(data)
                    .filter(([key]) => !["actions"].includes(key))
                    .map(([key, val]) => (
                      <div
                        key={key}
                        className={`p-3 rounded-xl border space-y-1 ${
                          isDarkMode ? "bg-slate-900/50 border-white/[0.06]" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${
                          isDarkMode ? "text-slate-400" : "text-slate-500"
                        }`}>
                          {formatKey(key)}
                        </span>
                        <div className="font-semibold text-xs sm:text-sm break-all">
                          {typeof val === "object" && val !== null ? (
                            JSON.stringify(val)
                          ) : String(val ?? "-") === "active" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-extrabold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            String(val ?? "-")
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* EDIT MODE */}
              {type === "edit" && schema && fields.length > 0 && (
                <DynamicForm
                  title=""
                  description=""
                  schema={schema}
                  fields={fields}
                  defaultValues={data}
                  onSubmit={handleEditSubmit}
                  onCancel={onClose}
                  submitText="Save Changes"
                  isDarkMode={isDarkMode}
                />
              )}
            </div>

            {/* Footer for Delete and View Modes */}
            {type !== "edit" && (
              <div
                className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${
                  isDarkMode ? "border-white/[0.08] bg-slate-900/40" : "border-slate-100 bg-slate-50"
                }`}
              >
                <button
                  disabled={isSubmitting}
                  onClick={onClose}
                  className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    isDarkMode
                      ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                      : "border-slate-300 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {type === "delete" ? "Cancel" : "Close"}
                </button>

                {type === "delete" && (
                  <button
                    disabled={isSubmitting}
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span>{isSubmitting ? "Deleting..." : "Confirm Delete"}</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
