"use client";

import React, { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { fetchApi, extractList } from "@/lib/api";
import { dateOf } from "@/lib/format";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";

interface OpeningItem {
  id: number;
  uuid: string;
  slug: string;
  title: string;
  location: string;
  work_mode: string;
  employment_type: string;
  experience_label: string;
  positions: number;
  open_count: number;
  application_count: number;
  closes_on: string | null;
  status: string;
  department?: { name?: string } | string | null;
}

interface InterviewItem {
  id: number;
  uuid: string;
  round_no: number;
  title: string;
  mode: string;
  interviewer: string;
  scheduled_at_local: string;
  duration_minutes: number;
  verdict: string | null;
  status: string;
  is_open: boolean;
  application?: { candidate?: { name?: string }; opening?: { title?: string } };
}

interface JoiningItem {
  uuid: string;
  bucket: string;
  candidate_name: string;
  candidate_email: string;
  opening_title: string;
  joining_date: string | null;
  status: string;
}

const openingSchema = z.object({
  title: z.string().min(3, "Role title is required").max(200, "Max 200 characters"),
  location: z.string().min(2, "Location is required").max(150, "Max 150 characters"),
  department: z.string().optional().or(z.literal("")),
  work_mode: z.string().optional().or(z.literal("")),
  employment_type: z.string().optional().or(z.literal("")),
  positions: z.string().optional().or(z.literal("")),
  experience_min: z.string().optional().or(z.literal("")),
  closes_on: z.string().optional().or(z.literal("")),
  summary: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
  requirements: z.string().max(8000, "Max 8000 characters").optional().or(z.literal("")),
});

type OpeningFormData = z.infer<typeof openingSchema>;

interface RecruitmentModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

export const RecruitmentModule: React.FC<RecruitmentModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "openings",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    setActiveTab(externalTab);
  }, [externalTab]);

  const [openings, setOpenings] = useState<OpeningItem[]>([]);
  const [loadingOpenings, setLoadingOpenings] = useState(false);
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [joinings, setJoinings] = useState<JoiningItem[]>([]);
  const [loadingJoinings, setLoadingJoinings] = useState(false);
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);

  const [showAddOpening, setShowAddOpening] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (activeTab === "openings") { fetchOpenings(); fetchDepartments(); }
    if (activeTab === "interviews") fetchInterviews();
    if (activeTab === "joinings") fetchJoinings();
  }, [activeTab]);

  const fetchDepartments = async () => {
    try {
      const res = await fetchApi<any>("/departments");
      setDepartments(extractList(res).map((d: any) => ({ label: d.name, value: String(d.id) })));
    } catch {
      setDepartments([]);
    }
  };

  const fetchOpenings = async () => {
    setLoadingOpenings(true);
    try {
      const res = await fetchApi<any>("/openings");
      setOpenings(extractList(res));
    } catch (err: any) {
      showNotify(err.message || "Could not load openings", "error");
      setOpenings([]);
    } finally {
      setLoadingOpenings(false);
    }
  };

  const fetchInterviews = async () => {
    setLoadingInterviews(true);
    try {
      const res = await fetchApi<any>("/interviews");
      setInterviews(extractList(res));
    } catch (err: any) {
      showNotify(err.message || "Could not load interviews", "error");
      setInterviews([]);
    } finally {
      setLoadingInterviews(false);
    }
  };

  const fetchJoinings = async () => {
    setLoadingJoinings(true);
    try {
      // Pipeline teen bucket me aati hai — ek list bana lete hain
      const res = await fetchApi<any>("/joinings");
      const data = res?.data ?? {};
      const flatten = (rows: any[], bucket: string) =>
        (rows ?? []).map((row: any) => ({
          uuid: row.uuid ?? String(row.id ?? ""),
          bucket,
          candidate_name: row.candidate?.name ?? row.candidate_name ?? "-",
          candidate_email: row.candidate?.email ?? "-",
          opening_title: row.opening?.title ?? row.opening_title ?? "-",
          joining_date: row.joining_date ?? row.expected_joining_date ?? null,
          status: row.status ?? "accepted",
        }));

      setJoinings([
        ...flatten(data.overdue, "Overdue"),
        ...flatten(data.this_week, "This week"),
        ...flatten(data.later, "Later"),
      ]);
    } catch (err: any) {
      showNotify(err.message || "Could not load the joining pipeline", "error");
      setJoinings([]);
    } finally {
      setLoadingJoinings(false);
    }
  };

  const act = async (path: string, body: Record<string, unknown>, okText: string, reload: () => void) => {
    try {
      await fetchApi(path, { method: "PUT", body: JSON.stringify(body) });
      showNotify(okText);
      reload();
    } catch (err: any) {
      showNotify(err.message || "That action could not be completed", "error");
    }
  };

  const addOpening = async (data: OpeningFormData) => {
    try {
      await fetchApi("/openings", {
        method: "POST",
        body: JSON.stringify({
          title: data.title.trim(),
          location: data.location.trim(),
          ...(data.department ? { department_id: Number(data.department) } : {}),
          ...(data.work_mode ? { work_mode: data.work_mode } : {}),
          ...(data.employment_type ? { employment_type: data.employment_type } : {}),
          ...(data.positions ? { positions: Number(data.positions) } : {}),
          ...(data.experience_min ? { experience_min: Number(data.experience_min) } : {}),
          ...(data.closes_on ? { closes_on: data.closes_on } : {}),
          summary: data.summary?.trim() || null,
          requirements: data.requirements?.trim() || null,
        }),
      });
      showNotify("Opening created");
      setShowAddOpening(false);
      fetchOpenings();
    } catch (err: any) {
      showNotify(err.message || "Could not create the opening", "error");
    }
  };

  const openingFields: FieldConfig<OpeningFormData>[] = [
    { name: "title", label: "Role Title", placeholder: "e.g. Senior Backend Engineer" },
    { name: "location", label: "Location", placeholder: "e.g. New Delhi" },
    { name: "department", label: "Department (Optional)", type: "select", options: departments },
    {
      name: "work_mode",
      label: "Work Mode",
      type: "select",
      options: [
        { label: "On site", value: "onsite" },
        { label: "Hybrid", value: "hybrid" },
        { label: "Remote", value: "remote" },
      ],
    },
    {
      name: "employment_type",
      label: "Employment Type",
      type: "select",
      options: [
        { label: "Full time", value: "full_time" },
        { label: "Part time", value: "part_time" },
        { label: "Intern", value: "intern" },
        { label: "Contract", value: "contract" },
        { label: "Consultant", value: "consultant" },
      ],
    },
    { name: "positions", label: "Positions", type: "number", placeholder: "e.g. 2" },
    { name: "experience_min", label: "Minimum Experience (Years)", type: "number", placeholder: "e.g. 3" },
    { name: "closes_on", label: "Closes On (Optional)", type: "date" },
    { name: "summary", label: "Summary (Optional)", type: "textarea", colSpan: 2 },
    { name: "requirements", label: "Requirements (Optional)", type: "textarea", colSpan: 2, rows: 5 },
  ];

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
    const done = ["open", "selected", "joined", "accepted", "completed"];
    const busy = ["draft", "requested", "scheduled", "on_hold", "pending"];
    const bad = ["declined", "closed", "rejected", "cancelled"];

    return badge(status, done.includes(status) ? "emerald" : busy.includes(status) ? "amber" : bad.includes(status) ? "rose" : "blue");
  };

  const iconButton = (
    key: string,
    title: string,
    tone: "emerald" | "rose",
    Icon: React.ComponentType<{ className?: string }>,
    onClick: () => void
  ) => {
    const tones: Record<string, string> = {
      emerald: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
      rose: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/30",
    };

    return (
      <button key={key} title={title} onClick={onClick} className={`p-1.5 rounded-lg border transition-all cursor-pointer ${tones[tone]}`}>
        <Icon className="w-3.5 h-3.5" />
      </button>
    );
  };

  const openingColumns: ColumnDef<OpeningItem>[] = useMemo(
    () => [
      { accessorKey: "title", header: "Opening", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      {
        id: "department",
        header: "Department",
        cell: ({ row }) => {
          const dept = row.original.department;
          const name = typeof dept === "string" ? dept : dept?.name;

          return <span className="text-xs text-slate-400">{name || "-"}</span>;
        },
      },
      { accessorKey: "location", header: "Location", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "work_mode", header: "Work Mode", cell: (i) => badge(String(i.getValue() ?? "-"), "cyan") },
      { accessorKey: "employment_type", header: "Type", cell: (i) => badge(String(i.getValue() ?? "-"), "purple") },
      { accessorKey: "experience_label", header: "Experience", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "positions", header: "Positions", cell: (i) => <span className="font-mono text-xs">{String(i.getValue() ?? 0)}</span> },
      { accessorKey: "application_count", header: "Applications", cell: (i) => badge(String(i.getValue() ?? 0), "blue") },
      { accessorKey: "closes_on", header: "Closes", cell: (i) => <span className="text-xs text-slate-400 font-mono">{dateOf(i.getValue())}</span> },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "draft")) },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const opening = row.original;

          if (opening.status !== "requested") return <span className="text-[10px] text-slate-500 font-semibold">-</span>;

          return (
            <div className="flex items-center gap-1.5">
              {iconButton("approve", "Approve opening", "emerald", CheckCircle2, () =>
                act(`/openings/${opening.uuid}/decide`, { decision: "approved" }, "Opening approved", fetchOpenings)
              )}
              {iconButton("decline", "Decline request", "rose", XCircle, () => {
                const reason = window.prompt("Why is this request being declined?");
                if (reason && reason.trim().length > 2) {
                  act(`/openings/${opening.uuid}/decide`, { decision: "declined", decline_reason: reason.trim() }, "Request declined", fetchOpenings);
                }
              })}
            </div>
          );
        },
      },
    ],
    []
  );

  const interviewColumns: ColumnDef<InterviewItem>[] = useMemo(
    () => [
      {
        id: "candidate",
        header: "Candidate",
        cell: ({ row }) => <span className="font-bold">{row.original.application?.candidate?.name ?? "-"}</span>,
      },
      {
        id: "opening",
        header: "Opening",
        cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.application?.opening?.title ?? "-"}</span>,
      },
      { accessorKey: "round_no", header: "Round", cell: (i) => badge("R" + String(i.getValue() ?? 1), "purple") },
      { accessorKey: "title", header: "Stage", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "mode", header: "Mode", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "interviewer", header: "Interviewer", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "scheduled_at_local", header: "When", cell: (i) => <span className="text-xs text-slate-400 font-mono">{dateOf(i.getValue())}</span> },
      { accessorKey: "duration_minutes", header: "Duration", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? 0)} min</span> },
      { accessorKey: "verdict", header: "Verdict", cell: (i) => (i.getValue() ? statusBadge(String(i.getValue())) : <span className="text-xs text-slate-500">-</span>) },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "scheduled")) },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const interview = row.original;

          if (!interview.is_open) return <span className="text-[10px] text-slate-500 font-semibold">-</span>;

          return (
            <div className="flex items-center gap-1.5">
              {iconButton("select", "Mark selected", "emerald", CheckCircle2, () =>
                act(`/interviews/${interview.uuid}/feedback`, { verdict: "selected" }, "Verdict recorded", fetchInterviews)
              )}
              {iconButton("reject", "Mark rejected", "rose", XCircle, () =>
                act(`/interviews/${interview.uuid}/feedback`, { verdict: "rejected" }, "Verdict recorded", fetchInterviews)
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  const joiningColumns: ColumnDef<JoiningItem>[] = useMemo(
    () => [
      { accessorKey: "candidate_name", header: "Candidate", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "candidate_email", header: "Email", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "opening_title", header: "Opening", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "joining_date", header: "Joining On", cell: (i) => <span className="text-xs text-slate-400 font-mono">{dateOf(i.getValue())}</span> },
      {
        accessorKey: "bucket",
        header: "Window",
        cell: (i) => badge(String(i.getValue() ?? "-"), String(i.getValue()) === "Overdue" ? "rose" : "amber"),
      },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "accepted")) },
    ],
    []
  );

  const tabs: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "openings", label: "Openings", icon: Briefcase },
    { id: "interviews", label: "Interviews", icon: Users },
    { id: "joinings", label: "Joining Soon", icon: CalendarClock },
  ];

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
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 text-indigo-500">
              <UserPlus className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">Recruitment & Hiring</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-500 border border-indigo-500/30">
                  Hiring
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Post openings, approve hiring requests, track interview rounds and who is joining soon.
              </p>
            </div>
          </div>

          {activeTab === "openings" && (
            <button
              onClick={() => setShowAddOpening(!showAddOpening)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddOpening ? "Back to Openings" : "Post Opening"}</span>
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
              onClick={() => { setActiveTab(tab.id); setShowAddOpening(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
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

      {/* SECTION 1: OPENINGS */}
      {activeTab === "openings" && (
        showAddOpening ? (
          <DynamicForm
            title="Post Opening"
            description="Openings go live on the career page once they are approved."
            schema={openingSchema}
            fields={openingFields}
            columns={2}
            onSubmit={addOpening}
            onCancel={() => setShowAddOpening(false)}
            submitText="Post Opening"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Job Openings"
            description="Roles being hired for, their pipeline and how many seats are still open."
            columns={openingColumns}
            data={openings}
            isLoading={loadingOpenings}
            searchPlaceholder="Filter by title or location..."
            isDarkMode={isDarkMode}
          />
        )
      )}

      {/* SECTION 2: INTERVIEWS */}
      {activeTab === "interviews" && (
        <DataTable
          title="Interview Rounds"
          description="Scheduled rounds, who is taking them and the verdict so far."
          columns={interviewColumns}
          data={interviews}
          isLoading={loadingInterviews}
          searchPlaceholder="Filter by candidate or interviewer..."
          isDarkMode={isDarkMode}
        />
      )}

      {/* SECTION 3: JOINING SOON */}
      {activeTab === "joinings" && (
        <DataTable
          title="Joining Pipeline"
          description="Accepted offers with a joining date, overdue ones first."
          columns={joiningColumns}
          data={joinings}
          isLoading={loadingJoinings}
          searchPlaceholder="Filter by candidate..."
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default RecruitmentModule;
