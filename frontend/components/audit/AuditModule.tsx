"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { fetchApi, extractList } from "@/lib/api";
import { dateOf } from "@/lib/format";
import { ScrollText, ShieldCheck, Users, CheckCircle2, XCircle } from "lucide-react";

interface AuditItem {
  id: number;
  event: string;
  entity: string;
  entity_label: string;
  entity_id: number;
  actor: string;
  actor_email: string;
  ip_address: string;
  happened_at: string;
  change_count: number;
  changes?: { field: string; label: string; from: unknown; to: unknown }[];
}

interface UserItem {
  id: number;
  uuid: string;
  name: string;
  email: string;
  status: string;
  roles?: { name?: string }[];
  department?: { name?: string };
  branch?: { name?: string };
}

interface AuditModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

export const AuditModule: React.FC<AuditModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "audit-log",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    setActiveTab(externalTab);
  }, [externalTab]);

  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (activeTab === "audit-log") load("/audit-logs", setLogs);
    if (activeTab === "users") load("/users", setUsers);
  }, [activeTab]);

  const load = async (path: string, apply: (rows: any[]) => void) => {
    setLoading(true);
    try {
      apply(extractList(await fetchApi<any>(path)));
    } catch (err: any) {
      showNotify(err.message || "Could not load this list", "error");
      apply([]);
    } finally {
      setLoading(false);
    }
  };

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
        {String(text).replace(/_/g, " ")}
      </span>
    );
  };

  const eventBadge = (event: string) =>
    badge(event, event === "created" ? "emerald" : event === "deleted" ? "rose" : event === "updated" ? "amber" : "blue");

  const logColumns: ColumnDef<AuditItem>[] = useMemo(
    () => [
      { accessorKey: "happened_at", header: "When", cell: (i) => <span className="font-mono text-xs text-slate-400">{dateOf(i.getValue())}</span> },
      { accessorKey: "actor", header: "Who", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "System")}</span> },
      { accessorKey: "event", header: "Event", cell: (i) => eventBadge(String(i.getValue() ?? "-")) },
      { accessorKey: "entity_label", header: "Record", cell: (i) => badge(String(i.getValue() ?? "-"), "purple") },
      { accessorKey: "entity_id", header: "Record Id", cell: (i) => <span className="font-mono text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      {
        id: "changes",
        header: "Fields Changed",
        cell: ({ row }) => (
          <span className="text-xs text-slate-400 truncate max-w-[260px] block">
            {(row.original.changes ?? []).map((change) => change.label).join(", ") || "-"}
          </span>
        ),
      },
      { accessorKey: "change_count", header: "Count", cell: (i) => badge(String(i.getValue() ?? 0), "amber") },
      { accessorKey: "ip_address", header: "From", cell: (i) => <span className="font-mono text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
    ],
    []
  );

  const userColumns: ColumnDef<UserItem>[] = useMemo(
    () => [
      { accessorKey: "name", header: "Name", cell: (i) => <span className="font-bold">{String(i.getValue() ?? "-")}</span> },
      { accessorKey: "email", header: "Email", cell: (i) => <span className="text-xs text-slate-400">{String(i.getValue() ?? "-")}</span> },
      { id: "role", header: "Role", cell: ({ row }) => badge(row.original.roles?.[0]?.name ?? "-", "blue") },
      { id: "department", header: "Department", cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.department?.name ?? "-"}</span> },
      { id: "branch", header: "Branch", cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.branch?.name ?? "-"}</span> },
      { accessorKey: "status", header: "Status", cell: (i) => badge(String(i.getValue() ?? "active"), String(i.getValue()) === "active" ? "emerald" : "rose") },
    ],
    []
  );

  const tabs: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "users", label: "Sign-in Accounts", icon: Users },
    { id: "audit-log", label: "Audit Log", icon: ScrollText },
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
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-500/20 to-zinc-500/20 border border-slate-500/30 text-slate-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight">Accounts & Audit Trail</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-500/20 text-slate-400 border border-slate-500/30">
                Access
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Who can sign in, and a record of who changed what, when, and from which address.
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
        className={`flex items-center gap-2 p-1.5 rounded-xl border ${
          isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-slate-100 border-slate-200"
        }`}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-slate-700 text-white shadow-md shadow-slate-900/20"
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

      {activeTab === "users" && (
        <DataTable
          title="Sign-in Accounts"
          description="Every account in this workspace and the role attached to it."
          columns={userColumns}
          data={users}
          isLoading={loading}
          searchPlaceholder="Filter by name or email..."
          isDarkMode={isDarkMode}
        />
      )}

      {activeTab === "audit-log" && (
        <DataTable
          title="Audit Log"
          description="Newest first. Every create, update and delete is recorded."
          columns={logColumns}
          data={logs}
          isLoading={loading}
          searchPlaceholder="Filter by actor, event or record..."
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default AuditModule;
