"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Building2,
  Building,
  Users,
  User,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  RefreshCw,
  GitFork,
  Network,
  Sparkles,
  Crown,
  Briefcase,
  Mail,
  UserCheck,
  UserX,
  Layers,
  Grid,
  ListTree,
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface OrgChartModuleProps {
  isDarkMode?: boolean;
}

export const OrgChartModule: React.FC<OrgChartModuleProps> = ({
  isDarkMode = false,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter States
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [depth, setDepth] = useState<"branch" | "department" | "team" | "employee">("employee");
  const [includeExited, setIncludeExited] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"tree" | "cards">("tree");

  // Collapsed Nodes State (Record of expanded node IDs)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: prev[nodeId] === undefined ? false : !prev[nodeId],
    }));
  };

  const isNodeExpanded = (nodeId: string) => {
    return expandedNodes[nodeId] !== false; // expanded by default
  };

  // Fetch Org Chart Data
  const fetchOrgChart = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append("branch_id", selectedBranchId);
      if (depth) params.append("depth", depth);
      if (includeExited) params.append("include_exited", "true");

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await fetchApi<any>(`/org-chart${queryStr}`);
      const chartData = res?.data || res;
      setData(chartData);
    } catch (err: any) {
      setError(err.message || "Failed to load Organization Chart.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgChart();
  }, [selectedBranchId, depth, includeExited]);

  const company = data?.company || {};
  const branches = data?.branches || [];
  const unassigned = data?.unassigned || { employee_count: 0, employees: [] };

  // Filter branches/departments/teams based on search query
  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.toLowerCase().trim();

    return branches
      .map((branch: any) => {
        const matchesBranch =
          branch.name.toLowerCase().includes(q) ||
          (branch.code && branch.code.toLowerCase().includes(q));

        const filteredDepts = (branch.departments || [])
          .map((dept: any) => {
            const matchesDept =
              dept.name.toLowerCase().includes(q) ||
              (dept.code && dept.code.toLowerCase().includes(q));

            const filteredTeams = (dept.teams || [])
              .map((team: any) => {
                const matchesTeam =
                  team.name.toLowerCase().includes(q) ||
                  (team.code && team.code.toLowerCase().includes(q));

                const filteredEmployees = (team.employees || []).filter(
                  (emp: any) =>
                    emp.name.toLowerCase().includes(q) ||
                    emp.email.toLowerCase().includes(q) ||
                    (emp.designation && emp.designation.toLowerCase().includes(q)) ||
                    (emp.employee_code && emp.employee_code.toLowerCase().includes(q))
                );

                if (matchesTeam || filteredEmployees.length > 0) {
                  return { ...team, employees: filteredEmployees };
                }
                return null;
              })
              .filter(Boolean);

            const filteredLooseDepts = (dept.employees_without_team || []).filter(
              (emp: any) =>
                emp.name.toLowerCase().includes(q) ||
                emp.email.toLowerCase().includes(q) ||
                (emp.designation && emp.designation.toLowerCase().includes(q))
            );

            if (matchesDept || filteredTeams.length > 0 || filteredLooseDepts.length > 0) {
              return {
                ...dept,
                teams: filteredTeams,
                employees_without_team: filteredLooseDepts,
              };
            }
            return null;
          })
          .filter(Boolean);

        const filteredBranchLoose = (branch.employees_without_department || []).filter(
          (emp: any) =>
            emp.name.toLowerCase().includes(q) ||
            emp.email.toLowerCase().includes(q) ||
            (emp.designation && emp.designation.toLowerCase().includes(q))
        );

        if (matchesBranch || filteredDepts.length > 0 || filteredBranchLoose.length > 0) {
          return {
            ...branch,
            departments: filteredDepts,
            employees_without_department: filteredBranchLoose,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [branches, searchQuery]);

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER BAR & STATS */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden backdrop-blur-xl transition-all ${
          isDarkMode
            ? "bg-[#0B1A30]/90 border-white/[0.08] shadow-2xl"
            : "bg-white border-slate-200 shadow-xl"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md">
                <Network className="w-5 h-5" />
              </span>
              <h1
                className={`text-xl sm:text-2xl font-black tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                {company.name || "Organization"} Structure
              </h1>
            </div>
            <p className={`text-xs mt-1 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Visual hierarchy of company branches, departments, teams, and employee reporting structures.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div
              className={`p-3.5 rounded-2xl border text-center ${
                isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-purple-50/60 border-purple-100"
              }`}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Branches</div>
              <div className="text-lg font-black text-purple-400 mt-0.5">{company.branch_count ?? 0}</div>
            </div>
            <div
              className={`p-3.5 rounded-2xl border text-center ${
                isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-blue-50/60 border-blue-100"
              }`}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Departments</div>
              <div className="text-lg font-black text-blue-400 mt-0.5">{company.department_count ?? 0}</div>
            </div>
            <div
              className={`p-3.5 rounded-2xl border text-center ${
                isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-emerald-50/60 border-emerald-100"
              }`}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Teams</div>
              <div className="text-lg font-black text-emerald-400 mt-0.5">{company.team_count ?? 0}</div>
            </div>
            <div
              className={`p-3.5 rounded-2xl border text-center ${
                isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-cyan-50/60 border-cyan-100"
              }`}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Workforce</div>
              <div className="text-lg font-black text-cyan-400 mt-0.5">{company.employee_count ?? 0}</div>
            </div>
          </div>
        </div>

        {/* CONTROLS TOOLBAR */}
        <div
          className={`flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t ${
            isDarkMode ? "border-white/[0.08]" : "border-slate-100"
          }`}
        >
          {/* Left Controls: Depth & Branch Selector */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Depth Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">Depth:</span>
              <div
                className={`p-1 rounded-2xl border flex items-center gap-1 ${
                  isDarkMode ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-100 border-slate-200"
                }`}
              >
                {(["branch", "department", "team", "employee"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepth(d)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer ${
                      depth === d
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                        : isDarkMode
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Branch Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">Branch:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className={`px-3 py-2 rounded-2xl text-xs font-semibold outline-none border cursor-pointer ${
                  isDarkMode
                    ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                <option value="">All Branches</option>
                {branches.map((b: any) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Exited Employee Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none px-2 py-1">
              <input
                type="checkbox"
                checked={includeExited}
                onChange={(e) => setIncludeExited(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                Include Exited Staff
              </span>
            </label>
          </div>

          {/* Right Controls: Search & View Mode Switch */}
          <div className="flex items-center gap-3 flex-1 sm:flex-initial min-w-[240px]">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, dept, team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 rounded-2xl text-xs outline-none border transition-all ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-500 focus:border-purple-500"
                    : "bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500"
                }`}
              />
            </div>

            {/* View Mode Toggle */}
            <div
              className={`p-1 rounded-2xl border flex items-center gap-1 ${
                isDarkMode ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-100 border-slate-200"
              }`}
            >
              <button
                onClick={() => setViewMode("tree")}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  viewMode === "tree"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Hierarchical Tree View"
              >
                <ListTree className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Grid Cards View"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchOrgChart}
              className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                isDarkMode
                  ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
              title="Refresh Org Chart"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold ${
            isDarkMode
              ? "bg-rose-950/60 border-rose-800 text-rose-300"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          {error}
        </div>
      )}

      {/* LOADING STATE */}
      {loading && !data && (
        <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-3" />
          <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            Building organization hierarchy...
          </p>
        </div>
      )}

      {/* ORG CHART CONTENT VIEW */}
      {!loading && filteredBranches.length === 0 && (
        <div
          className={`p-12 text-center rounded-3xl border ${
            isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08] text-slate-400" : "bg-white border-slate-200 text-slate-500"
          }`}
        >
          No branch or organization data found matching your query.
        </div>
      )}

      {!loading && filteredBranches.length > 0 && (
        <div className="space-y-6">
          {filteredBranches.map((branch: any) => {
            const branchIdStr = `branch-${branch.id}`;
            const isBranchExpanded = isNodeExpanded(branchIdStr);

            return (
              <div
                key={branch.id}
                className={`p-6 sm:p-8 rounded-3xl border space-y-6 transition-all ${
                  isDarkMode
                    ? "bg-[#0B1A30]/90 border-white/[0.08] shadow-xl"
                    : "bg-white border-slate-200 shadow-md"
                }`}
              >
                {/* BRANCH HEADER NODE */}
                <div className="flex items-center justify-between">
                  <div
                    onClick={() => toggleNode(branchIdStr)}
                    className="flex items-center gap-3 cursor-pointer select-none group"
                  >
                    <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2
                          className={`text-lg font-black tracking-tight group-hover:text-purple-400 transition-colors ${
                            isDarkMode ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {branch.name}
                        </h2>
                        {branch.is_head_office && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-400" /> Head Office
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20 font-mono">
                          {branch.code}
                        </span>
                      </div>
                      <p className={`text-xs font-semibold mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                        Total Branch Staff: {branch.employee_count ?? 0}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleNode(branchIdStr)}
                    className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {isBranchExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {/* DEPARTMENTS UNDER BRANCH */}
                {isBranchExpanded && (
                  <div className="space-y-6 pt-2 pl-2 sm:pl-4 border-l-2 border-purple-500/20">
                    {/* Loose Branch Employees */}
                    {branch.employees_without_department &&
                      branch.employees_without_department.length > 0 && (
                        <div className="space-y-3">
                          <h4 className={`text-xs font-extrabold uppercase tracking-wider text-amber-400`}>
                            Direct Branch Staff (Unassigned to Department)
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {branch.employees_without_department.map((emp: any) => (
                              <EmployeeCard key={emp.user_id} emp={emp} isDarkMode={isDarkMode} />
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Departments List */}
                    {branch.departments && branch.departments.length > 0 ? (
                      branch.departments.map((dept: any) => {
                        const deptIdStr = `dept-${branch.id}-${dept.id}`;
                        const isDeptExpanded = isNodeExpanded(deptIdStr);

                        return (
                          <div
                            key={dept.id}
                            className={`p-5 rounded-2xl border space-y-4 ${
                              isDarkMode
                                ? "bg-white/[0.02] border-white/[0.06]"
                                : "bg-slate-50/80 border-slate-200/80"
                            }`}
                          >
                            {/* DEPARTMENT NODE */}
                            <div className="flex items-center justify-between">
                              <div
                                onClick={() => toggleNode(deptIdStr)}
                                className="flex items-center gap-2.5 cursor-pointer select-none group"
                              >
                                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                                  <Building className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3
                                      className={`text-sm font-extrabold group-hover:text-purple-400 transition-colors ${
                                        isDarkMode ? "text-white" : "text-slate-900"
                                      }`}
                                    >
                                      {dept.name}
                                    </h3>
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                      {dept.code}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 font-medium">
                                    Department Staff: {dept.employee_count ?? 0}
                                  </p>
                                </div>
                              </div>

                              {depth !== "department" && (
                                <button
                                  onClick={() => toggleNode(deptIdStr)}
                                  className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                    isDarkMode
                                      ? "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white"
                                      : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                                  }`}
                                >
                                  {isDeptExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* TEAMS & EMPLOYEES UNDER DEPARTMENT */}
                            {isDeptExpanded && depth !== "department" && (
                              <div className="space-y-4 pt-2 pl-3 border-l-2 border-blue-500/20">
                                {/* Loose Department Employees */}
                                {dept.employees_without_team &&
                                  dept.employees_without_team.length > 0 && (
                                    <div className="space-y-2">
                                      <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                        Direct Department Staff
                                      </h5>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {dept.employees_without_team.map((emp: any) => (
                                          <EmployeeCard key={emp.user_id} emp={emp} isDarkMode={isDarkMode} />
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                {/* Teams List */}
                                {dept.teams && dept.teams.length > 0 && (
                                  <div className="space-y-4">
                                    {dept.teams.map((team: any) => (
                                      <div
                                        key={team.id}
                                        className={`p-4 rounded-xl border space-y-3 ${
                                          isDarkMode
                                            ? "bg-white/[0.02] border-white/[0.06]"
                                            : "bg-white border-slate-200"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-emerald-400" />
                                            <span
                                              className={`text-xs font-bold ${
                                                isDarkMode ? "text-slate-200" : "text-slate-800"
                                              }`}
                                            >
                                              {team.name} ({team.code})
                                            </span>
                                          </div>
                                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                                            {team.employee_count ?? 0} Members
                                          </span>
                                        </div>

                                        {/* Team Employees */}
                                        {depth === "employee" && team.employees && (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                                            {team.employees.map((emp: any) => (
                                              <EmployeeCard key={emp.user_id} emp={emp} isDarkMode={isDarkMode} />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-slate-400 py-2">
                        No active departments in this branch.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* UNASSIGNED EMPLOYEES NODE */}
          {unassigned && unassigned.employee_count > 0 && (
            <div
              className={`p-6 sm:p-8 rounded-3xl border space-y-4 ${
                isDarkMode
                  ? "bg-[#0B1A30]/90 border-white/[0.08]"
                  : "bg-white border-slate-200"
              }`}
            >
              <h3 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <UserX className="w-4 h-4 text-amber-400" /> Unassigned Staff ({unassigned.employee_count})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassigned.employees.map((emp: any) => (
                  <EmployeeCard key={emp.user_id} emp={emp} isDarkMode={isDarkMode} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* Employee Card Helper Component */
const EmployeeCard: React.FC<{ emp: any; isDarkMode: boolean }> = ({
  emp,
  isDarkMode,
}) => {
  const initials = emp.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all hover:scale-[1.02] ${
        isDarkMode
          ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]"
          : "bg-white border-slate-200 shadow-2xs hover:shadow-md"
      }`}
    >
      {/* Avatar / Initials */}
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-400 p-0.5 shrink-0 shadow-sm">
        <div className="w-full h-full rounded-[14px] bg-[#081425] flex items-center justify-center text-white font-bold text-xs">
          {initials}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <h4
            className={`text-xs font-bold truncate ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {emp.name}
          </h4>
          {emp.employee_code && (
            <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0">
              {emp.employee_code}
            </span>
          )}
        </div>

        <p className="text-[11px] text-purple-400 font-semibold truncate">
          {emp.designation || emp.roles?.[0] || "Staff Member"}
        </p>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate pt-0.5">
          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{emp.email}</span>
        </div>
      </div>
    </div>
  );
};

export default OrgChartModule;
