"use client";

import React, { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { fetchApi, extractList } from "@/lib/api";
import { dateOf } from "@/lib/format";
import {
  Wallet,
  Calculator,
  CheckCircle2,
  XCircle,
  Plus,
  Landmark,
  Coins,
  Receipt,
  UserMinus,
  Lock,
  Unlock,
  Play,
  Download,
} from "lucide-react";

interface PayrollRunItem {
  id: number;
  uuid: string;
  month: string;
  month_label: string;
  pay_date: string;
  status: string;
  status_label: string;
  headcount: number;
  total_earnings: number;
  total_deductions: number;
  total_net: number;
  paid_count: number;
  pending_count: number;
  is_editable: boolean;
  is_payable: boolean;
}

interface SettlementItem {
  id: number;
  uuid: string;
  employee_code: string;
  employee_name: string;
  last_working_date: string;
  service_years: number;
  paid_days: number;
  working_days: number;
  total_earnings: number;
  total_deductions: number;
  net_payable: number;
  status: string;
  status_label: string;
  payment_status: string;
}

interface AdvanceItem {
  uuid: string;
  reference: string;
  employee_code: string;
  employee_name: string;
  amount: number;
  emi_amount: number;
  tenure_months: number;
  recovered: number;
  outstanding: number;
  instalments_left: number;
  reason: string;
  status: string;
  status_label: string;
  hold_reason: string | null;
  can?: { decide?: boolean; transfer?: boolean; edit_plan?: boolean; cancel?: boolean };
}

interface ComponentItem {
  id: number;
  uuid: string;
  code: string;
  name: string;
  kind: string;
  kind_label: string;
  calculation: string;
  default_value: number;
  is_taxable: boolean;
  is_statutory: boolean;
  sequence: number;
  status: string;
}

interface BankAccountItem {
  id: number;
  uuid: string;
  label: string;
  account_holder_name: string;
  bank_name: string;
  account_masked: string;
  ifsc_code: string;
  balance: number;
  is_primary: boolean;
  status: string;
}

const runSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use the YYYY-MM format, e.g. 2026-09"),
  pay_date: z.string().optional().or(z.literal("")),
  note: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
});

const componentSchema = z.object({
  name: z.string().min(2, "Component name is required").max(100, "Max 100 characters"),
  code: z
    .string()
    .min(2, "Component code is required")
    .max(30, "Max 30 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dash and underscore only"),
  kind: z.string().min(1, "Please choose a kind"),
  calculation: z.string().min(1, "Please choose how it is worked out"),
  default_value: z.string().optional().or(z.literal("")),
  sequence: z.string().optional().or(z.literal("")),
  note: z.string().max(255, "Max 255 characters").optional().or(z.literal("")),
});

const bankSchema = z.object({
  label: z.string().min(2, "Give the account a name").max(100, "Max 100 characters"),
  account_holder_name: z.string().min(2, "Account holder name is required").max(150, "Max 150 characters"),
  bank_name: z.string().min(2, "Bank name is required").max(150, "Max 150 characters"),
  account_number: z.string().min(6, "Account number is required").max(30, "Max 30 characters"),
  ifsc_code: z.string().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, "An IFSC looks like HDFC0000123"),
  branch_name: z.string().max(150, "Max 150 characters").optional().or(z.literal("")),
});

type RunFormData = z.infer<typeof runSchema>;
type ComponentFormData = z.infer<typeof componentSchema>;
type BankFormData = z.infer<typeof bankSchema>;

interface PayrollModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const money = (value: unknown) => `₹${inr.format(Number(value ?? 0))}`;

