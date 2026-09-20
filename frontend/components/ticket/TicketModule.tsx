"use client";

import React, { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { fetchApi, extractList } from "@/lib/api";
import {
  LifeBuoy,
  Plus,
  CheckCircle2,
  XCircle,
  MessageSquare,
  UserCheck,
  Check,
  Tag,
  ShieldAlert,
} from "lucide-react";

// Interfaces
interface TicketItem {
  id: number;
  ticket_no: string;
  subject: string;
  message?: string;
  status: string; // open, in_progress, resolved, closed, reopened
  priority: string; // low, medium, high, urgent
  category_name?: string;
  category_id?: number;
  raiser_name?: string;
  assignee_name?: string;
  created_at: string;
}

interface TicketCategoryItem {
  id: number;
  name: string;
  code: string;
  default_priority?: string;
  response_hours?: number;
  resolution_hours?: number;
  is_active: boolean;
}

// Zod Schemas matching backend TicketRequest & TicketCategoryRequest
const ticketSchema = z.object({
  category_id: z.string().min(1, "Please select a ticket category"),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200, "Max 200 characters"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  message: z.string().min(5, "Please describe the issue in detail").max(5000, "Max 5000 characters"),
});

type TicketFormData = z.infer<typeof ticketSchema>;

const resolveSchema = z.object({
  resolution_note: z.string().min(3, "Resolution note required").max(1000, "Max 1000 characters"),
});

type ResolveFormData = z.infer<typeof resolveSchema>;

const categorySchema = z.object({
  name: z.string().min(2, "Category name required").max(120, "Max 120 characters"),
  code: z
    .string()
    .min(2, "Code required (e.g. IT_SUPPORT)")
    .max(40, "Max 40 characters")
    .regex(/^[a-z0-9_]+$/, "Code must contain lowercase letters, numbers or underscores"),
  default_priority: z.enum(["low", "medium", "high", "urgent"]),
  response_hours: z.coerce.number().min(1, "Min 1 hr").max(720, "Max 720 hrs"),
  resolution_hours: z.coerce.number().min(1, "Min 1 hr").max(2160, "Max 2160 hrs"),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface TicketModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

export const TicketModule: React.FC<TicketModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "tickets",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    if (externalTab) setActiveTab(externalTab);
  }, [externalTab]);

  // Data States
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [categories, setCategories] = useState<TicketCategoryItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Form Visibility States
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [selectedResolveTicket, setSelectedResolveTicket] = useState<TicketItem | null>(null);

  // Feedback Notification
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Mount Fetching
  useEffect(() => {
    fetchCategories();
    if (activeTab === "tickets" || activeTab === "support-tickets") fetchTickets();
    if (activeTab === "ticket-categories") fetchCategories();
  }, [activeTab]);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await fetchApi<any>("/ticket-categories");
      const list = extractList(res);
      setCategories(list);
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await fetchApi<any>("/tickets");
      const list = extractList(res);
      const formatted: TicketItem[] = list.map((item: any) => ({
        id: item.id,
        ticket_no: item.ticket_no || `TKT-${item.id}`,
        subject: item.subject || "Support Ticket",
        message: item.message || "-",
        status: item.status || "open",
        priority: item.priority || "medium",
        category_name: item.category?.name || item.category_name || "General Support",
        category_id: item.category_id,
        raiser_name: item.raiser?.name || item.raised_by_name || "Employee",
        assignee_name: item.assignee?.name || item.assigned_to_name || "Unassigned",
        created_at: item.created_at || "-",
      }));
      setTickets(formatted);
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Claim Ticket Handler
  const handleClaimTicket = async (ticketId: number) => {
    try {
      await fetchApi(`/tickets/${ticketId}/claim`, { method: "POST" });
      showNotify("Ticket claimed successfully!");
      fetchTickets();
    } catch (err: any) {
      showNotify(err.message || "Failed to claim ticket", "error");
    }
  };

  // DynamicForm Submit Handlers
  const handleCreateTicketSubmit = async (data: TicketFormData) => {
    try {
      const payload = {
        category_id: Number(data.category_id),
        subject: data.subject.trim(),
        message: data.message.trim(),
        priority: data.priority,
      };

      await fetchApi("/tickets", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Support ticket submitted successfully!");
      setShowCreateTicket(false);
      fetchTickets();
    } catch (err: any) {
      showNotify(err.message || "Failed to submit ticket", "error");
    }
  };

  const handleResolveTicketSubmit = async (data: ResolveFormData) => {
    if (!selectedResolveTicket) return;
    try {
      await fetchApi(`/tickets/${selectedResolveTicket.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution_note: data.resolution_note.trim() }),
      });

      showNotify(`Ticket #${selectedResolveTicket.ticket_no} resolved!`);
      setSelectedResolveTicket(null);
      fetchTickets();
    } catch (err: any) {
      showNotify(err.message || "Failed to resolve ticket", "error");
    }
  };

  const handleCreateCategorySubmit = async (data: CategoryFormData) => {
    try {
      const payload = {
        name: data.name.trim(),
        code: data.code.trim().toLowerCase(),
        default_priority: data.default_priority,
        response_hours: Number(data.response_hours),
        resolution_hours: Number(data.resolution_hours),
        routes: [{ route_to: "department_head", label: "Department Head Routing" }],
      };

      await fetchApi("/ticket-categories", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Support category created!");
      setShowCreateCategory(false);
      fetchCategories();
    } catch (err: any) {
      showNotify(err.message || "Failed to create category", "error");
    }
  };

  // Dynamic Options & Fields Config
  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        label: `${c.name} (${c.code.toUpperCase()})`,
        value: String(c.id),
      })),
    [categories]
  );

  const ticketFields: FieldConfig<TicketFormData>[] = [
    { name: "category_id", label: "Category", type: "select", options: categoryOptions },
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
    { name: "subject", label: "Ticket Subject", placeholder: "e.g. Laptop display flickering", colSpan: 2 },
    { name: "message", label: "Issue Description & Details", type: "textarea", rows: 4, placeholder: "Provide details...", colSpan: 2 },
  ];

  const resolveFields: FieldConfig<ResolveFormData>[] = [
    { name: "resolution_note", label: "Resolution Steps & Notes", type: "textarea", rows: 3, placeholder: "Describe how issue was resolved...", colSpan: 2 },
  ];

  const categoryFields: FieldConfig<CategoryFormData>[] = [
    { name: "name", label: "Category Name", placeholder: "e.g. IT Infrastructure" },
    { name: "code", label: "Category Code (lowercase)", placeholder: "e.g. it_infrastructure" },
    {
      name: "default_priority",
      label: "Default Priority",
      type: "select",
      options: [
        { label: "Low Priority", value: "low" },
        { label: "Medium Priority", value: "medium" },
        { label: "High Priority", value: "high" },
        { label: "Urgent Priority", value: "urgent" },
      ],
    },
    { name: "response_hours", label: "Target Response Time (Hours)", type: "number", placeholder: "4" },
    { name: "resolution_hours", label: "Target Resolution SLA (Hours)", type: "number", placeholder: "24", colSpan: 2 },
  ];

  // DataTable Column Configurations
  const ticketColumns: ColumnDef<TicketItem>[] = useMemo(
    () => [
      {
        accessorKey: "ticket_no",
        header: "Ticket ID",
        cell: (info) => (
          <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border bg-blue-500/15 text-blue-600 border-blue-500/30">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "subject",
        header: "Subject & Category",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <p className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>{row.subject}</p>
              <p className="text-[10px] text-amber-600 font-bold mt-0.5">{row.category_name}</p>
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
        accessorKey: "raiser_name",
        header: "Raised By",
        cell: (info) => (
          <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "assignee_name",
        header: "Assigned To",
        cell: (info) => (
          <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
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
                status === "resolved" || status === "closed"
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : status === "in_progress"
                  ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
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
          if (row.status === "resolved" || row.status === "closed") return null;
          return (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleClaimTicket(row.id)}
                title="Claim Ticket"
                className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/30 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedResolveTicket(row)}
                title="Resolve Ticket"
                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [isDarkMode]
  );

  const categoryColumns: ColumnDef<TicketCategoryItem>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Category Code",
        cell: (info) => (
          <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border bg-amber-500/15 text-amber-600 border-amber-500/30">
            {(info.getValue() as string).toUpperCase()}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Category Name",
        cell: (info) => (
          <span className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "default_priority",
        header: "Default Priority",
        cell: (info) => (
          <span className="font-semibold text-xs text-blue-600 uppercase">
            {(info.getValue() as string) || "medium"}
          </span>
        ),
      },
      {
        accessorKey: "response_hours",
        header: "Response SLA",
        cell: (info) => (
          <span className={`font-mono ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {(info.getValue() as number) || 4} Hours
          </span>
        ),
      },
      {
        accessorKey: "resolution_hours",
        header: "Resolution SLA",
        cell: (info) => (
          <span className={`font-mono ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {(info.getValue() as number) || 24} Hours
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
        className={`rounded-2xl p-6 border backdrop-blur-xl transition-all duration-300 ${
          isDarkMode
            ? "bg-[#0B1A30]/90 border-white/[0.08] text-white"
            : "bg-white border-slate-200 text-slate-900 shadow-sm"
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-500">
              <LifeBuoy className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">Help Desk & Support Tickets</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-500 border border-cyan-500/30">
                  Help Desk
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Raise IT/HR support tickets, manage categories, track resolution SLAs, and assign staff.
              </p>
            </div>
          </div>

          <button
            onClick={() => { setShowCreateTicket(!showCreateTicket); setShowCreateCategory(false); setSelectedResolveTicket(null); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreateTicket ? "Back to Queue" : "Raise Support Ticket"}</span>
          </button>
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
          onClick={() => { setActiveTab("tickets"); setShowCreateTicket(false); setShowCreateCategory(false); setSelectedResolveTicket(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "tickets" || activeTab === "support-tickets"
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>Support Tickets Queue</span>
        </button>
        <button
          onClick={() => { setActiveTab("ticket-categories"); setShowCreateTicket(false); setShowCreateCategory(false); setSelectedResolveTicket(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "ticket-categories"
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Ticket Categories & SLAs</span>
        </button>
      </div>

      {/* SECTION 1: SUPPORT TICKETS QUEUE */}
      {(activeTab === "tickets" || activeTab === "support-tickets") && (
        showCreateTicket ? (
          <DynamicForm
            title="Raise Support Ticket"
            description="Submit a help desk ticket to your IT or HR support team."
            schema={ticketSchema}
            fields={ticketFields}
            columns={2}
            onSubmit={handleCreateTicketSubmit}
            onCancel={() => setShowCreateTicket(false)}
            submitText="Submit Ticket"
            isDarkMode={isDarkMode}
          />
        ) : selectedResolveTicket ? (
          <DynamicForm
            title={`Resolve Ticket #${selectedResolveTicket.ticket_no}`}
            description={`Provide resolution notes for: "${selectedResolveTicket.subject}"`}
            schema={resolveSchema}
            fields={resolveFields}
            columns={2}
            onSubmit={handleResolveTicketSubmit}
            onCancel={() => setSelectedResolveTicket(null)}
            submitText="Mark Ticket Resolved"
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className="space-y-4">
            {/* Metric Summary Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tickets</p>
                <p className={`text-xl font-extrabold mt-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{tickets.length}</p>
              </div>
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Open Tickets</p>
                <p className="text-xl font-extrabold mt-1 text-amber-500">{tickets.filter((t) => t.status === "open").length}</p>
              </div>
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500">In Progress</p>
                <p className="text-xl font-extrabold mt-1 text-blue-500">{tickets.filter((t) => t.status === "in_progress").length}</p>
              </div>
              <div className={`p-4 rounded-2xl border backdrop-blur-xl ${isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Resolved</p>
                <p className="text-xl font-extrabold mt-1 text-emerald-500">{tickets.filter((t) => t.status === "resolved" || t.status === "closed").length}</p>
              </div>
            </div>

            <DataTable
              title="Support Tickets Directory"
              description="Track, assign, claim, and resolve help desk support tickets."
              columns={ticketColumns}
              data={tickets}
              isLoading={loadingTickets}
              searchPlaceholder="Search tickets by subject, ID, or category..."
              isDarkMode={isDarkMode}
              actionButton={
                <button
                  onClick={() => setShowCreateTicket(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Raise Ticket</span>
                </button>
              }
            />
          </div>
        )
      )}

      {/* SECTION 2: TICKET CATEGORIES DIRECTORY */}
      {activeTab === "ticket-categories" && (
        showCreateCategory ? (
          <DynamicForm
            title="Create Support Category"
            description="Configure category SLAs, default priority, and department routing."
            schema={categorySchema}
            fields={categoryFields}
            columns={2}
            onSubmit={handleCreateCategorySubmit}
            onCancel={() => setShowCreateCategory(false)}
            submitText="Save Category"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Support Categories & SLAs"
            description="Manage help desk categories, response targets, and resolution SLAs."
            columns={categoryColumns}
            data={categories}
            isLoading={loadingCategories}
            searchPlaceholder="Search categories by name or code..."
            isDarkMode={isDarkMode}
            actionButton={
              <button
                onClick={() => setShowCreateCategory(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            }
          />
        )
      )}
    </div>
  );
};
