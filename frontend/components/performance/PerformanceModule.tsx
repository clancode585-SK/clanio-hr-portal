"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  Target,
  Award,
  Star,
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
  TrendingUp,
  Crown,
  Zap,
  Gift,
  Smile,
  ShieldCheck,
  User,
  Building,
  ChevronRight,
  Edit3,
  Trash2,
  Eye,
  BarChart3,
  Percent,
} from "lucide-react";
import { fetchApi, extractList } from "@/lib/api";

interface PerformanceModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

export const PerformanceModule: React.FC<PerformanceModuleProps> = ({
  isDarkMode = false,
  activeTab: initialTab = "performance-goals",
}) => {
  const [tab, setTab] = useState<"goals" | "appraisals" | "incentives" | "recognitions">(
    initialTab === "appraisals"
      ? "appraisals"
      : initialTab === "incentives"
      ? "incentives"
      : initialTab === "recognitions"
      ? "recognitions"
      : "goals"
  );

  useEffect(() => {
    if (initialTab === "appraisals") setTab("appraisals");
    else if (initialTab === "incentives" || initialTab === "incentive-rules") setTab("incentives");
    else if (initialTab === "recognitions") setTab("recognitions");
    else setTab("goals");
  }, [initialTab]);

  // Performance Score & Summary
  const [scoreData, setScoreData] = useState<any>(null);

  // Data States
  const [goals, setGoals] = useState<any[]>([]);
  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [appraisalCycles, setAppraisalCycles] = useState<any[]>([]);
  const [incentives, setIncentives] = useState<any[]>([]);
  const [incentiveSummary, setIncentiveSummary] = useState<any>(null);
  const [incentiveRules, setIncentiveRules] = useState<any[]>([]);
  const [recognitions, setRecognitions] = useState<any[]>([]);
  const [recTypes, setRecTypes] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [notify, setNotify] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [goalTypeFilter, setGoalTypeFilter] = useState("");
  const [goalFilterMode, setGoalFilterMode] = useState<"all" | "pending-approvals" | "pending-verification">("all");
  const [appraisalFilterMode, setAppraisalFilterMode] = useState<"all" | "pending-reviews">("all");

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState<any | null>(null);
  const [showAppraisalModal, setShowAppraisalModal] = useState<any | null>(null);
  const [showGiveRecModal, setShowGiveRecModal] = useState(false);
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [showSelfReviewModal, setShowSelfReviewModal] = useState<any | null>(null);
  const [showManagerReviewModal, setShowManagerReviewModal] = useState<any | null>(null);
  const [showFinaliseAppraisalModal, setShowFinaliseAppraisalModal] = useState<any | null>(null);

  // Form States
  const [cycleForm, setCycleForm] = useState({
    name: "",
    period_type: "annual",
    period_label: "2026-FY",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    description: "",
  });

  const [selfReviewForm, setSelfReviewForm] = useState({
    self_rating: 4,
    self_feedback: "",
  });

  const [managerReviewForm, setManagerReviewForm] = useState({
    manager_rating: 4,
    manager_feedback: "",
    growth_plan: "",
  });

  const [finaliseAppraisalForm, setFinaliseAppraisalForm] = useState({
    final_rating: 4,
    remarks: "",
  });

  const [calcForm, setCalcForm] = useState({
    period_type: "month",
    period_label: new Date().toISOString().slice(0, 7),
  });

  const [ruleForm, setRuleForm] = useState({
    name: "",
    base_percent: "10",
    period_type: "month",
    description: "",
  });

  const [goalForm, setGoalForm] = useState({
    goal_type: "kra",
    period_type: "quarter",
    title: "",
    description: "",
    metric: "units",
    target_value: "100",
    weight: "20",
    due_date: new Date().toISOString().split("T")[0],
  });

  const [progressForm, setProgressForm] = useState({
    achieved_value: "",
  });

  const [appraisalForm, setAppraisalForm] = useState({
    rating: 4,
    feedback: "",
  });

  const [recForm, setRecForm] = useState({
    receiver_id: "",
    recognition_type: "star_performer",
    message: "",
  });

  // 1. Fetch Performance Scorecard
  const fetchScorecard = async () => {
    try {
      const res = await fetchApi<any>("/performance/score");
      setScoreData(res?.data || res);
    } catch {
      // ignore
    }
  };

  // 2. Fetch Module Data based on active tab
  const fetchModuleData = async () => {
    setLoading(true);
    try {
      if (tab === "goals") {
        const endpoint =
          goalFilterMode === "pending-approvals"
            ? "/goals/pending-approvals"
            : goalFilterMode === "pending-verification"
            ? "/goals/pending-verification"
            : "/goals";
        const res = await fetchApi<any>(endpoint);
        setGoals(extractList(res));
      } else if (tab === "appraisals") {
        const appEndpoint = appraisalFilterMode === "pending-reviews" ? "/appraisals/pending-reviews" : "/appraisals";
        const [appRes, cyclesRes] = await Promise.all([
          fetchApi<any>(appEndpoint).catch(() => null),
          fetchApi<any>("/appraisal-cycles").catch(() => null),
        ]);
        if (appRes) setAppraisals(extractList(appRes));
        if (cyclesRes) setAppraisalCycles(extractList(cyclesRes));
      } else if (tab === "incentives") {
        const [incRes, sumRes, rulesRes] = await Promise.all([
          fetchApi<any>("/incentives").catch(() => null),
          fetchApi<any>("/incentives/summary").catch(() => null),
          fetchApi<any>("/incentive-rules").catch(() => null),
        ]);
        if (incRes) setIncentives(extractList(incRes));
        if (sumRes) setIncentiveSummary(sumRes?.data || sumRes);
        if (rulesRes) setIncentiveRules(extractList(rulesRes));
      } else if (tab === "recognitions") {
        const [recRes, typesRes] = await Promise.all([
          fetchApi<any>("/recognitions").catch(() => null),
          fetchApi<any>("/recognitions/types").catch(() => null),
        ]);
        if (recRes) setRecognitions(extractList(recRes));
        if (typesRes) setRecTypes(typesRes?.data?.types || []);
      }
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to load performance data", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScorecard();
  }, []);

  useEffect(() => {
    fetchModuleData();
  }, [tab]);

  // Create Goal
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.title.trim()) {
      setNotify({ msg: "Please enter goal title", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      await fetchApi("/goals", {
        method: "POST",
        body: JSON.stringify({
          goal_type: goalForm.goal_type,
          period_type: goalForm.period_type,
          title: goalForm.title,
          description: goalForm.description,
          metric: goalForm.metric,
          target_value: parseFloat(goalForm.target_value),
          weight: parseFloat(goalForm.weight),
          due_date: goalForm.due_date,
        }),
      });

      setNotify({ msg: "Performance goal created successfully!", type: "success" });
      setShowGoalModal(false);
      setGoalForm({
        goal_type: "kra",
        period_type: "quarter",
        title: "",
        description: "",
        metric: "units",
        target_value: "100",
        weight: "20",
        due_date: new Date().toISOString().split("T")[0],
      });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to create goal", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Update Goal Progress
  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showProgressModal) return;

    setSubmitting(true);
    try {
      await fetchApi(`/goals/${showProgressModal.id}/progress`, {
        method: "PUT",
        body: JSON.stringify({
          achieved_value: parseFloat(progressForm.achieved_value),
        }),
      });

      setNotify({ msg: "Goal progress updated!", type: "success" });
      setShowProgressModal(null);
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to update progress", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Goal (Manager Approval)
  const handleApproveGoal = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/goals/${id}/approve`, { method: "PUT" });
      setNotify({ msg: "Goal approved successfully!", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to approve goal", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Goal for Verification
  const handleSubmitGoal = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/goals/${id}/submit`, { method: "PUT" });
      setNotify({ msg: "Goal submitted for verification!", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to submit goal", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Verify Goal
  const handleVerifyGoal = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/goals/${id}/verify`, { method: "PUT" });
      setNotify({ msg: "Goal progress verified!", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to verify goal", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Finalise Goal
  const handleFinaliseGoal = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/goals/${id}/finalise`, { method: "PUT" });
      setNotify({ msg: "Goal finalized!", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to finalize goal", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Close Goal
  const handleCloseGoal = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/goals/${id}/close`, { method: "PUT" });
      setNotify({ msg: "Goal closed!", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to close goal", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Goal
  const handleDeleteGoal = async (id: number | string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    setSubmitting(true);
    try {
      await fetchApi(`/goals/${id}`, { method: "DELETE" });
      setNotify({ msg: "Goal deleted successfully", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to delete goal", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Goals List
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      const q = searchQuery.toLowerCase().trim();
      const title = g.title || "";
      const matchesSearch = title.toLowerCase().includes(q);
      const matchesType = !goalTypeFilter || g.goal_type === goalTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [goals, searchQuery, goalTypeFilter]);

  // Create Appraisal Cycle Submit
  const handleCreateCycleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetchApi("/appraisal-cycles", {
        method: "POST",
        body: JSON.stringify(cycleForm),
      });
      setNotify({ msg: "Appraisal cycle created!", type: "success" });
      setShowCycleModal(false);
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to create cycle", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Launch Appraisal Cycle
  const handleLaunchCycle = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/appraisal-cycles/${id}/launch`, { method: "POST" });
      setNotify({ msg: "Appraisal cycle launched for all employees!", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to launch cycle", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Advance Appraisal Cycle Stage
  const handleAdvanceCycle = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/appraisal-cycles/${id}/advance`, { method: "PUT" });
      setNotify({ msg: "Appraisal cycle stage advanced!", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to advance cycle", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Self Review
  const handleSelfReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSelfReviewModal) return;
    setSubmitting(true);
    try {
      await fetchApi(`/appraisals/${showSelfReviewModal.id}/self-review`, {
        method: "PUT",
        body: JSON.stringify(selfReviewForm),
      });
      setNotify({ msg: "Self-review submitted successfully!", type: "success" });
      setShowSelfReviewModal(null);
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Self-review failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Manager Review
  const handleManagerReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showManagerReviewModal) return;
    setSubmitting(true);
    try {
      await fetchApi(`/appraisals/${showManagerReviewModal.id}/manager-review`, {
        method: "PUT",
        body: JSON.stringify(managerReviewForm),
      });
      setNotify({ msg: "Manager review submitted!", type: "success" });
      setShowManagerReviewModal(null);
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Manager review failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Finalise Appraisal
  const handleFinaliseAppraisalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFinaliseAppraisalModal) return;
    setSubmitting(true);
    try {
      await fetchApi(`/appraisals/${showFinaliseAppraisalModal.id}/finalise`, {
        method: "PUT",
        body: JSON.stringify(finaliseAppraisalForm),
      });
      setNotify({ msg: "Appraisal finalized!", type: "success" });
      setShowFinaliseAppraisalModal(null);
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Finalization failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Incentive Payout
  const handleApproveIncentive = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/incentives/${id}/approve`, {
        method: "PUT",
        body: JSON.stringify({ remarks: "Approved for payout" }),
      });
      setNotify({ msg: "Incentive payout approved!", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Approve failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Reject Incentive Payout
  const handleRejectIncentive = async (id: number | string) => {
    setSubmitting(true);
    try {
      await fetchApi(`/incentives/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: "Criteria not met" }),
      });
      setNotify({ msg: "Incentive record rejected", type: "success" });
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Reject failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Run Incentive Calculation Batch
  const handleCalculateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetchApi<any>("/incentives/calculate", {
        method: "POST",
        body: JSON.stringify(calcForm),
      });
      setNotify({ msg: res?.message || "Incentive calculation complete!", type: "success" });
      setShowCalculateModal(false);
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Calculation failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Create Incentive Rule Submit
  const handleCreateRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetchApi("/incentive-rules", {
        method: "POST",
        body: JSON.stringify(ruleForm),
      });
      setNotify({ msg: "Incentive calculation rule created!", type: "success" });
      setShowRuleModal(false);
      fetchModuleData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Rule creation failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

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
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Performance & OKRs Terminal
              </h1>
              <p className={`text-xs mt-0.5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Track objectives, key results (OKRs), appraisal reviews, performance bonuses, and peer awards.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowGoalModal(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Goal / OKR</span>
          </button>
        </div>

        {/* PERFORMANCE METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/20 text-xs">
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-purple-50/60 border-purple-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Overall Score</div>
            <div className="text-lg font-black text-purple-400 mt-0.5">
              {scoreData?.score != null ? Math.round((Number(scoreData.score) / 5) * 100) : 0}%
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-cyan-50/60 border-cyan-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Goals Achieved</div>
            <div className="text-lg font-black text-cyan-400 mt-0.5">
              {goals.filter((g) => g.status === "achieved").length} / {goals.length}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-amber-50/60 border-amber-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Appraisal Rating</div>
            <div className="text-lg font-black text-amber-400 mt-0.5 flex items-center justify-center gap-1">
              <Star className="w-4 h-4 fill-amber-400" />
              <span>{scoreData?.appraisal_rating ?? "Not rated"}</span>
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-emerald-50/60 border-emerald-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Incentives Earned</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              ₹{Number(incentiveSummary?.total_earned ?? 0).toLocaleString("en-IN")}
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
              onClick={() => setTab("goals")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "goals"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Goals & OKRs
            </button>
            <button
              onClick={() => setTab("appraisals")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "appraisals"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Appraisal Reviews
            </button>
            <button
              onClick={() => setTab("incentives")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "incentives"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Incentives & Bonuses
            </button>
            <button
              onClick={() => setTab("recognitions")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "recognitions"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Peer Recognitions
            </button>
          </div>

          {tab === "goals" && (
            <div className="flex flex-wrap items-center gap-3 flex-1 sm:flex-initial">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search goals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-2xl text-xs outline-none border transition-all ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-100 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              {/* Goal Mode Filter Buttons */}
              <div
                className={`p-1 rounded-2xl border flex items-center gap-1 ${
                  isDarkMode ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-100 border-slate-200"
                }`}
              >
                <button
                  onClick={() => setGoalFilterMode("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    goalFilterMode === "all"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                      : isDarkMode
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Goals
                </button>
                <button
                  onClick={() => setGoalFilterMode("pending-approvals")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    goalFilterMode === "pending-approvals"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                      : isDarkMode
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Pending Approvals
                </button>
                <button
                  onClick={() => setGoalFilterMode("pending-verification")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    goalFilterMode === "pending-verification"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                      : isDarkMode
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Pending Verification
                </button>
              </div>

              {/* Goal Type Filter */}
              <select
                value={goalTypeFilter}
                onChange={(e) => setGoalTypeFilter(e.target.value)}
                className={`px-3 py-2 rounded-2xl text-xs font-semibold outline-none border cursor-pointer ${
                  isDarkMode
                    ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                <option value="">All Types</option>
                <option value="kra">KRA</option>
                <option value="objective">Objective</option>
                <option value="key_result">Key Result</option>
              </select>

              <button
                onClick={fetchModuleData}
                className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: GOALS & OKRS */}
      {tab === "goals" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border ${
            isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
          }`}
        >
          {loading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-3" />
              <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Loading goals & OKRs...
              </p>
            </div>
          ) : filteredGoals.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No performance goals or OKRs found matching your criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGoals.map((goal) => {
                const target = parseFloat(goal.target_value || 100);
                const achieved = parseFloat(goal.achieved_value || 0);
                const pct = Math.min(100, Math.round((achieved / (target || 1)) * 100));
                const status = goal.status || "active";

                return (
                  <div
                    key={goal.id}
                    className={`p-5 rounded-2xl border space-y-4 transition-all hover:scale-[1.01] ${
                      isDarkMode
                        ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                          {goal.goal_type || "KRA"}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 capitalize">
                          {goal.period_type || "quarter"}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          status === "achieved" || status === "closed"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : status === "active" || status === "verified"
                            ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <div>
                      <h3 className={`text-sm font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{goal.description}</p>
                      )}
                    </div>

                    {/* Progress Meter Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-400">Progress ({achieved} / {target} {goal.metric})</span>
                        <span className="text-purple-400 font-bold">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-700/30 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-purple-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* ACTION BUTTONS WORKFLOW */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-700/20 text-[11px]">
                      <span className="text-slate-400 font-mono">Due: {goal.due_date || "N/A"}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => {
                            setProgressForm({ achieved_value: String(goal.achieved_value || 0) });
                            setShowProgressModal(goal);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer transition-all text-[10px]"
                        >
                          Progress
                        </button>

                        {status === "draft" || status === "pending" ? (
                          <button
                            onClick={() => handleApproveGoal(goal.id)}
                            disabled={submitting}
                            className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-all text-[10px]"
                          >
                            Approve
                          </button>
                        ) : null}

                        <button
                          onClick={() => handleSubmitGoal(goal.id)}
                          disabled={submitting}
                          className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer transition-all text-[10px]"
                        >
                          Submit
                        </button>

                        <button
                          onClick={() => handleVerifyGoal(goal.id)}
                          disabled={submitting}
                          className="px-2.5 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer transition-all text-[10px]"
                        >
                          Verify
                        </button>

                        <button
                          onClick={() => handleFinaliseGoal(goal.id)}
                          disabled={submitting}
                          className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer transition-all text-[10px]"
                        >
                          Finalise
                        </button>

                        <button
                          onClick={() => handleCloseGoal(goal.id)}
                          disabled={submitting}
                          className="px-2.5 py-1 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold cursor-pointer transition-all text-[10px]"
                        >
                          Close
                        </button>

                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          disabled={submitting}
                          className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          title="Delete Goal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPRAISALS */}
      {tab === "appraisals" && (
        <div className="space-y-6">
          <div
            className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
              isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="border-b pb-4 border-slate-700/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  Performance Appraisal Reviews & Cycles
                </h3>
                <p className="text-xs text-slate-400">
                  Manage evaluation cycles, employee self-reviews, manager reviews, and final ratings.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Appraisal Filter Mode */}
                <div
                  className={`p-1 rounded-2xl border flex items-center gap-1 ${
                    isDarkMode ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-100 border-slate-200"
                  }`}
                >
                  <button
                    onClick={() => setAppraisalFilterMode("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      appraisalFilterMode === "all"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                        : isDarkMode
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All Appraisals
                  </button>
                  <button
                    onClick={() => setAppraisalFilterMode("pending-reviews")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      appraisalFilterMode === "pending-reviews"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                        : isDarkMode
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Pending Manager Reviews
                  </button>
                </div>

                <button
                  onClick={() => setShowCycleModal(true)}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Appraisal Cycle</span>
                </button>
              </div>
            </div>

            {/* APPRAISAL CYCLES SUB-SECTION */}
            {appraisalCycles.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Appraisal Evaluation Cycles ({appraisalCycles.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {appraisalCycles.map((cycle) => (
                    <div
                      key={cycle.id}
                      className={`p-4 rounded-2xl border space-y-3 ${
                        isDarkMode ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-extrabold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {cycle.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {cycle.status || "draft"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Label: {cycle.period_label || "2026-FY"} • Type: {cycle.period_type || "annual"}
                      </p>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-700/20">
                        <button
                          onClick={() => handleLaunchCycle(cycle.id)}
                          disabled={submitting}
                          className="flex-1 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] transition-all cursor-pointer"
                        >
                          Launch Cycle
                        </button>
                        <button
                          onClick={() => handleAdvanceCycle(cycle.id)}
                          disabled={submitting}
                          className="flex-1 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[10px] transition-all cursor-pointer"
                        >
                          Advance Stage
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* APPRAISALS REVIEWS TABLE */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Employee Appraisal Reviews
              </h4>

              {appraisals.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No appraisal review records active for the current filter.
                </div>
              ) : (
                <div className="space-y-4">
                  {appraisals.map((app) => {
                    const status = app.status || "pending";

                    return (
                      <div
                        key={app.id}
                        className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isDarkMode ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                              {app.employee?.user?.name || app.employee?.name || "Employee Review"}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                              {app.cycle?.name || "Annual Cycle"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            Status:{" "}
                            <span className="capitalize font-bold text-purple-400">{status}</span>
                            {app.self_rating && (
                              <span className="ml-3 text-slate-400">
                                Self Rating: <span className="font-bold text-amber-400">{app.self_rating}/5</span>
                              </span>
                            )}
                            {app.manager_rating && (
                              <span className="ml-3 text-slate-400">
                                Manager Rating: <span className="font-bold text-emerald-400">{app.manager_rating}/5</span>
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setSelfReviewForm({
                                self_rating: app.self_rating || 4,
                                self_feedback: app.self_feedback || "",
                              });
                              setShowSelfReviewModal(app);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Self Review
                          </button>

                          <button
                            onClick={() => {
                              setManagerReviewForm({
                                manager_rating: app.manager_rating || 4,
                                manager_feedback: app.manager_feedback || "",
                                growth_plan: app.growth_plan || "",
                              });
                              setShowManagerReviewModal(app);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Manager Review
                          </button>

                          <button
                            onClick={() => {
                              setFinaliseAppraisalForm({
                                final_rating: app.final_rating || app.manager_rating || 4,
                                remarks: app.remarks || "",
                              });
                              setShowFinaliseAppraisalModal(app);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Finalise
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INCENTIVES */}
      {tab === "incentives" && (
        <div className="space-y-6">
          <div
            className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
              isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="border-b pb-4 border-slate-700/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  Incentives & Performance Bonuses
                </h3>
                <p className="text-xs text-slate-400">
                  Automated performance bonus calculations, rule slabs, and manager payout approvals.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowRuleModal(true)}
                  className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white"
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <Plus className="w-4 h-4 text-purple-400" />
                  <span>Add Calculation Rule</span>
                </button>
                <button
                  onClick={() => setShowCalculateModal(true)}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Award className="w-4 h-4" />
                  <span>Run Bonus Calculation</span>
                </button>
              </div>
            </div>

            {/* INCENTIVE CALCULATION RULES SUB-SECTION */}
            {incentiveRules.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Active Incentive Rules ({incentiveRules.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {incentiveRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-2xl border ${
                        isDarkMode ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-extrabold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {rule.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Base: {rule.base_percent}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 capitalize font-mono">
                        Period: {rule.period_type || "Month"}
                      </p>
                      {rule.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{rule.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CALCULATED INCENTIVES PAYOUT TABLE */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Calculated Payout Records
              </h4>

              {incentives.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No performance incentive payouts calculated for this period. Click "Run Bonus Calculation" to generate payouts.
                </div>
              ) : (
                <div className="space-y-3">
                  {incentives.map((inc) => {
                    const status = inc.status || "calculated";

                    return (
                      <div
                        key={inc.id}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isDarkMode ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                              {inc.employee?.user?.name || inc.employee?.name || "Staff Bonus"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                status === "approved"
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : status === "rejected"
                                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Period: {inc.period_label || "2026-08"} • Score: {inc.score ?? "100"}%
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="font-mono font-black text-emerald-400 text-sm">
                            ₹{(inc.amount || 0).toLocaleString()}
                          </div>

                          {status === "calculated" && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleApproveIncentive(inc.id)}
                                disabled={submitting}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition-all cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectIncentive(inc.id)}
                                disabled={submitting}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RECOGNITIONS */}
      {tab === "recognitions" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
          }`}
        >
          <div className="border-b pb-4 border-slate-700/20 flex items-center justify-between">
            <div>
              <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Peer Recognitions & Wall of Fame
              </h3>
              <p className="text-xs text-slate-400">
                Celebrate teammates with star performer awards and appreciation badges.
              </p>
            </div>
          </div>

          {recognitions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No peer recognitions awarded yet. Be the first to appreciate a colleague!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recognitions.map((rec) => (
                <div
                  key={rec.id}
                  className={`p-4 rounded-2xl border space-y-2 ${
                    isDarkMode ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                      {rec.recognition_type ? rec.recognition_type.replace("_", " ") : "Award"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 italic">"{rec.message}"</p>
                  <div className="text-[10px] text-purple-400 font-semibold pt-1 border-t border-slate-700/20">
                    To: {rec.receiver?.name || "Teammate"} • From: {rec.giver?.name || "Peer"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CREATE GOAL / OKR */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-lg p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-700/20">
              <h2 className="text-lg font-black tracking-tight">Create Performance Goal / OKR</h2>
              <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Goal Type *</label>
                  <select
                    value={goalForm.goal_type}
                    onChange={(e) => setGoalForm({ ...goalForm, goal_type: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="kra">KRA (Key Result Area)</option>
                    <option value="objective">OKR Objective</option>
                    <option value="key_result">OKR Key Result</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-400">Period *</label>
                  <select
                    value={goalForm.period_type}
                    onChange={(e) => setGoalForm({ ...goalForm, period_type: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="month">Monthly</option>
                    <option value="quarter">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Goal Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Increase monthly API performance by 25%"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed metrics and target expectations..."
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Target Value</label>
                  <input
                    type="number"
                    value={goalForm.target_value}
                    onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })}
                    className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Weight (%)</label>
                  <input
                    type="number"
                    value={goalForm.weight}
                    onChange={(e) => setGoalForm({ ...goalForm, weight: e.target.value })}
                    className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Due Date</label>
                  <input
                    type="date"
                    value={goalForm.due_date}
                    onChange={(e) => setGoalForm({ ...goalForm, due_date: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  <span>Save Goal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: UPDATE GOAL PROGRESS */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">Update Goal Progress</h2>
              <button onClick={() => setShowProgressModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProgress} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">
                  Achieved Value (Target: {showProgressModal.target_value} {showProgressModal.metric})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={progressForm.achieved_value}
                  onChange={(e) => setProgressForm({ achieved_value: e.target.value })}
                  className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Updating..." : "Save Progress"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RUN INCENTIVE BONUS CALCULATION BATCH */}
      {showCalculateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">Run Bonus Calculation Batch</h2>
              <button onClick={() => setShowCalculateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCalculateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Calculation Period Type</label>
                <select
                  value={calcForm.period_type}
                  onChange={(e) => setCalcForm({ ...calcForm, period_type: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="month">Monthly Calculation</option>
                  <option value="quarter">Quarterly Calculation</option>
                  <option value="annual">Annual Calculation</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Period Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026-08 or 2026-Q3"
                  value={calcForm.period_label}
                  onChange={(e) => setCalcForm({ ...calcForm, period_label: e.target.value })}
                  className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCalculateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md cursor-pointer flex items-center gap-2"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                  <span>Run Batch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE INCENTIVE RULE */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">Create Incentive Rule</h2>
              <button onClick={() => setShowRuleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRuleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales KRA Performance Bonus"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Base Incentive (%) *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={ruleForm.base_percent}
                    onChange={(e) => setRuleForm({ ...ruleForm, base_percent: e.target.value })}
                    className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-400">Period Type</label>
                  <select
                    value={ruleForm.period_type}
                    onChange={(e) => setRuleForm({ ...ruleForm, period_type: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="month">Monthly</option>
                    <option value="quarter">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Description</label>
                <textarea
                  rows={3}
                  placeholder="Notes on slab multipliers and qualification limits..."
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
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
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Saving..." : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: CREATE APPRAISAL CYCLE */}
      {showCycleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">Create Appraisal Cycle</h2>
              <button onClick={() => setShowCycleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCycleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Cycle Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Appraisal Cycle 2026"
                  value={cycleForm.name}
                  onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Period Type</label>
                  <select
                    value={cycleForm.period_type}
                    onChange={(e) => setCycleForm({ ...cycleForm, period_type: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="annual">Annual</option>
                    <option value="half_yearly">Half-Yearly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-400">Period Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026-FY"
                    value={cycleForm.period_label}
                    onChange={(e) => setCycleForm({ ...cycleForm, period_label: e.target.value })}
                    className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-400">Start Date</label>
                  <input
                    type="date"
                    required
                    value={cycleForm.start_date}
                    onChange={(e) => setCycleForm({ ...cycleForm, start_date: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-400">End Date</label>
                  <input
                    type="date"
                    value={cycleForm.end_date}
                    onChange={(e) => setCycleForm({ ...cycleForm, end_date: e.target.value })}
                    className={`w-full p-3 rounded-2xl border outline-none ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCycleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Saving..." : "Create Cycle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: EMPLOYEE SELF-REVIEW */}
      {showSelfReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">Submit Employee Self-Review</h2>
              <button onClick={() => setShowSelfReviewModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSelfReviewSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Self Rating (1 to 5 Stars) *</label>
                <select
                  value={selfReviewForm.self_rating}
                  onChange={(e) => setSelfReviewForm({ ...selfReviewForm, self_rating: parseInt(e.target.value) })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  <option value={5}>5 Stars - Outstanding Performance</option>
                  <option value={4}>4 Stars - Exceeds Expectations</option>
                  <option value={3}>3 Stars - Meets Expectations</option>
                  <option value={2}>2 Stars - Needs Improvement</option>
                  <option value={1}>1 Star - Unsatisfactory</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Self Feedback & Achievements</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Highlight key achievements, completed milestones, and growth goals..."
                  value={selfReviewForm.self_feedback}
                  onChange={(e) => setSelfReviewForm({ ...selfReviewForm, self_feedback: e.target.value })}
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
                  onClick={() => setShowSelfReviewModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Submitting..." : "Submit Self-Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: MANAGER REVIEW */}
      {showManagerReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">Submit Manager Review</h2>
              <button onClick={() => setShowManagerReviewModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManagerReviewSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Manager Rating (1 to 5 Stars) *</label>
                <select
                  value={managerReviewForm.manager_rating}
                  onChange={(e) => setManagerReviewForm({ ...managerReviewForm, manager_rating: parseInt(e.target.value) })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  <option value={5}>5 Stars - Outstanding Performance</option>
                  <option value={4}>4 Stars - Exceeds Expectations</option>
                  <option value={3}>3 Stars - Meets Expectations</option>
                  <option value={2}>2 Stars - Needs Improvement</option>
                  <option value={1}>1 Star - Unsatisfactory</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Manager Feedback Notes</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Manager review notes and evaluation..."
                  value={managerReviewForm.manager_feedback}
                  onChange={(e) => setManagerReviewForm({ ...managerReviewForm, manager_feedback: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Growth Plan & Development Goals</label>
                <textarea
                  rows={2}
                  placeholder="Recommended skills, training, or development plan..."
                  value={managerReviewForm.growth_plan}
                  onChange={(e) => setManagerReviewForm({ ...managerReviewForm, growth_plan: e.target.value })}
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
                  onClick={() => setShowManagerReviewModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: FINALISE APPRAISAL */}
      {showFinaliseAppraisalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight">Finalise Appraisal Rating</h2>
              <button onClick={() => setShowFinaliseAppraisalModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFinaliseAppraisalSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Final Overall Rating (1 to 5 Stars) *</label>
                <select
                  value={finaliseAppraisalForm.final_rating}
                  onChange={(e) => setFinaliseAppraisalForm({ ...finaliseAppraisalForm, final_rating: parseInt(e.target.value) })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  <option value={5}>5 Stars - Outstanding Performance</option>
                  <option value={4}>4 Stars - Exceeds Expectations</option>
                  <option value={3}>3 Stars - Meets Expectations</option>
                  <option value={2}>2 Stars - Needs Improvement</option>
                  <option value={1}>1 Star - Unsatisfactory</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">HR Final Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Final appraisal summary notes..."
                  value={finaliseAppraisalForm.remarks}
                  onChange={(e) => setFinaliseAppraisalForm({ ...finaliseAppraisalForm, remarks: e.target.value })}
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
                  onClick={() => setShowFinaliseAppraisalModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md cursor-pointer"
                >
                  {submitting ? "Finalising..." : "Finalise Rating"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceModule;