export const PayrollModule: React.FC<PayrollModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "payroll",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    setActiveTab(externalTab);
  }, [externalTab]);

  const [runs, setRuns] = useState<PayrollRunItem[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  const [advances, setAdvances] = useState<AdvanceItem[]>([]);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [accounts, setAccounts] = useState<BankAccountItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [showOpenRun, setShowOpenRun] = useState(false);
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);

  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const closeForms = () => {
    setShowOpenRun(false);
    setShowAddComponent(false);
    setShowAddAccount(false);
  };

  useEffect(() => {
    if (activeTab === "payroll" || activeTab === "payroll-runs") fetchRuns();
    if (activeTab === "fnf") fetchSettlements();
    if (activeTab === "advances") fetchAdvances();
    if (activeTab === "salary-components") fetchComponents();
    if (activeTab === "company-bank") fetchAccounts();
  }, [activeTab]);

  const fetchRuns = async () => {
    setLoadingRuns(true);
    try {
      const res = await fetchApi<any>("/payroll-runs");
      setRuns(extractList(res));
    } catch (err: any) {
      showNotify(err.message || "Could not load payroll runs", "error");
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  };

  const fetchSettlements = async () => {
    setLoadingSettlements(true);
    try {
      const res = await fetchApi<any>("/fnf-settlements");
      setSettlements(extractList(res));
    } catch (err: any) {
      showNotify(err.message || "Could not load settlements", "error");
      setSettlements([]);
    } finally {
      setLoadingSettlements(false);
    }
  };

  const fetchAdvances = async () => {
    setLoadingAdvances(true);
    try {
      const res = await fetchApi<any>("/advances");
      setAdvances(extractList(res));
    } catch (err: any) {
      showNotify(err.message || "Could not load advances", "error");
      setAdvances([]);
    } finally {
      setLoadingAdvances(false);
    }
  };

  const fetchComponents = async () => {
    setLoadingComponents(true);
    try {
      const res = await fetchApi<any>("/salary-components");
      setComponents(extractList(res));
    } catch (err: any) {
      showNotify(err.message || "Could not load salary components", "error");
      setComponents([]);
    } finally {
      setLoadingComponents(false);
    }
  };

  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    try {
      // Ye endpoint list ko data.accounts ke andar deta hai
      const res = await fetchApi<any>("/company-bank-accounts");
      setAccounts(res?.data?.accounts ?? []);
    } catch (err: any) {
      showNotify(err.message || "Could not load bank accounts", "error");
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const act = async (
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body: Record<string, unknown> | null,
    okText: string,
    reload: () => void
  ) => {
    try {
      await fetchApi(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      showNotify(okText);
      reload();
    } catch (err: any) {
      showNotify(err.message || "That action could not be completed", "error");
    }
  };

  const openRun = async (data: RunFormData) => {
    try {
      await fetchApi("/payroll-runs", {
        method: "POST",
        body: JSON.stringify({
          month: data.month.trim(),
          ...(data.pay_date ? { pay_date: data.pay_date } : {}),
          ...(data.note ? { note: data.note.trim() } : {}),
        }),
      });
      showNotify("Payroll opened for " + data.month);
      setShowOpenRun(false);
      fetchRuns();
    } catch (err: any) {
      showNotify(err.message || "Could not open payroll", "error");
    }
  };

  const addComponent = async (data: ComponentFormData) => {
    try {
      await fetchApi("/salary-components", {
        method: "POST",
        body: JSON.stringify({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          kind: data.kind,
          calculation: data.calculation,
          ...(data.default_value ? { default_value: Number(data.default_value) } : {}),
          ...(data.sequence ? { sequence: Number(data.sequence) } : {}),
          ...(data.note ? { note: data.note.trim() } : {}),
        }),
      });
      showNotify("Salary component added");
      setShowAddComponent(false);
      fetchComponents();
    } catch (err: any) {
      showNotify(err.message || "Could not add the component", "error");
    }
  };

  const addAccount = async (data: BankFormData) => {
    try {
      await fetchApi("/company-bank-accounts", {
        method: "POST",
        body: JSON.stringify({
          label: data.label.trim(),
          account_holder_name: data.account_holder_name.trim(),
          bank_name: data.bank_name.trim(),
          account_number: data.account_number.trim(),
          ifsc_code: data.ifsc_code.trim().toUpperCase(),
          branch_name: data.branch_name?.trim() || null,
        }),
      });
      showNotify("Bank account added");
      setShowAddAccount(false);
      fetchAccounts();
    } catch (err: any) {
      showNotify(err.message || "Could not add the bank account", "error");
    }
  };

  const runFields: FieldConfig<RunFormData>[] = [
    { name: "month", label: "Payroll Month", placeholder: "2026-09", helperText: "Format YYYY-MM" },
    { name: "pay_date", label: "Pay Date (Optional)", type: "date" },
    { name: "note", label: "Note (Optional)", type: "textarea", colSpan: 2 },
  ];

  const componentFields: FieldConfig<ComponentFormData>[] = [
    { name: "name", label: "Component Name", placeholder: "e.g. House Rent Allowance" },
    { name: "code", label: "Component Code", placeholder: "e.g. HRA" },
    {
      name: "kind",
      label: "Kind",
      type: "select",
      options: [
        { label: "Earning", value: "earning" },
        { label: "Deduction", value: "deduction" },
        { label: "Employer Cost", value: "employer_cost" },
      ],
    },
    {
      name: "calculation",
      label: "How It Is Worked Out",
      type: "select",
      options: [
        { label: "Fixed amount", value: "fixed" },
        { label: "Percent of basic", value: "percent_of_basic" },
        { label: "Percent of gross", value: "percent_of_gross" },
        { label: "Balance of gross", value: "balance" },
      ],
    },
    { name: "default_value", label: "Default Value", type: "number", placeholder: "e.g. 40" },
    { name: "sequence", label: "Order On Payslip", type: "number", placeholder: "e.g. 20" },
    { name: "note", label: "Note (Optional)", type: "textarea", colSpan: 2 },
  ];

  const bankFields: FieldConfig<BankFormData>[] = [
    { name: "label", label: "Account Name", placeholder: "e.g. Salary account" },
    { name: "account_holder_name", label: "Account Holder", placeholder: "Registered company name" },
    { name: "bank_name", label: "Bank", placeholder: "e.g. HDFC Bank" },
    { name: "account_number", label: "Account Number", placeholder: "e.g. 000405001234" },
    { name: "ifsc_code", label: "IFSC", placeholder: "e.g. HDFC0000123" },
    { name: "branch_name", label: "Branch (Optional)", placeholder: "e.g. Connaught Place" },
  ];

  const badge = (text: string, tone: "emerald" | "amber" | "rose" | "blue" | "purple") => {
    const tones: Record<string, string> = {
      emerald: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      rose: "bg-rose-500/15 text-rose-500 border-rose-500/30",
      blue: "bg-blue-500/15 text-blue-500 border-blue-500/30",
      purple: "bg-purple-500/15 text-purple-500 border-purple-500/30",
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${tones[tone]}`}>
        {text.replace(/_/g, " ")}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const done = ["approved", "paid", "completed", "settled", "active", "disbursed"];
    const busy = ["pending", "calculated", "draft", "open", "requested"];
    const bad = ["cancelled", "rejected", "failed", "stopped"];

    return badge(status, done.includes(status) ? "emerald" : busy.includes(status) ? "amber" : bad.includes(status) ? "rose" : "blue");
  };

  const iconButton = (
    key: string,
    title: string,
    tone: "emerald" | "rose" | "blue" | "amber",
    Icon: React.ComponentType<{ className?: string }>,
    onClick: () => void
  ) => {
    const tones: Record<string, string> = {
      emerald: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
      rose: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/30",
      blue: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-blue-500/30",
      amber: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30",
    };

    return (
      <button
        key={key}
        title={title}
        onClick={onClick}
        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${tones[tone]}`}
      >
        <Icon className="w-3.5 h-3.5" />
      </button>
    );
  };

  const runColumns: ColumnDef<PayrollRunItem>[] = useMemo(
    () => [
      { accessorKey: "month_label", header: "Month", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "pay_date", header: "Pay Date", cell: (i) => <span className="text-slate-400 font-mono text-xs">{dateOf(i.getValue())}</span> },
      { accessorKey: "headcount", header: "Headcount", cell: (i) => badge(String(i.getValue() ?? 0), "purple") },
      { accessorKey: "total_earnings", header: "Earnings", cell: (i) => <span className="font-mono text-xs font-bold text-emerald-500">{money(i.getValue())}</span> },
      { accessorKey: "total_deductions", header: "Deductions", cell: (i) => <span className="font-mono text-xs font-bold text-rose-500">{money(i.getValue())}</span> },
      { accessorKey: "total_net", header: "Net Payable", cell: (i) => <span className="font-mono text-xs font-bold">{money(i.getValue())}</span> },
      {
        id: "paid",
        header: "Paid",
        cell: ({ row }) => (
          <span className="text-xs text-slate-400">
            {row.original.paid_count} of {row.original.headcount}
          </span>
        ),
      },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "draft")) },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const run = row.original;
          const buttons: React.ReactNode[] = [];

          if (run.is_editable) {
            buttons.push(
              iconButton("calc", "Calculate payslips", "blue", Calculator, () =>
                act(`/payroll-runs/${run.uuid}/calculate`, "POST", null, "Payslips recalculated", fetchRuns)
              )
            );
          }

          if (run.status === "calculated") {
            buttons.push(
              iconButton("approve", "Approve run", "emerald", CheckCircle2, () =>
                act(`/payroll-runs/${run.uuid}/approve`, "POST", {}, "Payroll approved", fetchRuns)
              )
            );
          }

          if (run.paid_count === 0 && run.status !== "cancelled") {
            buttons.push(
              iconButton("cancel", "Cancel run", "rose", XCircle, () => {
                const reason = window.prompt("Why is this run being cancelled?");
                if (reason && reason.trim().length > 2) {
                  act(`/payroll-runs/${run.uuid}/cancel`, "POST", { reason: reason.trim() }, "Payroll cancelled", fetchRuns);
                }
              })
            );
          }

          return <div className="flex items-center gap-1.5">{buttons}</div>;
        },
      },
    ],
    []
  );

  const settlementColumns: ColumnDef<SettlementItem>[] = useMemo(
    () => [
      { accessorKey: "employee_code", header: "Code", cell: (i) => <span className="font-mono text-xs font-extrabold text-purple-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "employee_name", header: "Employee", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "last_working_date", header: "Last Working Day", cell: (i) => <span className="text-slate-400 font-mono text-xs">{dateOf(i.getValue())}</span> },
      {
        id: "paid_days",
        header: "Paid Days",
        cell: ({ row }) => (
          <span className="text-xs text-slate-400">
            {row.original.paid_days} of {row.original.working_days}
          </span>
        ),
      },
      { accessorKey: "total_earnings", header: "Earnings", cell: (i) => <span className="font-mono text-xs font-bold text-emerald-500">{money(i.getValue())}</span> },
      { accessorKey: "total_deductions", header: "Deductions", cell: (i) => <span className="font-mono text-xs font-bold text-rose-500">{money(i.getValue())}</span> },
      { accessorKey: "net_payable", header: "Net Payable", cell: (i) => <span className="font-mono text-xs font-bold">{money(i.getValue())}</span> },
      { accessorKey: "payment_status", header: "Payment", cell: (i) => statusBadge(String(i.getValue() ?? "pending")) },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "draft")) },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const fnf = row.original;
          const buttons: React.ReactNode[] = [];

          if (fnf.status === "draft" || fnf.status === "calculated") {
            buttons.push(
              iconButton("calc", "Rebuild settlement", "blue", Calculator, () =>
                act(`/fnf-settlements/${fnf.uuid}/calculate`, "POST", null, "Settlement rebuilt", fetchSettlements)
              )
            );
          }

          if (fnf.status === "calculated") {
            buttons.push(
              iconButton("approve", "Approve settlement", "emerald", CheckCircle2, () =>
                act(`/fnf-settlements/${fnf.uuid}/approve`, "POST", {}, "Settlement approved", fetchSettlements)
              )
            );
          }

          if (fnf.payment_status !== "paid") {
            buttons.push(
              iconButton("cancel", "Cancel settlement", "rose", XCircle, () => {
                const reason = window.prompt("Why is this settlement being cancelled?");
                if (reason && reason.trim().length > 2) {
                  act(`/fnf-settlements/${fnf.uuid}/cancel`, "POST", { reason: reason.trim() }, "Settlement cancelled", fetchSettlements);
                }
              })
            );
          }

          buttons.push(
            iconButton("slip", "Open settlement letter", "amber", Download, () =>
              window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL}/fnf-settlements/${fnf.uuid}/preview`, "_blank")
            )
          );

          return <div className="flex items-center gap-1.5">{buttons}</div>;
        },
      },
    ],
    []
  );

  const advanceColumns: ColumnDef<AdvanceItem>[] = useMemo(
    () => [
      { accessorKey: "reference", header: "Reference", cell: (i) => <span className="font-mono text-xs font-extrabold text-indigo-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "employee_name", header: "Employee", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "amount", header: "Advance", cell: (i) => <span className="font-mono text-xs font-bold">{money(i.getValue())}</span> },
      { accessorKey: "emi_amount", header: "EMI", cell: (i) => <span className="font-mono text-xs">{money(i.getValue())}</span> },
      { accessorKey: "tenure_months", header: "Tenure", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? 0)} months</span> },
      { accessorKey: "recovered", header: "Recovered", cell: (i) => <span className="font-mono text-xs text-emerald-500">{money(i.getValue())}</span> },
      { accessorKey: "outstanding", header: "Outstanding", cell: (i) => <span className="font-mono text-xs text-amber-500">{money(i.getValue())}</span> },
      { accessorKey: "reason", header: "Reason", cell: (i) => <span className="text-xs text-slate-400 truncate max-w-[180px] block">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "pending")) },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const advance = row.original;
          const buttons: React.ReactNode[] = [];

          if (advance.can?.decide) {
            buttons.push(
              iconButton("approve", "Approve advance", "emerald", CheckCircle2, () =>
                act(`/advances/${advance.uuid}/decide`, "POST", { decision: "approved" }, "Advance approved", fetchAdvances)
              )
            );
            buttons.push(
              iconButton("reject", "Reject advance", "rose", XCircle, () => {
                const note = window.prompt("Reason for rejecting this advance?");
                if (note && note.trim().length > 2) {
                  act(`/advances/${advance.uuid}/decide`, "POST", { decision: "rejected", note: note.trim() }, "Advance rejected", fetchAdvances);
                }
              })
            );
          }

          if (advance.status === "disbursed" && !advance.hold_reason) {
            buttons.push(
              iconButton("hold", "Hold EMI recovery", "amber", Lock, () => {
                const reason = window.prompt("Why is the EMI recovery being paused?");
                if (reason && reason.trim().length > 2) {
                  act(`/advances/${advance.uuid}/hold`, "POST", { reason: reason.trim() }, "EMI recovery paused", fetchAdvances);
                }
              })
            );
          }

          if (advance.hold_reason) {
            buttons.push(
              iconButton("release", "Resume EMI recovery", "blue", Unlock, () =>
                act(`/advances/${advance.uuid}/release`, "POST", {}, "EMI recovery resumed", fetchAdvances)
              )
            );
          }

          return <div className="flex items-center gap-1.5">{buttons}</div>;
        },
      },
    ],
    []
  );

  const componentColumns: ColumnDef<ComponentItem>[] = useMemo(
    () => [
      { accessorKey: "code", header: "Code", cell: (i) => <span className="font-mono text-xs font-extrabold text-cyan-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "name", header: "Component", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "kind", header: "Kind", cell: (i) => statusBadge(String(i.getValue() ?? "earning")) },
      { accessorKey: "calculation", header: "How It Is Worked Out", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-").replace(/_/g, " ")}</span> },
      { accessorKey: "default_value", header: "Default", cell: (i) => <span className="font-mono text-xs">{String(i.getValue() ?? 0)}</span> },
      { id: "tax", header: "Tax", cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.is_taxable ? "Taxable" : "Exempt"}</span> },
      { id: "source", header: "Source", cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.is_statutory ? "Statutory" : "Company"}</span> },
      { accessorKey: "sequence", header: "Order", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? 0)}</span> },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.is_statutory ? (
            <span className="text-[10px] text-slate-500 font-semibold">Locked</span>
          ) : (
            <div className="flex items-center gap-1.5">
              {iconButton("del", "Remove component", "rose", XCircle, () => {
                if (window.confirm(`Remove ${row.original.name} from the salary structure?`)) {
                  act(`/salary-components/${row.original.uuid}`, "DELETE", null, "Component removed", fetchComponents);
                }
              })}
            </div>
          ),
      },
    ],
    []
  );

  const accountColumns: ColumnDef<BankAccountItem>[] = useMemo(
    () => [
      { accessorKey: "label", header: "Account", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "account_holder_name", header: "Holder", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "bank_name", header: "Bank", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "account_masked", header: "Account Number", cell: (i) => <span className="font-mono text-xs font-bold text-indigo-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "ifsc_code", header: "IFSC", cell: (i) => <span className="font-mono text-xs text-cyan-500">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "balance", header: "Balance", cell: (i) => <span className="font-mono text-xs font-bold text-emerald-500">{money(i.getValue())}</span> },
      { id: "use", header: "Use", cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.is_primary ? "Primary" : "Secondary"}</span> },
      { accessorKey: "status", header: "Status", cell: (i) => statusBadge(String(i.getValue() ?? "active")) },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {iconButton("topup", "Top up balance", "emerald", Coins, () => {
              const amount = window.prompt("How much should be added to this account?");
              if (amount && Number(amount) > 0) {
                act(`/company-bank-accounts/${row.original.uuid}/top-up`, "POST", { amount: Number(amount) }, "Balance topped up", fetchAccounts);
              }
            })}
          </div>
        ),
      },
    ],
    []
  );

  const tabs: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "payroll", label: "Payroll Runs", icon: Wallet },
    { id: "fnf", label: "Full & Final", icon: UserMinus },
    { id: "advances", label: "Salary Advance", icon: Coins },
    { id: "salary-components", label: "Salary Components", icon: Receipt },
    { id: "company-bank", label: "Company Bank", icon: Landmark },
  ];

  const isRuns = activeTab === "payroll" || activeTab === "payroll-runs";

  const primaryAction = () => {
    if (isRuns) return { label: showOpenRun ? "Back to Runs" : "Open Payroll", onClick: () => { const next = !showOpenRun; closeForms(); setShowOpenRun(next); } };
    if (activeTab === "salary-components") return { label: showAddComponent ? "Back to Components" : "Add Component", onClick: () => { const next = !showAddComponent; closeForms(); setShowAddComponent(next); } };
    if (activeTab === "company-bank") return { label: showAddAccount ? "Back to Accounts" : "Add Bank Account", onClick: () => { const next = !showAddAccount; closeForms(); setShowAddAccount(next); } };

    return null;
  };

  const action = primaryAction();

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
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-500">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">Payroll & Settlements</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                  Payroll
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Run monthly payroll, settle exits, manage advances, salary components and the accounts salary is paid from.
              </p>
            </div>
          </div>

          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{action.label}</span>
            </button>
          )}
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
      <div
        className={`flex items-center gap-2 p-1.5 rounded-xl border overflow-x-auto ${
          isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-slate-100 border-slate-200"
        }`}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const on = tab.id === "payroll" ? isRuns : activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); closeForms(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                on
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
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

      {/* SECTION 1: PAYROLL RUNS */}
      {isRuns && (
        showOpenRun ? (
          <DynamicForm
            title="Open Payroll"
            description="A run is opened for one month, then calculated and approved before anyone is paid."
            schema={runSchema}
            fields={runFields}
            columns={2}
            onSubmit={openRun}
            onCancel={() => setShowOpenRun(false)}
            submitText="Open Payroll"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Monthly Payroll Runs"
            description="Open a month, calculate payslips, approve, then pay."
            columns={runColumns}
            data={runs}
            isLoading={loadingRuns}
            searchPlaceholder="Filter by month..."
            isDarkMode={isDarkMode}
          />
        )
      )}

      {/* SECTION 2: FULL & FINAL */}
      {activeTab === "fnf" && (
        <DataTable
          title="Full & Final Settlements"
          description="Dues, recoveries and the final payout for people who have left."
          columns={settlementColumns}
          data={settlements}
          isLoading={loadingSettlements}
          searchPlaceholder="Filter by employee..."
          isDarkMode={isDarkMode}
        />
      )}

      {/* SECTION 3: SALARY ADVANCE */}
      {activeTab === "advances" && (
        <DataTable
          title="Salary Advances"
          description="Advances asked for, approved, and how much is still to recover."
          columns={advanceColumns}
          data={advances}
          isLoading={loadingAdvances}
          searchPlaceholder="Filter by employee or reference..."
          isDarkMode={isDarkMode}
        />
      )}

      {/* SECTION 4: SALARY COMPONENTS */}
      {activeTab === "salary-components" && (
        showAddComponent ? (
          <DynamicForm
            title="Add Salary Component"
            description="Earnings, deductions and employer cost heads a salary is built from."
            schema={componentSchema}
            fields={componentFields}
            columns={2}
            onSubmit={addComponent}
            onCancel={() => setShowAddComponent(false)}
            submitText="Add Component"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Salary Components"
            description="Statutory heads are locked; company heads can be changed."
            columns={componentColumns}
            data={components}
            isLoading={loadingComponents}
            searchPlaceholder="Filter components..."
            isDarkMode={isDarkMode}
          />
        )
      )}

      {/* SECTION 5: COMPANY BANK */}
      {activeTab === "company-bank" && (
        showAddAccount ? (
          <DynamicForm
            title="Add Bank Account"
            description="The account salary and settlements are paid from."
            schema={bankSchema}
            fields={bankFields}
            columns={2}
            onSubmit={addAccount}
            onCancel={() => setShowAddAccount(false)}
            submitText="Add Bank Account"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Company Bank Accounts"
            description="Balance is synced from the bank before every transfer."
            columns={accountColumns}
            data={accounts}
            isLoading={loadingAccounts}
            searchPlaceholder="Filter accounts..."
            isDarkMode={isDarkMode}
          />
        )
      )}
    </div>
  );
};

export default PayrollModule;
