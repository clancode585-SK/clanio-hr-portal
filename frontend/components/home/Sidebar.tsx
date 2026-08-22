"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import {
  Search,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

export interface SubMenuItem {
  id: string;
  label: string;
}

export interface MenuItem {
  id: string;
  label: string;
  iconPath: string;
  badge?: {
    text: string;
    variant: "emerald" | "purple" | "cyan" | "amber";
  };
  subItems?: SubMenuItem[];
}

export interface FlatSidebarOption {
  id: string;
  label: string;
  category?: string;
  iconPath: string;
}

interface SidebarProps {
  isCollapsed?: boolean;
  isDarkMode?: boolean;
  onToggle?: () => void;
  activeItem?: string;
  onSelectItem?: (id: string) => void;
  viewMode?: "admin" | "employee";
}

export const sidebarMenuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    iconPath: "/images/icons/dashboard.png",
  },
  {
    id: "workforce",
    label: "Workforce",
    iconPath: "/images/icons/teamwork.png",
    subItems: [
      { id: "companies", label: "Companies" },
      { id: "branches", label: "Branches" },
      { id: "employees", label: "Employees" },
      { id: "departments", label: "Departments" },
      { id: "teams", label: "Teams" },
      { id: "designations", label: "Designations" },
      { id: "organization-chart", label: "Organization Chart" },
    ],
  },
  {
    id: "attendance",
    label: "Attendance",
    iconPath: "/images/icons/calendar.png",
    badge: { text: "Today", variant: "emerald" },
    subItems: [
      { id: "attendance-list", label: "Attendance" },
      { id: "shift-management", label: "Shift Management" },
      { id: "holidays", label: "Holidays" },
      { id: "timesheets", label: "Timesheets" },
    ],
  },
  {
    id: "leave",
    label: "Leave",
    iconPath: "/images/icons/calendar.png",
    subItems: [
      { id: "leave-requests", label: "Leave Requests" },
      { id: "leave-balance", label: "Leave Balance" },
      { id: "leave-policies", label: "Leave Policies" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    iconPath: "/images/icons/wages.png",
    badge: { text: "Pending", variant: "amber" },
    subItems: [
      { id: "payroll-overview", label: "Payroll" },
      { id: "salary-structure", label: "Salary Structure" },
      { id: "payslips", label: "Payslips" },
      { id: "reimbursements", label: "Reimbursements" },
      { id: "loans-advances", label: "Loans & Advances" },
    ],
  },
  {
    id: "recruitment",
    label: "Recruitment",
    iconPath: "/images/icons/recruitment.png",
    badge: { text: "3 New", variant: "purple" },
    subItems: [
      { id: "jobs", label: "Jobs" },
      { id: "candidates", label: "Candidates" },
      { id: "interviews", label: "Interviews" },
      { id: "offers", label: "Offers" },
    ],
  },
  {
    id: "tasks",
    label: "Tasks",
    iconPath: "/images/icons/task.png",
    subItems: [
      { id: "my-tasks", label: "My Tasks" },
      { id: "team-tasks", label: "Team Tasks" },
      { id: "projects", label: "Projects" },
      { id: "sod-eod", label: "SOD / EOD" },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    iconPath: "/images/icons/folders.png",
    subItems: [
      { id: "employee-documents", label: "Employee Documents" },
      { id: "company-policies", label: "Company Policies" },
      { id: "templates", label: "Templates" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    iconPath: "/images/icons/seo-report.png",
    subItems: [
      { id: "hr-reports", label: "HR Reports" },
      { id: "attendance-reports", label: "Attendance Reports" },
      { id: "payroll-reports", label: "Payroll Reports" },
      { id: "analytics", label: "Analytics" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    iconPath: "/images/icons/chat-bubbles.png",
    badge: { text: "12", variant: "cyan" },
    subItems: [
      { id: "announcements", label: "Announcements" },
      { id: "notifications", label: "Notifications" },
      { id: "calendar", label: "Calendar" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    iconPath: "/images/icons/administration.png",
    subItems: [
      { id: "roles", label: "Roles" },
      { id: "users-roles", label: "Users & Roles" },
      { id: "company-settings", label: "Company Settings" },
      { id: "billing", label: "Billing" },
      { id: "audit-logs", label: "Audit Logs" },
    ],
  },
  {
    id: "help",
    label: "Help",
    iconPath: "/images/icons/help.png",
  },
];

export const getFlatSidebarOptions = (): FlatSidebarOption[] => {
  const options: FlatSidebarOption[] = [];
  sidebarMenuItems.forEach((item) => {
    if (item.subItems && item.subItems.length > 0) {
      item.subItems.forEach((sub) => {
        options.push({
          id: sub.id,
          label: sub.label,
          category: item.label,
          iconPath: item.iconPath,
        });
      });
    } else {
      options.push({
        id: item.id,
        label: item.label,
        iconPath: item.iconPath,
      });
    }
  });
  return options;
};

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed = false,
  isDarkMode = true,
  activeItem: externalActiveItem,
  onSelectItem,
  viewMode = "admin",
}) => {
  const [internalActiveItem, setInternalActiveItem] = useState("employees");
  const activeItem = externalActiveItem !== undefined ? externalActiveItem : internalActiveItem;

  const [userName, setUserName] = useState("Platform Super Admin");
  const [userRole, setUserRole] = useState("Super Administrator");
  const [companyName, setCompanyName] = useState("Clanio HR");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("user_name");
      const isSuper = localStorage.getItem("is_super_admin") === "true";
      const storedEmail = localStorage.getItem("user_email");
      const storedCompany = localStorage.getItem("company_name");

      if (storedName) {
        setUserName(storedName);
      } else if (isSuper || storedEmail === "superadmin@clanio.com") {
        setUserName("Platform Super Admin");
      }

      if (storedCompany) {
        setCompanyName(storedCompany);
      }

      if (isSuper || storedEmail === "superadmin@clanio.com") {
        setUserRole("Super Administrator");
      } else {
        setUserRole("Company Admin");
      }
    }
  }, []);

  const initials = userName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "SA";

  const handleSelectItem = (id: string) => {
    if (onSelectItem) {
      onSelectItem(id);
    } else {
      setInternalActiveItem(id);
    }
  };

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    workforce: true,
    administration: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [dynamicMenuItems, setDynamicMenuItems] = useState<MenuItem[]>(sidebarMenuItems);

  useEffect(() => {
    let isMounted = true;
    const modeQuery = viewMode ? `?mode=${viewMode}` : "";
    fetchApi<{ data?: { menu?: MenuItem[] } }>(`/navigation${modeQuery}`)
      .then((res) => {
        if (isMounted && res?.data?.menu && Array.isArray(res.data.menu) && res.data.menu.length > 0) {
          setDynamicMenuItems(res.data.menu);
        }
      })
      .catch((err) => {
        console.warn("Backend dynamic navigation unavailable, using fallback menu.", err);
      });

    return () => {
      isMounted = false;
    };
  }, [viewMode]);

  const isSuperAdmin = typeof window !== "undefined" && (
    localStorage.getItem("is_super_admin") === "true" ||
    localStorage.getItem("user_email") === "superadmin@clanio.com"
  );

  const adminOnlyMenus = ["workforce", "recruitment", "administration"];
  const adminOnlySubItems = [
    "shift-management",
    "leave-policies",
    "payroll-overview",
    "salary-structure",
    "loans-advances",
    "team-tasks",
    "projects",
  ];

  const menuItems = React.useMemo(() => {
    let items = dynamicMenuItems;

    // Hide Teams tab strictly from Super Admin while keeping it visible for Company Admin
    if (isSuperAdmin) {
      items = items.map((item) => {
        if (item.id === "workforce" && item.subItems) {
          return {
            ...item,
            subItems: item.subItems.filter((sub) => sub.id !== "teams"),
          };
        }
        return item;
      });
    }

    if (viewMode === "employee") {
      return items
        .filter((item) => !adminOnlyMenus.includes(item.id))
        .map((item) => {
          if (item.subItems) {
            return {
              ...item,
              subItems: item.subItems.filter(
                (sub) => !adminOnlySubItems.includes(sub.id)
              ),
            };
          }
          return item;
        });
    }
    return items;
  }, [dynamicMenuItems, viewMode, isSuperAdmin]);

  const toggleSubmenu = (id: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getBadgeStyle = (variant: "emerald" | "purple" | "cyan" | "amber") => {
    if (isDarkMode) {
      switch (variant) {
        case "emerald":
          return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
        case "purple":
          return "bg-purple-500/15 text-purple-300 border-purple-500/30";
        case "cyan":
          return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
        case "amber":
          return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      }
    } else {
      switch (variant) {
        case "emerald":
          return "bg-emerald-100 text-emerald-700 border-emerald-200";
        case "purple":
          return "bg-purple-100 text-purple-700 border-purple-200";
        case "cyan":
          return "bg-cyan-100 text-cyan-700 border-cyan-200";
        case "amber":
          return "bg-amber-100 text-amber-700 border-amber-200";
      }
    }
  };

  const getBadgeDotColor = (variant: "emerald" | "purple" | "cyan" | "amber") => {
    switch (variant) {
      case "emerald":
        return "bg-emerald-400 shadow-[0_0_8px_#10B981]";
      case "purple":
        return "bg-purple-400 shadow-[0_0_8px_#A855F7]";
      case "cyan":
        return "bg-cyan-400 shadow-[0_0_8px_#22D3EE]";
      case "amber":
        return "bg-amber-400 shadow-[0_0_8px_#F59E0B]";
    }
  };

  const filteredItems = menuItems
    .map((item) => {
      if (!searchQuery) return item;
      const matchesParent = item.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchingSubItems = item.subItems?.filter((sub) =>
        sub.label.toLowerCase().includes(searchQuery.toLowerCase())
      );

      if (matchesParent || (matchingSubItems && matchingSubItems.length > 0)) {
        return {
          ...item,
          subItems: matchingSubItems?.length ? matchingSubItems : item.subItems,
        };
      }
      return null;
    })
    .filter(Boolean) as MenuItem[];

  return (
    <aside
      className={`${
        isCollapsed ? "w-[84px] p-3.5" : "w-[280px] py-4 px-2"
      } h-screen flex flex-col justify-between relative overflow-hidden select-none z-30 shrink-0 font-sans backdrop-blur-xl transition-all duration-300 ease-in-out ${
        isDarkMode
          ? "bg-[#081425] text-[#94A3B8] border-r border-white/[0.06] shadow-[10px_0_40px_rgba(0,0,0,0.4)]"
          : "bg-white text-slate-600 border-r border-slate-200/90 shadow-[10px_0_30px_rgba(0,0,0,0.04)]"
      }`}
    >
      {/* Decorative Subtle Background Glow */}
      {isDarkMode && (
        <>
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* TOP & MIDDLE CONTAINER WITH SCROLL */}
      <div className="flex-1 flex flex-col space-y-4 min-h-0 overflow-y-auto scrollbar-none pr-0.5">
        {/* =================================================== */}
        {/* TOP SECTION: BRAND LOGO                            */}
        {/* =================================================== */}
        {isCollapsed ? (
          <div className="flex items-center justify-center pt-1 pb-1">
            <Image
              src="/images/logo/Clanio.png"
              alt="Clanio Logo"
              width={40}
              height={40}
              priority
              className="h-9 w-9 object-contain rounded-xl shadow-md"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 pt-1 pb-1">
            <div className="shrink-0">
              <Image
                src="/images/logo/Clanio.png"
                alt="Clanio Logo"
                width={140}
                height={40}
                priority
                className="h-10 w-auto object-contain rounded-xl"
              />
            </div>

            <div className="min-w-0">
              <div
                className={`text-lg font-bold tracking-tight flex items-center gap-1.5 leading-none ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                <span>Clanio</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  HR
                </span>
              </div>
              <div className="text-[10px] font-medium tracking-tight flex items-center gap-1 mt-1 leading-none">
                <span className="text-[#2563EB]">Work.</span>
                <span className="text-[#7C3AED]">Manage.</span>
                <span className="text-[#22D3EE]">Grow.</span>
              </div>
            </div>
          </div>
        )}

        {/* =================================================== */}
        {/* WORKSPACE CARD                                      */}
        {/* =================================================== */}
        {isCollapsed ? (
          <div
            title={`${companyName} (Enterprise Plan)`}
            className="w-11 h-11 mx-auto rounded-2xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] p-0.5 flex items-center justify-center relative shrink-0 shadow-md shadow-purple-900/30 group cursor-pointer"
          >
            <div
              className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                isDarkMode ? "bg-[#081425]" : "bg-white"
              }`}
            >
              <Image
                src="/images/icons/teamwork.png"
                alt="Workspace"
                width={22}
                height={22}
                className="w-5.5 h-5.5 object-contain"
              />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#081425] shadow-[0_0_8px_#10B981]" />
          </div>
        ) : (
          <div
            className={`backdrop-blur-md rounded-2xl p-3.5 space-y-2.5 transition-all duration-200 shadow-inner group border ${
              isDarkMode
                ? "bg-white/[0.03] hover:bg-white/[0.05] border-white/[0.08]"
                : "bg-purple-50/70 hover:bg-purple-50 border-purple-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] p-0.5 flex items-center justify-center shrink-0 shadow-md shadow-purple-900/30">
                  <div
                    className={`w-full h-full rounded-[10px] flex items-center justify-center ${
                      isDarkMode ? "bg-[#081425]" : "bg-white"
                    }`}
                  >
                    <Image
                      src="/images/icons/teamwork.png"
                      alt="Workspace"
                      width={20}
                      height={20}
                      className="w-5 h-5 object-contain"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div
                    className={`text-xs font-bold truncate transition-colors ${
                      isDarkMode
                        ? "text-white group-hover:text-cyan-300"
                        : "text-slate-900 group-hover:text-purple-700"
                    }`}
                  >
                    {companyName}
                  </div>
                  <div
                    className={`text-[10px] truncate ${
                      isDarkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    acme.clanio.com
                  </div>
                </div>
              </div>

              <div className="relative flex items-center justify-center shrink-0">
                <span className="absolute w-3 h-3 rounded-full bg-emerald-500/40 animate-ping" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
              </div>
            </div>

            
          </div>
        )}

        {/* =================================================== */}
        {/* SEARCH BOX / SEARCH ICON                            */}
        {/* =================================================== */}
        {isCollapsed ? (
          <div
            title="Search (Ctrl + K)"
            className={`w-11 h-11 mx-auto rounded-2xl border flex items-center justify-center transition-all cursor-pointer ${
              isDarkMode
                ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-slate-400 hover:text-white"
                : "bg-slate-100 hover:bg-slate-200/70 border-slate-200 text-slate-500 hover:text-slate-900"
            }`}
          >
            <Search className="w-4 h-4" />
          </div>
        ) : (
          <div className="relative">
            <Search
              className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                isDarkMode ? "text-slate-400" : "text-slate-400"
              }`}
            />
            <input
              type="text"
              placeholder="Search anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl pl-9 pr-8 py-2 text-xs outline-none transition-all duration-200 ${
                isDarkMode
                  ? "bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.09] border-white/[0.08] focus:border-purple-500/50 text-white placeholder-slate-500"
                  : "bg-slate-100 hover:bg-slate-200/60 focus:bg-white border-slate-200 focus:border-purple-500/60 text-slate-900 placeholder-slate-400"
              }`}
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded bg-white/10"
              >
                ESC
              </button>
            ) : (
              <span
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono border rounded px-1.5 py-0.5 ${
                  isDarkMode
                    ? "text-slate-500 border-white/[0.1] bg-white/[0.03]"
                    : "text-slate-400 border-slate-200 bg-white shadow-2xs"
                }`}
              >
                ⌘K
              </span>
            )}
          </div>
        )}

        {/* =================================================== */}
        {/* NAVIGATION MENU ITEMS                              */}
        {/* =================================================== */}
        <nav className="space-y-1 pt-1">
          {filteredItems.map((item) => {
            const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
            const isOpen = Boolean(openSubmenus[item.id] || searchQuery);
            const isParentActive = activeItem === item.id;
            const isChildActive = item.subItems?.some((sub) => sub.id === activeItem);
            const isActive = isParentActive || isChildActive;

            if (isCollapsed) {
              return (
                <div key={item.id} className="relative flex justify-center py-0.5">
                  <button
                    title={item.label}
                    onClick={() => {
                      if (hasSubItems && item.subItems?.[0]) {
                        handleSelectItem(item.subItems[0].id);
                      } else {
                        handleSelectItem(item.id);
                      }
                    }}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center relative transition-all duration-200 group ${
                      isActive
                        ? "bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white shadow-[0_4px_25px_rgba(124,58,237,0.35)]"
                        : isDarkMode
                        ? "text-[#94A3B8] hover:bg-[#7C3AED]/12 hover:text-white"
                        : "text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                    }`}
                  >
                    <Image
                      src={item.iconPath}
                      alt={item.label}
                      width={20}
                      height={20}
                      className="w-5 h-5 object-contain"
                    />

                    {/* Badge Dot Indicator */}
                    {item.badge && (
                      <span
                        className={`w-2 h-2 rounded-full absolute top-2 right-2 ${getBadgeDotColor(
                          item.badge.variant
                        )}`}
                      />
                    )}
                  </button>
                </div>
              );
            }

            return (
              <div key={item.id} className="space-y-1">
                {/* Parent Menu Row */}
                <button
                  onClick={() => {
                    if (hasSubItems) {
                      toggleSubmenu(item.id);
                    } else {
                      handleSelectItem(item.id);
                    }
                  }}
                  className={`w-full relative flex items-center justify-between px-3 py-2 rounded-2xl text-[18px] font-medium transition-all duration-200 group ${
                    isParentActive && !hasSubItems
                      ? "bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white shadow-[0_4px_25px_rgba(124,58,237,0.35)] font-semibold"
                      : isChildActive
                      ? isDarkMode
                        ? "bg-white/[0.06] text-white font-semibold"
                        : "bg-purple-50/80 text-purple-700 font-semibold"
                      : isDarkMode
                      ? "text-[#94A3B8] hover:bg-[#7C3AED]/12 hover:text-white"
                      : "text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                  }`}
                >
                  {/* Active Indicator Line */}
                  {isParentActive && !hasSubItems && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-cyan-400 shadow-[0_0_10px_#22D3EE]" />
                  )}

                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-xl transition-colors shrink-0 ${
                        isParentActive && !hasSubItems
                          ? "bg-white/20"
                          : isChildActive
                          ? isDarkMode
                            ? "bg-purple-500/20"
                            : "bg-purple-100"
                          : isDarkMode
                          ? "bg-white/[0.04] group-hover:bg-purple-500/20"
                          : "bg-slate-100 group-hover:bg-purple-100"
                      }`}
                    >
                      <Image
                        src={item.iconPath}
                        alt={item.label}
                        width={20}
                        height={20}
                        className="w-4.5 h-4.5 object-contain"
                      />
                    </div>

                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Badge */}
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${getBadgeStyle(
                          item.badge.variant
                        )}`}
                      >
                        {item.badge.text}
                      </span>
                    )}

                    {/* Chevron icon for collapsible parent */}
                    {hasSubItems && (
                      <div
                        className={`transition-transform duration-200 ${
                          isDarkMode
                            ? "text-slate-500 group-hover:text-white"
                            : "text-slate-400 group-hover:text-purple-700"
                        }`}
                      >
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                    )}
                  </div>
                </button>

                {/* Sub-Items List */}
                {hasSubItems && isOpen && (
                  <div
                    className={`pl-6 space-y-1 border-l-2 ml-5 py-1 ${
                      isDarkMode ? "border-white/[0.06]" : "border-slate-200"
                    }`}
                  >
                    {item.subItems?.map((sub) => {
                      const isSubActive = activeItem === sub.id;

                      return (
                        <button
                          key={sub.id}
                          onClick={() => handleSelectItem(sub.id)}
                          className={`w-full relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-md transition-all duration-150 group ${
                            isSubActive
                              ? "bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white font-semibold shadow-md shadow-purple-900/30"
                              : isDarkMode
                              ? "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                              : "text-slate-600 hover:text-purple-700 hover:bg-purple-50/60"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              isSubActive
                                ? "bg-cyan-400 shadow-[0_0_8px_#22D3EE]"
                                : isDarkMode
                                ? "bg-slate-600 group-hover:bg-slate-300"
                                : "bg-slate-300 group-hover:bg-purple-500"
                            }`}
                          />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* =================================================== */}
      {/* BOTTOM SECTION: USER PROFILE CARD                   */}
      {/* =================================================== */}
      <div
        className={`pt-4 border-t space-y-3 shrink-0 ${
          isDarkMode ? "border-white/[0.06]" : "border-slate-200"
        }`}
      >
        {isCollapsed ? (
          <div
            title="Rahul Sharma (HR Administrator)"
            className="w-10 h-10 mx-auto rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-cyan-400 p-0.5 relative cursor-pointer shadow-md"
          >
            <div
              className={`w-full h-full rounded-full flex items-center justify-center font-bold text-xs ${
                isDarkMode ? "bg-[#081425] text-white" : "bg-white text-slate-900"
              }`}
            >
              RS
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#081425]" />
          </div>
        ) : (
          <div
            className={`backdrop-blur-md rounded-2xl p-3 flex items-center justify-between gap-2 border ${
              isDarkMode
                ? "bg-white/[0.03] border-white/[0.08]"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-cyan-400 p-0.5 shadow-md">
                  <div
                    className={`w-full h-full rounded-full flex items-center justify-center font-bold text-xs ${
                      isDarkMode ? "bg-[#081425] text-white" : "bg-white text-slate-900"
                    }`}
                  >
                    {initials}
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>

              <div className="min-w-0">
                <div
                  className={`text-xs font-bold truncate ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {userName}
                </div>
                <div
                  className={`text-[10px] truncate ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {userRole}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleSelectItem("admin-settings")}
                className={`p-1.5 rounded-xl transition-colors ${
                  isDarkMode
                    ? "bg-white/[0.04] hover:bg-white/10 text-slate-400 hover:text-white"
                    : "bg-white hover:bg-slate-200/60 border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs"
                }`}
                title="Settings"
              >
                <Image
                  src="/images/icons/administration.png"
                  alt="Settings"
                  width={16}
                  height={16}
                  className="w-4 h-4 object-contain"
                />
              </button>
              <Link
                href="/login"
                className={`p-1.5 rounded-xl transition-colors ${
                  isDarkMode
                    ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                    : "bg-red-50 hover:bg-red-100 border border-red-100 text-red-600"
                }`}
                title="Logout"
              >
                <Image
                  src="/images/icons/out.png"
                  alt="Logout"
                  width={16}
                  height={16}
                  className="w-4 h-4 object-contain"
                />
              </Link>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
