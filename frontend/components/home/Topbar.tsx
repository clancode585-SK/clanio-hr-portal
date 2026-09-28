"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  PanelLeft,
  Search,
  Plus,
  Sun,
  Moon,
  Globe,
  ChevronDown,
  UserPlus,
  CalendarOff,
  CheckSquare,
  Wallet,
  Megaphone,
  CheckCircle2,
  UserCheck,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { SidebarSimple, List } from "@phosphor-icons/react";
import { getFlatSidebarOptions } from "./Sidebar";
import { extractList, fetchApi } from "@/lib/api";
import { removeCookie } from "@/lib/cookies";

interface TopbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onSelectItem?: (id: string) => void;
  viewMode?: "admin" | "employee";
  onToggleViewMode?: (mode: "admin" | "employee") => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onToggleSidebar,
  isSidebarOpen = true,
  isDarkMode: externalIsDarkMode,
  onToggleTheme,
  onSelectItem,
  viewMode: externalViewMode,
  onToggleViewMode,
}) => {
  const [internalIsDarkMode, setInternalIsDarkMode] = useState(true);
  const [internalViewMode, setInternalViewMode] = useState<"admin" | "employee">("admin");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMode = localStorage.getItem("view_mode") as "admin" | "employee";
      if (storedMode === "admin" || storedMode === "employee") {
        setInternalViewMode(storedMode);
      }
    }
  }, []);

  const currentViewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;

  const handleToggleMode = (mode: "admin" | "employee") => {
    if (typeof window !== "undefined") {
      localStorage.setItem("view_mode", mode);
    }
    if (onToggleViewMode) {
      onToggleViewMode(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  // Sync external vs internal theme state
  const isDarkMode =
    externalIsDarkMode !== undefined ? externalIsDarkMode : internalIsDarkMode;

  const handleToggleTheme = (mode: boolean) => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      setInternalIsDarkMode(mode);
    }
  };

  const [activeDropdown, setActiveDropdown] = useState<
    "create" | "notifications" | "messages" | "lang" | "profile" | null
  >(null);
  const [selectedLang, setSelectedLang] = useState("English");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [userName, setUserName] = useState("Platform Super Admin");
  const [userEmail, setUserEmail] = useState("superadmin@clanio.com");
  const [userRole, setUserRole] = useState("Super Administrator");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  // Live Notification States
  const [liveUnreadCount, setLiveUnreadCount] = useState<number>(0);
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);

  // Change Password Modal States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    new_password_confirmation: "",
  });
  const [passwordNotify, setPasswordNotify] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const fetchUserProfile = async () => {
    try {
      // Backend me /auth/me nahi hai, profile yahan se aata hai
      const res = await fetchApi<any>("/profile");
      const data = res?.data ?? res;
      if (data && data.name) {
        setUserName(data.name);
        setUserEmail(data.email || "");
        setUserRole(data.roles?.[0]?.name || data.role || "Administrator");
        if (data.avatar_url) setUserAvatarUrl(data.avatar_url);
      }
    } catch {
      // ignore
    }
  };

  const fetchLiveNotifications = async () => {
    try {
      // Ginti summary se, list alag endpoint se — dono envelope me aate hain
      const [summary, list] = await Promise.all([
        fetchApi<any>("/notifications/unread-count"),
        fetchApi<any>("/notifications?per_page=10"),
      ]);

      setLiveUnreadCount(summary?.data?.unread_count ?? 0);
      setLiveNotifications(extractList(list));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchLiveNotifications();
    const interval = setInterval(fetchLiveNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetchApi("/notifications/read-all", { method: "PUT" });
      setLiveUnreadCount(0);
      setLiveNotifications([]);
    } catch {
      // ignore
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.new_password_confirmation) {
      setPasswordNotify({ msg: "New password and confirmation do not match!", type: "error" });
      return;
    }

    setSubmittingPassword(true);
    setPasswordNotify(null);
    try {
      await fetchApi("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(passwordForm),
      });
      setPasswordNotify({ msg: "Password changed successfully!", type: "success" });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordForm({ current_password: "", new_password: "", new_password_confirmation: "" });
        setPasswordNotify(null);
      }, 1500);
    } catch (err: any) {
      setPasswordNotify({ msg: err.message || "Failed to change password", type: "error" });
    } finally {
      setSubmittingPassword(false);
    }
  };

  const initials = userName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "SA";

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const allSidebarOptions = getFlatSidebarOptions();

  const filteredSidebarOptions = allSidebarOptions.filter((option) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      option.label.toLowerCase().includes(q) ||
      (option.category && option.category.toLowerCase().includes(q))
    );
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleDropdown = (
    name: "create" | "notifications" | "messages" | "lang" | "profile"
  ) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
  ];

  const notifications = [
    {
      id: 1,
      title: "Leave Request Approved",
      desc: "Your annual leave request for 28-30 Jul was approved.",
      time: "10m ago",
      icon: CheckCircle2,
      color: "text-emerald-400 bg-emerald-500/15",
      unread: true,
    },
    {
      id: 2,
      title: "Interview Scheduled",
      desc: "Technical interview with Priya Sharma scheduled for 3:00 PM.",
      time: "1h ago",
      icon: UserCheck,
      color: "text-blue-400 bg-blue-500/15",
      unread: true,
    },
    {
      id: 3,
      title: "July Payroll Processed",
      desc: "Salary disbursements for 142 employees completed.",
      time: "3h ago",
      icon: Wallet,
      color: "text-amber-400 bg-amber-500/15",
      unread: false,
    },
    {
      id: 4,
      title: "New Employee Joined",
      desc: "Vikram Mehta joined the Engineering team as Lead Dev.",
      time: "5h ago",
      icon: UserPlus,
      color: "text-purple-400 bg-purple-500/15",
      unread: false,
    },
  ];

  return (
    <header
      className={`sticky top-0 z-30 shrink-0 w-full h-[64px] sm:h-[76px] backdrop-blur-md pl-1 sm:pl-2 md:pl-3 pr-3 sm:pr-6 md:pr-8 flex items-center justify-between font-sans select-none transition-colors duration-300 ${isDarkMode
          ? "bg-[#081425] text-white border-b border-white/[0.06] shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)]"
          : "bg-[#EEF5FF]/95 text-slate-900 border-b border-blue-200/70 shadow-[0_4px_20px_-2px_rgba(37,99,235,0.04)]"
        }`}
    >
      {/* =================================================== */}
      {/* LEFT SECTION                                        */}
      {/* =================================================== */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {/* Sidebar Collapse Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 flex items-center justify-center transition-all duration-200 group active:scale-90 shrink-0 bg-transparent border-none outline-none"
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {/* Mobile Hamburger Icon */}
          <List
            size={28}
            weight="duotone"
            className={`block md:hidden transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isDarkMode ? "text-blue-400 group-hover:text-blue-300" : "text-blue-600 group-hover:text-blue-700"
            } ${isSidebarOpen ? "rotate-90 text-indigo-400" : "rotate-0"}`}
          />
          {/* Desktop Sidebar Collapse Icon */}
          <SidebarSimple
            size={28}
            weight="duotone"
            className={`hidden md:block transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isDarkMode ? "text-blue-400 group-hover:text-blue-300" : "text-blue-600 group-hover:text-blue-700"
            } ${!isSidebarOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Mobile Brand Title */}
        <div className="flex xl:hidden items-center gap-2 min-w-0">
          <Image
            src="/images/logo/Clanio.png"
            alt="Clanio Logo"
            width={28}
            height={28}
            className="w-7 h-7 object-contain rounded-lg shrink-0"
          />
          <span className={`font-black text-sm sm:text-base tracking-tight truncate ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            Clanio <span className="text-blue-600">HR</span>
          </span>
        </div>
      </div>

      {/* =================================================== */}
      {/* CENTER SECTION: GLOBAL SEARCH BAR                   */}
      {/* =================================================== */}
      <div className="hidden xl:flex items-center justify-center flex-1 max-w-[360px] mx-6">
        <div className="w-full relative group" ref={searchContainerRef}>
          <div
            className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? "text-slate-400 group-focus-within:text-cyan-300" : "text-blue-500/70 group-focus-within:text-blue-600"
              }`}
          >
            <Search className="w-4 h-4" />
          </div>

          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search employees, payroll, attendance, documents..."
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onClick={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            className={`w-full pl-10 pr-20 py-2.5 rounded-full text-xs placeholder-slate-400 outline-none transition-all duration-200 ${isDarkMode
                ? "bg-white/[0.04] hover:bg-white/[0.07] focus:bg-[#081425] border border-white/[0.08] focus:border-purple-500/60 text-white focus:ring-4 focus:ring-purple-500/20"
                : "bg-white/90 hover:bg-white focus:bg-white border border-blue-200/80 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-2xs"
              }`}
          />

          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
            <span
              className={`text-[10px] font-mono font-semibold rounded-md px-1.5 py-0.5 ${isDarkMode
                  ? "bg-white/[0.06] border border-white/10 text-slate-400"
                  : "bg-blue-50/80 border border-blue-200/60 text-blue-600 shadow-2xs"
                }`}
            >
              Ctrl + K
            </span>
          </div>

          {/* SEARCH SUGGESTIONS DROPDOWN (SIDEBAR OPTIONS) */}
          {isSearchOpen && (
            <div
              className={`absolute left-0 right-0 mt-2 rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 border max-h-96 overflow-y-auto scrollbar-none shadow-2xl ${isDarkMode
                  ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-black/60"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-slate-900/10"
                }`}
            >
              <div
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between border-b ${isDarkMode ? "border-white/[0.08] text-slate-400" : "border-slate-100 text-slate-400"
                  }`}
              >
                <span>Sidebar Navigation Options</span>
                <span className="text-[10px] font-normal lowercase font-mono">
                  {filteredSidebarOptions.length} results
                </span>
              </div>

              <div className="py-1 space-y-0.5">
                {filteredSidebarOptions.length > 0 ? (
                  filteredSidebarOptions.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (onSelectItem) {
                          onSelectItem(item.id);
                        }
                        setIsSearchOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left group ${isDarkMode
                          ? "text-slate-200 hover:bg-white/[0.06] hover:text-white"
                          : "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 transition-colors ${isDarkMode ? "bg-white/[0.06] group-hover:bg-purple-500/20" : "bg-slate-100 group-hover:bg-purple-100"
                            }`}
                        >
                          <Image
                            src={item.iconPath}
                            alt={item.label}
                            width={16}
                            height={16}
                            className="w-4 h-4 object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold leading-tight truncate">{item.label}</div>
                          {item.category && (
                            <div className="text-[10px] text-slate-400 font-normal truncate">
                              {item.category}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[10px] font-mono text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity pl-2 shrink-0">
                        Jump to →
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">
                    No matching sidebar options found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =================================================== */}
      {/* RIGHT SECTION: CONTROLS & PROFILE                  */}
      {/* =================================================== */}
      <div
        className="flex items-center gap-2 sm:gap-3 shrink-0"
        ref={dropdownRef}
      >
        {/* 1. QUICK CREATE BUTTON */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown("create")}
            className="h-10 px-3.5 sm:px-4 rounded-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:from-blue-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 hover:shadow-purple-500/35 transition-all duration-200 active:scale-95 flex items-center gap-2 group"
          >
            <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
              <Plus className="w-3 h-3 text-white" />
            </div>
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className="w-3 h-3 text-white/80" />
          </button>

          {/* Quick Create Dropdown */}
          {activeDropdown === "create" && (
            <div
              className={`absolute right-0 mt-2 w-56 rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 border ${isDarkMode
                  ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-2xl shadow-black/60"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-xl shadow-slate-900/10"
                }`}
            >
              <div
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-400"
                  }`}
              >
                Quick Actions
              </div>
              <div className="space-y-0.5">
                {[
                  { label: "New Employee", iconPath: "/images/icons/teamwork.png", desc: "Add team member", target: "employees" },
                  { label: "Leave Request", iconPath: "/images/icons/calendar.png", desc: "Apply for leave", target: "leave-requests" },
                  { label: "New Task", iconPath: "/images/icons/task.png", desc: "Assign team task", target: "my-tasks" },
                  { label: "Expense Claim", iconPath: "/images/icons/wages.png", desc: "Submit expense claim", target: "expense-claims" },
                  { label: "Announcement", iconPath: "/images/icons/chat-bubbles.png", desc: "Post company update", target: "announcements" },
                  { label: "Performance Goal", iconPath: "/images/icons/trophy.png", desc: "Set KRA or OKR", target: "performance-goals" },
                  { label: "Support Ticket", iconPath: "/images/icons/help.png", desc: "Raise helpdesk ticket", target: "tickets" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveDropdown(null);
                      if (onSelectItem) onSelectItem(item.target);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left group cursor-pointer ${isDarkMode
                        ? "text-slate-200 hover:bg-white/[0.06] hover:text-white"
                        : "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                      }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg transition-colors ${isDarkMode
                          ? "bg-white/[0.06] group-hover:bg-purple-500/20"
                          : "bg-slate-100 group-hover:bg-purple-100"
                        }`}
                    >
                      <Image
                        src={item.iconPath}
                        alt={item.label}
                        width={16}
                        height={16}
                        className="w-4 h-4 object-contain"
                      />
                    </div>
                    <div>
                      <div className="font-bold leading-tight">{item.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>





        {/* 4. NOTIFICATIONS */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown("notifications")}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all relative active:scale-95 ${isDarkMode
                ? "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
                : "bg-white/90 hover:bg-white border border-blue-200/80 shadow-2xs text-slate-700 hover:text-blue-600"
              }`}
            title="Notifications"
          >
            <Image
              src="/images/icons/notification-bell.png"
              alt="Notifications"
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
            />
            {liveUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-purple-600 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-[#081425] shadow-xs font-mono">
                {liveUnreadCount > 99 ? "99+" : liveUnreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {activeDropdown === "notifications" && (
            <div
              className={`absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-24px)] rounded-2xl p-3 sm:p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 border ${isDarkMode
                  ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-2xl shadow-black/60"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-xl shadow-slate-900/10"
                }`}
            >
              <div
                className={`flex items-center justify-between pb-3 border-b ${isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">Recent Notifications</span>
                  {liveUnreadCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {liveUnreadCount} New
                    </span>
                  )}
                </div>
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-purple-400 hover:underline font-semibold cursor-pointer"
                >
                  Mark all as read
                </button>
              </div>

              <div className="py-2 space-y-2 max-h-80 overflow-y-auto scrollbar-none">
                {(liveNotifications.length > 0 ? liveNotifications : notifications).slice(0, 5).map((item: any, idx: number) => {
                  const title = item.title || item.name || "Notification";
                  const body = item.body || item.desc || "";
                  const isUnread = !item.read_at && item.unread !== false;

                  return (
                    <div
                      key={item.id || idx}
                      onClick={() => {
                        if (item.id) {
                          fetchApi(`/notifications/${item.id}/read`, { method: "PUT" }).catch(() => {});
                        }
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${isDarkMode
                          ? isUnread
                            ? "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06]"
                          : isUnread
                            ? "bg-purple-50/40 border-purple-100 hover:bg-purple-50/80"
                            : "bg-white border-slate-100 hover:bg-slate-50"
                        }`}
                    >
                      <div className="p-2 rounded-xl shrink-0 mt-0.5 text-purple-400 bg-purple-500/15">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-xs font-bold truncate ${isDarkMode ? "text-white" : "text-slate-900"
                              }`}
                          >
                            {title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (item.time || "Now")}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                          {body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className={`pt-2 border-t text-center ${isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                  }`}
              >
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    if (onSelectItem) onSelectItem("notifications");
                  }}
                  className="text-xs font-bold text-purple-400 hover:underline cursor-pointer"
                >
                  View All Notifications →
                </button>
              </div>
            </div>
          )}
        </div>



        {/* 9. USER PROFILE */}
        <div
          className={`relative pl-1 border-l ${isDarkMode ? "border-white/[0.08]" : "border-slate-200/80"
            }`}
        >
          <button
            onClick={() => toggleDropdown("profile")}
            className="flex items-center p-0.5 rounded-full transition-all active:scale-95 group"
            title={`${userName} (${userRole})`}
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-400 p-0.5 shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform overflow-hidden flex items-center justify-center">
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#081425] flex items-center justify-center text-white font-bold text-xs">
                    {initials}
                  </div>
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#081425] shadow-xs" />
            </div>
          </button>

          {/* Profile Dropdown */}
          {activeDropdown === "profile" && (
            <div
              className={`absolute right-0 mt-2 w-60 sm:w-64 max-w-[calc(100vw-24px)] rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 border ${isDarkMode
                  ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-2xl shadow-black/60"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-xl shadow-slate-900/10"
                }`}
            >
              <div
                className={`px-3 py-2 border-b mb-1 ${isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                  }`}
              >
                <div className="font-bold text-xs truncate">{userName}</div>
                <div className="text-[10px] text-slate-400 truncate">{userEmail}</div>
                <div className="text-[9px] font-extrabold uppercase mt-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 inline-block font-mono">
                  {userRole}
                </div>
              </div>

              <div className="space-y-0.5 text-xs font-medium">
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    if (onSelectItem) onSelectItem("profile");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                    isDarkMode
                      ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      : "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                  }`}
                >
                  <Image
                    src="/images/icons/authentication.png"
                    alt="My Profile"
                    width={16}
                    height={16}
                    className="w-4 h-4 object-contain"
                  />
                  <span>My Profile & Account</span>
                </button>

                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    setShowPasswordModal(true);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                    isDarkMode
                      ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      : "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Security & Password</span>
                </button>

                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    if (onSelectItem) onSelectItem("company-settings");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                    isDarkMode
                      ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      : "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                  }`}
                >
                  <Image
                    src="/images/icons/administration.png"
                    alt="Company Settings"
                    width={16}
                    height={16}
                    className="w-4 h-4 object-contain"
                  />
                  <span>Company Settings</span>
                </button>

                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    if (onSelectItem) onSelectItem("company-policies");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                    isDarkMode
                      ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      : "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                  }`}
                >
                  <Image
                    src="/images/icons/help.png"
                    alt="Help & Policies"
                    width={16}
                    height={16}
                    className="w-4 h-4 object-contain"
                  />
                  <span>Company Policies & Help</span>
                </button>

                {/* Theme Toggle */}
                <div
                  className={`py-2 px-3 border-t mt-1 flex items-center justify-between ${
                    isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                  }`}
                >
                  <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>Theme</span>
                  <div
                    className={`p-1 rounded-full flex items-center gap-0.5 border shadow-inner ${
                      isDarkMode
                        ? "bg-white/[0.06] border-white/[0.08]"
                        : "bg-slate-100 border-slate-200/80"
                    }`}
                  >
                    <button
                      onClick={() => handleToggleTheme(false)}
                      className={`p-1.5 rounded-full transition-all duration-200 ${
                        !isDarkMode
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Light Mode"
                    >
                      <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleTheme(true)}
                      className={`p-1.5 rounded-full transition-all duration-200 ${
                        isDarkMode
                          ? "bg-[#081425] text-purple-400 shadow-sm"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                      title="Dark Mode"
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Language Switcher */}
                <div
                  className={`py-2 px-3 border-t flex flex-col gap-1.5 ${
                    isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className={`flex items-center gap-1.5 ${isDarkMode ? "text-[#CBD5E1]" : "text-slate-700"}`}>
                      <Globe className="w-3.5 h-3.5 text-blue-500/70" /> Language
                    </span>
                    <span className="font-bold text-xs text-indigo-500">{selectedLang}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLang(lang.name)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold text-center transition-colors ${
                          selectedLang === lang.name
                            ? isDarkMode
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold"
                            : isDarkMode
                            ? "text-slate-300 hover:bg-white/[0.06]"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`pt-1 border-t mt-1 ${isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                    }`}
                >
                  <button
                    onClick={async () => {
                      try {
                        await fetchApi("/auth/logout", { method: "POST" });
                      } catch {
                        // ignore API failure and proceed with local signout
                      }
                      removeCookie("token");
                      removeCookie("isAuthenticated");
                      if (typeof window !== "undefined") {
                        localStorage.removeItem("token");
                        localStorage.removeItem("isAuthenticated");
                      }
                      setActiveDropdown(null);
                      window.location.href = "/login";
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                  >
                    <Image
                      src="/images/icons/out.png"
                      alt="Logout"
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                    />
                    <span className="font-bold">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-sans">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkMode ? "bg-[#0B1A30] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/20">
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <span>Security & Password</span>
              </h2>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordNotify && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold ${
                  passwordNotify.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                {passwordNotify.msg}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-400">Current Password *</label>
                <input
                  type="password"
                  required
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">New Password *</label>
                <input
                  type="password"
                  required
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-400">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  value={passwordForm.new_password_confirmation}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirmation: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-lg shadow-purple-500/25 cursor-pointer"
                >
                  {submittingPassword ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

export default Topbar;