"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  ShieldCheck,
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
  Download,
  Eye,
  Edit3,
  Archive,
  Send,
  Building,
  User,
  Paperclip,
  CheckSquare,
  Award,
  BookOpen,
} from "lucide-react";
import { fetchApi, extractList } from "@/lib/api";

interface PolicyModuleProps {
  isDarkMode?: boolean;
}

export const PolicyModule: React.FC<PolicyModuleProps> = ({ isDarkMode = false }) => {
  const [tab, setTab] = useState<"all" | "my">("all");

  // Data States
  const [policies, setPolicies] = useState<any[]>([]);
  const [myPoliciesData, setMyPoliciesData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals & Active Actions
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<any | null>(null);
  const [ackModalPolicy, setAckModalPolicy] = useState<any | null>(null);

  // Form States
  const [policyForm, setPolicyForm] = useState({
    category: "general",
    title: "",
    version: "1.0",
    summary: "",
    body: "",
    effective_from: new Date().toISOString().split("T")[0],
    review_on: "",
    needs_ack: true,
    ack_due_days: 14,
  });
  const [fileAttachment, setFileAttachment] = useState<File | null>(null);

  const [ackNote, setAckNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notify, setNotify] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // 1. Fetch Categories & Statuses
  const fetchMetadata = async () => {
    try {
      const res = await fetchApi<any>("/policies/categories");
      const data = res?.data || res;
      setCategories(data?.categories || []);
      setStatuses(data?.statuses || {});
    } catch {
      // ignore
    }
  };

  // 2. Fetch Policies Data
  const fetchPoliciesData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (categoryFilter) params.append("category", categoryFilter);

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const [allRes, myRes] = await Promise.all([
        fetchApi<any>(`/policies${queryStr}`),
        fetchApi<any>("/my-policies").catch(() => null),
      ]);

      setPolicies(extractList(allRes));
      if (myRes) setMyPoliciesData(myRes?.data || myRes);
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to fetch company policies", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchPoliciesData();
  }, [tab, categoryFilter, statusFilter]);

  // Create Policy Draft Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyForm.title.trim()) {
      setNotify({ msg: "Please enter a policy title", type: "error" });
      return;
    }

    setSubmitting(true);
    setNotify(null);

    const formData = new FormData();
    formData.append("category", policyForm.category);
    formData.append("title", policyForm.title);
    if (policyForm.version) formData.append("version", policyForm.version);
    if (policyForm.summary) formData.append("summary", policyForm.summary);
    if (policyForm.body) formData.append("body", policyForm.body);
    formData.append("effective_from", policyForm.effective_from);
    if (policyForm.review_on) formData.append("review_on", policyForm.review_on);
    formData.append("needs_ack", policyForm.needs_ack ? "1" : "0");
    formData.append("ack_due_days", String(policyForm.ack_due_days));

    if (fileAttachment) {
      formData.append("file", fileAttachment);
    }

    try {
      await fetchApi("/policies", {
        method: "POST",
        body: formData,
      });

      setNotify({ msg: "Company policy created successfully!", type: "success" });
      setShowCreateModal(false);
      setPolicyForm({
        category: "general",
        title: "",
        version: "1.0",
        summary: "",
        body: "",
        effective_from: new Date().toISOString().split("T")[0],
        review_on: "",
        needs_ack: true,
        ack_due_days: 14,
      });
      setFileAttachment(null);
      fetchPoliciesData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to create policy", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Publish Policy
  const handlePublishPolicy = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/policies/${id}/publish`, { method: "POST" });
      setNotify({ msg: "Policy published successfully!", type: "success" });
      fetchPoliciesData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Publish failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Archive Policy
  const handleArchivePolicy = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/policies/${id}/archive`, { method: "PUT" });
      setNotify({ msg: "Policy archived", type: "success" });
      fetchPoliciesData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Archive failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Acknowledge Policy Submit
  const handleAcknowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackModalPolicy) return;

    setSubmitting(true);
    try {
      await fetchApi(`/policies/${ackModalPolicy.id}/acknowledge`, {
        method: "PUT",
        body: JSON.stringify({ note: ackNote }),
      });

      setNotify({ msg: "Policy acknowledged successfully!", type: "success" });
      setAckModalPolicy(null);
      setAckNote("");
      fetchPoliciesData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Acknowledgment failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Policies
  const filteredPolicies = useMemo(() => {
    const list = tab === "my" ? myPoliciesData?.items || [] : policies;
    return list.filter((p: any) => {
      const item = p.policy || p;
      const q = searchQuery.toLowerCase().trim();
      const title = item.title || "";
      const summary = item.summary || "";
      const cat = item.category || "";
      return title.toLowerCase().includes(q) || summary.toLowerCase().includes(q) || cat.toLowerCase().includes(q);
    });
  }, [policies, myPoliciesData, tab, searchQuery]);

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
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Company Policies & Compliance
              </h1>
              <p className={`text-xs mt-0.5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Browse organizational guidelines, employee code of conduct, and sign policy acknowledgments.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Policy</span>
          </button>
        </div>

        {/* COMPLIANCE METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/20 text-xs">
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-purple-50/60 border-purple-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Policies</div>
            <div className="text-lg font-black text-purple-400 mt-0.5">
              {myPoliciesData?.total ?? policies.length}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-amber-50/60 border-amber-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pending Sign-off</div>
            <div className="text-lg font-black text-amber-400 mt-0.5">
              {myPoliciesData?.pending ?? 0}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-emerald-50/60 border-emerald-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Acknowledged</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              {myPoliciesData?.acknowledged ?? 0}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-cyan-50/60 border-cyan-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Gate Cleared</div>
            <div className="text-lg font-black text-cyan-400 mt-0.5">
              {myPoliciesData?.gate_cleared ? "Yes" : "Pending"}
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
              onClick={() => setTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "all"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Company Policies
            </button>
            <button
              onClick={() => setTab("my")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "my"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              My Required Policies
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 flex-1 sm:flex-initial">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 rounded-2xl text-xs outline-none border transition-all ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
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
                  ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
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

            <button
              onClick={fetchPoliciesData}
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

      {/* POLICIES LIST VIEW */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border ${
          isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
        }`}
      >
        {loading ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-3" />
            <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
              Loading company policies...
            </p>
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No company policies found matching your criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPolicies.map((p: any) => {
              const item = p.policy || p;
              const isAck = p.acknowledged_at || item.is_acknowledged;

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border space-y-4 transition-all hover:scale-[1.01] flex flex-col justify-between ${
                    isDarkMode
                      ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {item.category ? item.category.replace("_", " ") : "General"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          item.status === "published"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : item.status === "draft"
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                        }`}
                      >
                        {item.status || "published"}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {item.title}
                        </h3>
                        {item.version && (
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            v{item.version}
                          </span>
                        )}
                      </div>
                      {item.summary && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.summary}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700/20 space-y-3 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Effective: {item.effective_from || "N/A"}</span>
                      {item.acknowledgements_count !== undefined && (
                        <span className="font-mono text-purple-400">
                          {item.acknowledgements_count} Acknowledged
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => setSelectedPolicy(item)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isDarkMode
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                            : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                        }`}
                        title="Read Policy Document"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {item.file_path && (
                        <a
                          href={`/api/hrms/policies/${item.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isDarkMode
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                          }`}
                          title="Download Document"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {item.status === "draft" && (
                        <button
                          onClick={() => handlePublishPolicy(item.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Publish
                        </button>
                      )}

                      {item.status === "published" && (
                        <button
                          onClick={() => handleArchivePolicy(item.id)}
                          className="px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold cursor-pointer"
                        >
                          Archive
                        </button>
                      )}

                      {item.needs_ack && !isAck && (
                        <button
                          onClick={() => setAckModalPolicy(item)}
                          className="px-3 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-[10px] font-bold cursor-pointer shadow-sm"
                        >
                          Acknowledge
                        </button>
                      )}

                      {isAck && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Signed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE NEW POLICY DRAFT */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-lg p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-700/20">
              <h2 className="text-lg font-black tracking-tight">Create Company Policy</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Category *</label>
                  <select
                    value={policyForm.category}
                    onChange={(e) => setPolicyForm({ ...policyForm, category: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
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
                        <option value="general">General Code of Conduct</option>
                        <option value="leave_attendance">Leave & Attendance</option>
                        <option value="it_security">IT & Data Security</option>
                        <option value="hr">HR & Staff Policies</option>
                        <option value="finance">Finance & Expense</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-400">Version Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1.0"
                    value={policyForm.version}
                    onChange={(e) => setPolicyForm({ ...policyForm, version: e.target.value })}
                    className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Policy Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Information Security & Password Policy 2026"
                  value={policyForm.title}
                  onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Executive Summary</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of policy guidelines..."
                  value={policyForm.summary}
                  onChange={(e) => setPolicyForm({ ...policyForm, summary: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Full Policy Content / Body</label>
                <textarea
                  rows={4}
                  placeholder="Detailed policy text and rules..."
                  value={policyForm.body}
                  onChange={(e) => setPolicyForm({ ...policyForm, body: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Effective Date *</label>
                  <input
                    type="date"
                    required
                    value={policyForm.effective_from}
                    onChange={(e) => setPolicyForm({ ...policyForm, effective_from: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-400">Attach Document (.pdf, .doc)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setFileAttachment(e.target.files?.[0] || null)}
                    className={`w-full p-2.5 rounded-2xl border cursor-pointer ${
                      isDarkMode ? "bg-white/[0.04] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="needs_ack"
                  checked={policyForm.needs_ack}
                  onChange={(e) => setPolicyForm({ ...policyForm, needs_ack: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="needs_ack" className="font-bold text-slate-300 cursor-pointer">
                  Require Employee Digital Acknowledgment & Sign-off
                </label>
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
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>Save Policy Draft</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: READ POLICY DETAILS */}
      {selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-2xl p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-700/20">
              <div>
                <h2 className="text-lg font-black tracking-tight">{selectedPolicy.title}</h2>
                <p className="text-xs text-slate-400 font-mono">Version {selectedPolicy.version || "1.0"}</p>
              </div>
              <button onClick={() => setSelectedPolicy(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedPolicy.summary && (
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-purple-300">Executive Summary</div>
                <div className="text-slate-200 leading-relaxed">{selectedPolicy.summary}</div>
              </div>
            )}

            {selectedPolicy.body && (
              <div className="space-y-2 text-xs">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">Full Policy Guidelines</div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedPolicy.body}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-700/20">
              {selectedPolicy.file_path ? (
                <a
                  href={`/api/hrms/policies/${selectedPolicy.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Policy File</span>
                </a>
              ) : (
                <span className="text-xs text-slate-400">No attached file document</span>
              )}

              <button
                onClick={() => setSelectedPolicy(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Close Reader
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ACKNOWLEDGE POLICY SIGN-OFF */}
      {ackModalPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">Digital Policy Acknowledgment</h2>
              <button onClick={() => setAckModalPolicy(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              By signing off below, you confirm that you have read, understood, and agreed to abide by{" "}
              <strong className="text-white">"{ackModalPolicy.title}"</strong>.
            </p>

            <form onSubmit={handleAcknowledgeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Acknowledgment Note / Remark</label>
                <textarea
                  rows={3}
                  placeholder="Optional signature note..."
                  value={ackNote}
                  onChange={(e) => setAckNote(e.target.value)}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAckModalPolicy(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{submitting ? "Signing..." : "Confirm & Sign"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyModule;
