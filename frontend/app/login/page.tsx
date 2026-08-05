"use client";

import React, { useState } from "react";
import ClanioLogo from "@/components/login/ClanioLogo";
import FeatureCardList from "@/components/login/FeatureCard";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  const [isDark, setIsDark] = useState(false);

  return (
    <main
      className={`relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans overflow-hidden transition-colors duration-500 ${
        isDark
          ? "bg-slate-950 text-slate-100 dark"
          : "bg-gradient-to-br from-slate-100 via-indigo-50/50 to-purple-50/40 text-slate-900"
      }`}
    >
      {/* Pure CSS Ambient Background */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-dot-pattern opacity-60">
        {/* Soft Radial Ambient Glow Orbs */}
        <div className={`absolute -top-32 -left-32 w-[450px] h-[450px] rounded-full blur-3xl transition-all duration-700 ${
          isDark ? "bg-purple-600/25" : "bg-purple-300/40"
        }`} />
        <div className={`absolute top-1/2 -right-32 w-[450px] h-[450px] rounded-full blur-3xl transition-all duration-700 ${
          isDark ? "bg-blue-600/20" : "bg-blue-300/35"
        }`} />
        <div className={`absolute -bottom-32 left-1/3 w-[450px] h-[450px] rounded-full blur-3xl transition-all duration-700 ${
          isDark ? "bg-indigo-600/20" : "bg-indigo-200/40"
        }`} />
      </div>

      {/* Main Glassmorphic Container Card - Prominent & Spacious */}
      <div className={`relative z-10 w-full max-w-[1200px] min-h-[550px] rounded-[36px] border transition-all duration-500 grid grid-cols-1 lg:grid-cols-12 overflow-hidden ${
        isDark
          ? "bg-slate-900/70 border-slate-800/80 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          : "bg-white/60 border-white/80 shadow-[0_25px_70px_-15px_rgba(37,99,235,0.08)] backdrop-blur-xl"
      }`}>

        {/* ---------------------------------------------------- */}
        {/* LEFT SECTION (55% / col-span-7)                      */}
        {/* ---------------------------------------------------- */}
        <section className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center relative overflow-hidden">
          {/* Left Content Header & Features */}
          <div className="relative z-10 space-y-6 w-full max-w-xl">
            {/* Logo Component */}
            <ClanioLogo isDark={isDark} />

            {/* Main Headline */}
            <div className="pt-2">
              <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] ${
                isDark ? "text-white" : "text-slate-900"
              }`}>
                The Complete HR <br />
                Management System <br />
                <span className="text-clanio-gradient">
                  for Modern Teams
                </span>
              </h1>
            </div>

            {/* 4 Feature Cards */}
            <FeatureCardList isDark={isDark} />
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* RIGHT SECTION (45% / col-span-5)                     */}
        {/* ---------------------------------------------------- */}
        <section className={`lg:col-span-5 rounded-t-3xl lg:rounded-t-none lg:rounded-l-3xl p-6 sm:p-10 lg:p-12 flex items-center justify-center relative z-10 transition-colors duration-500 ${
          isDark
            ? "bg-slate-900/90 border-l border-slate-800/60 backdrop-blur-2xl"
            : "bg-white/90 border-l border-white/80 backdrop-blur-2xl shadow-xl"
        }`}>
          <LoginForm isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
        </section>

      </div>
    </main>
  );
}
