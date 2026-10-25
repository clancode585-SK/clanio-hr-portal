"use client";

import React, { useState, useEffect } from "react";
import { fetchApi, extractList } from "@/lib/api";
import {
  ShieldCheck,
  User,
  Building,
  RotateCcw,
  Save,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Layers,
  Sparkles,
  Info,
  Check,
  Slash,
} from "lucide-react";

interface PermissionItem {
  id: number;
  slug: string;
  name: string;
  action: string;
  can_assign: boolean;
}

interface ModuleTreeItem {
  module: string;
  is_enabled: boolean;
  permissions: PermissionItem[];
}

interface PermissionTreeResponse {
  modules: ModuleTreeItem[];
  total: number;
}

interface UserPermissionData {
  user_id: number;
  name: string;
  email: string;
  roles: { id: number; name: string; slug: string }[];
  from_roles: string[];
  from_department: string[];
  granted: string[];
  revoked: string[];
  effective: string[];
  counts: {
    from_roles: number;
    from_department: number;
    granted: number;
    revoked: number;
    effective: number;
  };
}

interface DepartmentPermissionData {
  department_id: number;
  department_name: string;
  permissions: string[];
  employees: number;
}

interface PermissionMatrixProps {
  isDarkMode?: boolean;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  isDarkMode = true,
}) => {
  const [activeTab, setActiveTab] = useState<"users" | "departments" | "catalogue">("users");

  // Reference Data
  const [treeData, setTreeData] = useState<ModuleTreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModuleFilter, setSelectedModuleFilter] = useState("all");

  // Selection state
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userData, setUserData] = useState<UserPermissionData | null>(null);
  const [userEffectiveSlugs, setUserEffectiveSlugs] = useState<string[]>([]);
  const [loadingUserPermissions, setLoadingUserPermissions] = useState(false);
  const [savingUserPermissions, setSavingUserPermissions] = useState(false);

  // Department State
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [deptData, setDeptData] = useState<DepartmentPermissionData | null>(null);
  const [deptSlugs, setDeptSlugs] = useState<string[]>([]);
  const [loadingDeptPermissions, setLoadingDeptPermissions] = useState(false);
  const [savingDeptPermissions, setSavingDeptPermissions] = useState(false);

  // Feedback Notification
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // 1. Load Permission Tree & Target Entities on Mount
  useEffect(() => {
    fetchTree();
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchTree = async () => {
    setLoadingTree(true);
    try {
      const res = await fetchApi<any>("/permissions/tree");
      const modules = res?.data?.modules || res?.modules || [];
      setTreeData(modules);
    } catch (err: any) {
      console.error("Failed to load permission tree:", err);
    } finally {
      setLoadingTree(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetchApi<any>("/users");
      const list = extractList(res);
      setUsersList(list);
      if (list.length > 0 && !selectedUserId) {
        setSelectedUserId(String(list[0].id));
      }
    } catch (err: any) {
      console.error("Failed to load users:", err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetchApi<any>("/departments");
      const list = extractList(res);
      setDepartmentsList(list);
      if (list.length > 0 && !selectedDeptId) {
        setSelectedDeptId(String(list[0].id));
      }
    } catch (err: any) {
      console.error("Failed to load departments:", err);
    }
  };

  // 2. Load Selected User's Permissions
  useEffect(() => {
    if (selectedUserId && activeTab === "users") {
      fetchUserPermissions(selectedUserId);
    }
  }, [selectedUserId, activeTab]);

  const fetchUserPermissions = async (userId: string) => {
    setLoadingUserPermissions(true);
    try {
      const res = await fetchApi<any>(`/users/${userId}/permissions`);
      const data = res?.data || res;
      setUserData(data);
      setUserEffectiveSlugs(data?.effective || []);
    } catch (err: any) {
      console.error("Failed to fetch user permissions:", err);
    } finally {
      setLoadingUserPermissions(false);
    }
  };

  // 3. Load Selected Department's Permissions
  useEffect(() => {
    if (selectedDeptId && activeTab === "departments") {
      fetchDeptPermissions(selectedDeptId);
    }
  }, [selectedDeptId, activeTab]);

  const fetchDeptPermissions = async (deptId: string) => {
    setLoadingDeptPermissions(true);
    try {
      const res = await fetchApi<any>(`/departments/${deptId}/permissions`);
      const data = res?.data || res;
      setDeptData(data);
      setDeptSlugs(data?.permissions || []);
    } catch (err: any) {
      console.error("Failed to fetch department permissions:", err);
    } finally {
      setLoadingDeptPermissions(false);
    }
  };

  // Handlers for User Permissions
  const toggleUserPermission = (slug: string) => {
    setUserEffectiveSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUserId) return;
    setSavingUserPermissions(true);
    try {
      await fetchApi(`/users/${selectedUserId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: userEffectiveSlugs }),
      });
      showNotification("User permissions successfully updated!");
      fetchUserPermissions(selectedUserId);
    } catch (err: any) {
      console.error("Save error:", err);
      showNotification(err.message || "Failed to update user permissions", "error");
    } finally {
      setSavingUserPermissions(false);
    }
  };

  const handleResetUserPermissions = async () => {
    if (!selectedUserId) return;
    if (!confirm("Are you sure you want to reset all custom overrides for this user? Permissions will revert strictly to Role and Department defaults.")) {
      return;
    }
    setSavingUserPermissions(true);
    try {
      await fetchApi(`/users/${selectedUserId}/permissions`, {
        method: "DELETE",
      });
      showNotification("User permissions reset to role defaults!");
      fetchUserPermissions(selectedUserId);
    } catch (err: any) {
      console.error("Reset error:", err);
      showNotification(err.message || "Failed to reset permissions", "error");
    } finally {
      setSavingUserPermissions(false);
    }
  };

  // Handlers for Department Permissions
  const toggleDeptPermission = (slug: string) => {
    setDeptSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSaveDeptPermissions = async () => {
    if (!selectedDeptId) return;
    setSavingDeptPermissions(true);
    try {
      await fetchApi(`/departments/${selectedDeptId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: deptSlugs }),
      });
      showNotification("Department default permissions saved!");
      fetchDeptPermissions(selectedDeptId);
    } catch (err: any) {
      console.error("Save error:", err);
      showNotification(err.message || "Failed to update department permissions", "error");
    } finally {
      setSavingDeptPermissions(false);
    }
  };

  // Filter modules/permissions
  const filteredTree = treeData
    .filter((mod) => selectedModuleFilter === "all" || mod.module === selectedModuleFilter)
    .map((mod) => ({
      ...mod,
      permissions: mod.permissions.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.action.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((mod) => mod.permissions.length > 0);

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Permissions & Access Control</h2>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Manage granular role inheritance, user overrides, and department access policies.
              </p>
            </div>
          </div>

          {/* Top Tabs */}
          <div className={`flex items-center p-1 rounded-xl border ${
            isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-slate-100 border-slate-200"
          }`}>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "users"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>User Overrides</span>
            </button>
            <button
              onClick={() => setActiveTab("departments")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "departments"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Department Policies</span>
            </button>
            <button
              onClick={() => setActiveTab("catalogue")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "catalogue"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Permission Tree</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Message */}
        {message && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
              message.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search permissions by name, slug..."
            className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs border outline-hidden transition-all ${
              isDarkMode
                ? "bg-[#0B1A30]/80 border-slate-800 text-white focus:border-blue-500"
                : "bg-white border-slate-200 text-slate-900 focus:border-blue-500"
            }`}
          />
        </div>

        {/* Module Category Filter Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedModuleFilter}
            onChange={(e) => setSelectedModuleFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border outline-hidden transition-all cursor-pointer ${
              isDarkMode
                ? "bg-[#0B1A30]/80 border-slate-800 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <option value="all">All System Modules ({treeData.length})</option>
            {treeData.map((m) => (
              <option key={m.module} value={m.module}>
                {m.module.toUpperCase()} ({m.permissions.length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: USER PERMISSIONS MANAGER */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* User Selector Bar */}
          <div
            className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isDarkMode
                ? "bg-[#0B1A30]/90 border-white/[0.08]"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-blue-400" />
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select User Account
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className={`mt-1 font-bold text-sm bg-transparent outline-hidden cursor-pointer ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id} className={isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* User Metadata & Summary Badge Counts */}
            {userData && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg border bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold">
                  Effective: {userEffectiveSlugs.length}
                </span>
                <span className="px-2.5 py-1 rounded-lg border bg-purple-500/10 border-purple-500/30 text-purple-400 font-medium">
                  Role Default: {userData.from_roles.length}
                </span>
                <span className="px-2.5 py-1 rounded-lg border bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-medium">
                  Dept Default: {userData.from_department.length}
                </span>
                {userData.granted.length > 0 && (
                  <span className="px-2.5 py-1 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold">
                    Granted Overrides: +{userData.granted.length}
                  </span>
                )}
                {userData.revoked.length > 0 && (
                  <span className="px-2.5 py-1 rounded-lg border bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold">
                    Revoked Overrides: -{userData.revoked.length}
                  </span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetUserPermissions}
                disabled={savingUserPermissions}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Role</span>
              </button>
              <button
                onClick={handleSaveUserPermissions}
                disabled={savingUserPermissions}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingUserPermissions ? "Saving..." : "Save Overrides"}</span>
              </button>
            </div>
          </div>

          {/* Module Permission Matrix Cards */}
          {loadingUserPermissions ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Fetching user permission profile...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTree.map((mod) => {
                const allSlugs = mod.permissions.map((p) => p.slug);
                const activeCount = mod.permissions.filter((p) => userEffectiveSlugs.includes(p.slug)).length;
                const isAllActive = allSlugs.length > 0 && activeCount === allSlugs.length;

                const toggleModuleUserPermissions = () => {
                  if (isAllActive) {
                    setUserEffectiveSlugs((prev) => prev.filter((s) => !allSlugs.includes(s)));
                  } else {
                    setUserEffectiveSlugs((prev) => Array.from(new Set([...prev, ...allSlugs])));
                  }
                };

                return (
                  <div
                    key={mod.module}
                    className={`p-5 rounded-2xl border backdrop-blur-xl ${
                      isDarkMode
                        ? "bg-[#0B1A30]/90 border-white/[0.08]"
                        : "bg-white border-slate-200 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/30">
                      <div
                        className="flex items-center gap-2.5 cursor-pointer select-none group"
                        onClick={toggleModuleUserPermissions}
                        title={isAllActive ? "Unselect all permissions in this module" : "Select all permissions in this module"}
                      >
                        <div
                          className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${
                            isAllActive
                              ? "bg-blue-600 border-blue-500 text-white shadow-xs"
                              : activeCount > 0
                              ? "bg-blue-500/30 border-blue-400 text-blue-300"
                              : "border-slate-600 bg-transparent group-hover:border-blue-400"
                          }`}
                        >
                          {isAllActive ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : activeCount > 0 ? (
                            <span className="w-2 h-0.5 bg-blue-400 rounded-full" />
                          ) : null}
                        </div>
                        <span className="font-extrabold text-xs uppercase tracking-wider text-blue-400 group-hover:text-blue-300 transition-colors">
                          {mod.module} Module (Parent Tab)
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {activeCount} / {mod.permissions.length} active
                      </span>
                    </div>

                    <div className="space-y-2">
                      {mod.permissions.map((perm) => {
                        const isActive = userEffectiveSlugs.includes(perm.slug);
                        const isRoleInherited = userData?.from_roles.includes(perm.slug);
                        const isDeptInherited = userData?.from_department.includes(perm.slug);
                        const isGranted = userData?.granted.includes(perm.slug);
                        const isRevoked = userData?.revoked.includes(perm.slug);

                        return (
                          <div
                            key={perm.id}
                            onClick={() => toggleUserPermission(perm.slug)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                              isActive
                                ? isDarkMode
                                  ? "bg-blue-500/10 border-blue-500/30 text-white"
                                  : "bg-blue-50 border-blue-200 text-slate-900"
                                : isDarkMode
                                ? "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200"
                                : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                  isActive
                                    ? "bg-blue-600 border-blue-500 text-white"
                                    : "border-slate-600 bg-transparent"
                                }`}
                              >
                                {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div>
                                <p className="text-xs font-bold leading-tight">{perm.name}</p>
                                <p className="text-[10px] font-mono text-slate-400">{perm.slug}</p>
                              </div>
                            </div>

                            {/* Inherited Status Tags */}
                            <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase">
                              {isRoleInherited && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  Role
                                </span>
                              )}
                              {isDeptInherited && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  Dept
                                </span>
                              )}
                              {isGranted && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Granted
                                </span>
                              )}
                              {isRevoked && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  Revoked
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEPARTMENT PERMISSIONS MANAGER */}
      {activeTab === "departments" && (
        <div className="space-y-4">
          <div
            className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isDarkMode
                ? "bg-[#0B1A30]/90 border-white/[0.08]"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <Building className="w-5 h-5 text-purple-400" />
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select Department Policy
                </label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className={`mt-1 font-bold text-sm bg-transparent outline-hidden cursor-pointer ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {departmentsList.map((d) => (
                    <option key={d.id} value={d.id} className={isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>
                      {d.name} ({d.code || "DEPT"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {deptData && (
              <div className="flex items-center gap-3 text-xs">
                <span className="px-3 py-1 rounded-lg border bg-purple-500/10 border-purple-500/30 text-purple-400 font-bold">
                  Department Default Permissions: {deptSlugs.length}
                </span>
                <span className="px-3 py-1 rounded-lg border bg-blue-500/10 border-blue-500/30 text-blue-400 font-medium">
                  Assigned Employees: {deptData.employees}
                </span>
              </div>
            )}

            <button
              onClick={handleSaveDeptPermissions}
              disabled={savingDeptPermissions}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingDeptPermissions ? "Saving..." : "Save Department Defaults"}</span>
            </button>
          </div>

          {loadingDeptPermissions ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Fetching department default policy...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTree.map((mod) => {
                const allSlugs = mod.permissions.map((p) => p.slug);
                const activeCount = mod.permissions.filter((p) => deptSlugs.includes(p.slug)).length;
                const isAllActive = allSlugs.length > 0 && activeCount === allSlugs.length;

                const toggleModuleDeptPermissions = () => {
                  if (isAllActive) {
                    setDeptSlugs((prev) => prev.filter((s) => !allSlugs.includes(s)));
                  } else {
                    setDeptSlugs((prev) => Array.from(new Set([...prev, ...allSlugs])));
                  }
                };

                return (
                  <div
                    key={mod.module}
                    className={`p-5 rounded-2xl border backdrop-blur-xl ${
                      isDarkMode
                        ? "bg-[#0B1A30]/90 border-white/[0.08]"
                        : "bg-white border-slate-200 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/30">
                      <div
                        className="flex items-center gap-2.5 cursor-pointer select-none group"
                        onClick={toggleModuleDeptPermissions}
                        title={isAllActive ? "Unselect all in this module" : "Select all in this module"}
                      >
                        <div
                          className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${
                            isAllActive
                              ? "bg-purple-600 border-purple-500 text-white shadow-xs"
                              : activeCount > 0
                              ? "bg-purple-500/30 border-purple-400 text-purple-300"
                              : "border-slate-600 bg-transparent group-hover:border-purple-400"
                          }`}
                        >
                          {isAllActive ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : activeCount > 0 ? (
                            <span className="w-2 h-0.5 bg-purple-400 rounded-full" />
                          ) : null}
                        </div>
                        <span className="font-extrabold text-xs uppercase tracking-wider text-purple-400 group-hover:text-purple-300 transition-colors">
                          {mod.module} Module Defaults
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {activeCount} / {mod.permissions.length} active
                      </span>
                    </div>

                    <div className="space-y-2">
                      {mod.permissions.map((perm) => {
                        const isActive = deptSlugs.includes(perm.slug);

                        return (
                          <div
                            key={perm.id}
                            onClick={() => toggleDeptPermission(perm.slug)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                              isActive
                                ? isDarkMode
                                  ? "bg-purple-500/10 border-purple-500/30 text-white"
                                  : "bg-purple-50 border-purple-200 text-slate-900"
                                : isDarkMode
                                ? "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200"
                                : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                  isActive
                                    ? "bg-purple-600 border-purple-500 text-white"
                                    : "border-slate-600 bg-transparent"
                                }`}
                              >
                                {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div>
                                <p className="text-xs font-bold leading-tight">{perm.name}</p>
                                <p className="text-[10px] font-mono text-slate-400">{perm.slug}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SYSTEM PERMISSION TREE CATALOGUE */}
      {activeTab === "catalogue" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingTree ? (
            <div className="col-span-full p-12 text-center text-slate-400 text-xs">
              Loading system permission catalogue...
            </div>
          ) : (
            filteredTree.map((mod) => (
              <div
                key={mod.module}
                className={`p-5 rounded-2xl border backdrop-blur-xl ${
                  isDarkMode
                    ? "bg-[#0B1A30]/90 border-white/[0.08]"
                    : "bg-white border-slate-200 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/30">
                  <span className="font-extrabold text-xs uppercase tracking-wider text-cyan-400">
                    {mod.module}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    {mod.permissions.length} Scope Slugs
                  </span>
                </div>

                <div className="space-y-2">
                  {mod.permissions.map((p) => (
                    <div
                      key={p.id}
                      className={`p-2.5 rounded-xl border text-xs ${
                        isDarkMode
                          ? "bg-slate-900/60 border-slate-800/80 text-slate-300"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <p className="font-bold">{p.name}</p>
                      <p className="font-mono text-[10px] text-blue-400 mt-0.5">{p.slug}</p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Action: {p.action}</span>
                        <span>Assignable: {p.can_assign ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
