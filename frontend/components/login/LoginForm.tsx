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

import { fetchApi } from "@/lib/api";
import { setCookie } from "@/lib/cookies";

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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [workspace, setWorkspace] = useState({
    name: "Acme Technologies Pvt. Ltd.",
    url: "acme.clanio.com",
  });

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(workspace.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await fetchApi<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const token = res?.data?.token || res?.token;
      const userObj = res?.data?.user || res?.user;
      if (token) {
        setCookie("token", token, 7);
        setCookie("isAuthenticated", "true", 7);
        if (userObj) {
          setCookie("user_name", userObj.name || "", 7);
          setCookie("user_email", userObj.email || "", 7);
          setCookie("company_name", userObj.company_name || "", 7);
          setCookie("is_super_admin", userObj.is_super_admin ? "true" : "false", 7);
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("token", token);
          localStorage.setItem("isAuthenticated", "true");
          if (userObj) {
            localStorage.setItem("user_name", userObj.name || "");
            localStorage.setItem("user_email", userObj.email || "");
            localStorage.setItem("company_name", userObj.company_name || "");
            localStorage.setItem("is_super_admin", userObj.is_super_admin ? "true" : "false");
          }
        }
        router.push("/");
      } else {
        setErrorMessage("Invalid credentials returned from server.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-8">
      {/* Title Header & Theme Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"
            }`}>
            Welcome Back! <span className="inline-block animate-bounce">👋</span>
          </h2>
          <p className={`text-xs sm:text-sm mt-1 font-medium ${isDark ? "text-slate-400" : "text-slate-500"
            }`}>
            Sign in to your workspace
          </p>
        </div>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-2.5 rounded-2xl border transition-all duration-300 flex items-center gap-2 group cursor-pointer ${isDark
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
        <div className={`p-3 rounded-2xl border space-y-2 text-xs transition-all ${isDark
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
              className={`p-2.5 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${workspace.url === ws.url
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

      {/* Error Banner */}
      {errorMessage && (
        <div className={`p-3 rounded-2xl border text-xs font-semibold ${
          isDark
            ? "bg-rose-950/50 border-rose-800 text-rose-300"
            : "bg-rose-50 border-rose-200 text-rose-700"
        }`}>
          {errorMessage}
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
        <div>
          <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"
            }`}>
            Email Address
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${isDark ? "text-slate-400" : "text-slate-400"
              }`}>
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@acme.com"
              className={`w-full pl-10 pr-4 py-3 rounded-2xl text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 border backdrop-blur-md ${isDark
                ? "bg-slate-900/60 border-white/10 text-white placeholder-slate-500 focus:bg-slate-900/80 focus:ring-purple-500/30 focus:border-purple-500"
                : "bg-white/60 border-white/80 text-slate-900 placeholder-slate-400 focus:bg-white/90 focus:ring-purple-500/20 focus:border-purple-500 shadow-xs"
                }`}
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"
            }`}>
            Password
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${isDark ? "text-slate-400" : "text-slate-400"
              }`}>
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className={`w-full pl-10 pr-10 py-3 rounded-2xl text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 border backdrop-blur-md ${isDark
                ? "bg-slate-900/60 border-white/10 text-white placeholder-slate-500 focus:bg-slate-900/80 focus:ring-purple-500/30 focus:border-purple-500"
                : "bg-white/60 border-white/80 text-slate-900 focus:bg-white/90 focus:ring-purple-500/20 focus:border-purple-500 shadow-xs"
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors cursor-pointer ${isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"
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
              className={`w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer ${isDark ? "bg-slate-800 border-slate-700" : ""
                }`}
            />
            <span className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"
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
      <div className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors backdrop-blur-md ${isDark
        ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-200"
        : "bg-emerald-50/60 border-emerald-200/60 text-emerald-950 shadow-xs"
        }`}>
        <div className={`p-1 rounded-full mt-0.5 flex-shrink-0 ${isDark ? "bg-emerald-900/60 text-emerald-400" : "bg-emerald-100 text-emerald-600"
          }`}>
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <p className={`text-[11px] font-semibold leading-snug ${isDark ? "text-emerald-300" : "text-emerald-950"
            }`}>
            Your data is secure with enterprise-grade encryption
          </p>
          <p className={`text-[10px] mt-0.5 font-medium ${isDark ? "text-emerald-400/80" : "text-emerald-700"
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
