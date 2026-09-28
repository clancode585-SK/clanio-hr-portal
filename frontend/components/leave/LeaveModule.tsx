"use client";

import React, { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { fetchApi, extractList } from "@/lib/api";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  Check,
  X,
  FileText,
  Sliders,
  Shield,
} from "lucide-react";

interface LeaveTypeItem {
  id: number;
  name: string;
  code: string;
  description?: string;
  annual_quota: number;
  is_paid: boolean;
  allow_half_day: boolean;
  carry_forward: boolean;
  status: string;
}

interface LeaveRequestItem {
  id: number;
  employee_name: string;
  employee_id: number;
  leave_type_name: string;
  leave_type_id: number;
  from_date: string;
  to_date: string;
  total_days: number;
  is_half_day: boolean;
  half_day_session?: string;
  reason: string;
  contact_number?: string;
  status: string;
  created_at: string;
}

interface LeaveBalanceItem {
  id: number;
  employee_name: string;
  employee_id: number;
  leave_type_name: string;
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

const applyLeaveSchema = z.object({
  leave_type_id: z.string().min(1, "Please select a leave type"),
  from_date: z.string().min(1, "From date is required"),
  to_date: z.string().min(1, "To date is required"),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(500, "Max 500 characters"),
  contact_number: z.string().optional().or(z.literal("")),
});

type ApplyLeaveFormData = z.infer<typeof applyLeaveSchema>;

const leaveTypeSchema = z.object({
  name: z.string().min(2, "Leave type name required").max(100, "Max 100 characters"),
  code: z
    .string()
    .min(2, "Code required (e.g. SL)")
    .max(20, "Max 20 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Code must contain only letters, numbers, hyphens or underscores"),
  annual_quota: z.coerce.number().min(0, "Min 0").max(365, "Max 365"),
  is_paid: z.boolean(),
  allow_half_day: z.boolean(),
  description: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
});

type LeaveTypeFormData = z.infer<typeof leaveTypeSchema>;

interface LeaveModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

export const LeaveModule: React.FC<LeaveModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "leave-requests",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    if (externalTab) setActiveTab(externalTab);
  }, [externalTab]);

  // Data States
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceItem[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Form Visibility States
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [showAddTypeForm, setShowAddTypeForm] = useState(false);

  // Feedback Notification
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Mount Fetching
  useEffect(() => {
    fetchLeaveTypes();
    if (activeTab === "leave-requests" || activeTab === "leave") fetchLeaveRequests();
    if (activeTab === "leave-balance") fetchLeaveBalances();
    if (activeTab === "leave-policies") fetchLeaveTypes();
  }, [activeTab]);

  const fetchLeaveTypes = async () => {
    setLoadingTypes(true);
    try {
      const res = await fetchApi<any>("/leave-types");
      const list = extractList(res);
      setLeaveTypes(list);
    } catch (err: any) {
      console.error("Failed to load leave types:", err);
    } finally {
      setLoadingTypes(false);
    }
  };

  const fetchLeaveRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetchApi<any>("/leaves");
      const list = extractList(res);
      const formatted: LeaveRequestItem[] = list.map((item: any) => ({
        id: item.id,
        employee_name: item.employee?.user?.name || item.employee_name || "Employee",
        employee_id: item.employee_id,
        leave_type_name: item.leave_type?.name || item.leave_type_name || "Leave",
        leave_type_id: item.leave_type_id,
        from_date: item.from_date || "-",
        to_date: item.to_date || "-",
        total_days: item.total_days || item.days_count || 1,
        is_half_day: item.is_half_day ?? false,
        half_day_session: item.half_day_session,
        reason: item.reason || "-",
        contact_number: item.contact_number || "-",
        status: item.status || "pending",
        created_at: item.created_at || "-",
      }));
      setLeaveRequests(formatted);
    } catch (err: any) {
      console.error("Failed to load leave requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchLeaveBalances = async () => {
    setLoadingBalances(true);
    try {
      const res = await fetchApi<any>("/leave-balances");
      const list = extractList(res);
      const formatted: LeaveBalanceItem[] = list.map((item: any) => ({
        id: item.id,
        employee_name: item.employee?.user?.name || item.employee_name || "Employee",
        employee_id: item.employee_id,
        leave_type_name: item.leave_type?.name || item.leave_type_name || "Casual Leave",
        allocated: item.allocated ?? item.quota ?? 12,
        used: item.used ?? 0,
        pending: item.pending ?? 0,
        available: item.available ?? (item.allocated - item.used),
      }));
      setLeaveBalances(formatted);
    } catch (err: any) {
      console.error("Failed to load leave balances:", err);
    } finally {
      setLoadingBalances(false);
    }
  };

  // Approve / Reject Leave Handlers
  const handleApproveLeave = async (id: number) => {
    try {
      await fetchApi(`/leaves/${id}/approve`, {
        method: "PUT",
        body: JSON.stringify({ remarks: "Approved via HR Portal" }),
      });
      showNotify("Leave request approved!");
      fetchLeaveRequests();
    } catch (err: any) {
      showNotify(err.message || "Failed to approve leave", "error");
    }
  };

  const handleRejectLeave = async (id: number) => {
    try {
      await fetchApi(`/leaves/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: "Rejected via HR Portal" }),
      });
      showNotify("Leave request rejected!", "error");
      fetchLeaveRequests();
    } catch (err: any) {
      showNotify(err.message || "Failed to reject leave", "error");
    }
  };

  // Submit Handlers for DynamicForm
  const handleApplyLeaveSubmit = async (data: ApplyLeaveFormData) => {
    try {
      const payload = {
        leave_type_id: Number(data.leave_type_id),
        from_date: data.from_date,
        to_date: data.to_date,
        is_half_day: false,
        reason: data.reason,
        ...(data.contact_number ? { contact_number: data.contact_number } : {}),
      };

      await fetchApi("/leaves", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Leave application submitted successfully!");
      setShowApplyForm(false);
      fetchLeaveRequests();
    } catch (err: any) {
      showNotify(err.message || "Failed to submit leave application", "error");
    }
  };

  const handleCreateLeaveTypeSubmit = async (data: LeaveTypeFormData) => {
    try {
      const payload = {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        annual_quota: Number(data.annual_quota),
        is_paid: data.is_paid,
        allow_half_day: data.allow_half_day,
        description: data.description?.trim() || null,
      };

      await fetchApi("/leave-types", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("New leave type policy created!");
      setShowAddTypeForm(false);
      fetchLeaveTypes();
    } catch (err: any) {
      showNotify(err.message || "Failed to create leave type", "error");
    }
  };

  // Dynamic Options & Fields Config
  const leaveTypeOptions = useMemo(
    () =>
      leaveTypes.map((t) => ({
        label: `${t.name} (${t.annual_quota} Days/Yr)`,
        value: String(t.id),
      })),
    [leaveTypes]
  );

  const applyLeaveFields: FieldConfig<ApplyLeaveFormData>[] = [
    { name: "leave_type_id", label: "Leave Type", type: "select", options: leaveTypeOptions },
    { name: "from_date", label: "From Date", type: "date" },
    { name: "to_date", label: "To Date", type: "date" },
    { name: "contact_number", label: "Emergency Contact (Optional)", placeholder: "+91 98765 43210" },
    { name: "reason", label: "Reason for Leave", type: "textarea", rows: 3, placeholder: "Provide reason...", colSpan: 2 },
  ];

  const leaveTypeFields: FieldConfig<LeaveTypeFormData>[] = [
    { name: "name", label: "Leave Type Name", placeholder: "e.g. Casual Leave" },
    { name: "code", label: "Policy Code", placeholder: "e.g. CL" },
    { name: "annual_quota", label: "Annual Quota (Days)", type: "number", placeholder: "12" },
    { name: "description", label: "Description (Optional)", type: "textarea", rows: 2, placeholder: "Policy rules...", colSpan: 2 },
  ];

  // DataTable Column Configurations
  const leaveRequestsColumns: ColumnDef<LeaveRequestItem>[] = useMemo(
    () => [
      {
        accessorKey: "employee_name",
        header: "Employee",
        cell: (info) => (
          <span className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "leave_type_name",
        header: "Leave Type",
        cell: (info) => (
          <span className="text-purple-400 font-bold">{info.getValue() as string}</span>
        ),
      },
      {
        accessorKey: "from_date",
        header: "Dates",
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className={`font-mono text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              {row.from_date} to {row.to_date}
            </span>
          );
        },
      },
      {
        accessorKey: "total_days",
        header: "Duration",
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className={`text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              {row.is_half_day ? "0.5 Day (Half Day)" : `${row.total_days} Days`}
            </span>
          );
        },
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: (info) => (
          <span className={`truncate max-w-xs block ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                status === "approved"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : status === "rejected"
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (row.status !== "pending") return null;
          return (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleApproveLeave(row.id)}
                title="Approve Leave"
                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleRejectLeave(row.id)}
                title="Reject Leave"
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [isDarkMode]
  );

  const leaveBalancesColumns: ColumnDef<LeaveBalanceItem>[] = useMemo(
    () => [
      {
        accessorKey: "employee_name",
        header: "Employee",
        cell: (info) => (
          <span className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "leave_type_name",
        header: "Leave Type",
        cell: (info) => <span className="font-bold text-purple-400">{info.getValue() as string}</span>,
      },
      {
        accessorKey: "allocated",
        header: "Allocated Quota",
        cell: (info) => (
          <span className={`font-mono ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as number} Days
          </span>
        ),
      },
      {
        accessorKey: "used",
        header: "Used",
        cell: (info) => <span className="font-mono text-rose-400 font-bold">{info.getValue() as number} Days</span>,
      },
      {
        accessorKey: "pending",
        header: "Pending",
        cell: (info) => <span className="font-mono text-amber-400 font-bold">{info.getValue() as number} Days</span>,
      },
      {
        accessorKey: "available",
        header: "Available Balance",
        cell: (info) => <span className="font-mono text-emerald-400 font-extrabold">{info.getValue() as number} Days</span>,
      },
    ],
    [isDarkMode]
  );

  const leaveTypesColumns: ColumnDef<LeaveTypeItem>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: (info) => (
          <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border bg-purple-500/15 text-purple-300 border-purple-500/30">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Policy Name",
        cell: (info) => (
          <span className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "annual_quota",
        header: "Annual Quota",
        cell: (info) => (
          <span className={`font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as number} Days
          </span>
        ),
      },
      {
        accessorKey: "is_paid",
        header: "Type",
        cell: (info) => (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            {info.getValue() ? "Paid Leave" : "Unpaid"}
          </span>
        ),
      },
      {
        accessorKey: "allow_half_day",
        header: "Allow Half Day",
        cell: (info) => (
          <span className={`text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() ? "Yes" : "No"}
          </span>
        ),
      },
    ],
    [isDarkMode]
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden backdrop-blur-xl transition-all ${
          isDarkMode
            ? "bg-[#0B1A30]/90 border-white/[0.08] shadow-2xl"
            : "bg-white border-slate-200 shadow-xl"
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 via-purple-600 to-indigo-600 text-white shadow-md">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">Leave Management & Approvals</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                  HR Module
                </span>
              </div>
              <p className={`text-xs mt-0.5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Manage employee leave requests, leave quotas, approvals, and policy rules.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowApplyForm(!showApplyForm)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{showApplyForm ? "Back to Table" : "Apply for Leave"}</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {notification && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {notification.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>{notification.text}</span>
          </div>
        )}
      </div>

      {/* SUB-TABS NAVIGATION BAR */}
      <div
        className={`p-1 rounded-2xl border flex flex-wrap items-center gap-1 ${
          isDarkMode ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-100 border-slate-200"
        }`}
      >
        <button
          onClick={() => { setActiveTab("leave-requests"); setShowApplyForm(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "leave-requests" || activeTab === "leave"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Leave Applications</span>
        </button>
        <button
          onClick={() => { setActiveTab("leave-balance"); setShowApplyForm(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "leave-balance"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Leave Balances</span>
        </button>
        <button
          onClick={() => { setActiveTab("leave-policies"); setShowApplyForm(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "leave-policies"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Leave Types & Policies</span>
        </button>
      </div>

      {/* SECTION 1: LEAVE APPLICATIONS & APPROVALS */}
      {(activeTab === "leave-requests" || activeTab === "leave") && (
        showApplyForm ? (
          <DynamicForm
            title="Apply for Leave"
            description="Submit a new leave application to your reporting manager."
            schema={applyLeaveSchema}
            fields={applyLeaveFields}
            columns={2}
            onSubmit={handleApplyLeaveSubmit}
            onCancel={() => setShowApplyForm(false)}
            submitText="Submit Leave Application"
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className="space-y-4">
            {/* Summary Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Applications</p>
                <p className={`text-xl font-extrabold mt-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{leaveRequests.length}</p>
              </div>
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Pending Approvals</p>
                <p className="text-xl font-extrabold mt-1 text-amber-400">{leaveRequests.filter((r) => r.status === "pending").length}</p>
              </div>
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Approved Leaves</p>
                <p className="text-xl font-extrabold mt-1 text-emerald-400">{leaveRequests.filter((r) => r.status === "approved").length}</p>
              </div>
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Rejected Requests</p>
                <p className="text-xl font-extrabold mt-1 text-rose-400">{leaveRequests.filter((r) => r.status === "rejected").length}</p>
              </div>
            </div>

            <DataTable
              title="Leave Applications Directory"
              description="Manage employee leave requests, manager approvals, and status logs."
              columns={leaveRequestsColumns}
              data={leaveRequests}
              isLoading={loadingRequests}
              searchPlaceholder="Search by employee, leave type or reason..."
              isDarkMode={isDarkMode}
              actionButton={
                <button
                  onClick={() => setShowApplyForm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Apply Leave</span>
                </button>
              }
            />
          </div>
        )
      )}

      {/* SECTION 2: LEAVE BALANCES DIRECTORY */}
      {activeTab === "leave-balance" && (
        <DataTable
          title="Employee Leave Quotas & Balances"
          description="Available, used, and allocated leave balances across company leave types."
          columns={leaveBalancesColumns}
          data={leaveBalances}
          isLoading={loadingBalances}
          searchPlaceholder="Search balances by employee or leave type..."
          isDarkMode={isDarkMode}
        />
      )}

      {/* SECTION 3: LEAVE TYPES & POLICIES */}
      {activeTab === "leave-policies" && (
        showAddTypeForm ? (
          <DynamicForm
            title="Create New Leave Policy"
            description="Configure annual leave quotas, paid status, and policy rules."
            schema={leaveTypeSchema}
            fields={leaveTypeFields}
            columns={2}
            onSubmit={handleCreateLeaveTypeSubmit}
            onCancel={() => setShowAddTypeForm(false)}
            submitText="Save Leave Policy"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Configured Leave Types & Policies"
            description="Manage annual leave quotas, paid/unpaid status, and policy rules."
            columns={leaveTypesColumns}
            data={leaveTypes}
            isLoading={loadingTypes}
            searchPlaceholder="Search policies by name or code..."
            isDarkMode={isDarkMode}
            actionButton={
              <button
                onClick={() => setShowAddTypeForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Leave Type</span>
              </button>
            }
          />
        )
      )}
    </div>
  );
};
