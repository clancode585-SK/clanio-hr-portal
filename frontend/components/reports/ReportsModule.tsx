"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { fetchApi } from "@/lib/api";
import { dateOf } from "@/lib/format";
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Download,
  FileSpreadsheet,
  Receipt,
  Landmark,
  ScrollText,
  Wallet,
} from "lucide-react";

interface ReportItem {
  key: string;
  label: string;
  hint: string;
  param: string;
  group?: string;
  format?: string;
}

interface InvoiceItem {
  id: number;
  uuid: string;
  invoice_number: string;
  plan_name: string;
  seats: number;
  subtotal: number;
  gst_amount: number;
  total: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
  company?: { name?: string };
}

interface PlanItem {
  id: number;
  uuid?: string;
  code: string;
  name: string;
  tagline: string | null;
  price_per_seat: number;
  billing_cycle: string;
  min_seats: number;
  max_seats: number | null;
  trial_days: number;
  gst_percent: number;
}

interface Form16Row {
  uuid: string;
  employee_code: string;
  name: string;
  pan_number: string | null;
  designation: string;
}

interface ReportsModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const money = (value: unknown) => `₹${inr.format(Number(value ?? 0))}`;

const thisMonth = () => new Date().toISOString().slice(0, 7);

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "reports",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    setActiveTab(externalTab);
  }, [externalTab]);

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [returns, setReturns] = useState<ReportItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [form16Rows, setForm16Rows] = useState<Form16Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (activeTab === "reports") load("/reports", (res) => setReports(res?.data?.reports ?? []));
    if (activeTab === "statutory-returns") load("/statutory-returns", (res) => setReturns(res?.data?.returns ?? []));
    if (activeTab === "billing" || activeTab === "revenue") load("/invoices", (res) => setInvoices(res?.data ?? []));
    if (activeTab === "plans") load("/plans", (res) => setPlans(res?.data ?? []));
    if (activeTab === "form16")
      load("/employees?per_page=200", (res) =>
        setForm16Rows(
          (res?.data ?? []).map((row: any) => ({
            uuid: row.uuid,
            employee_code: row.employee_code ?? "-",
            name: row.user?.name ?? row.name ?? "-",
            pan_number: row.pan_number ?? null,
            designation: row.designation?.name ?? "-",
          }))
        )
      );
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

  /** File token ke saath laani padti hai, warna 401 aata hai */
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

  const markPaid = async (invoice: InvoiceItem) => {
    const reference = window.prompt("Payment reference (UTR or transaction id)?");

    if (reference === null) return;

    try {
      await fetchApi(`/invoices/${invoice.uuid}/mark-paid`, {
        method: "PUT",
        body: JSON.stringify(reference.trim() ? { reference: reference.trim() } : {}),
      });
      showNotify(`Invoice ${invoice.invoice_number} marked paid`);
      load("/invoices", (res) => setInvoices(res?.data ?? []));
    } catch (err: any) {
      showNotify(err.message || "Could not record the payment", "error");
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

  const statusBadge = (status: string) =>
    badge(status, status === "paid" ? "emerald" : status === "cancelled" ? "rose" : "amber");

  const downloadButton = (title: string, onClick: () => void) => (
    <button
      title={title}
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-extrabold uppercase bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-blue-500/30 transition-all cursor-pointer"
    >
      <Download className="w-3.5 h-3.5" />
      <span>Download</span>
    </button>
  );

  /** Financial year ka pehla saal — FY 2026-27 ke liye 2026 */
  const askYear = (): string | null => {
    const year = window.prompt("Financial year — first year, e.g. 2026 for FY 2026-27", String(new Date().getFullYear()));

    return year && /^\d{4}$/.test(year.trim()) ? year.trim() : null;
  };

  /** Backend month ko YYYY-MM leta hai, aur quarter ko Q1..Q4 ke saath alag year */
  const periodQuery = (param: string): string | null => {
    if (param === "quarter") {
      const quarter = window.prompt("Quarter — Q1, Q2, Q3 or Q4", "Q" + (Math.floor(new Date().getMonth() / 3) + 1));

      if (!quarter || !/^Q[1-4]$/i.test(quarter.trim())) return null;

      const year = window.prompt("Financial year, e.g. 2026", String(new Date().getFullYear()));

      if (!year || !/^\d{4}$/.test(year.trim())) return null;

      return `?quarter=${quarter.trim().toUpperCase()}&year=${year.trim()}`;
    }

    const month = window.prompt("Month, e.g. " + thisMonth(), thisMonth());

    if (!month || !/^\d{4}-\d{2}$/.test(month.trim())) return null;

    return `?${param}=${encodeURIComponent(month.trim())}`;
  };

  const reportColumns: ColumnDef<ReportItem>[] = useMemo(
    () => [
      { accessorKey: "label", header: "Report", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "group", header: "Area", cell: (i) => badge(String(i.getValue() ?? "-"), "purple") },
      { accessorKey: "hint", header: "What It Contains", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "param", header: "Period", cell: (i) => badge(String(i.getValue() ?? "month"), "cyan") },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) =>
          downloadButton("Download report", () => {
            const query = periodQuery(row.original.param);
            if (query) {
              download(`/reports/${row.original.key}/download${query}`, `${row.original.key}.csv`);
            }
          }),
      },
    ],
    []
  );

  const returnColumns: ColumnDef<ReportItem>[] = useMemo(
    () => [
      { accessorKey: "label", header: "Return", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "hint", header: "What It Is", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "param", header: "Period", cell: (i) => badge(String(i.getValue() ?? "month"), "cyan") },
      { accessorKey: "format", header: "File", cell: (i) => badge(String(i.getValue() ?? "-"), "purple") },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) =>
          downloadButton("Download return", () => {
            const query = periodQuery(row.original.param);
            if (query) {
              download(`/statutory-returns/${row.original.key}/download${query}`, `${row.original.key}.${row.original.format ?? "txt"}`);
            }
          }),
      },
    ],
    []
  );

  const invoiceColumns: ColumnDef<InvoiceItem>[] = useMemo(
    () => [
      { accessorKey: "invoice_number", header: "Invoice", cell: (i) => <span className="font-mono text-xs font-extrabold text-indigo-500">{String(i.getValue() ?? "-")}</span> },
      { id: "company", header: "Company", cell: ({ row }) => <span className="font-bold">{row.original.company?.name ?? "-"}</span> },
      { accessorKey: "plan_name", header: "Plan", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "seats", header: "Seats", cell: (i) => <span className="font-mono text-xs">{String(i.getValue() ?? 0)}</span> },
      { accessorKey: "subtotal", header: "Subtotal", cell: (i) => <span className="font-mono text-xs">{money(i.getValue())}</span> },
      { accessorKey: "gst_amount", header: "GST", cell: (i) => <span className="font-mono text-xs text-slate-400">{money(i.getValue())}</span> },
      { accessorKey: "total", header: "Total", cell: (i) => <span className="font-mono text-xs font-bold text-emerald-500">{money(i.getValue())}</span> },
      { accessorKey: "issued_at", header: "Issued", cell: (i) => <span className="text-xs text-slate-400 font-mono">{dateOf(i.getValue())}</span> },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "pending")) },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {downloadButton("Download invoice", () => download(`/invoices/${row.original.uuid}/download`, `${row.original.invoice_number}.pdf`))}
            {row.original.status !== "paid" && row.original.status !== "cancelled" && (
              <button
                title="Mark paid"
                onClick={() => markPaid(row.original)}
                className="p-1.5 rounded-lg border bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/30 transition-all cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    []
  );

  const planColumns: ColumnDef<PlanItem>[] = useMemo(
    () => [
      { accessorKey: "code", header: "Code", cell: (i) => <span className="font-mono text-xs font-extrabold text-indigo-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "name", header: "Plan", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "tagline", header: "Tagline", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "price_per_seat", header: "Per Seat", cell: (i) => <span className="font-mono text-xs font-bold">{money(i.getValue())}</span> },
      { accessorKey: "billing_cycle", header: "Billing", cell: (i) => badge(String(i.getValue() ?? "monthly"), "cyan") },
      {
        id: "seats",
        header: "Seat Band",
        cell: ({ row }) => (
          <span className="text-xs text-slate-400">
            {row.original.min_seats ?? 1} to {row.original.max_seats ?? "-"}
          </span>
        ),
      },
      { accessorKey: "trial_days", header: "Trial", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? 0)} days</span> },
      { accessorKey: "gst_percent", header: "GST", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? 0)}%</span> },
    ],
    []
  );

  const form16Columns: ColumnDef<Form16Row>[] = useMemo(
    () => [
      { accessorKey: "employee_code", header: "Code", cell: (i) => <span className="font-mono text-xs font-extrabold text-purple-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "name", header: "Employee", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "designation", header: "Designation", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      {
        accessorKey: "pan_number",
        header: "PAN",
        cell: (i) =>
          i.getValue() ? (
            <span className="font-mono text-xs text-cyan-500">{String(i.getValue())}</span>
          ) : (
            badge("PAN missing", "rose")
          ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) =>
          downloadButton("Download Form 16 Part B", () => {
            const year = askYear();
            if (year) {
              download(
                `/employees/${row.original.uuid}/form16/download?year=${year}`,
                `Form16-${row.original.employee_code}.pdf`
              );
            }
          }),
      },
    ],
    []
  );

  const tabs: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "reports", label: "Reports", icon: FileSpreadsheet },
    { id: "statutory-returns", label: "Statutory Returns", icon: ScrollText },
    { id: "form16", label: "Form 16", icon: FileSpreadsheet },
    { id: "billing", label: "Invoices", icon: Receipt },
    { id: "plans", label: "Plans", icon: Landmark },
  ];

  const isInvoices = activeTab === "billing" || activeTab === "revenue";

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
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-500">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight">Reports, Returns & Billing</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30">
                Reports
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Download registers and statutory files, and keep track of what the workspace has been billed.
            </p>
          </div>
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
          const on = tab.id === "billing" ? isInvoices : activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                on
                  ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
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

      {activeTab === "reports" && (
        <DataTable
          title="Registers & Statements"
          description="Pick a period and the file is generated on the spot."
          columns={reportColumns}
          data={reports}
          isLoading={loading}
          searchPlaceholder="Filter reports..."
          isDarkMode={isDarkMode}
        />
      )}

      {activeTab === "statutory-returns" && (
        <DataTable
          title="Statutory Returns"
          description="PF, ESI and TDS files in the format each portal expects."
          columns={returnColumns}
          data={returns}
          isLoading={loading}
          searchPlaceholder="Filter returns..."
          isDarkMode={isDarkMode}
        />
      )}

      {isInvoices && (
        <DataTable
          title="Invoices"
          description="What has been billed, and what is still outstanding."
          columns={invoiceColumns}
          data={invoices}
          isLoading={loading}
          searchPlaceholder="Filter by invoice number..."
          isDarkMode={isDarkMode}
        />
      )}

      {activeTab === "form16" && (
        <DataTable
          title="Form 16 Part B"
          description="Per employee, or everyone in one PDF. PAN is needed on the record before a Form 16 can be issued."
          columns={form16Columns}
          data={form16Rows}
          isLoading={loading}
          searchPlaceholder="Filter by employee..."
          isDarkMode={isDarkMode}
          actionButton={
            <button
              onClick={() => {
                const year = askYear();
                if (year) download(`/form16/bulk?year=${year}`, `Form16-all-${year}.pdf`);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download All</span>
            </button>
          }
        />
      )}

      {activeTab === "plans" && (
        <DataTable
          title="Subscription Plans"
          description="Pricing, seat bands and trial length companies can sign up on."
          columns={planColumns}
          data={plans}
          isLoading={loading}
          searchPlaceholder="Filter plans..."
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default ReportsModule;
