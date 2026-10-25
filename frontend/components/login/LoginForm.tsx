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

  const [authView, setAuthView] = useState<"login" | "forgot" | "reset">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(workspace.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetchApi<any>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: forgotEmail,
          ...(companySlug ? { company_slug: companySlug } : {}),
        }),
      });
      setSuccessMessage(res?.message || "If that account exists, a reset link has been emailed.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process forgot password request.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetchApi<any>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: resetToken,
          password: newPassword,
          password_confirmation: confirmPassword,
        }),
      });
      setSuccessMessage(res?.message || "Password reset successfully. Please log in.");
      setTimeout(() => setAuthView("login"), 2500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reset password. Check your token.");
    } finally {
      setIsLoading(false);
    }
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
      const role = res?.data?.role || res?.role;
      const userObj = res?.data?.user || res?.user;
      const isSuperAdmin = (email.trim().toLowerCase() === "superadmin@clanio.com") || role === "super_admin" || Boolean(userObj?.is_super_admin);

      if (token) {
        setCookie("token", token, 7);
        setCookie("isAuthenticated", "true", 7);
        setCookie("user_email", email, 7);
        setCookie("is_super_admin", isSuperAdmin ? "true" : "false", 7);
        setCookie("company_id", String(userObj?.company_id || "2"), 7);

        if (typeof window !== "undefined") {
          localStorage.setItem("token", token);
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("user_email", email);
          localStorage.setItem("is_super_admin", isSuperAdmin ? "true" : "false");
          localStorage.setItem("company_id", String(userObj?.company_id || "2"));

          if (isSuperAdmin) {
            setCookie("user_name", "Platform Super Admin", 7);
            setCookie("company_name", "Clanio HR", 7);
            localStorage.setItem("user_name", "Platform Super Admin");
            localStorage.setItem("company_name", "Clanio HR");
          } else {
            const formattedName = userObj?.name || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            setCookie("user_name", formattedName, 7);
            setCookie("company_name", userObj?.company_name || "Acme Technologies Pvt. Ltd.", 7);
            localStorage.setItem("user_name", formattedName);
            localStorage.setItem("company_name", userObj?.company_name || "Acme Technologies Pvt. Ltd.");
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
            {authView === "login" && <>Welcome Back! <span className="inline-block animate-bounce">👋</span></>}
            {authView === "forgot" && <>Forgot Password?</>}
            {authView === "reset" && <>Reset Password</>}
          </h2>
          <p className={`text-xs sm:text-sm mt-1 font-medium ${isDark ? "text-slate-400" : "text-slate-500"
            }`}>
            {authView === "login" && "Sign in to your workspace"}
            {authView === "forgot" && "Enter your email to receive a password reset link"}
            {authView === "reset" && "Enter your security token and new password"}
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

      {/* Success Banner */}
      {successMessage && (
        <div className={`p-3.5 rounded-2xl border text-xs font-semibold ${
          isDark
            ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
            : "bg-emerald-50 border-emerald-200 text-emerald-800"
        }`}>
          {successMessage}
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className={`p-3.5 rounded-2xl border text-xs font-semibold ${
          isDark
            ? "bg-rose-950/50 border-rose-800 text-rose-300"
            : "bg-rose-50 border-rose-200 text-rose-700"
        }`}>
          {errorMessage}
        </div>
      )}

      {/* 1. LOGIN VIEW */}
      {authView === "login" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors cursor-pointer text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <span className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Remember me
              </span>
            </label>

            <button
              type="button"
              onClick={() => {
                setAuthView("forgot");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className="text-xs font-semibold text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 hover:underline transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold tracking-wide shadow-lg shadow-purple-500/25 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Sign In to Workspace</span>}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* 2. FORGOT PASSWORD VIEW */}
      {authView === "forgot" && (
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Account Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="name@company.com"
                className={`w-full pl-10 pr-4 py-3 rounded-2xl text-xs sm:text-sm outline-none border ${isDark
                  ? "bg-slate-900/60 border-white/10 text-white"
                  : "bg-white border-slate-200 text-slate-900"
                  }`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Company Slug (Optional)
            </label>
            <input
              type="text"
              value={companySlug}
              onChange={(e) => setCompanySlug(e.target.value)}
              placeholder="e.g. acme"
              className={`w-full p-3 rounded-2xl text-xs outline-none border ${isDark
                ? "bg-slate-900/60 border-white/10 text-white"
                : "bg-white border-slate-200 text-slate-900"
                }`}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs sm:text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send Reset Instructions</span>}
          </button>

          <div className="flex items-center justify-between text-xs pt-2">
            <button
              type="button"
              onClick={() => setAuthView("login")}
              className="text-purple-400 hover:underline font-bold cursor-pointer"
            >
              ← Back to Login
            </button>
            <button
              type="button"
              onClick={() => setAuthView("reset")}
              className="text-slate-400 hover:text-slate-200 font-semibold cursor-pointer"
            >
              Have a Reset Token?
            </button>
          </div>
        </form>
      )}

      {/* 3. RESET PASSWORD VIEW */}
      {authView === "reset" && (
        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Security Reset Token (64-char hex)
            </label>
            <input
              type="text"
              required
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="64-character token"
              className={`w-full p-3 rounded-2xl text-xs font-mono outline-none border ${isDark
                ? "bg-slate-900/60 border-white/10 text-white"
                : "bg-white border-slate-200 text-slate-900"
                }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              New Password (Min 8 chars with letters & numbers)
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full p-3 rounded-2xl text-xs outline-none border ${isDark
                ? "bg-slate-900/60 border-white/10 text-white"
                : "bg-white border-slate-200 text-slate-900"
                }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full p-3 rounded-2xl text-xs outline-none border ${isDark
                ? "bg-slate-900/60 border-white/10 text-white"
                : "bg-white border-slate-200 text-slate-900"
                }`}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs sm:text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Reset Password & Login</span>}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setAuthView("login")}
              className="text-xs font-bold text-purple-400 hover:underline cursor-pointer"
            >
              ← Back to Login
            </button>
          </div>
        </form>
      )}

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
