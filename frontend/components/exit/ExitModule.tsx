"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LogOut,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  X,
  Check,
  UploadCloud,
  Trash2,
  Eye,
  Edit3,
  Building,
  CheckSquare,
  Square,
  MessageSquare,
  FileCheck,
  User,
  Info,
} from "lucide-react";
import { fetchApi, extractList } from "@/lib/api";
import { clockOf, dateOf } from "@/lib/format";

interface ExitModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

export const ExitModule: React.FC<ExitModuleProps> = ({
  isDarkMode = false,
  activeTab: initialTab = "exits",
}) => {
  const [tab, setTab] = useState<"exits" | "clearance-pending" | "clearance-items">(
    initialTab === "clearance" ? "clearance-pending" : "exits"
  );

  useEffect(() => {
    if (initialTab === "clearance") {
      setTab("clearance-pending");
    } else if (initialTab === "clearance-items") {
      setTab("clearance-items");
    } else {
      setTab("exits");
    }
  }, [initialTab]);

  // States for Exits List
  const [exits, setExits] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [exitTypes, setExitTypes] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loadingExits, setLoadingExits] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [exitTypeFilter, setExitTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Action States
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedExit, setSelectedExit] = useState<any | null>(null);
  const [decisionModal, setDecisionModal] = useState<{
    type: "manager-approve" | "hr-approve" | "reject" | "lwd" | "complete" | null;
    exit: any | null;
  }>({ type: null, exit: null });

  // Form States for Apply Resignation
  const [applyForm, setApplyForm] = useState({
    exit_type: "resignation",
    resignation_date: new Date().toISOString().split("T")[0],
    requested_last_working_date: "",
    reason: "",
  });

  // Form States for Decision Modal
  const [decisionForm, setDecisionForm] = useState({
    last_working_date: "",
    remarks: "",
    reason: "",
    force: false,
    force_reason: "",
  });

  // States for Clearance Checklist & Pending Department Clearance
  const [clearanceDepts, setClearanceDepts] = useState<any[]>([]);
  const [clearanceItems, setClearanceItems] = useState<any[]>([]);
  const [pendingClearances, setPendingClearances] = useState<any[]>([]);
  const [loadingClearance, setLoadingClearance] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({
    id: "",
    department: "it",
    title: "",
    description: "",
    is_required: true,
  });

  const [notify, setNotify] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Exit Types & Statuses
  const fetchMetadata = async () => {
    try {
      const res = await fetchApi<any>("/exits/types");
      const data = res?.data || res;
      setExitTypes(data?.exit_types || []);
      setStatuses(data?.statuses || {});
    } catch {
      // ignore
    }
  };

  // 2. Fetch Exits List & Summary
  const fetchExitsData = async () => {
    setLoadingExits(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (exitTypeFilter) params.append("exit_type", exitTypeFilter);

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const [exitsRes, summaryRes] = await Promise.all([
        fetchApi<any>(`/exits${queryStr}`),
        fetchApi<any>("/exits/summary").catch(() => null),
      ]);

      setExits(extractList(exitsRes));
      if (summaryRes) setSummary(summaryRes?.data || summaryRes);
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to fetch exit records", type: "error" });
    } finally {
      setLoadingExits(false);
    }
  };

  // 3. Fetch Clearance Data
  const fetchClearanceData = async () => {
    setLoadingClearance(true);
    try {
      const [deptsRes, itemsRes, pendingRes] = await Promise.all([
        fetchApi<any>("/clearance-items/departments").catch(() => null),
        fetchApi<any>("/clearance-items").catch(() => null),
        fetchApi<any>("/clearance/pending").catch(() => null),
      ]);

      if (deptsRes) {
        const dData = deptsRes?.data || deptsRes;
        setClearanceDepts(dData?.departments || []);
      }
      if (itemsRes) setClearanceItems(extractList(itemsRes));
      if (pendingRes) {
        const pData = pendingRes?.data || pendingRes;
        setPendingClearances(Array.isArray(pData) ? pData : pData?.pending || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingClearance(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (tab === "exits") {
      fetchExitsData();
    } else {
      fetchClearanceData();
    }
  }, [tab, statusFilter, exitTypeFilter]);

  // Handle Resignation Submission
  const handleApplyResignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.reason.trim()) {
      setNotify({ msg: "Please state the reason for resignation", type: "error" });
      return;
    }

    setSubmitting(true);
    setNotify(null);
    try {
      await fetchApi("/exits", {
        method: "POST",
        body: JSON.stringify(applyForm),
      });

      setNotify({ msg: "Resignation submitted successfully for manager approval", type: "success" });
      setShowApplyModal(false);
      setApplyForm({
        exit_type: "resignation",
        resignation_date: new Date().toISOString().split("T")[0],
        requested_last_working_date: "",
        reason: "",
      });
      fetchExitsData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to submit resignation", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Decision Actions (Manager Approve / HR Approve / LWD / Reject / Complete)
  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionModal.exit || !decisionModal.type) return;

    setSubmitting(true);
    setNotify(null);

    const exitId = decisionModal.exit.id;
    let endpoint = `/exits/${exitId}/${decisionModal.type}`;
    let method = "PUT";
    let bodyPayload: any = {};

    if (decisionModal.type === "manager-approve" || decisionModal.type === "hr-approve") {
      bodyPayload = {
        last_working_date: decisionForm.last_working_date || undefined,
        remarks: decisionForm.remarks,
      };
    } else if (decisionModal.type === "reject") {
      bodyPayload = { reason: decisionForm.reason };
    } else if (decisionModal.type === "lwd") {
      endpoint = `/exits/${exitId}/last-working-date`;
      bodyPayload = {
        last_working_date: decisionForm.last_working_date,
        remarks: decisionForm.remarks,
      };
    } else if (decisionModal.type === "complete") {
      bodyPayload = {
        force: decisionForm.force,
        force_reason: decisionForm.force_reason,
      };
    }

    try {
      await fetchApi(endpoint, {
        method,
        body: JSON.stringify(bodyPayload),
      });

      setNotify({ msg: `Exit action '${decisionModal.type}' executed successfully!`, type: "success" });
      setDecisionModal({ type: null, exit: null });
      fetchExitsData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Action failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Clearance Item Save (Master Checklist)
  const handleSaveClearanceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (itemForm.id) {
        await fetchApi(`/clearance-items/${itemForm.id}`, {
          method: "PUT",
          body: JSON.stringify(itemForm),
        });
      } else {
        await fetchApi("/clearance-items", {
          method: "POST",
          body: JSON.stringify(itemForm),
        });
      }

      setNotify({ msg: "Clearance checklist item saved!", type: "success" });
      setShowItemModal(false);
      setItemForm({ id: "", department: "it", title: "", description: "", is_required: true });
      fetchClearanceData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to save clearance item", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Clearance Signoff (Department Approval/Rejection per Exit Item)
  const handleSignoffClearance = async (
    exitId: number,
    clearanceId: number,
    status: "approved" | "rejected",
    remarks: string
  ) => {
    try {
      await fetchApi(`/exits/${exitId}/clearance/${clearanceId}`, {
        method: "PUT",
        body: JSON.stringify({ status, remarks }),
      });
      setNotify({ msg: `Clearance marked as ${status}!`, type: "success" });
      fetchClearanceData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Signoff failed", type: "error" });
    }
  };

  // Filtered Exits
  const filteredExits = useMemo(() => {
    return exits.filter((ex) => {
      const q = searchQuery.toLowerCase().trim();
      const empName = ex.employee?.user?.name || ex.employee?.name || "";
      const empCode = ex.employee?.employee_code || "";
      const reason = ex.reason || "";
      return (
        empName.toLowerCase().includes(q) ||
        empCode.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q)
      );
    });
  }, [exits, searchQuery]);

  return (
    <div className="space-y-6 font-sans">
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
          <button onClick={() => setNotify(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 via-purple-600 to-indigo-600 text-white shadow-md">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Exits & Offboarding Workspace
              </h1>
              <p className={`text-xs mt-0.5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Manage employee resignations, notice periods, departmental clearances, and final exit signoffs.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowApplyModal(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Resignation</span>
          </button>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/20 text-xs">
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-purple-50/60 border-purple-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Exits</div>
            <div className="text-lg font-black text-purple-400 mt-0.5">
              {summary?.total_exits ?? exits.length}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-amber-50/60 border-amber-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pending Approval</div>
            <div className="text-lg font-black text-amber-400 mt-0.5">
              {summary?.pending_approval ?? exits.filter((e) => e.status === "pending").length}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-cyan-50/60 border-cyan-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Serving Notice</div>
            <div className="text-lg font-black text-cyan-400 mt-0.5">
              {summary?.serving_notice ?? exits.filter((e) => e.status === "serving_notice").length}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-emerald-50/60 border-emerald-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Completed Exits</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              {summary?.exited ?? exits.filter((e) => e.status === "exited").length}
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS & CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-700/20">
          <div
            className={`p-1 rounded-2xl border flex items-center gap-1 ${
              isDarkMode ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-100 border-slate-200"
            }`}
          >
            <button
              onClick={() => setTab("exits")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "exits"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Resignations & Exits List
            </button>
            <button
              onClick={() => setTab("clearance-pending")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "clearance-pending"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Department Clearance Signoffs
            </button>
            <button
              onClick={() => setTab("clearance-items")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "clearance-items"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Clearance Master Items
            </button>
          </div>

          {tab === "exits" && (
            <div className="flex flex-wrap items-center gap-3 flex-1 sm:flex-initial">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff, code, reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-2xl text-xs outline-none border transition-all ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-100 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-3 py-2 rounded-2xl text-xs font-semibold outline-none border cursor-pointer ${
                  isDarkMode
                    ? "bg-[#081425] border-white/[0.08] text-white focus:border-rose-500"
                    : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                <option value="">All Statuses</option>
                {Object.entries(statuses).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>

              <button
                onClick={fetchExitsData}
                className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${loadingExits ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}

          {tab === "clearance-items" && (
            <button
              onClick={() => {
                setItemForm({ id: "", department: "it", title: "", description: "", is_required: true });
                setShowItemModal(true);
              }}
              className="px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Checklist Item</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: EXITS LIST */}
      {tab === "exits" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border ${
            isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
          }`}
        >
          {loadingExits ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mb-3" />
              <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Loading exit records...
              </p>
            </div>
          ) : filteredExits.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No employee exit records found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr
                    className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                      isDarkMode ? "border-white/[0.08] text-slate-400" : "border-slate-200 text-slate-500"
                    }`}
                  >
                    <th className="pb-3 px-2">Employee</th>
                    <th className="pb-3 px-2">Type</th>
                    <th className="pb-3 px-2">Resignation Date</th>
                    <th className="pb-3 px-2">Last Working Date</th>
                    <th className="pb-3 px-2">Status</th>
                    <th className="pb-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/20">
                  {filteredExits.map((ex) => {
                    const empName = ex.employee_name || ex.employee?.user?.name || ex.employee?.name || "Staff Member";
                    const empCode = ex.employee?.employee_code || "";

                    return (
                      <tr
                        key={ex.id}
                        className={`transition-colors ${
                          isDarkMode ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-3.5 px-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {empName[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                                {empName}
                              </div>
                              <div className="text-[10px] font-mono text-rose-400">{empCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-2 capitalize font-semibold text-slate-300">
                          {ex.exit_type ? ex.exit_type.replace("_", " ") : "Resignation"}
                        </td>
                        <td className="py-3.5 px-2 font-mono text-slate-400">{ex.resignation_date || "N/A"}</td>
                        <td className="py-3.5 px-2 font-mono font-bold text-amber-400">
                          {ex.last_working_date || ex.requested_last_working_date || "Pending"}
                        </td>
                        <td className="py-3.5 px-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                              ex.status === "pending"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : ex.status === "manager_approved"
                                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                : ex.status === "serving_notice"
                                ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                                : ex.status === "exited"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {statuses[ex.status] || ex.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedExit(ex)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isDarkMode
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                                  : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                              }`}
                              title="View Exit Details & Clearance"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {ex.status === "pending" && (
                              <button
                                onClick={() => {
                                  setDecisionForm({
                                    last_working_date: ex.requested_last_working_date || "",
                                    remarks: "",
                                    reason: "",
                                    force: false,
                                    force_reason: "",
                                  });
                                  setDecisionModal({ type: "manager-approve", exit: ex });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Manager Approve
                              </button>
                            )}

                            {ex.status === "manager_approved" && (
                              <button
                                onClick={() => {
                                  setDecisionForm({
                                    last_working_date: ex.requested_last_working_date || "",
                                    remarks: "",
                                    reason: "",
                                    force: false,
                                    force_reason: "",
                                  });
                                  setDecisionModal({ type: "hr-approve", exit: ex });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold cursor-pointer"
                              >
                                HR Approve
                              </button>
                            )}

                            {ex.status === "serving_notice" && (
                              <button
                                onClick={() => {
                                  setDecisionForm({
                                    last_working_date: "",
                                    remarks: "",
                                    reason: "",
                                    force: false,
                                    force_reason: "",
                                  });
                                  setDecisionModal({ type: "complete", exit: ex });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Mark Exited
                              </button>
                            )}

                            {(ex.status === "pending" || ex.status === "manager_approved") && (
                              <button
                                onClick={() => {
                                  setDecisionForm({
                                    last_working_date: "",
                                    remarks: "",
                                    reason: "",
                                    force: false,
                                    force_reason: "",
                                  });
                                  setDecisionModal({ type: "reject", exit: ex });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 text-[10px] font-bold cursor-pointer"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEPARTMENT CLEARANCE SIGNOFFS */}
      {tab === "clearance-pending" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between border-b pb-4 border-slate-700/20">
            <div>
              <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Department Offboarding Clearance Queue
              </h3>
              <p className="text-xs text-slate-400">
                Department heads review & sign off pending clearance items for offboarding employees.
              </p>
            </div>
            <button
              onClick={fetchClearanceData}
              className="p-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loadingClearance ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loadingClearance ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading clearance tasks...</div>
          ) : pendingClearances.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No pending department clearance tasks for your team.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingClearances.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isDarkMode
                      ? "bg-white/[0.02] border-white/[0.06]"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-400">
                        {item.department || "Dept"}
                      </span>
                      <span className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                        {item.title}
                      </span>
                    </div>
                    {item.description && <p className="text-[11px] text-slate-400">{item.description}</p>}
                    <div className="text-[10px] text-slate-400">
                      Employee Exit: <span className="font-bold text-amber-400">{item.employee_name || "Staff"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        handleSignoffClearance(item.employee_exit_id, item.id, "approved", "Approved by Dept Head")
                      }
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() =>
                        handleSignoffClearance(item.employee_exit_id, item.id, "rejected", "Dues/Items Pending")
                      }
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CLEARANCE MASTER ITEMS (ADMIN) */}
      {tab === "clearance-items" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
          }`}
        >
          <div className="border-b pb-4 border-slate-700/20">
            <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Master Department Clearance Items
            </h3>
            <p className="text-xs text-slate-400">
              Configure master checklist templates required for offboarding (e.g. IT laptop return, Finance dues).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clearanceItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border space-y-2 ${
                  isDarkMode
                    ? "bg-white/[0.02] border-white/[0.06]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-400">
                    {item.department}
                  </span>
                  {item.is_required && (
                    <span className="text-[10px] font-bold text-rose-400">Required</span>
                  )}
                </div>
                <h4 className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {item.title}
                </h4>
                {item.description && <p className="text-[11px] text-slate-400 line-clamp-2">{item.description}</p>}

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-700/20">
                  <button
                    onClick={() => {
                      setItemForm({
                        id: item.id,
                        department: item.department || "it",
                        title: item.title || "",
                        description: item.description || "",
                        is_required: Boolean(item.is_required),
                      });
                      setShowItemModal(true);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("Delete clearance item?")) return;
                      await fetchApi(`/clearance-items/${item.id}`, { method: "DELETE" });
                      fetchClearanceData();
                    }}
                    className="p-1 text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: SUBMIT RESIGNATION */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-lg p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-700/20">
              <h2 className="text-lg font-black tracking-tight">Submit Resignation Request</h2>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyResignation} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Exit Type</label>
                <select
                  value={applyForm.exit_type}
                  onChange={(e) => setApplyForm({ ...applyForm, exit_type: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-[#081425] border-white/[0.08] text-white focus:border-rose-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="resignation">Standard Resignation</option>
                  <option value="contract_end">End of Contract</option>
                  <option value="retirement">Retirement</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Resignation Date</label>
                <input
                  type="date"
                  value={applyForm.resignation_date}
                  onChange={(e) => setApplyForm({ ...applyForm, resignation_date: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Requested Last Working Date</label>
                <input
                  type="date"
                  value={applyForm.requested_last_working_date}
                  onChange={(e) => setApplyForm({ ...applyForm, requested_last_working_date: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Reason for Resignation *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="State detailed reason for leaving..."
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 text-white font-bold shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  <span>Submit Resignation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DECISION MODAL (APPROVE / REJECT / LWD / COMPLETE) */}
      {decisionModal.type && decisionModal.exit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black capitalize tracking-tight">
                Exit Action: {decisionModal.type.replace("-", " ")}
              </h2>
              <button
                onClick={() => setDecisionModal({ type: null, exit: null })}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDecisionSubmit} className="space-y-4 text-xs">
              {(decisionModal.type === "manager-approve" ||
                decisionModal.type === "hr-approve" ||
                decisionModal.type === "lwd") && (
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Confirmed Last Working Date</label>
                  <input
                    type="date"
                    value={decisionForm.last_working_date}
                    onChange={(e) => setDecisionForm({ ...decisionForm, last_working_date: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              )}

              {decisionModal.type === "reject" ? (
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Rejection Reason *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Reason for rejecting resignation..."
                    value={decisionForm.reason}
                    onChange={(e) => setDecisionForm({ ...decisionForm, reason: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              ) : decisionModal.type === "complete" ? (
                <div className="space-y-3">
                  <p className="text-slate-300">
                    Marking exit as complete will mark the employee as EXITED and disable their login account.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={decisionForm.force}
                      onChange={(e) => setDecisionForm({ ...decisionForm, force: e.target.checked })}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-bold text-rose-400">Force Complete (Bypass pending clearances)</span>
                  </label>
                  {decisionForm.force && (
                    <input
                      type="text"
                      placeholder="Reason for force exit..."
                      value={decisionForm.force_reason}
                      onChange={(e) => setDecisionForm({ ...decisionForm, force_reason: e.target.value })}
                      className={`w-full p-3 rounded-2xl border outline-none ${
                        isDarkMode
                          ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                          : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    />
                  )}
                </div>
              ) : (
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Remarks / Approval Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Optional notes for employee..."
                    value={decisionForm.remarks}
                    onChange={(e) => setDecisionForm({ ...decisionForm, remarks: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDecisionModal({ type: null, exit: null })}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Processing..." : "Confirm Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MASTER CLEARANCE ITEM MODAL */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">
                {itemForm.id ? "Edit Checklist Item" : "New Clearance Checklist Item"}
              </h2>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClearanceItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Responsible Department</label>
                <select
                  value={itemForm.department}
                  onChange={(e) => setItemForm({ ...itemForm, department: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-[#081425] border-white/[0.08] text-white focus:border-rose-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  {clearanceDepts.map((d: any) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                  {clearanceDepts.length === 0 && (
                    <>
                      <option value="it">IT Department</option>
                      <option value="finance">Finance & Accounts</option>
                      <option value="admin">Admin & Assets</option>
                      <option value="hr">Human Resources</option>
                      <option value="manager">Reporting Manager</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Checklist Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Laptop & Charger Handover"
                  value={itemForm.title}
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional details or return requirements..."
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={itemForm.is_required}
                  onChange={(e) => setItemForm({ ...itemForm, is_required: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-bold text-slate-300">Mandatory Clearance Item</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Saving..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VIEW EXIT DETAILS & CLEARANCE STATUS */}
      {selectedExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-2xl p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-700/20">
              <div>
                <h2 className="text-lg font-black tracking-tight">Exit & Offboarding Record Details</h2>
                <p className="text-xs text-slate-400">
                  Staff: {selectedExit.employee?.user?.name || selectedExit.employee?.name} (
                  {selectedExit.employee?.employee_code})
                </p>
              </div>
              <button onClick={() => setSelectedExit(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Resignation Date</div>
                <div className="font-mono font-bold text-slate-200">{selectedExit.resignation_date || "N/A"}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Confirmed LWD</div>
                <div className="font-mono font-bold text-amber-400">
                  {selectedExit.last_working_date || selectedExit.requested_last_working_date || "Pending"}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <h4 className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">Resignation Reason</h4>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-300">
                {selectedExit.reason}
              </div>
            </div>

            {selectedExit.clearances && selectedExit.clearances.length > 0 && (
              <div className="space-y-3 text-xs">
                <h4 className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">
                  Department Clearance Progress
                </h4>
                <div className="space-y-2">
                  {selectedExit.clearances.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-200">{c.clearance_item?.title || "Item"}</div>
                        <div className="text-[10px] text-slate-400">Dept: {c.clearance_item?.department}</div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          c.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : c.status === "rejected"
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-700/20">
              <button
                onClick={() => setSelectedExit(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExitModule;
