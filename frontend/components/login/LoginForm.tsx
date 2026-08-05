"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  Building2,
  ShieldCheck,
  Copy,
  RefreshCw,
  Sun,
  Moon,
  Check,
} from "lucide-react";

interface LoginFormProps {
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  isDark = false,
  onToggleTheme,
}) => {
  const router = useRouter();
  const [email, setEmail] = useState("admin@acme.com");
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [copied, setCopied] = useState(false);

  const [workspace, setWorkspace] = useState({
    name: "Acme Technologies Pvt. Ltd.",
    url: "acme.clanio.com",
  });

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(workspace.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/");
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-8">
      {/* Title Header & Theme Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2 ${
            isDark ? "text-white" : "text-slate-900"
          }`}>
            Welcome Back! <span className="inline-block animate-bounce">👋</span>
          </h2>
          <p className={`text-xs sm:text-sm mt-1 font-medium ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            Sign in to your workspace
          </p>
        </div>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-2.5 rounded-2xl border transition-all duration-300 flex items-center gap-2 group cursor-pointer ${
              isDark
                ? "bg-slate-800/80 border-slate-700/80 text-amber-400 hover:bg-slate-700/80 hover:border-amber-400/40 shadow-inner"
                : "bg-slate-100/80 border-slate-200/80 text-indigo-600 hover:bg-slate-200/80 hover:border-indigo-300 shadow-sm"
            }`}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-4.5 h-4.5 group-hover:rotate-45 transition-transform duration-300" />
            ) : (
              <Moon className="w-4.5 h-4.5 group-hover:-rotate-12 transition-transform duration-300" />
            )}
            <span className="text-xs font-bold hidden sm:inline">
              {isDark ? "Light" : "Dark"}
            </span>
          </button>
        )}
      </div>

     

      {/* Switch Workspace Quick Dropdown */}
      {isSwitchingWorkspace && (
        <div className={`p-3 rounded-2xl border space-y-2 text-xs transition-all ${
          isDark
            ? "bg-slate-900 border-slate-800 text-slate-300"
            : "bg-slate-50 border-slate-200 text-slate-700"
        }`}>
          <p className="font-semibold text-[11px] uppercase tracking-wider text-slate-400">Select Workspace:</p>
          {[
            { name: "Acme Technologies Pvt. Ltd.", url: "acme.clanio.com" },
            { name: "Global HR Corp", url: "globalhr.clanio.com" },
          ].map((ws, idx) => (
            <div
              key={idx}
              onClick={() => {
                setWorkspace(ws);
                setIsSwitchingWorkspace(false);
              }}
              className={`p-2.5 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                workspace.url === ws.url
                  ? isDark
                    ? "bg-purple-950/60 border-purple-600/60"
                    : "bg-purple-50 border-purple-300"
                  : isDark
                    ? "bg-slate-800/50 border-slate-700/60 hover:border-slate-600"
                    : "bg-white border-slate-200 hover:border-purple-300"
              }`}
            >
              <div>
                <div className={`font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{ws.name}</div>
                <div className="text-[10px] text-purple-500 font-medium">{ws.url}</div>
              </div>
              {workspace.url === ws.url && (
                <CheckCircle className="w-4 h-4 text-purple-500" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
        <div>
          <label className={`block text-xs font-semibold mb-1.5 ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}>
            Email Address
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
              isDark ? "text-slate-400" : "text-slate-400"
            }`}>
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@acme.com"
              className={`w-full pl-10 pr-4 py-3 rounded-2xl text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 border ${
                isDark
                  ? "bg-slate-800/90 border-slate-700 text-white placeholder-slate-500 focus:ring-purple-500/30 focus:border-purple-500"
                  : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-purple-500/20 focus:border-purple-500"
              }`}
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label className={`block text-xs font-semibold mb-1.5 ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}>
            Password
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
              isDark ? "text-slate-400" : "text-slate-400"
            }`}>
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className={`w-full pl-10 pr-10 py-3 rounded-2xl text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 border ${
                isDark
                  ? "bg-slate-800/90 border-slate-700 text-white placeholder-slate-500 focus:ring-purple-500/30 focus:border-purple-500"
                  : "bg-white border-slate-200 text-slate-900 focus:ring-purple-500/20 focus:border-purple-500"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors cursor-pointer ${
                isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember me & Forgot Password */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className={`w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer ${
                isDark ? "bg-slate-800 border-slate-700" : ""
              }`}
            />
            <span className={`text-xs font-semibold ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}>
              Remember me
            </span>
          </label>

          <a
            href="#forgot"
            onClick={(e) => {
              e.preventDefault();
              alert("Password reset instructions sent.");
            }}
            className="text-xs font-semibold text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 hover:underline transition-colors"
          >
            Forgot password?
          </a>
        </div>

        {/* Gradient Submit Button */}
        <button
          type="submit"
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold tracking-wide shadow-lg shadow-purple-500/25 dark:shadow-purple-900/40 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group cursor-pointer"
        >
          <span>Sign In to Workspace</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </form>

      {/* Security Box */}
      <div className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
        isDark
          ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-200"
          : "bg-emerald-50/80 border-emerald-100 text-emerald-950"
      }`}>
        <div className={`p-1 rounded-full mt-0.5 flex-shrink-0 ${
          isDark ? "bg-emerald-900/60 text-emerald-400" : "bg-emerald-100 text-emerald-600"
        }`}>
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <p className={`text-[11px] font-semibold leading-snug ${
            isDark ? "text-emerald-300" : "text-emerald-950"
          }`}>
            Your data is secure with enterprise-grade encryption
          </p>
          <p className={`text-[10px] mt-0.5 font-medium ${
            isDark ? "text-emerald-400/80" : "text-emerald-700"
          }`}>
            ISO 27001 Certified • GDPR Compliant
          </p>
        </div>
      </div>

      {/* Footer Link */}
      <div className="text-center pt-1">
        <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Don't have an account?{" "}
          <a
            href="#contact-admin"
            onClick={(e) => {
              e.preventDefault();
              alert("Contacting administrator...");
            }}
            className="font-bold text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 hover:underline transition-colors"
          >
            Contact your administrator
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
