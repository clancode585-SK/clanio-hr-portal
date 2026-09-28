"use client";

import React, { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { fetchApi, extractList } from "@/lib/api";
import { clockOf, dateOf } from "@/lib/format";
import {
  UserCircle,
  CalendarCheck,
  CalendarPlus,
  Receipt,
  Coins,
  FileText,
  CheckCircle2,
  XCircle,
  Plus,
  Download,
} from "lucide-react";

interface DayItem {
  date: string;
  weekday: string;
  day_type: string;
  status: string;
  worked_human: string;
  is_late: boolean;
  late_minutes: number;
  first_check_in_at: string | null;
  last_check_out_at: string | null;
}

interface MyLeaveItem {
  id: number;
  uuid: string;
  from_date: string;
  to_date: string;
  day_count: number;
  reason: string;
  status: string;
  leave_type?: { name?: string };
}

interface BalanceItem {
  leave_type_id: number;
  code: string;
  name: string;
  annual_quota: number;
  accrued: number;
  used: number;
  available: number;
  usable: number;
}

interface PayslipItem {
  id: number;
  uuid: string;
  month: string;
  month_label: string;
  pay_date: string;
  paid_days: number;
  working_days: number;
  lop_days: number;
  gross_earnings: number;
  total_deductions: number;
  net_payable: number;
  payment_status: string;
}

interface MyAdvanceItem {
  uuid: string;
  reference: string;
  amount: number;
  emi_amount: number;
  tenure_months: number;
  recovered: number;
  outstanding: number;
  reason: string;
  status: string;
}

interface MyClaimItem {
  id: number;
  uuid: string;
  category: string;
  purpose: string | null;
  description: string;
  expense_date: string;
  amount: number;
  payable_amount: number;
  stage: string;
  status: string;
}

interface MyPolicyItem {
  id: number;
  uuid: string;
  title: string;
  category: string;
  version: string;
  effective_from: string;
  summary: string | null;
  acknowledged: boolean;
  has_file: boolean;
}

const applyLeaveSchema = z.object({
  leave_type: z.string().min(1, "Please choose a leave type"),
  from_date: z.string().min(1, "Pick the first day"),
  to_date: z.string().min(1, "Pick the last day"),
  reason: z.string().min(3, "Say why you need the leave").max(500, "Max 500 characters"),
  contact_number: z.string().max(20, "Max 20 characters").optional().or(z.literal("")),
});

const advanceSchema = z.object({
  amount: z.string().min(1, "How much do you need"),
  tenure_months: z.string().min(1, "Over how many months"),
  reason: z.string().min(3, "Say what it is for").max(500, "Max 500 characters"),
});

const claimSchema = z.object({
  category: z.string().min(1, "Please choose a category"),
  expense_date: z.string().min(1, "Pick the date you spent it"),
  amount: z.string().min(1, "How much are you claiming"),
  purpose: z.string().max(150, "Max 150 characters").optional().or(z.literal("")),
  description: z.string().min(3, "Say what it was for").max(500, "Max 500 characters"),
});

type ApplyLeaveFormData = z.infer<typeof applyLeaveSchema>;
type AdvanceFormData = z.infer<typeof advanceSchema>;
type ClaimFormData = z.infer<typeof claimSchema>;

const EXPENSE_CATEGORIES = [
  { label: "Travel — cab, train, flight, hotel", value: "travel" },
  { label: "Food — client meeting or overtime meal", value: "food" },
  { label: "Internet — broadband or mobile data", value: "internet" },
  { label: "Fuel — petrol, diesel, toll", value: "fuel" },
  { label: "Stationery — office supplies", value: "stationery" },
  { label: "Repair — laptop, phone or other equipment", value: "repair" },
  { label: "Medical", value: "medical" },
  { label: "Training — course, certification, book", value: "training" },
  { label: "Other", value: "other" },
];

interface SelfServiceModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const money = (value: unknown) => `₹${inr.format(Number(value ?? 0))}`;

export const SelfServiceModule: React.FC<SelfServiceModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "my-attendance",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    setActiveTab(externalTab);
  }, [externalTab]);

  const [days, setDays] = useState<DayItem[]>([]);
  const [myLeaves, setMyLeaves] = useState<MyLeaveItem[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [payslips, setPayslips] = useState<PayslipItem[]>([]);
  const [myAdvances, setMyAdvances] = useState<MyAdvanceItem[]>([]);
  const [myClaims, setMyClaims] = useState<MyClaimItem[]>([]);
  const [myPolicies, setMyPolicies] = useState<MyPolicyItem[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [showApplyLeave, setShowApplyLeave] = useState(false);
  const [showAskAdvance, setShowAskAdvance] = useState(false);
  const [showRaiseClaim, setShowRaiseClaim] = useState(false);

  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const closeForms = () => {
    setShowApplyLeave(false);
    setShowAskAdvance(false);
    setShowRaiseClaim(false);
  };

  useEffect(() => {
    if (activeTab === "my-attendance") load("/attendance/calendar", (res) => setDays(res?.data?.days ?? []));
    if (activeTab === "my-leave") { loadMyLeaves(); loadBalances(); loadLeaveTypes(); }
    if (activeTab === "my-payslips") load("/my-payslips", (res) => setPayslips(extractList(res)));
    if (activeTab === "my-advance") load("/my-advances", (res) => setMyAdvances(extractList(res)));
    if (activeTab === "my-requests") load("/expense-claims", (res) => setMyClaims(extractList(res)));
    if (activeTab === "my-policies") load("/my-policies", (res) => setMyPolicies(res?.data?.items ?? []));
  }, [activeTab]);

  const load = async (path: string, apply: (res: any) => void) => {
    setLoading(true);
    try {
      apply(await fetchApi<any>(path));
    } catch (err: any) {
      showNotify(err.message || "Could not load this list", "error");
      apply({ data: [] });
    } finally {
      setLoading(false);
    }
  };

  const loadMyLeaves = () => load("/leaves", (res) => setMyLeaves(extractList(res)));
  const loadBalances = () => load("/leaves/my-balance", (res) => setBalances(extractList(res)));

  const loadLeaveTypes = async () => {
    try {
      const res = await fetchApi<any>("/leave-types");
      setLeaveTypes(extractList(res).map((t: any) => ({ label: t.name, value: String(t.id) })));
    } catch {
      setLeaveTypes([]);
    }
  };

  const applyLeave = async (data: ApplyLeaveFormData) => {
    try {
      await fetchApi("/leaves", {
        method: "POST",
        body: JSON.stringify({
          leave_type_id: Number(data.leave_type),
          from_date: data.from_date,
          to_date: data.to_date,
          reason: data.reason.trim(),
          ...(data.contact_number ? { contact_number: data.contact_number.trim() } : {}),
        }),
      });
      showNotify("Leave request sent");
      setShowApplyLeave(false);
      loadMyLeaves();
      loadBalances();
    } catch (err: any) {
      showNotify(err.message || "Could not apply for leave", "error");
    }
  };

  const askAdvance = async (data: AdvanceFormData) => {
    try {
      await fetchApi("/my-advances", {
        method: "POST",
        body: JSON.stringify({
          amount: Number(data.amount),
          tenure_months: Number(data.tenure_months),
          reason: data.reason.trim(),
        }),
      });
      showNotify("Advance request sent");
      setShowAskAdvance(false);
      load("/my-advances", (res) => setMyAdvances(extractList(res)));
    } catch (err: any) {
      showNotify(err.message || "Could not send the request", "error");
    }
  };

  const raiseClaim = async (data: ClaimFormData) => {
    try {
      await fetchApi("/expense-claims", {
        method: "POST",
        body: JSON.stringify({
          category: data.category,
          expense_date: data.expense_date,
          amount: Number(data.amount),
          description: data.description.trim(),
          ...(data.purpose ? { purpose: data.purpose.trim() } : {}),
        }),
      });
      showNotify("Claim raised");
      setShowRaiseClaim(false);
      load("/expense-claims", (res) => setMyClaims(extractList(res)));
    } catch (err: any) {
      showNotify(err.message || "Could not raise the claim", "error");
    }
  };

  const acknowledge = async (policy: MyPolicyItem) => {
    try {
      await fetchApi(`/policies/${policy.uuid}/acknowledge`, { method: "PUT", body: JSON.stringify({}) });
      showNotify(`Acknowledged ${policy.title}`);
      load("/my-policies", (res) => setMyPolicies(res?.data?.items ?? []));
    } catch (err: any) {
      showNotify(err.message || "Could not record the acknowledgement", "error");
    }
  };

  const download = async (path: string, fallbackName: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const response = await fetch(`${base}${path}`, {
        headers: { Accept: "application/octet-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "That file could not be generated");
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");

      link.href = url;
      link.download = match ? decodeURIComponent(match[1]) : fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      showNotify("Download started");
    } catch (err: any) {
      showNotify(err.message || "Download failed", "error");
    }
  };

  const badge = (text: string, tone: "emerald" | "amber" | "rose" | "blue" | "purple" | "cyan") => {
    const tones: Record<string, string> = {
      emerald: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      rose: "bg-rose-500/15 text-rose-500 border-rose-500/30",
      blue: "bg-blue-500/15 text-blue-500 border-blue-500/30",
      purple: "bg-purple-500/15 text-purple-500 border-purple-500/30",
      cyan: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${tones[tone]}`}>
        {String(text).replace(/_/g, " ")}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const good = ["present", "approved", "paid", "acknowledged", "cleared", "disbursed", "week_off", "holiday"];
    const busy = ["pending", "draft", "verified", "requested", "half_day"];
    const bad = ["absent", "rejected", "cancelled", "stopped"];

    return badge(status, good.includes(status) ? "emerald" : busy.includes(status) ? "amber" : bad.includes(status) ? "rose" : "blue");
  };

  const dayColumns: ColumnDef<DayItem>[] = useMemo(
    () => [
      { accessorKey: "date", header: "Date", cell: (i) => <span className="font-mono text-xs">{dateOf(i.getValue())}</span> },
      { accessorKey: "weekday", header: "Day", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "day_type", header: "Day Type", cell: (i) => badge(String(i.getValue() ?? "-"), "purple") },
      { id: "in", header: "Check In", cell: ({ row }) => <span className="font-mono text-xs text-emerald-500">{clockOf(row.original.first_check_in_at) ?? "-"}</span> },
      { id: "out", header: "Check Out", cell: ({ row }) => <span className="font-mono text-xs text-rose-500">{clockOf(row.original.last_check_out_at) ?? "-"}</span> },
      { accessorKey: "worked_human", header: "Worked", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { id: "late", header: "Punctuality", cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.is_late ? `${row.original.late_minutes} min late` : "On time"}</span> },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "absent")) },
    ],
    []
  );

  const myLeaveColumns: ColumnDef<MyLeaveItem>[] = useMemo(
    () => [
      { id: "type", header: "Leave Type", cell: ({ row }) => badge(row.original.leave_type?.name ?? "-", "cyan") },
      { accessorKey: "from_date", header: "From", cell: (i) => <span className="font-mono text-xs">{dateOf(i.getValue())}</span> },
      { accessorKey: "to_date", header: "To", cell: (i) => <span className="font-mono text-xs">{dateOf(i.getValue())}</span> },
      { accessorKey: "day_count", header: "Days", cell: (i) => badge(String(i.getValue() ?? 0), "purple") },
      { accessorKey: "reason", header: "Reason", cell: (i) => <span className="text-xs text-slate-400 truncate max-w-[220px] block">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "pending")) },
    ],
    []
  );

  const balanceColumns: ColumnDef<BalanceItem>[] = useMemo(
    () => [
      { accessorKey: "code", header: "Code", cell: (i) => <span className="font-mono text-xs font-extrabold text-cyan-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "name", header: "Leave Type", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "annual_quota", header: "Annual Quota", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? 0)} days</span> },
      { accessorKey: "accrued", header: "Accrued", cell: (i) => <span className="font-mono text-xs">{String(i.getValue() ?? 0)}</span> },
      { accessorKey: "used", header: "Used", cell: (i) => <span className="font-mono text-xs">{String(i.getValue() ?? 0)}</span> },
      { accessorKey: "available", header: "Available", cell: (i) => badge(String(i.getValue() ?? 0) + " days", "emerald") },
    ],
    []
  );

  const payslipColumns: ColumnDef<PayslipItem>[] = useMemo(
    () => [
      { accessorKey: "month_label", header: "Month", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "pay_date", header: "Pay Date", cell: (i) => <span className="font-mono text-xs text-slate-400">{dateOf(i.getValue())}</span> },
      { id: "paid_days", header: "Paid Days", cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.paid_days} of {row.original.working_days}</span> },
      { accessorKey: "lop_days", header: "Loss Of Pay", cell: (i) => <span className="font-mono text-xs">{String(i.getValue() ?? 0)}</span> },
      { accessorKey: "gross_earnings", header: "Gross", cell: (i) => <span className="font-mono text-xs text-emerald-500">{money(i.getValue())}</span> },
      { accessorKey: "total_deductions", header: "Deductions", cell: (i) => <span className="font-mono text-xs text-rose-500">{money(i.getValue())}</span> },
      { accessorKey: "net_payable", header: "Net Paid", cell: (i) => <span className="font-mono text-xs font-bold">{money(i.getValue())}</span> },
      { accessorKey: "payment_status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "pending")) },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            title="Download payslip"
            onClick={() => download(`/payslips/${row.original.uuid}/download`, `payslip-${row.original.month}.pdf`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-extrabold uppercase bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-blue-500/30 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Payslip</span>
          </button>
        ),
      },
    ],
    []
  );

  const myAdvanceColumns: ColumnDef<MyAdvanceItem>[] = useMemo(
    () => [
      { accessorKey: "reference", header: "Reference", cell: (i) => <span className="font-mono text-xs font-extrabold text-indigo-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "amount", header: "Advance", cell: (i) => <span className="font-mono text-xs font-bold">{money(i.getValue())}</span> },
      { accessorKey: "emi_amount", header: "EMI", cell: (i) => <span className="font-mono text-xs">{money(i.getValue())}</span> },
      { accessorKey: "tenure_months", header: "Tenure", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? 0)} months</span> },
      { accessorKey: "recovered", header: "Recovered", cell: (i) => <span className="font-mono text-xs text-emerald-500">{money(i.getValue())}</span> },
      { accessorKey: "outstanding", header: "Outstanding", cell: (i) => <span className="font-mono text-xs text-amber-500">{money(i.getValue())}</span> },
      { accessorKey: "reason", header: "Reason", cell: (i) => <span className="text-xs text-slate-400 truncate max-w-[200px] block">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "pending")) },
    ],
    []
  );

  const myClaimColumns: ColumnDef<MyClaimItem>[] = useMemo(
    () => [
      { accessorKey: "expense_date", header: "Date", cell: (i) => <span className="font-mono text-xs">{dateOf(i.getValue())}</span> },
      { accessorKey: "category", header: "Category", cell: (i) => badge(String(i.getValue() ?? "-"), "amber") },
      { id: "details", header: "Details", cell: ({ row }) => <span className="text-xs text-slate-400 truncate max-w-[240px] block">{row.original.purpose || row.original.description || "-"}</span> },
      { accessorKey: "amount", header: "Claimed", cell: (i) => <span className="font-mono text-xs font-bold">{money(i.getValue())}</span> },
      { accessorKey: "payable_amount", header: "Payable", cell: (i) => <span className="font-mono text-xs text-emerald-500">{money(i.getValue())}</span> },
      { accessorKey: "stage", header: "Stage", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "pending")) },
    ],
    []
  );

  const myPolicyColumns: ColumnDef<MyPolicyItem>[] = useMemo(
    () => [
      { accessorKey: "title", header: "Policy", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "category", header: "Category", cell: (i) => badge(String(i.getValue() ?? "-"), "purple") },
      { accessorKey: "version", header: "Version", cell: (i) => <span className="font-mono text-xs text-cyan-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "effective_from", header: "Effective From", cell: (i) => <span className="font-mono text-xs text-slate-400">{dateOf(i.getValue())}</span> },
      { accessorKey: "summary", header: "Summary", cell: (i) => <span className="text-xs text-slate-400 truncate max-w-[240px] block">{String(i.getValue() ?? "-")}</span> },
      { id: "status", header: "Status", cell: ({ row }) => statusBadge(row.original.acknowledged ? "acknowledged" : "pending") },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {!row.original.acknowledged && (
              <button
                title="Acknowledge"
                onClick={() => acknowledge(row.original)}
                className="p-1.5 rounded-lg border bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/30 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}
            {row.original.has_file && (
              <button
                title="Download policy"
                onClick={() => download(`/policies/${row.original.uuid}/download`, `${row.original.title}.pdf`)}
                className="p-1.5 rounded-lg border bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-blue-500/30 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    []
  );

  const applyLeaveFields: FieldConfig<ApplyLeaveFormData>[] = [
    { name: "leave_type", label: "Leave Type", type: "select", options: leaveTypes },
    { name: "contact_number", label: "Contact Number (Optional)", placeholder: "+91 98765 43210" },
    { name: "from_date", label: "From", type: "date" },
    { name: "to_date", label: "To", type: "date" },
    { name: "reason", label: "Reason", type: "textarea", colSpan: 2, placeholder: "Why you need the leave..." },
  ];

  const advanceFields: FieldConfig<AdvanceFormData>[] = [
    { name: "amount", label: "Amount", type: "number", placeholder: "e.g. 50000" },
    { name: "tenure_months", label: "Recover Over (Months)", type: "number", placeholder: "e.g. 5" },
    { name: "reason", label: "Reason", type: "textarea", colSpan: 2, placeholder: "What you need it for..." },
  ];

  const claimFields: FieldConfig<ClaimFormData>[] = [
    { name: "category", label: "Category", type: "select", options: EXPENSE_CATEGORIES, colSpan: 2 },
    { name: "expense_date", label: "Date Of Expense", type: "date" },
    { name: "amount", label: "Amount", type: "number", placeholder: "e.g. 2500" },
    { name: "purpose", label: "Purpose (Optional)", placeholder: "e.g. Client visit to Gurgaon" },
    { name: "description", label: "Details", type: "textarea", colSpan: 2, placeholder: "What you spent it on..." },
  ];

  const tabs: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "my-attendance", label: "My Attendance", icon: CalendarCheck },
    { id: "my-leave", label: "My Leave", icon: CalendarPlus },
    { id: "my-payslips", label: "My Payslips", icon: Receipt },
    { id: "my-advance", label: "Advance Salary", icon: Coins },
    { id: "my-requests", label: "My Requests", icon: FileText },
    { id: "my-policies", label: "Policies", icon: FileText },
  ];

  const action = (() => {
    if (activeTab === "my-leave") return { label: showApplyLeave ? "Back to My Leave" : "Apply For Leave", onClick: () => { const next = !showApplyLeave; closeForms(); setShowApplyLeave(next); } };
    if (activeTab === "my-advance") return { label: showAskAdvance ? "Back to Advances" : "Request Advance", onClick: () => { const next = !showAskAdvance; closeForms(); setShowAskAdvance(next); } };
    if (activeTab === "my-requests") return { label: showRaiseClaim ? "Back to Requests" : "Raise Claim", onClick: () => { const next = !showRaiseClaim; closeForms(); setShowRaiseClaim(next); } };

    return null;
  })();

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div
        className={`rounded-2xl p-6 border backdrop-blur-xl transition-all duration-300 ${
          isDarkMode
            ? "bg-[#0B1A30]/90 border-white/[0.08] text-white"
            : "bg-white border-slate-200 text-slate-900 shadow-sm"
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-500/30 text-sky-500">
              <UserCircle className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">My Space</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-500/20 text-sky-500 border border-sky-500/30">
                  Self Service
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Your own attendance, leave, payslips, advances, claims and the policies you have to acknowledge.
              </p>
            </div>
          </div>

          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{action.label}</span>
            </button>
          )}
        </div>

        {notification && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                : "bg-rose-500/10 border-rose-500/30 text-rose-500"
            }`}
          >
            {notification.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>{notification.text}</span>
          </div>
        )}
      </div>

      {/* SUB-TABS NAVIGATION BAR */}
      <div
        className={`flex items-center gap-2 p-1.5 rounded-xl border overflow-x-auto ${
          isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-slate-100 border-slate-200"
        }`}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); closeForms(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-sky-600 text-white shadow-md shadow-sky-500/20"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "my-attendance" && (
        <DataTable
          title="My Attendance This Month"
          description="Day by day punches, worked hours and late marks."
          columns={dayColumns}
          data={days}
          isLoading={loading}
          searchPlaceholder="Filter by date or status..."
          isDarkMode={isDarkMode}
        />
      )}

      {activeTab === "my-leave" && (
        showApplyLeave ? (
          <DynamicForm
            title="Apply For Leave"
            description="Your manager gets the request as soon as you send it."
            schema={applyLeaveSchema}
            fields={applyLeaveFields}
            columns={2}
            onSubmit={applyLeave}
            onCancel={() => setShowApplyLeave(false)}
            submitText="Send Request"
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className="space-y-6">
            <DataTable
              title="My Leave Balance"
              description="What you have earned and what is still left."
              columns={balanceColumns}
              data={balances}
              isLoading={loading}
              searchPlaceholder="Filter leave types..."
              isDarkMode={isDarkMode}
            />
            <DataTable
              title="My Leave Requests"
              description="Everything you have applied for, and where it has reached."
              columns={myLeaveColumns}
              data={myLeaves}
              isLoading={loading}
              searchPlaceholder="Filter requests..."
              isDarkMode={isDarkMode}
            />
          </div>
        )
      )}

      {activeTab === "my-payslips" && (
        <DataTable
          title="My Payslips"
          description="Every month you have been paid for, with the payslip to download."
          columns={payslipColumns}
          data={payslips}
          isLoading={loading}
          searchPlaceholder="Filter by month..."
          isDarkMode={isDarkMode}
        />
      )}

      {activeTab === "my-advance" && (
        showAskAdvance ? (
          <DynamicForm
            title="Request Advance Salary"
            description="HR sets the EMI plan once the request is approved."
            schema={advanceSchema}
            fields={advanceFields}
            columns={2}
            onSubmit={askAdvance}
            onCancel={() => setShowAskAdvance(false)}
            submitText="Send Request"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="My Advances"
            description="What you have asked for, and how much is still being recovered."
            columns={myAdvanceColumns}
            data={myAdvances}
            isLoading={loading}
            searchPlaceholder="Filter by reference..."
            isDarkMode={isDarkMode}
          />
        )
      )}

      {activeTab === "my-requests" && (
        showRaiseClaim ? (
          <DynamicForm
            title="Raise Reimbursement Claim"
            description="Your manager approves it, then finance verifies and pays."
            schema={claimSchema}
            fields={claimFields}
            columns={2}
            onSubmit={raiseClaim}
            onCancel={() => setShowRaiseClaim(false)}
            submitText="Raise Claim"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="My Requests"
            description="Reimbursement claims you have raised and where each one has reached."
            columns={myClaimColumns}
            data={myClaims}
            isLoading={loading}
            searchPlaceholder="Filter by category or purpose..."
            isDarkMode={isDarkMode}
          />
        )
      )}

      {activeTab === "my-policies" && (
        <DataTable
          title="Policies That Apply To Me"
          description="Read each one and acknowledge it."
          columns={myPolicyColumns}
          data={myPolicies}
          isLoading={loading}
          searchPlaceholder="Filter policies..."
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default SelfServiceModule;
