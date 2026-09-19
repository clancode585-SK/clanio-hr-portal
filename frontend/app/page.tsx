"use client";

import React, { useState } from "react";
import Sidebar from "@/components/home/Sidebar";
import Topbar from "@/components/home/Topbar";

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);

  return (
    <div className="flex min-h-screen bg-[#071326] text-white font-sans antialiased selection:bg-purple-500/30 selection:text-purple-200 overflow-hidden">
      {/* Left Sidebar Component */}
      <Sidebar isCollapsed={!isSidebarOpen} isDarkMode={isDarkMode} />

      {/* Main Layout Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-colors duration-300 ${
          isDarkMode ? "bg-[#071326]" : "bg-slate-100"
        }`}
      >
        {/* Top Navigation Bar Component */}
        <Topbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />

        {/* Dashboard Main Workspace Area */}
        <main
          className={`flex-1 p-6 sm:p-8 overflow-y-auto relative transition-colors duration-300 ${
            isDarkMode ? "bg-[#071326] text-white" : "bg-slate-50 text-slate-900"
          }`}
        >
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Main Content Header Section */}
            <div className="space-y-1.5 pb-1">
              <div className="flex items-center gap-3">
                <h1
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-none ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  Dashboard
                </h1>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                    isDarkMode
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                      : "bg-purple-100 text-purple-700 border-purple-200"
                  }`}
                >
                  Overview
                </span>
              </div>

              <div
                className={`text-xs sm:text-sm font-medium flex flex-wrap items-center gap-2 pt-0.5 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <span>
                  Welcome back,{" "}
                  <strong
                    className={isDarkMode ? "text-slate-200" : "text-slate-800"}
                  >
                    Rahul 👋
                  </strong>
                </span>
                <span className={isDarkMode ? "text-slate-600" : "text-slate-300"}>
                  •
                </span>
                <span>Tuesday, 24 June 2026</span>
                <span className={isDarkMode ? "text-slate-600" : "text-slate-300"}>
                  •
                </span>
                <span
                  className={`font-semibold ${
                    isDarkMode ? "text-cyan-300" : "text-purple-600"
                  }`}
                >
                  Acme Technologies Pvt Ltd
                </span>
              </div>
            </div>

            {/* Demo Header Card */}
            <div
              className={`p-8 rounded-3xl border backdrop-blur-xl transition-all duration-300 flex flex-col md:flex-row items-center justify-between gap-6 ${
                isDarkMode
                  ? "bg-white/[0.03] border-white/[0.08] text-white shadow-2xl"
                  : "bg-white border-slate-200/80 text-slate-900 shadow-sm"
              }`}
            >
              <div className="space-y-2">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${
                    isDarkMode
                      ? "bg-purple-500/20 border-purple-500/30 text-purple-300"
                      : "bg-purple-100 border-purple-200 text-purple-700"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  Main Content Header Moved
                </div>
                <h2
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  Clanio HR Portal Workspace
                </h2>
                <p
                  className={`text-sm max-w-xl ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  The page title, greeting badge, current date, and organization details are now rendered at the top of the main dashboard content area, keeping the top navigation bar ultra clean and minimal.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a
                  href="/login"
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold transition-all shadow-md hover:shadow-purple-500/25"
                >
                  View Login Page →
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
