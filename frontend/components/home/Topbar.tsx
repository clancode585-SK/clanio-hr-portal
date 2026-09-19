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
} from "lucide-react";

interface TopbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onToggleSidebar,
  isSidebarOpen = true,
  isDarkMode: externalIsDarkMode,
  onToggleTheme,
}) => {
  const [internalIsDarkMode, setInternalIsDarkMode] = useState(true);

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

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      className={`w-full h-[76px] backdrop-blur-md px-6 sm:px-8 flex items-center justify-between z-20 relative font-sans select-none transition-colors duration-300 ${
        isDarkMode
          ? "bg-[#081425] text-white border-b border-white/[0.06] shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)]"
          : "bg-white/95 text-slate-900 border-b border-slate-900/[0.06] shadow-[0_10px_30px_-5px_rgba(15,23,42,0.05)]"
      }`}
    >
      {/* =================================================== */}
      {/* LEFT SECTION                                        */}
      {/* =================================================== */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Sidebar Collapse Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shadow-2xs active:scale-95 shrink-0 ${
            isDarkMode
              ? "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white"
              : "bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/60 text-slate-600 hover:text-slate-900"
          }`}
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>

      {/* =================================================== */}
      {/* CENTER SECTION: LARGE GLOBAL SEARCH BAR             */}
      {/* =================================================== */}
      <div className="hidden xl:flex items-center justify-center flex-1 max-w-[520px] mx-6">
        <div className="w-full relative group">
          <div
            className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
              isDarkMode ? "text-slate-400 group-focus-within:text-cyan-300" : "text-slate-400 group-focus-within:text-purple-600"
            }`}
          >
            <Search className="w-4 h-4" />
          </div>

          <input
            type="text"
            placeholder="Search employees, payroll, attendance, documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-20 py-2.5 rounded-full text-xs placeholder-slate-400 outline-none transition-all duration-200 ${
              isDarkMode
                ? "bg-white/[0.04] hover:bg-white/[0.07] focus:bg-[#081425] border border-white/[0.08] focus:border-purple-500/60 text-white focus:ring-4 focus:ring-purple-500/20"
                : "bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 text-slate-900 focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/10 shadow-sm"
            }`}
          />

          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
            <span
              className={`text-[10px] font-mono font-semibold rounded-md px-1.5 py-0.5 ${
                isDarkMode
                  ? "bg-white/[0.06] border border-white/10 text-slate-400"
                  : "bg-white border border-slate-200 text-slate-400 shadow-2xs"
              }`}
            >
              Ctrl + K
            </span>
          </div>
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
              className={`absolute right-0 mt-2 w-56 rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 border ${
                isDarkMode
                  ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-2xl shadow-black/60"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-xl shadow-slate-900/10"
              }`}
            >
              <div
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  isDarkMode ? "text-slate-400" : "text-slate-400"
                }`}
              >
                Quick Actions
              </div>
              <div className="space-y-0.5">
                {[
                  { label: "New Employee", iconPath: "/images/icons/teamwork.png", desc: "Add team member" },
                  { label: "Leave Request", iconPath: "/images/icons/calendar.png", desc: "Apply for leave" },
                  { label: "Task", iconPath: "/images/icons/task.png", desc: "Assign new task" },
                  { label: "Payroll", iconPath: "/images/icons/wages.png", desc: "Run payroll cycle" },
                  { label: "Announcement", iconPath: "/images/icons/chat-bubbles.png", desc: "Post company update" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveDropdown(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left group ${
                      isDarkMode
                        ? "text-slate-200 hover:bg-white/[0.06] hover:text-white"
                        : "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDarkMode
                          ? "bg-white/[0.06]"
                          : "bg-slate-100"
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

        {/* 2. CALENDAR */}
        <button
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            isDarkMode
              ? "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
              : "bg-slate-50 hover:bg-slate-100 border border-slate-200/70 shadow-2xs"
          }`}
          title="View Calendar"
        >
          <Image
            src="/images/icons/calendar.png"
            alt="Calendar"
            width={20}
            height={20}
            className="w-5 h-5 object-contain"
          />
        </button>

        {/* 3. MESSAGES */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown("messages")}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all relative active:scale-95 ${
              isDarkMode
                ? "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
                : "bg-slate-50 hover:bg-slate-100 border border-slate-200/70 shadow-2xs"
            }`}
            title="Messages"
          >
            <Image
              src="/images/icons/messages.png"
              alt="Messages"
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
            />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-[#081425] shadow-xs">
              5
            </span>
          </button>

          {/* Messages Dropdown */}
          {activeDropdown === "messages" && (
            <div
              className={`absolute right-0 mt-2 w-72 rounded-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 border ${
                isDarkMode
                  ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-2xl shadow-black/60"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-xl shadow-slate-900/10"
              }`}
            >
              <div
                className={`flex items-center justify-between pb-2 border-b ${
                  isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                }`}
              >
                <span className="text-xs font-bold">Messages</span>
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/20">
                  5 Unread
                </span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                {[
                  { name: "Ananya Roy", text: "Please review the Q3 HR report draft.", time: "5m ago" },
                  { name: "Karan Verma", text: "Approved your leave request for Friday.", time: "25m ago" },
                  { name: "Priya Sharma", text: "Sent you candidate resumes for review.", time: "2h ago" },
                ].map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl cursor-pointer transition-colors space-y-0.5 ${
                      isDarkMode
                        ? "hover:bg-white/[0.06]"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between font-bold text-xs">
                      <span className={isDarkMode ? "text-white" : "text-slate-900"}>
                        {msg.name}
                      </span>
                      <span className="text-[10px] font-normal text-slate-400">{msg.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. NOTIFICATIONS */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown("notifications")}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all relative active:scale-95 ${
              isDarkMode
                ? "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
                : "bg-slate-50 hover:bg-slate-100 border border-slate-200/70 shadow-2xs"
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
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-[#081425] shadow-xs">
              12
            </span>
          </button>

          {/* Notifications Dropdown */}
          {activeDropdown === "notifications" && (
            <div
              className={`absolute right-0 mt-2 w-80 rounded-2xl p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 border ${
                isDarkMode
                  ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-2xl shadow-black/60"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-xl shadow-slate-900/10"
              }`}
            >
              <div
                className={`flex items-center justify-between pb-3 border-b ${
                  isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">Recent Notifications</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    12 New
                  </span>
                </div>
                <button className="text-[10px] text-purple-400 hover:underline font-semibold">
                  Mark all as read
                </button>
              </div>

              <div className="py-2 space-y-2 max-h-80 overflow-y-auto scrollbar-none">
                {notifications.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isDarkMode
                          ? item.unread
                            ? "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06]"
                          : item.unread
                          ? "bg-purple-50/40 border-purple-100 hover:bg-purple-50/80"
                          : "bg-white border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${item.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-xs font-bold truncate ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {item.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className={`pt-2 border-t text-center ${
                  isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                }`}
              >
                <button className="text-xs font-bold text-purple-400 hover:underline">
                  View All Notifications →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5. THEME TOGGLE (ANIMATED PILL) */}
        <div
          className={`p-1 rounded-full flex items-center gap-0.5 border shadow-inner ${
            isDarkMode
              ? "bg-white/[0.06] border-white/[0.08]"
              : "bg-slate-100/90 border-slate-200/60"
          }`}
        >
          <button
            onClick={() => handleToggleTheme(false)}
            className={`p-1.5 rounded-full transition-all duration-200 ${
              !isDarkMode
                ? "bg-white text-slate-800 shadow-sm"
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

        {/* 6. LANGUAGE SELECTOR */}
        <div className="relative hidden md:block">
          <button
            onClick={() => toggleDropdown("lang")}
            className={`h-9 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
              isDarkMode
                ? "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200"
                : "bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-700 shadow-2xs"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{selectedLang}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {activeDropdown === "lang" && (
            <div
              className={`absolute right-0 mt-2 w-36 rounded-2xl p-1 z-50 border ${
                isDarkMode
                  ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-2xl shadow-black/60"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-xl"
              }`}
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setSelectedLang(lang.name);
                    setActiveDropdown(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    selectedLang === lang.name
                      ? isDarkMode
                        ? "bg-purple-500/20 text-purple-300 font-bold"
                        : "bg-purple-50 text-purple-600 font-bold"
                      : isDarkMode
                      ? "text-slate-300 hover:bg-white/[0.06]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 7. HELP CENTER */}
        <button
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all hidden sm:flex active:scale-95 ${
            isDarkMode
              ? "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
              : "bg-slate-50 hover:bg-slate-100 border border-slate-200/70 shadow-2xs"
          }`}
          title="Help Center"
        >
          <Image
            src="/images/icons/help.png"
            alt="Help"
            width={20}
            height={20}
            className="w-5 h-5 object-contain"
          />
        </button>

        {/* 8. SETTINGS */}
        <button
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all hidden lg:flex active:scale-95 ${
            isDarkMode
              ? "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
              : "bg-slate-50 hover:bg-slate-100 border border-slate-200/70 shadow-2xs"
          }`}
          title="Settings"
        >
          <Image
            src="/images/icons/administration.png"
            alt="Settings"
            width={20}
            height={20}
            className="w-5 h-5 object-contain"
          />
        </button>

        {/* 9. USER PROFILE */}
        <div
          className={`relative pl-1 border-l ${
            isDarkMode ? "border-white/[0.08]" : "border-slate-200/80"
          }`}
        >
          <button
            onClick={() => toggleDropdown("profile")}
            className="flex items-center p-0.5 rounded-full transition-all active:scale-95 group"
            title="Rahul Sharma (HR Administrator)"
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-400 p-0.5 shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-full bg-[#081425] flex items-center justify-center text-white font-bold text-xs">
                  RS
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#081425] shadow-xs" />
            </div>
          </button>

          {/* Profile Dropdown */}
          {activeDropdown === "profile" && (
            <div
              className={`absolute right-0 mt-2 w-60 rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 border ${
                isDarkMode
                  ? "bg-[#0B1A30] border-white/[0.1] text-white shadow-2xl shadow-black/60"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-xl shadow-slate-900/10"
              }`}
            >
              <div
                className={`px-3 py-2 border-b mb-1 ${
                  isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                }`}
              >
                <div className="font-bold text-xs">Rahul Sharma</div>
                <div className="text-[10px] text-slate-400">rahul.sharma@acme.com</div>
              </div>

              <div className="space-y-0.5 text-xs font-medium">
                {[
                  { label: "My Account", iconPath: "/images/icons/authentication.png" },
                  { label: "Workspace Settings", iconPath: "/images/icons/teamwork.png" },
                  { label: "Preferences", iconPath: "/images/icons/administration.png" },
                  { label: "Security", iconPath: "/images/icons/authentication.png" },
                  { label: "Billing", iconPath: "/images/icons/wages.png" },
                  { label: "Help", iconPath: "/images/icons/help.png" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveDropdown(null)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                      isDarkMode
                        ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                        : "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                    }`}
                  >
                    <Image
                      src={item.iconPath}
                      alt={item.label}
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                    />
                    <span>{item.label}</span>
                  </button>
                ))}

                <div
                  className={`pt-1 border-t mt-1 ${
                    isDarkMode ? "border-white/[0.08]" : "border-slate-100"
                  }`}
                >
                  <Link
                    href="/login"
                    onClick={() => setActiveDropdown(null)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Image
                      src="/images/icons/out.png"
                      alt="Logout"
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                    />
                    <span className="font-bold">Logout</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;