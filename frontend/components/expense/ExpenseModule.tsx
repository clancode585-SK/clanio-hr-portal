"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  DollarSign,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
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
  FileText,
  Building,
  User,
  ArrowRight,
  TrendingUp,
  Download,
  Paperclip,
  CheckSquare,
  Square,
  ShieldCheck,
  CheckCheck,
} from "lucide-react";
import { fetchApi, extractList } from "@/lib/api";

interface ExpenseModuleProps {
  isDarkMode?: boolean;
}

export const ExpenseModule: React.FC<ExpenseModuleProps> = ({
  isDarkMode = false,
}) => {
  const [tab, setTab] = useState<"claims" | "pending-approval" | "pending-verification" | "payout">("claims");

  // Main Data States
  const [claims, setClaims] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  // Modals & Action States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: "approve" | "verify" | "pay" | "reject" | null;
    claim: any | null;
  }>({ type: null, claim: null });

  // Bulk Payment Selection
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [showBulkPayModal, setShowBulkPayModal] = useState(false);

  // Form States for Create Claim
  const [createForm, setCreateForm] = useState({
    category: "travel",
    purpose: "",
    expense_date: new Date().toISOString().split("T")[0],
    amount: "",
    description: "",
  });
  const [billFiles, setBillFiles] = useState<File[]>([]);

  // Form States for Decision / Payment
  const [decisionForm, setDecisionForm] = useState({
    remarks: "",
    reason: "",
    verified_amount: "",
    payment_mode: "bank_transfer",
    payment_reference: "",
    paid_on: new Date().toISOString().split("T")[0],
    payment_remarks: "",
  });

  const [notify, setNotify] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Categories & Payment Modes
  const fetchMetadata = async () => {
    try {
      const res = await fetchApi<any>("/expense-claims/categories");
      const data = res?.data || res;
      setCategories(data?.categories || []);
      setPaymentModes(data?.payment_modes || {});
    } catch {
      // ignore
    }
  };

  // 2. Fetch Claims & Summary
  const fetchClaimsData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (categoryFilter) params.append("category", categoryFilter);

      let endpoint = "/expense-claims";
      if (tab === "pending-approval") endpoint = "/expense-claims/pending-approvals";
      else if (tab === "pending-verification") endpoint = "/expense-claims/pending-verification";
      else if (tab === "payout") endpoint = "/expense-claims/pending-payout";

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const [claimsRes, summaryRes] = await Promise.all([
        fetchApi<any>(`${endpoint}${queryStr}`),
        fetchApi<any>(`/expense-claims/summary?month=${selectedMonth}`).catch(() => null),
      ]);

      setClaims(extractList(claimsRes));
      if (summaryRes) setSummary(summaryRes?.data || summaryRes);
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to fetch expense claims", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchClaimsData();
  }, [tab, statusFilter, categoryFilter, selectedMonth]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      if (filesArr.length + billFiles.length > 5) {
        setNotify({ msg: "Maximum 5 receipt bill files allowed per claim", type: "error" });
        return;
      }
      setBillFiles((prev) => [...prev, ...filesArr]);
    }
  };

  // Submit New Expense Claim
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.amount || parseFloat(createForm.amount) <= 0) {
      setNotify({ msg: "Please enter a valid expense amount", type: "error" });
      return;
    }

    setSubmitting(true);
    setNotify(null);

    const formData = new FormData();
    formData.append("category", createForm.category);
    if (createForm.purpose) formData.append("purpose", createForm.purpose);
    formData.append("expense_date", createForm.expense_date);
    formData.append("amount", createForm.amount);
    formData.append("description", createForm.description);

    billFiles.forEach((file) => {
      formData.append("bills[]", file);
    });

    try {
      await fetchApi("/expense-claims", {
        method: "POST",
        body: formData,
      });

      setNotify({ msg: "Expense reimbursement claim submitted successfully!", type: "success" });
      setShowCreateModal(false);
      setCreateForm({
        category: "travel",
        purpose: "",
        expense_date: new Date().toISOString().split("T")[0],
        amount: "",
        description: "",
      });
      setBillFiles([]);
      fetchClaimsData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to submit claim", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Single Claim Decision Action (Approve / Verify / Pay / Reject)
  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal.claim || !actionModal.type) return;

    setSubmitting(true);
    setNotify(null);

    const claimId = actionModal.claim.id;
    const type = actionModal.type;

    let payload: any = {};
    if (type === "approve") {
      payload = { remarks: decisionForm.remarks };
    } else if (type === "verify") {
      payload = {
        verified_amount: decisionForm.verified_amount ? parseFloat(decisionForm.verified_amount) : undefined,
        remarks: decisionForm.remarks,
      };
    } else if (type === "pay") {
      payload = {
        payment_mode: decisionForm.payment_mode,
        payment_reference: decisionForm.payment_reference,
        paid_on: decisionForm.paid_on,
        payment_remarks: decisionForm.payment_remarks,
      };
    } else if (type === "reject") {
      payload = { reason: decisionForm.reason };
    }

    try {
      await fetchApi(`/expense-claims/${claimId}/${type}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setNotify({ msg: `Claim action '${type}' processed successfully!`, type: "success" });
      setActionModal({ type: null, claim: null });
      fetchClaimsData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Action failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Bulk Payment Submission
  const handleBulkPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClaimIds.length === 0) return;

    setSubmitting(true);
    setNotify(null);

    try {
      await fetchApi("/expense-claims/pay-many", {
        method: "POST",
        body: JSON.stringify({
          claims: selectedClaimIds,
          payment_mode: decisionForm.payment_mode,
          payment_reference: decisionForm.payment_reference,
          paid_on: decisionForm.paid_on,
          payment_remarks: decisionForm.payment_remarks,
        }),
      });

      setNotify({ msg: `Bulk payment recorded for ${selectedClaimIds.length} claims!`, type: "success" });
      setShowBulkPayModal(false);
      setSelectedClaimIds([]);
      fetchClaimsData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Bulk payment failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const empName = c.employee?.user?.name || c.employee?.name || "";
      const desc = c.description || "";
      const cat = c.category || "";
      const ref = c.payment_reference || "";
      return (
        empName.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        ref.toLowerCase().includes(q)
      );
    });
  }, [claims, searchQuery]);

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
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Expenses & Claims Terminal
              </h1>
              <p className={`text-xs mt-0.5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Submit reimbursement claims, review manager & HR approvals, and process finance payouts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={`px-3 py-2 rounded-2xl text-xs font-bold outline-none border cursor-pointer ${
                isDarkMode
                  ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                  : "bg-slate-100 border-slate-200 text-slate-900"
              }`}
            />
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Claim Expense</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/20 text-xs">
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-purple-50/60 border-purple-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Claimed</div>
            <div className="text-lg font-black text-purple-400 mt-0.5">
              ₹{(summary?.total_amount ?? summary?.claimed ?? 0).toLocaleString()}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-amber-50/60 border-amber-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pending Approvals</div>
            <div className="text-lg font-black text-amber-400 mt-0.5">
              ₹{(summary?.pending_amount ?? summary?.pending ?? 0).toLocaleString()}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-cyan-50/60 border-cyan-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Verified Payouts</div>
            <div className="text-lg font-black text-cyan-400 mt-0.5">
              ₹{(summary?.verified_amount ?? summary?.verified ?? 0).toLocaleString()}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-emerald-50/60 border-emerald-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Paid Out</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              ₹{(summary?.paid_amount ?? summary?.paid ?? 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS & CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-700/20">
          <div
            className={`p-1 rounded-2xl border flex flex-wrap items-center gap-1 ${
              isDarkMode ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-100 border-slate-200"
            }`}
          >
            <button
              onClick={() => setTab("claims")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "claims"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Claims List
            </button>
            <button
              onClick={() => setTab("pending-approval")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "pending-approval"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Manager Approval Queue
            </button>
            <button
              onClick={() => setTab("pending-verification")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "pending-verification"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              HR Verification Queue
            </button>
            <button
              onClick={() => setTab("payout")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "payout"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Finance Payout Terminal
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 flex-1 sm:flex-initial">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, desc, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 rounded-2xl text-xs outline-none border transition-all ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-emerald-500"
                    : "bg-slate-100 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`px-3 py-2 rounded-2xl text-xs font-semibold outline-none border cursor-pointer ${
                isDarkMode
                  ? "bg-[#081425] border-white/[0.08] text-white focus:border-emerald-500"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            {tab === "payout" && selectedClaimIds.length > 0 && (
              <button
                onClick={() => setShowBulkPayModal(true)}
                className="px-4 py-2 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                <span>Pay Selected ({selectedClaimIds.length})</span>
              </button>
            )}

            <button
              onClick={fetchClaimsData}
              className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                isDarkMode
                  ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* CLAIMS TABLE VIEW */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border ${
          isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
        }`}
      >
        {loading ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
            <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
              Fetching expense claims data...
            </p>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No expense reimbursement claims found matching your criteria.
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
                  {tab === "payout" && (
                    <th className="pb-3 px-2 w-8">
                      <input
                        type="checkbox"
                        checked={
                          selectedClaimIds.length > 0 &&
                          selectedClaimIds.length === filteredClaims.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedClaimIds(filteredClaims.map((c) => c.uuid || String(c.id)));
                          } else {
                            setSelectedClaimIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="pb-3 px-2">Employee</th>
                  <th className="pb-3 px-2">Category</th>
                  <th className="pb-3 px-2">Expense Date</th>
                  <th className="pb-3 px-2">Amount</th>
                  <th className="pb-3 px-2">Bills</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {filteredClaims.map((c) => {
                  const empName = c.employee?.user?.name || c.employee?.name || "Staff Member";
                  const claimUuid = c.uuid || String(c.id);

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isDarkMode ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"
                      }`}
                    >
                      {tab === "payout" && (
                        <td className="py-3.5 px-2">
                          <input
                            type="checkbox"
                            checked={selectedClaimIds.includes(claimUuid)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClaimIds([...selectedClaimIds, claimUuid]);
                              } else {
                                setSelectedClaimIds(selectedClaimIds.filter((id) => id !== claimUuid));
                              }
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3.5 px-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {empName[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                              {empName}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {c.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 capitalize font-semibold text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-extrabold border border-purple-500/20">
                          {c.category ? c.category.replace("_", " ") : "General"}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 font-mono text-slate-400">{c.expense_date || "N/A"}</td>
                      <td className="py-3.5 px-2 font-mono font-black text-emerald-400">
                        ₹{(c.verified_amount ?? c.amount).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 flex items-center gap-1 w-fit">
                          <Paperclip className="w-3 h-3" /> {c.bills_count ?? c.bills?.length ?? 0} bills
                        </span>
                      </td>
                      <td className="py-3.5 px-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                            c.status === "pending"
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : c.status === "manager_approved"
                              ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                              : c.status === "verified"
                              ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                              : c.status === "paid"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedClaim(c)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isDarkMode
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                                : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                            }`}
                            title="View Claim Details & Receipts"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {c.status === "pending" && (
                            <button
                              onClick={() => {
                                setDecisionForm({
                                  remarks: "",
                                  reason: "",
                                  verified_amount: String(c.amount),
                                  payment_mode: "bank_transfer",
                                  payment_reference: "",
                                  paid_on: new Date().toISOString().split("T")[0],
                                  payment_remarks: "",
                                });
                                setActionModal({ type: "approve", claim: c });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Approve
                            </button>
                          )}

                          {c.status === "manager_approved" && (
                            <button
                              onClick={() => {
                                setDecisionForm({
                                  remarks: "",
                                  reason: "",
                                  verified_amount: String(c.amount),
                                  payment_mode: "bank_transfer",
                                  payment_reference: "",
                                  paid_on: new Date().toISOString().split("T")[0],
                                  payment_remarks: "",
                                });
                                setActionModal({ type: "verify", claim: c });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Verify HR
                            </button>
                          )}

                          {c.status === "verified" && (
                            <button
                              onClick={() => {
                                setDecisionForm({
                                  remarks: "",
                                  reason: "",
                                  verified_amount: String(c.verified_amount || c.amount),
                                  payment_mode: "bank_transfer",
                                  payment_reference: "",
                                  paid_on: new Date().toISOString().split("T")[0],
                                  payment_remarks: "",
                                });
                                setActionModal({ type: "pay", claim: c });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Record Payout
                            </button>
                          )}

                          {(c.status === "pending" || c.status === "manager_approved") && (
                            <button
                              onClick={() => {
                                setDecisionForm({
                                  remarks: "",
                                  reason: "",
                                  verified_amount: String(c.amount),
                                  payment_mode: "bank_transfer",
                                  payment_reference: "",
                                  paid_on: new Date().toISOString().split("T")[0],
                                  payment_remarks: "",
                                });
                                setActionModal({ type: "reject", claim: c });
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

      {/* MODAL 1: SUBMIT NEW CLAIM */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-lg p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-700/20">
              <h2 className="text-lg font-black tracking-tight">Submit Expense Reimbursement</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Expense Category *</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-[#081425] border-white/[0.08] text-white focus:border-emerald-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                    {categories.length === 0 && (
                      <>
                        <option value="travel">Travel & Cab</option>
                        <option value="food">Meals & Food</option>
                        <option value="fuel">Fuel Allowance</option>
                        <option value="office_supplies">Office Supplies</option>
                        <option value="software">Software & Licenses</option>
                        <option value="other">Other Expense</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-400">Expense Date *</label>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split("T")[0]}
                    value={createForm.expense_date}
                    onChange={(e) => setCreateForm({ ...createForm, expense_date: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-emerald-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 1500.00"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-emerald-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Expense Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide details about the business expense..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-emerald-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              {/* Receipt File Upload */}
              <div>
                <label className="block font-bold mb-1 text-slate-400">Attach Bills / Receipts (Max 5 files, 10MB each)</label>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className={`w-full p-2.5 rounded-2xl border cursor-pointer ${
                    isDarkMode ? "bg-white/[0.04] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
                {billFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {billFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] font-mono text-emerald-400 flex items-center justify-between"
                      >
                        <span>{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button
                          type="button"
                          onClick={() => setBillFiles(billFiles.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                  <span>Submit Claim</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ACTION MODAL (APPROVE / VERIFY / PAY / REJECT) */}
      {actionModal.type && actionModal.claim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black capitalize tracking-tight">
                Claim Action: {actionModal.type}
              </h2>
              <button
                onClick={() => setActionModal({ type: null, claim: null })}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
              {actionModal.type === "verify" && (
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Verified Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={decisionForm.verified_amount}
                    onChange={(e) => setDecisionForm({ ...decisionForm, verified_amount: e.target.value })}
                    className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              )}

              {actionModal.type === "pay" && (
                <>
                  <div>
                    <label className="block font-bold mb-1 text-slate-400">Payment Mode *</label>
                    <select
                      value={decisionForm.payment_mode}
                      onChange={(e) => setDecisionForm({ ...decisionForm, payment_mode: e.target.value })}
                      className={`w-full p-3 rounded-2xl border outline-none ${
                        isDarkMode
                          ? "bg-[#081425] border-white/[0.08] text-white focus:border-cyan-500"
                          : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    >
                      {Object.entries(paymentModes).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                      {Object.keys(paymentModes).length === 0 && (
                        <>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="upi">UPI Transfer</option>
                          <option value="payroll">Payroll Addition</option>
                          <option value="cash">Petty Cash</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-slate-400">Payment Ref / Transaction ID</label>
                    <input
                      type="text"
                      placeholder="e.g. TXN987654321"
                      value={decisionForm.payment_reference}
                      onChange={(e) => setDecisionForm({ ...decisionForm, payment_reference: e.target.value })}
                      className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                        isDarkMode
                          ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-cyan-500"
                          : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-slate-400">Paid Date</label>
                    <input
                      type="date"
                      value={decisionForm.paid_on}
                      onChange={(e) => setDecisionForm({ ...decisionForm, paid_on: e.target.value })}
                      className={`w-full p-3 rounded-2xl border outline-none ${
                        isDarkMode
                          ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-cyan-500"
                          : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </>
              )}

              {actionModal.type === "reject" ? (
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Rejection Reason *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Reason for rejecting claim..."
                    value={decisionForm.reason}
                    onChange={(e) => setDecisionForm({ ...decisionForm, reason: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-rose-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Remarks / Approval Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Optional notes for claimant..."
                    value={decisionForm.remarks}
                    onChange={(e) => setDecisionForm({ ...decisionForm, remarks: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-emerald-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal({ type: null, claim: null })}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Processing..." : "Confirm Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BULK PAY MODAL */}
      {showBulkPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">
                Bulk Payout ({selectedClaimIds.length} Claims)
              </h2>
              <button onClick={() => setShowBulkPayModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkPaySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Payment Mode *</label>
                <select
                  value={decisionForm.payment_mode}
                  onChange={(e) => setDecisionForm({ ...decisionForm, payment_mode: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-[#081425] border-white/[0.08] text-white focus:border-cyan-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  {Object.entries(paymentModes).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                  {Object.keys(paymentModes).length === 0 && (
                    <>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="upi">UPI Transfer</option>
                      <option value="payroll">Payroll Addition</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Payment Ref / Batch ID</label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-2026-08-01"
                  value={decisionForm.payment_reference}
                  onChange={(e) => setDecisionForm({ ...decisionForm, payment_reference: e.target.value })}
                  className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-cyan-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Paid Date</label>
                <input
                  type="date"
                  value={decisionForm.paid_on}
                  onChange={(e) => setDecisionForm({ ...decisionForm, paid_on: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-cyan-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkPayModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Processing Bulk Payout..." : "Process Payout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VIEW CLAIM DETAILS & RECEIPT BILLS */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-xl p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-700/20">
              <div>
                <h2 className="text-lg font-black tracking-tight">Claim Details</h2>
                <p className="text-xs text-slate-400">
                  Claimant: {selectedClaim.employee?.user?.name || selectedClaim.employee?.name}
                </p>
              </div>
              <button onClick={() => setSelectedClaim(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Category</div>
                <div className="font-bold text-slate-200 capitalize">{selectedClaim.category}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Claim Amount</div>
                <div className="font-mono font-black text-emerald-400 text-sm">
                  ₹{(selectedClaim.verified_amount ?? selectedClaim.amount).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <h4 className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">Description</h4>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-300">
                {selectedClaim.description}
              </div>
            </div>

            {selectedClaim.payment_reference && (
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs space-y-1">
                <div className="text-[10px] uppercase font-bold text-cyan-400">Payment Reference</div>
                <div className="font-mono font-bold text-white">
                  Ref: {selectedClaim.payment_reference} ({selectedClaim.payment_mode})
                </div>
              </div>
            )}

            {/* Bills / Attachments */}
            {selectedClaim.bills && selectedClaim.bills.length > 0 && (
              <div className="space-y-3 text-xs">
                <h4 className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">
                  Attached Receipts ({selectedClaim.bills.length})
                </h4>
                <div className="space-y-2">
                  {selectedClaim.bills.map((b: any) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate text-slate-200">{b.original_name || b.file_path}</span>
                      </div>
                      <a
                        href={`/api/hrms/expense-bills/${b.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center gap-1 hover:bg-blue-500/30 shrink-0"
                      >
                        <Download className="w-3 h-3" />
                        <span>Receipt</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-700/20">
              <button
                onClick={() => setSelectedClaim(null)}
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

export default ExpenseModule;
