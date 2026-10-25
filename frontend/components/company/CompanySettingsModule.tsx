"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Clock,
  Calendar,
  ShieldCheck,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
  Check,
  Building,
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface CompanySettingsModuleProps {
  isDarkMode?: boolean;
}

export const CompanySettingsModule: React.FC<CompanySettingsModuleProps> = ({
  isDarkMode = false,
}) => {
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Form Data State
  const [formData, setFormData] = useState({
    sod_cutoff: "10:30",
    eod_cutoff: "19:30",
    regularization_days: 7,
    expense_claim_days: 30,
    notice_period_days: 60,
    policy_gate_enabled: true,
    ticket_sla_enabled: true,
    fiscal_year_start: 4,
    timezone: "Asia/Kolkata",
    currency: "INR",
  });

  // Fetch Company Settings
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<any>("/company-settings");
      const data = res?.data || res;
      setCompanySettings(data);

      if (data?.settings) {
        const s = data.settings;
        setFormData({
          sod_cutoff: s.sod_cutoff || "10:30",
          eod_cutoff: s.eod_cutoff || "19:30",
          regularization_days: s.regularization_days ?? 7,
          expense_claim_days: s.expense_claim_days ?? 30,
          notice_period_days: s.notice_period_days ?? 60,
          policy_gate_enabled: Boolean(s.policy_gate_enabled),
          ticket_sla_enabled: Boolean(s.ticket_sla_enabled),
          fiscal_year_start: s.fiscal_year_start ?? 4,
          timezone: s.timezone || "Asia/Kolkata",
          currency: s.currency || "INR",
        });
      }
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to load company settings", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotify(null);

    try {
      const payload = {
        sod_cutoff: formData.sod_cutoff,
        eod_cutoff: formData.eod_cutoff,
        regularization_days: Number(formData.regularization_days),
        expense_claim_days: Number(formData.expense_claim_days),
        notice_period_days: Number(formData.notice_period_days),
        policy_gate_enabled: formData.policy_gate_enabled,
        ticket_sla_enabled: formData.ticket_sla_enabled,
        fiscal_year_start: Number(formData.fiscal_year_start),
        timezone: formData.timezone,
        currency: formData.currency.toUpperCase(),
      };

      const res = await fetchApi<any>("/company-settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setNotify({ msg: "Company settings updated successfully!", type: "success" });
      fetchSettings();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to update company settings", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const meanings = companySettings?.meaning || {};

  if (loading && !companySettings) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[350px]">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-3" />
        <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
          Loading company configuration & settings...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 font-sans">
      {/* NOTIFICATION BANNER */}
      {notify && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all shadow-lg animate-in fade-in slide-in-from-top-2 ${
            notify.type === "success"
              ? isDarkMode
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
              : isDarkMode
              ? "bg-rose-950/80 border-rose-500/40 text-rose-300"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notify.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notify.msg}</span>
          </div>
        </div>
      )}

      {/* HEADER CARD */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden backdrop-blur-xl transition-all ${
          isDarkMode
            ? "bg-[#0B1A30]/90 border-white/[0.08] shadow-2xl"
            : "bg-white border-slate-200 shadow-xl"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-md">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                {companySettings?.name || "Company"} Settings
              </h1>
              <p className={`text-xs mt-0.5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Slug: <span className="font-mono text-purple-400 font-bold">{companySettings?.slug}</span> •
                Status: <span className="capitalize font-bold text-emerald-400">{companySettings?.status}</span>
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: WORKDAY & CUTOFF TIMES */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode
              ? "bg-[#0B1A30]/90 border-white/[0.08]"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2.5 border-b pb-4 border-slate-700/20">
            <Clock className="w-5 h-5 text-purple-400" />
            <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Workday & Daily Report Cutoff Times
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-400">SOD Cutoff Time (24h format)</label>
                <span className="text-[10px] text-purple-400 font-mono">HH:MM</span>
              </div>
              <input
                type="text"
                value={formData.sod_cutoff}
                onChange={(e) => setFormData({ ...formData, sod_cutoff: e.target.value })}
                placeholder="10:30"
                className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
              {meanings.sod_cutoff && (
                <p className="text-[10px] text-slate-400 mt-1 flex items-start gap-1">
                  <Info className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                  <span>{meanings.sod_cutoff}</span>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-400">EOD Cutoff Time (24h format)</label>
                <span className="text-[10px] text-purple-400 font-mono">HH:MM</span>
              </div>
              <input
                type="text"
                value={formData.eod_cutoff}
                onChange={(e) => setFormData({ ...formData, eod_cutoff: e.target.value })}
                placeholder="19:30"
                className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
              {meanings.eod_cutoff && (
                <p className="text-[10px] text-slate-400 mt-1 flex items-start gap-1">
                  <Info className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                  <span>{meanings.eod_cutoff}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: OPERATIONAL & COMPLIANCE WINDOWS */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode
              ? "bg-[#0B1A30]/90 border-white/[0.08]"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2.5 border-b pb-4 border-slate-700/20">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Operational Windows (Days)
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold mb-1 text-slate-400">
                Attendance Regularization Window (0 - 90 Days)
              </label>
              <input
                type="number"
                min={0}
                max={90}
                value={formData.regularization_days}
                onChange={(e) =>
                  setFormData({ ...formData, regularization_days: Number(e.target.value) })
                }
                className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
              {meanings.regularization_days && (
                <p className="text-[10px] text-slate-400 mt-1 flex items-start gap-1">
                  <Info className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                  <span>{meanings.regularization_days}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-400">
                Expense Claim Window (1 - 365 Days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={formData.expense_claim_days}
                onChange={(e) =>
                  setFormData({ ...formData, expense_claim_days: Number(e.target.value) })
                }
                className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
              {meanings.expense_claim_days && (
                <p className="text-[10px] text-slate-400 mt-1 flex items-start gap-1">
                  <Info className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                  <span>{meanings.expense_claim_days}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-400">
                Notice Period Duration (0 - 180 Days)
              </label>
              <input
                type="number"
                min={0}
                max={180}
                value={formData.notice_period_days}
                onChange={(e) =>
                  setFormData({ ...formData, notice_period_days: Number(e.target.value) })
                }
                className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
              {meanings.notice_period_days && (
                <p className="text-[10px] text-slate-400 mt-1 flex items-start gap-1">
                  <Info className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                  <span>{meanings.notice_period_days}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CARD 3: FEATURE & POLICY GATES */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode
              ? "bg-[#0B1A30]/90 border-white/[0.08]"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2.5 border-b pb-4 border-slate-700/20">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Feature Gates & Enforcement
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div
              onClick={() =>
                setFormData({ ...formData, policy_gate_enabled: !formData.policy_gate_enabled })
              }
              className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                formData.policy_gate_enabled
                  ? isDarkMode
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-emerald-50 border-emerald-200"
                  : isDarkMode
                  ? "bg-white/[0.03] border-white/[0.06]"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div>
                <div className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  Mandatory Policy Gate
                </div>
                {meanings.policy_gate_enabled && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {meanings.policy_gate_enabled}
                  </p>
                )}
              </div>
              <div
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                  formData.policy_gate_enabled ? "bg-emerald-500" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    formData.policy_gate_enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </div>

            <div
              onClick={() =>
                setFormData({ ...formData, ticket_sla_enabled: !formData.ticket_sla_enabled })
              }
              className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                formData.ticket_sla_enabled
                  ? isDarkMode
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-emerald-50 border-emerald-200"
                  : isDarkMode
                  ? "bg-white/[0.03] border-white/[0.06]"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div>
                <div className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  Support Ticket SLA Tracking
                </div>
                {meanings.ticket_sla_enabled && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {meanings.ticket_sla_enabled}
                  </p>
                )}
              </div>
              <div
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                  formData.ticket_sla_enabled ? "bg-emerald-500" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    formData.ticket_sla_enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: REGIONAL & FISCAL SETUP */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode
              ? "bg-[#0B1A30]/90 border-white/[0.08]"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2.5 border-b pb-4 border-slate-700/20">
            <Globe className="w-5 h-5 text-cyan-400" />
            <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Regional & Fiscal Configuration
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold mb-1 text-slate-400">Fiscal Year Start Month</label>
              <select
                value={formData.fiscal_year_start}
                onChange={(e) =>
                  setFormData({ ...formData, fiscal_year_start: Number(e.target.value) })
                }
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                {[
                  { m: 1, name: "January" },
                  { m: 2, name: "February" },
                  { m: 3, name: "March" },
                  { m: 4, name: "April (Default India/UK)" },
                  { m: 5, name: "May" },
                  { m: 6, name: "June" },
                  { m: 7, name: "July (Default US/AU)" },
                  { m: 8, name: "August" },
                  { m: 9, name: "September" },
                  { m: 10, name: "October" },
                  { m: 11, name: "November" },
                  { m: 12, name: "December" },
                ].map((item) => (
                  <option key={item.m} value={item.m}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-400">Timezone</label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                placeholder="Asia/Kolkata"
                className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-400">Currency Code (3 chars)</label>
              <input
                type="text"
                maxLength={3}
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                placeholder="INR"
                className={`w-full p-3 rounded-2xl border font-mono uppercase outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

export default CompanySettingsModule;
