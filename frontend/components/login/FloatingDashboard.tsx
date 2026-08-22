"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Users,
  CalendarCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  Bell,
  Search,
  Plus,
  Briefcase,
  Award,
  ChevronRight,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";

export const FloatingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "attendance">("overview");

  return (
    <div className="relative w-full py-2 perspective-container flex flex-col items-center justify-center">
      {/* Background Ambient Glows & Geometric accents */}
      <div className="absolute -top-12 -left-12 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute top-1/2 -right-8 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "2s" }} />
      <div className="absolute -bottom-10 left-1/3 w-60 h-60 bg-cyan-400/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "4s" }} />

      {/* Floating 3D Dashboard Main Container */}
      <div className="relative z-10 w-full max-w-xl dashboard-3d-card rounded-2xl bg-slate-950/90 text-white border border-slate-800/80 shadow-[0_30px_70px_-15px_rgba(37,99,235,0.25)] overflow-hidden backdrop-blur-2xl">
        {/* Top Header Bar */}
        <div className="h-11 px-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <div className="h-4 w-[1px] bg-slate-800 mx-1" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 text-slate-300 text-[11px] border border-slate-700/50">
              <Search className="w-3 h-3 text-slate-400" />
              <span>Search employees, teams, payroll...</span>
              <kbd className="ml-3 px-1 py-0.5 text-[9px] bg-slate-700/60 rounded text-slate-400">⌘K</kbd>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
              <Bell className="w-3.5 h-3.5" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                HR
              </div>
              <span className="text-[11px] font-medium text-slate-300">Admin</span>
            </div>
          </div>
        </div>

        {/* Inner Dashboard Body: Dark Sidebar + Main Canvas */}
        <div className="flex h-[360px]">
          {/* Dark Vertical Sidebar */}
          <div className="w-14 bg-slate-900/60 border-r border-slate-800/80 p-2.5 flex flex-col justify-between items-center">
            <div className="space-y-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    activeTab === "overview"
                      ? "bg-blue-600/30 text-blue-400 border border-blue-500/40"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                  title="Overview"
                >
                  <Users className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTab("attendance")}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    activeTab === "attendance"
                      ? "bg-purple-600/30 text-purple-400 border border-purple-500/40"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                  title="Attendance"
                >
                  <CalendarCheck className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer">
                  <Award className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400">
              <Plus className="w-4 h-4" />
            </div>
          </div>

          {/* Main Dashboard Panel */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-gradient-to-b from-slate-950 to-slate-900">
            {/* Top Stat Cards Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Card 1: Active Workforce */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                  <span>Workforce</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold text-[9px] flex items-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" /> +12.4%
                  </span>
                </div>
                <div className="text-base font-bold text-white tracking-tight">1,482</div>
                <p className="text-[9px] text-slate-400 mt-0.5">Active employees</p>
              </div>

              {/* Card 2: Attendance Today */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                  <span>Attendance</span>
                  <span className="text-cyan-400 font-semibold text-[9px]">98.2%</span>
                </div>
                <div className="text-base font-bold text-white tracking-tight">1,455</div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full w-[98%]" />
                </div>
              </div>

              {/* Card 3: Task Circle */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-inner flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-[10px]">HR Tasks</div>
                  <div className="text-base font-bold text-white tracking-tight">84%</div>
                  <p className="text-[9px] text-purple-400">Completed</p>
                </div>
                {/* SVG Circle Progress */}
                <div className="relative w-9 h-9">
                  <svg className="w-9 h-9 transform -rotate-90">
                    <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="3.5" className="text-slate-800" fill="transparent" />
                    <circle cx="18" cy="18" r="14" stroke="url(#taskGrad)" strokeWidth="3.5" strokeDasharray="88" strokeDashoffset="14" strokeLinecap="round" fill="transparent" />
                    <defs>
                      <linearGradient id="taskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#7C3AED" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-purple-300">
                    ✓
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row: Employee Growth Chart & Attendance Bars */}
            <div className="grid grid-cols-12 gap-2.5">
              {/* Employee Growth Chart (7 Cols) */}
              <div className="col-span-7 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-200">Workforce Expansion</span>
                    <p className="text-[9px] text-slate-400">Monthly active vs targets</p>
                  </div>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  </div>
                </div>
                
                {/* SVG Curve Chart */}
                <div className="h-24 w-full relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 200 70" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Area fill */}
                    <path d="M0,60 Q40,40 80,45 T160,20 T200,10 L200,70 L0,70 Z" fill="url(#areaGradient)" />
                    <path d="M0,65 Q40,50 80,30 T160,35 T200,18 L200,70 L0,70 Z" fill="url(#cyanGradient)" />
                    {/* Line 1 */}
                    <path d="M0,60 Q40,40 80,45 T160,20 T200,10" fill="none" stroke="#2563EB" strokeWidth="2.5" />
                    {/* Line 2 */}
                    <path d="M0,65 Q40,50 80,30 T160,35 T200,18" fill="none" stroke="#06B6D4" strokeWidth="2" strokeDasharray="3 3" />
                    {/* Pulse point */}
                    <circle cx="200" cy="10" r="4" fill="#22D3EE" className="animate-ping" />
                    <circle cx="200" cy="10" r="3" fill="#FFFFFF" />
                  </svg>
                </div>

                <div className="flex justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-800/50">
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>May</span>
                  <span>Jun</span>
                </div>
              </div>

              {/* Attendance Chart (5 Cols) */}
              <div className="col-span-5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-200">Attendance</span>
                  <span className="text-[9px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">Live</span>
                </div>
                {/* Bar chart */}
                <div className="flex items-end justify-between h-20 px-1 pt-2 gap-1.5">
                  {[
                    { day: "M", val: 85, color: "from-blue-600 to-blue-400" },
                    { day: "T", val: 95, color: "from-purple-600 to-purple-400" },
                    { day: "W", val: 92, color: "from-blue-600 to-cyan-400" },
                    { day: "T", val: 98, color: "from-cyan-500 to-teal-400" },
                    { day: "F", val: 88, color: "from-indigo-600 to-blue-400" },
                  ].map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="w-full bg-slate-800 rounded-t-sm h-full flex items-end">
                        <div
                          className={`w-full rounded-t bg-gradient-to-t ${bar.color} transition-all duration-500 group-hover:brightness-125`}
                          style={{ height: `${bar.val}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row: Recent Activity & Employee Stats */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-200">
                    Q3 Payroll Batch Approved
                  </div>
                  <div className="text-[9px] text-slate-400">
                    1,482 employees processed • $2.4M total
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium">
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating 3D White Platform below Dashboard */}
      <div className="relative z-0 -mt-7 w-[82%] h-12 bg-gradient-to-b from-white/90 to-white/40 backdrop-blur-md rounded-[36px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] border border-white/80 flex items-center justify-between px-8">
        {/* Left Side: Ceramic Plant Pot */}
        <div className="relative -top-5 flex items-end">
          {/* Ceramic Plant Pot */}
          <div className="relative group">
            {/* Plant leaves */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center justify-center">
              <div className="w-8 h-8 relative">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-5 bg-emerald-700 rounded-full" />
                <div className="absolute bottom-1 left-0 w-4 h-4 bg-emerald-500 rounded-full rounded-br-none -rotate-45" />
                <div className="absolute bottom-1 right-0 w-4 h-4 bg-emerald-400 rounded-full rounded-bl-none rotate-45" />
                <div className="absolute -top-1 left-2 w-3.5 h-3.5 bg-emerald-300 rounded-full rounded-tr-none rotate-12" />
              </div>
            </div>
            {/* Ceramic Pot Body */}
            <div className="w-7 h-7 bg-gradient-to-b from-slate-100 to-slate-200 border border-slate-300/80 rounded-b-xl rounded-t-sm shadow-md flex items-center justify-center">
              <div className="w-5 h-1 bg-slate-300 rounded-full -mt-4" />
            </div>
          </div>
        </div>

        {/* Center Platform Detail Pill */}
        <div className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5 opacity-80">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Clanio Enterprise Platform
        </div>

        {/* Right Side: Clanio Premium Coffee Mug */}
        <div className="relative -top-5 flex items-end">
          <div className="relative group">
            {/* Steam Animation */}
            <div className="absolute -top-4 left-2 flex gap-1">
              <span className="w-1 h-3 bg-slate-300/60 rounded-full animate-steam" />
              <span className="w-1 h-3 bg-slate-300/60 rounded-full animate-steam" style={{ animationDelay: "0.8s" }} />
            </div>
            {/* Ceramic Coffee Mug */}
            <div className="relative w-8 h-7 bg-gradient-to-b from-white to-slate-100 border border-slate-200 rounded-b-lg rounded-t-sm shadow-md flex items-center justify-center p-1">
              {/* Clanio Logo on Mug */}
              <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-[7px] text-white font-bold">
                C
              </div>
              {/* Mug Handle */}
              <div className="absolute -right-2 top-1.5 w-2.5 h-3.5 border-2 border-slate-200 rounded-r-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingDashboard;
