"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Sliders,
  Check,
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface CompanyModulesModalProps {
  companyId: string | number;
  companyName: string;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const CompanyModulesModal: React.FC<CompanyModulesModalProps> = ({
  companyId,
  companyName,
  isOpen,
  onClose,
  isDarkMode = false,
}) => {
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Load Company Modules
  const fetchModules = async () => {
    if (!companyId || !isOpen) return;
    setLoading(true);
    try {
      const res = await fetchApi<any>(`/companies/${companyId}/modules`);
      const data = res?.data || res;
      setModules(data?.modules || []);
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to load company modules", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, [companyId, isOpen]);

  const handleToggleModule = (moduleName: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.module === moduleName ? { ...m, is_enabled: !m.is_enabled } : m
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setNotify(null);

    const modulesMap: Record<string, boolean> = {};
    modules.forEach((m) => {
      modulesMap[m.module] = Boolean(m.is_enabled);
    });

    try {
      await fetchApi(`/companies/${companyId}/modules`, {
        method: "PUT",
        body: JSON.stringify({ modules: modulesMap }),
      });

      setNotify({ msg: "Company tenant modules updated successfully!", type: "success" });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to save company modules", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
          isDarkMode
            ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-black/80"
            : "bg-white border-slate-200 text-slate-900 shadow-xl"
        }`}
      >
        {/* MODAL HEADER */}
        <div
          className={`p-6 border-b flex items-center justify-between ${
            isDarkMode ? "border-white/[0.08]" : "border-slate-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-lg font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Tenant Feature Modules
              </h2>
              <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Company: <span className="text-purple-400 font-bold">{companyName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isDarkMode
                ? "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NOTIFICATION BANNER */}
        {notify && (
          <div
            className={`px-6 py-3 border-b text-xs font-bold flex items-center gap-2 ${
              notify.type === "success"
                ? isDarkMode
                  ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
                : isDarkMode
                ? "bg-rose-950/80 border-rose-500/40 text-rose-300"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {notify.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notify.msg}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-none">
          {loading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-3" />
              <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Loading tenant modules...
              </p>
            </div>
          ) : modules.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No module configurations found for this tenant company.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {modules.map((m) => (
                <div
                  key={m.module}
                  onClick={() => handleToggleModule(m.module)}
                  className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all select-none ${
                    m.is_enabled
                      ? isDarkMode
                        ? "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/15"
                        : "bg-purple-50/80 border-purple-200 hover:bg-purple-100/80"
                      : isDarkMode
                      ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] opacity-60"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 opacity-60"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-black capitalize ${
                          m.is_enabled
                            ? isDarkMode
                              ? "text-white"
                              : "text-slate-900"
                            : "text-slate-400"
                        }`}
                      >
                        {m.module.replace("_", " ")}
                      </span>
                      {m.permissions > 0 && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                          {m.permissions} perms
                        </span>
                      )}
                    </div>
                    {m.note && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{m.note}</p>
                    )}
                  </div>

                  {/* Toggle Switch */}
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                      m.is_enabled ? "bg-purple-600" : "bg-slate-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        m.is_enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          className={`p-6 border-t flex items-center justify-between ${
            isDarkMode ? "border-white/[0.08]" : "border-slate-100"
          }`}
        >
          <div className="text-[11px] text-slate-400 font-semibold">
            Super Admin Tenant Gate Control
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                isDarkMode
                  ? "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Save Tenant Modules</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyModulesModal;
