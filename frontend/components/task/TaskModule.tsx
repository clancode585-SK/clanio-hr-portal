"use client";

import React, { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { fetchApi, extractList } from "@/lib/api";
import {
  CheckSquare,
  Plus,
  CheckCircle2,
  XCircle,
  Sun,
  Moon,
  FileText,
} from "lucide-react";

// Interfaces
interface TaskItem {
  id: number;
  title: string;
  description?: string;
  status: string; // todo, in_progress, review, completed, blocked
  priority: string; // low, medium, high, urgent
  due_date?: string;
  assignee_name?: string;
  assignee_id?: number;
  creator_name?: string;
  created_at: string;
}

interface DailyReportItem {
  id: number;
  employee_name: string;
  employee_id: number;
  report_date: string;
  sod_tasks?: string;
  eod_tasks?: string;
  blockers?: string;
  worked_hours?: number;
  status: string;
}

// Zod Schemas matching backend FormRequests (TaskRequest, DailyReportSodRequest, DailyReportEodRequest)
const taskSchema = z.object({
  title: z.string().min(3, "Task title must be at least 3 characters").max(200, "Max 200 characters"),
  description: z.string().max(5000, "Max 5000 characters").optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: z.string().optional().or(z.literal("")),
});

type TaskFormData = z.infer<typeof taskSchema>;

const sodSchema = z.object({
  sod_plan: z.string().min(5, "Please list at least 5 characters for SOD plan").max(5000, "Max 5000 characters"),
});

type SodFormData = z.infer<typeof sodSchema>;

const eodSchema = z.object({
  eod_summary: z.string().min(5, "Please list completed work for EOD summary").max(5000, "Max 5000 characters"),
  eod_tomorrow_plan: z.string().max(2000, "Max 2000 characters").optional().or(z.literal("")),
  eod_blockers: z.string().max(2000, "Max 2000 characters").optional().or(z.literal("")),
  worked_hours: z.coerce.number().min(0, "Min 0 hrs").max(24, "Max 24 hrs"),
});

type EodFormData = z.infer<typeof eodSchema>;

interface TaskModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

export const TaskModule: React.FC<TaskModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "task-board",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    if (externalTab) setActiveTab(externalTab);
  }, [externalTab]);

  // Data States
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [reports, setReports] = useState<DailyReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Form Visibility States
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showSodForm, setShowSodForm] = useState(false);
  const [showEodForm, setShowEodForm] = useState(false);

  // Feedback Notification
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Mount Fetching
  useEffect(() => {
    if (activeTab === "task-board" || activeTab === "tasks") fetchTasks();
    if (activeTab === "daily-reports" || activeTab === "sod-eod") fetchDailyReports();
  }, [activeTab]);

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetchApi<any>("/tasks");
      const list = extractList(res);
      const formatted: TaskItem[] = list.map((item: any) => ({
        id: item.id,
        title: item.title || item.name || "Task",
        description: item.description || "-",
        status: item.status || "todo",
        priority: item.priority || "medium",
        due_date: item.due_date || item.deadline || "-",
        assignee_name: item.assignee?.name || item.assigned_to_name || "Unassigned",
        creator_name: item.creator?.name || "Manager",
        created_at: item.created_at || "-",
      }));
      setTasks(formatted);
    } catch {
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchDailyReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetchApi<any>("/daily-reports");
      const list = extractList(res);
      const formatted: DailyReportItem[] = list.map((item: any) => ({
        id: item.id,
        employee_name: item.employee_name || item.employee?.user?.name || "Employee",
        employee_id: item.employee_id,
        report_date: item.report_date || item.created_at?.split("T")[0] || "-",
        sod_tasks: item.sod?.plan || item.sod_plan || "-",
        eod_tasks: item.eod?.summary || item.eod_summary || "-",
        blockers: item.eod?.blockers || item.eod_blockers || "-",
        worked_hours: item.eod?.worked_hours ?? item.worked_hours ?? undefined,
        status: item.status || (item.eod?.summary ? "completed" : "sod_submitted"),
      }));
      setReports(formatted);
    } catch {
      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  // Status Change Handler
  const handleTaskStatusChange = async (taskId: number, newStatus: string) => {
    try {
      await fetchApi(`/tasks/${taskId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      showNotify(`Task status updated to ${newStatus}!`);
      fetchTasks();
    } catch (err: any) {
      showNotify(err.message || "Failed to update task status", "error");
    }
  };

  // DynamicForm Submit Handlers
  const handleCreateTaskSubmit = async (data: TaskFormData) => {
    try {
      const payload = {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        priority: data.priority,
        due_date: data.due_date || null,
      };

      await fetchApi("/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Task created successfully!");
      setShowCreateTask(false);
      fetchTasks();
    } catch (err: any) {
      showNotify(err.message || "Failed to create task", "error");
    }
  };

  const handleSodSubmit = async (data: SodFormData) => {
    try {
      const payload = {
        sod_plan: data.sod_plan.trim(),
      };

      await fetchApi("/daily-reports/sod", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Start of Day (SOD) report submitted!");
      setShowSodForm(false);
      fetchDailyReports();
    } catch (err: any) {
      showNotify(err.message || "Failed to submit SOD", "error");
    }
  };

  const handleEodSubmit = async (data: EodFormData) => {
    try {
      const payload = {
        eod_summary: data.eod_summary.trim(),
        eod_tomorrow_plan: data.eod_tomorrow_plan?.trim() || null,
        eod_blockers: data.eod_blockers?.trim() || null,
        worked_hours: Number(data.worked_hours),
      };

      await fetchApi("/daily-reports/eod", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("End of Day (EOD) report submitted!");
      setShowEodForm(false);
      fetchDailyReports();
    } catch (err: any) {
      showNotify(err.message || "Failed to submit EOD", "error");
    }
  };

  // DynamicForm Fields Configs
  const taskFields: FieldConfig<TaskFormData>[] = [
    { name: "title", label: "Task Title", placeholder: "e.g. Implement API rate limiter" },
    {
      name: "priority",
      label: "Priority Level",
      type: "select",
      options: [
        { label: "Low Priority", value: "low" },
        { label: "Medium Priority", value: "medium" },
        { label: "High Priority", value: "high" },
        { label: "Urgent Priority", value: "urgent" },
      ],
    },
    { name: "due_date", label: "Due Date (Optional)", type: "date" },
    { name: "description", label: "Task Description & Specs", type: "textarea", rows: 3, placeholder: "Provide specifications...", colSpan: 2 },
  ];

  const sodFields: FieldConfig<SodFormData>[] = [
    { name: "sod_plan", label: "Start of Day Plan (SOD)", type: "textarea", rows: 4, placeholder: "1. Complete user auth\n2. Refactor dashboard...", colSpan: 2 },
  ];

  const eodFields: FieldConfig<EodFormData>[] = [
    { name: "worked_hours", label: "Actual Worked Hours", type: "number", placeholder: "8" },
    { name: "eod_summary", label: "Completed Work Today (EOD)", type: "textarea", rows: 3, placeholder: "List completed work items...", colSpan: 2 },
    { name: "eod_tomorrow_plan", label: "Plan for Tomorrow (Optional)", type: "textarea", rows: 2, placeholder: "Planned items for next shift...", colSpan: 2 },
    { name: "eod_blockers", label: "Blockers or Bottlenecks (Optional)", type: "textarea", rows: 2, placeholder: "Dependencies or technical blockers...", colSpan: 2 },
  ];

  // DataTable Column Configurations
  const taskColumns: ColumnDef<TaskItem>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: "Task Title & Specs",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <p className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>{row.title}</p>
              <p className={`text-[11px] truncate max-w-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {row.description}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: (info) => {
          const priority = info.getValue() as string;
          return (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                priority === "urgent"
                  ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                  : priority === "high"
                  ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                  : priority === "medium"
                  ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
                  : "bg-slate-500/15 text-slate-600 border-slate-500/30"
              }`}
            >
              {priority}
            </span>
          );
        },
      },
      {
        accessorKey: "assignee_name",
        header: "Assignee",
        cell: (info) => (
          <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "due_date",
        header: "Due Date",
        cell: (info) => (
          <span className={`font-mono text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => {
          const row = info.row.original;
          return (
            <select
              value={row.status}
              onChange={(e) => handleTaskStatusChange(row.id, e.target.value)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase border outline-hidden cursor-pointer ${
                row.status === "completed"
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : row.status === "in_progress"
                  ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
                  : row.status === "blocked"
                  ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                  : "bg-slate-500/15 text-slate-600 border-slate-500/30"
              }`}
            >
              <option value="todo" className="bg-slate-900 text-white">To-Do</option>
              <option value="in_progress" className="bg-slate-900 text-white">In Progress</option>
              <option value="review" className="bg-slate-900 text-white">In Review</option>
              <option value="completed" className="bg-slate-900 text-white">Completed</option>
              <option value="blocked" className="bg-slate-900 text-white">Blocked</option>
            </select>
          );
        },
      },
    ],
    [isDarkMode]
  );

  const reportColumns: ColumnDef<DailyReportItem>[] = useMemo(
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
        accessorKey: "report_date",
        header: "Date",
        cell: (info) => (
          <span className={`font-mono ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "sod_tasks",
        header: "SOD Plan",
        cell: (info) => (
          <span className={`truncate max-w-xs block ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "eod_tasks",
        header: "EOD Summary",
        cell: (info) => (
          <span className="truncate max-w-xs block text-emerald-600 font-medium">
            {(info.getValue() as string) || "Pending EOD"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Report Status",
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                status === "completed"
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-600 border-amber-500/30"
              }`}
            >
              {status === "completed" ? "SOD + EOD Submitted" : "SOD Submitted"}
            </span>
          );
        },
      },
    ],
    [isDarkMode]
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div
        className={`rounded-2xl p-6 border backdrop-blur-xl transition-all duration-300 ${
          isDarkMode
            ? "bg-[#0B1A30]/90 border-white/[0.08] text-white"
            : "bg-white border-slate-200 text-slate-900 shadow-sm"
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-500">
              <CheckSquare className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">Task Board & Daily SOD/EOD Reports</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-500 border border-indigo-500/30">
                  Work Terminal
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Manage task assignments, track progress, and submit daily SOD/EOD status reports.
              </p>
            </div>
          </div>

          {/* Quick SOD / EOD Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSodForm(!showSodForm); setShowEodForm(false); setShowCreateTask(false); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Sun className="w-4 h-4" />
              <span>Submit SOD</span>
            </button>
            <button
              onClick={() => { setShowEodForm(!showEodForm); setShowSodForm(false); setShowCreateTask(false); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Moon className="w-4 h-4" />
              <span>Submit EOD</span>
            </button>
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
          onClick={() => { setActiveTab("task-board"); setShowCreateTask(false); setShowSodForm(false); setShowEodForm(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "task-board" || activeTab === "tasks"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Task Board</span>
        </button>
        <button
          onClick={() => { setActiveTab("daily-reports"); setShowCreateTask(false); setShowSodForm(false); setShowEodForm(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "daily-reports" || activeTab === "sod-eod"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Daily SOD/EOD Reports</span>
        </button>
      </div>

      {/* SECTION 1: TASK BOARD & DIRECTORY */}
      {(activeTab === "task-board" || activeTab === "tasks") && (
        showCreateTask ? (
          <DynamicForm
            title="Create New Task"
            description="Assign tasks to team members with due dates and priority."
            schema={taskSchema}
            fields={taskFields}
            columns={2}
            onSubmit={handleCreateTaskSubmit}
            onCancel={() => setShowCreateTask(false)}
            submitText="Save Task"
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className="space-y-4">
            {/* Task Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tasks</p>
                <p className={`text-xl font-extrabold mt-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{tasks.length}</p>
              </div>
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500">In Progress</p>
                <p className="text-xl font-extrabold mt-1 text-blue-500">{tasks.filter((t) => t.status === "in_progress").length}</p>
              </div>
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Completed</p>
                <p className="text-xl font-extrabold mt-1 text-emerald-500">{tasks.filter((t) => t.status === "completed").length}</p>
              </div>
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Blocked / Urgent</p>
                <p className="text-xl font-extrabold mt-1 text-rose-500">{tasks.filter((t) => t.status === "blocked" || t.priority === "urgent").length}</p>
              </div>
            </div>

            <DataTable
              title="Task Management Directory"
              description="Track work tasks, update execution status, and assign priorities."
              columns={taskColumns}
              data={tasks}
              isLoading={loadingTasks}
              searchPlaceholder="Search tasks by title, specs or assignee..."
              isDarkMode={isDarkMode}
              actionButton={
                <button
                  onClick={() => setShowCreateTask(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Task</span>
                </button>
              }
            />
          </div>
        )
      )}

      {/* SECTION 2: DAILY SOD / EOD REPORTS STREAM */}
      {(activeTab === "daily-reports" || activeTab === "sod-eod") && (
        showSodForm ? (
          <DynamicForm
            title="Start of Day (SOD) Report"
            description="Submit your planned tasks and estimated hours for today."
            schema={sodSchema}
            fields={sodFields}
            columns={2}
            onSubmit={handleSodSubmit}
            onCancel={() => setShowSodForm(false)}
            submitText="Submit SOD Report"
            isDarkMode={isDarkMode}
          />
        ) : showEodForm ? (
          <DynamicForm
            title="End of Day (EOD) Report"
            description="Submit your completed tasks, actual hours, and blockers."
            schema={eodSchema}
            fields={eodFields}
            columns={2}
            onSubmit={handleEodSubmit}
            onCancel={() => setShowEodForm(false)}
            submitText="Submit EOD Report"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Team Daily SOD/EOD Reports Directory"
            description="Start of Day (SOD) plans and End of Day (EOD) work summaries."
            columns={reportColumns}
            data={reports}
            isLoading={loadingReports}
            searchPlaceholder="Search daily reports by employee or plan..."
            isDarkMode={isDarkMode}
            actionButton={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSodForm(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Submit SOD</span>
                </button>
                <button
                  onClick={() => setShowEodForm(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Submit EOD</span>
                </button>
              </div>
            }
          />
        )
      )}
    </div>
  );
};
