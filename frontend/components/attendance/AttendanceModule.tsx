"use client";

import React, { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { fetchApi, extractList } from "@/lib/api";
import {
  Clock,
  Play,
  Square,
  Plus,
  Check,
  X,
  Calendar,
  CheckCircle2,
  XCircle,
  FileCheck,
  MapPin,
} from "lucide-react";

interface AttendanceLogItem {
  id: number;
  employee_name: string;
  employee_id: number;
  attendance_date: string;
  check_in_time?: string;
  check_out_time?: string;
  status: string;
  location?: string;
}

interface WorkShiftItem {
  id: number;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  employees_count?: number;
  weekly_offs?: number[];
}

interface HolidayItem {
  id: number;
  name: string;
  holiday_date: string;
  type: string;
  is_paid: boolean;
  description?: string;
}

interface RegularizationItem {
  id: number;
  employee_name: string;
  employee_id: number;
  attendance_date: string;
  requested_check_in?: string;
  requested_check_out?: string;
  reason: string;
  status: string;
}

const workShiftSchema = z.object({
  name: z.string().min(2, "Shift name required").max(100, "Max 100 characters"),
  code: z
    .string()
    .min(2, "Code required (e.g. MORNING)")
    .max(20, "Max 20 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Code must contain only letters, numbers, hyphens or underscores"),
  start_time: z.string().min(1, "Start time required"),
  end_time: z.string().min(1, "End time required"),
  grace_minutes: z.coerce.number().min(0, "Min 0").max(120, "Max 120"),
});

type WorkShiftFormData = z.infer<typeof workShiftSchema>;

const holidaySchema = z.object({
  name: z.string().min(2, "Holiday name required").max(100, "Max 100 characters"),
  holiday_date: z.string().min(1, "Date is required"),
  type: z.enum(["public", "optional", "restricted"]),
  description: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
});

type HolidayFormData = z.infer<typeof holidaySchema>;

const regularizationSchema = z.object({
  attendance_date: z.string().min(1, "Attendance date required"),
  requested_check_in: z.string().min(1, "Requested check in required (e.g. 09:30)"),
  requested_check_out: z.string().min(1, "Requested check out required (e.g. 18:30)"),
  reason: z.string().min(3, "Reason required").max(500, "Max 500 characters"),
});

type RegularizationFormData = z.infer<typeof regularizationSchema>;

interface AttendanceModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "attendance-list",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    if (externalTab) setActiveTab(externalTab);
  }, [externalTab]);

  // Data States
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogItem[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [shifts, setShifts] = useState<WorkShiftItem[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [regularizations, setRegularizations] = useState<RegularizationItem[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);

  // Today Live Status
  const [todayStatus, setTodayStatus] = useState<AttendanceLogItem | null>(null);
  const [clockingAction, setClockingAction] = useState(false);

  // Form Visibility States
  const [showAddShiftForm, setShowAddShiftForm] = useState(false);
  const [showAddHolidayForm, setShowAddHolidayForm] = useState(false);
  const [showAddRegForm, setShowAddRegForm] = useState(false);

  // Feedback Notification
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Mount Fetching
  useEffect(() => {
    fetchTodayStatus();
    if (activeTab === "attendance-list" || activeTab === "attendance") fetchAttendanceLogs();
    if (activeTab === "shift-management") fetchShifts();
    if (activeTab === "holidays") fetchHolidays();
    if (activeTab === "regularization") fetchRegularizations();
  }, [activeTab]);

  const fetchTodayStatus = async () => {
    try {
      const res = await fetchApi<any>("/attendance/today");
      if (res?.data) {
        setTodayStatus(res.data);
      }
    } catch {
      // Silent catch if user has not checked in today
    }
  };

  const fetchAttendanceLogs = async () => {
    setLoadingAttendance(true);
    try {
      const res = await fetchApi<any>("/attendance");
      const list = extractList(res);
      const formatted: AttendanceLogItem[] = list.map((item: any) => ({
        id: item.id,
        employee_name: item.employee?.user?.name || item.employee_name || "Employee",
        employee_id: item.employee_id,
        attendance_date: item.attendance_date || "-",
        check_in_time: item.check_in_time || null,
        check_out_time: item.check_out_time || null,
        status: item.status || "present",
        location: item.location || "Office Terminal",
      }));
      setAttendanceLogs(formatted);
    } catch {
      setAttendanceLogs([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const fetchShifts = async () => {
    setLoadingShifts(true);
    try {
      const res = await fetchApi<any>("/work-shifts");
      const list = extractList(res);
      setShifts(list);
    } catch {
      setShifts([]);
    } finally {
      setLoadingShifts(false);
    }
  };

  const fetchHolidays = async () => {
    setLoadingHolidays(true);
    try {
      const res = await fetchApi<any>("/holidays");
      const list = extractList(res);
      setHolidays(list);
    } catch {
      setHolidays([]);
    } finally {
      setLoadingHolidays(false);
    }
  };

  const fetchRegularizations = async () => {
    setLoadingRegs(true);
    try {
      const res = await fetchApi<any>("/regularizations");
      const list = extractList(res);
      const formatted: RegularizationItem[] = list.map((item: any) => ({
        id: item.id,
        employee_name: item.employee?.user?.name || item.employee_name || "Employee",
        employee_id: item.employee_id,
        attendance_date: item.attendance_date || "-",
        requested_check_in: item.requested_check_in || "-",
        requested_check_out: item.requested_check_out || "-",
        reason: item.reason || "-",
        status: item.status || "pending",
      }));
      setRegularizations(formatted);
    } catch {
      setRegularizations([]);
    } finally {
      setLoadingRegs(false);
    }
  };

  // Clock In / Out Actions
  const handleCheckIn = async () => {
    setClockingAction(true);
    try {
      await fetchApi("/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ location: "HR Web Portal", notes: "Live terminal check in" }),
      });
      showNotify("Clocked in successfully!");
      fetchTodayStatus();
      fetchAttendanceLogs();
    } catch (err: any) {
      showNotify(err.message || "Clock-in failed", "error");
    } finally {
      setClockingAction(false);
    }
  };

  const handleCheckOut = async () => {
    setClockingAction(true);
    try {
      await fetchApi("/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({ notes: "Live terminal check out" }),
      });
      showNotify("Clocked out successfully!");
      fetchTodayStatus();
      fetchAttendanceLogs();
    } catch (err: any) {
      showNotify(err.message || "Clock-out failed", "error");
    } finally {
      setClockingAction(false);
    }
  };

  // Approve / Reject Regularization
  const handleApproveReg = async (id: number) => {
    try {
      await fetchApi(`/regularizations/${id}/approve`, { method: "PUT" });
      showNotify("Regularization approved!");
      fetchRegularizations();
    } catch (err: any) {
      showNotify(err.message || "Failed to approve", "error");
    }
  };

  const handleRejectReg = async (id: number) => {
    try {
      await fetchApi(`/regularizations/${id}/reject`, { method: "PUT" });
      showNotify("Regularization rejected!", "error");
      fetchRegularizations();
    } catch (err: any) {
      showNotify(err.message || "Failed to reject", "error");
    }
  };

  // DynamicForm Submit Handlers
  const handleCreateShiftSubmit = async (data: WorkShiftFormData) => {
    try {
      const payload = {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        start_time: data.start_time,
        end_time: data.end_time,
        grace_minutes: Number(data.grace_minutes),
        full_day_minutes: 480,
        half_day_minutes: 240,
        weekly_offs: [0, 6],
      };

      await fetchApi("/work-shifts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Work shift created successfully!");
      setShowAddShiftForm(false);
      fetchShifts();
    } catch (err: any) {
      showNotify(err.message || "Failed to create shift", "error");
    }
  };

  const handleCreateHolidaySubmit = async (data: HolidayFormData) => {
    try {
      const payload = {
        name: data.name.trim(),
        holiday_date: data.holiday_date,
        type: data.type,
        is_paid: true,
        description: data.description?.trim() || null,
      };

      await fetchApi("/holidays", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Holiday registered successfully!");
      setShowAddHolidayForm(false);
      fetchHolidays();
    } catch (err: any) {
      showNotify(err.message || "Failed to register holiday", "error");
    }
  };

  const handleCreateRegSubmit = async (data: RegularizationFormData) => {
    try {
      const payload = {
        attendance_date: data.attendance_date,
        requested_check_in: data.requested_check_in,
        requested_check_out: data.requested_check_out,
        reason: data.reason.trim(),
      };

      await fetchApi("/regularizations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Regularization request submitted!");
      setShowAddRegForm(false);
      fetchRegularizations();
    } catch (err: any) {
      showNotify(err.message || "Failed to submit regularization", "error");
    }
  };

  // DynamicForm Fields Configs
  const workShiftFields: FieldConfig<WorkShiftFormData>[] = [
    { name: "name", label: "Shift Name", placeholder: "e.g. Morning Shift" },
    { name: "code", label: "Shift Code", placeholder: "e.g. MORNING" },
    { name: "start_time", label: "Start Time (HH:MM)", placeholder: "09:00" },
    { name: "end_time", label: "End Time (HH:MM)", placeholder: "18:00" },
    { name: "grace_minutes", label: "Grace Period (Minutes)", type: "number", placeholder: "15", colSpan: 2 },
  ];

  const holidayFields: FieldConfig<HolidayFormData>[] = [
    { name: "name", label: "Holiday Name", placeholder: "e.g. Independence Day" },
    { name: "holiday_date", label: "Holiday Date", type: "date" },
    {
      name: "type",
      label: "Holiday Category",
      type: "select",
      options: [
        { label: "Public Holiday", value: "public" },
        { label: "Optional Holiday", value: "optional" },
        { label: "Restricted Holiday", value: "restricted" },
      ],
    },
    { name: "description", label: "Description (Optional)", type: "textarea", rows: 2, placeholder: "Details...", colSpan: 2 },
  ];

  const regularizationFields: FieldConfig<RegularizationFormData>[] = [
    { name: "attendance_date", label: "Attendance Date", type: "date" },
    { name: "requested_check_in", label: "Requested Check In (HH:MM)", placeholder: "09:30" },
    { name: "requested_check_out", label: "Requested Check Out (HH:MM)", placeholder: "18:30" },
    { name: "reason", label: "Reason for Missed Log", type: "textarea", rows: 2, placeholder: "Provide explanation...", colSpan: 2 },
  ];

  // DataTable Column Configurations
  const attendanceColumns: ColumnDef<AttendanceLogItem>[] = useMemo(
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
        accessorKey: "attendance_date",
        header: "Date",
        cell: (info) => (
          <span className={`font-mono ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "check_in_time",
        header: "Check In",
        cell: (info) => (
          <span className="font-mono text-emerald-500 font-bold">
            {(info.getValue() as string) || "--:--"}
          </span>
        ),
      },
      {
        accessorKey: "check_out_time",
        header: "Check Out",
        cell: (info) => (
          <span className="font-mono text-rose-500 font-bold">
            {(info.getValue() as string) || "--:--"}
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
                status === "present"
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : status === "late"
                  ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                  : "bg-rose-500/15 text-rose-600 border-rose-500/30"
              }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: (info) => (
          <span className={`flex items-center gap-1.5 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            <MapPin className="w-3 h-3 text-slate-400" />
            <span>{(info.getValue() as string) || "Terminal"}</span>
          </span>
        ),
      },
    ],
    [isDarkMode]
  );

  const workShiftColumns: ColumnDef<WorkShiftItem>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Shift Code",
        cell: (info) => (
          <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border bg-blue-500/15 text-blue-600 border-blue-500/30">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Shift Name",
        cell: (info) => (
          <span className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "start_time",
        header: "Shift Hours",
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="font-mono text-xs font-bold text-emerald-600">
              {row.start_time} - {row.end_time}
            </span>
          );
        },
      },
      {
        accessorKey: "grace_minutes",
        header: "Grace Period",
        cell: (info) => (
          <span className={`font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as number} mins
          </span>
        ),
      },
      {
        accessorKey: "employees_count",
        header: "Members Assigned",
        cell: (info) => (
          <span className="font-semibold text-xs px-2.5 py-1 rounded-full border bg-purple-500/15 text-purple-600 border-purple-500/30">
            {(info.getValue() as number) || 0} employees
          </span>
        ),
      },
    ],
    [isDarkMode]
  );

  const holidayColumns: ColumnDef<HolidayItem>[] = useMemo(
    () => [
      {
        accessorKey: "holiday_date",
        header: "Date",
        cell: (info) => (
          <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border bg-amber-500/15 text-amber-600 border-amber-500/30">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Holiday Name",
        cell: (info) => (
          <span className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Category",
        cell: (info) => (
          <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded uppercase border ${isDarkMode ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "is_paid",
        header: "Type",
        cell: (info) => (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            {info.getValue() ? "Paid Holiday" : "Unpaid"}
          </span>
        ),
      },
    ],
    [isDarkMode]
  );

  const regularizationColumns: ColumnDef<RegularizationItem>[] = useMemo(
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
        accessorKey: "attendance_date",
        header: "Date",
        cell: (info) => (
          <span className={`font-mono ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "requested_check_in",
        header: "Requested In",
        cell: (info) => (
          <span className="font-mono text-emerald-600 font-bold">
            {(info.getValue() as string) || "--:--"}
          </span>
        ),
      },
      {
        accessorKey: "requested_check_out",
        header: "Requested Out",
        cell: (info) => (
          <span className="font-mono text-rose-600 font-bold">
            {(info.getValue() as string) || "--:--"}
          </span>
        ),
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
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : status === "rejected"
                  ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                  : "bg-amber-500/15 text-amber-600 border-amber-500/30"
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
                onClick={() => handleApproveReg(row.id)}
                title="Approve Request"
                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleRejectReg(row.id)}
                title="Reject Request"
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 cursor-pointer"
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Clock-In Widget */}
      <div
        className={`rounded-2xl p-6 border backdrop-blur-xl transition-all duration-300 ${
          isDarkMode
            ? "bg-[#0B1A30]/90 border-white/[0.08] text-white"
            : "bg-white border-slate-200 text-slate-900 shadow-sm"
        }`}
      >
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-500">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">Attendance & Work Shift Stream</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                  Live Terminal
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Real-time check-ins, shift schedules, holidays, and attendance regularization requests.
              </p>
            </div>
          </div>

          {/* Clock In / Out Action Widget */}
          <div className={`flex items-center gap-4 p-3 rounded-2xl border ${
            isDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
          }`}>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today's Status</p>
              <p className="text-xs font-mono font-extrabold text-emerald-500">
                {todayStatus?.check_in_time ? `In: ${todayStatus.check_in_time}` : "Not Checked In"}
                {todayStatus?.check_out_time ? ` | Out: ${todayStatus.check_out_time}` : ""}
              </p>
            </div>

            {!todayStatus?.check_in_time ? (
              <button
                onClick={handleCheckIn}
                disabled={clockingAction}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{clockingAction ? "Clocking In..." : "Clock In Now"}</span>
              </button>
            ) : !todayStatus?.check_out_time ? (
              <button
                onClick={handleCheckOut}
                disabled={clockingAction}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>{clockingAction ? "Clocking Out..." : "Clock Out"}</span>
              </button>
            ) : (
              <span className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-600">
                Shift Completed
              </span>
            )}
          </div>
        </div>

        {/* Global Feedback Banner */}
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
      <div className={`flex items-center gap-2 p-1.5 rounded-xl border ${
        isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-slate-100 border-slate-200"
      }`}>
        <button
          onClick={() => { setActiveTab("attendance-list"); setShowAddShiftForm(false); setShowAddHolidayForm(false); setShowAddRegForm(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "attendance-list" || activeTab === "attendance"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Attendance Stream</span>
        </button>
        <button
          onClick={() => { setActiveTab("shift-management"); setShowAddShiftForm(false); setShowAddHolidayForm(false); setShowAddRegForm(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "shift-management"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Shift Management</span>
        </button>
        <button
          onClick={() => { setActiveTab("holidays"); setShowAddShiftForm(false); setShowAddHolidayForm(false); setShowAddRegForm(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "holidays"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Holidays</span>
        </button>
        <button
          onClick={() => { setActiveTab("regularization"); setShowAddShiftForm(false); setShowAddHolidayForm(false); setShowAddRegForm(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "regularization"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Regularization</span>
        </button>
      </div>

      {/* SECTION 1: ATTENDANCE STREAM */}
      {(activeTab === "attendance-list" || activeTab === "attendance") && (
        <DataTable
          title="Today's Attendance Logs"
          description="Real-time check-in and check-out timestamps for company members."
          columns={attendanceColumns}
          data={attendanceLogs}
          isLoading={loadingAttendance}
          searchPlaceholder="Search attendance logs by employee..."
          isDarkMode={isDarkMode}
        />
      )}

      {/* SECTION 2: WORK SHIFTS */}
      {activeTab === "shift-management" && (
        showAddShiftForm ? (
          <DynamicForm
            title="Create Work Shift"
            description="Define shift timings, grace period, and weekly off days."
            schema={workShiftSchema}
            fields={workShiftFields}
            columns={2}
            onSubmit={handleCreateShiftSubmit}
            onCancel={() => setShowAddShiftForm(false)}
            submitText="Save Work Shift"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Work Shift Templates & Schedules"
            description="Manage company shift templates, grace periods, and working hours."
            columns={workShiftColumns}
            data={shifts}
            isLoading={loadingShifts}
            searchPlaceholder="Search shifts by name or code..."
            isDarkMode={isDarkMode}
            actionButton={
              <button
                onClick={() => setShowAddShiftForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Work Shift</span>
              </button>
            }
          />
        )
      )}

      {/* SECTION 3: HOLIDAYS */}
      {activeTab === "holidays" && (
        showAddHolidayForm ? (
          <DynamicForm
            title="Register Company Holiday"
            description="Add a new public, optional, or restricted holiday."
            schema={holidaySchema}
            fields={holidayFields}
            columns={2}
            onSubmit={handleCreateHolidaySubmit}
            onCancel={() => setShowAddHolidayForm(false)}
            submitText="Save Holiday"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Company Holidays Directory"
            description="Public, optional, and restricted holidays configured for the company."
            columns={holidayColumns}
            data={holidays}
            isLoading={loadingHolidays}
            searchPlaceholder="Search holidays by name or date..."
            isDarkMode={isDarkMode}
            actionButton={
              <button
                onClick={() => setShowAddHolidayForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Holiday</span>
              </button>
            }
          />
        )
      )}

      {/* SECTION 4: REGULARIZATION */}
      {activeTab === "regularization" && (
        showAddRegForm ? (
          <DynamicForm
            title="Apply for Attendance Regularization"
            description="Request correction for missed check-in/out timestamps."
            schema={regularizationSchema}
            fields={regularizationFields}
            columns={2}
            onSubmit={handleCreateRegSubmit}
            onCancel={() => setShowAddRegForm(false)}
            submitText="Submit Regularization"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Attendance Regularization Requests"
            description="Request correction for missed logs or approve pending manager queue."
            columns={regularizationColumns}
            data={regularizations}
            isLoading={loadingRegs}
            searchPlaceholder="Search regularizations by employee or reason..."
            isDarkMode={isDarkMode}
            actionButton={
              <button
                onClick={() => setShowAddRegForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Apply Regularization</span>
              </button>
            }
          />
        )
      )}
    </div>
  );
};
