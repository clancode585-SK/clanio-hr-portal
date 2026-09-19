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
} from "lucide-react";

export const LoginForm: React.FC = () => {
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
    <div className="w-full max-w-md mx-auto space-y-4">
        {/* Title & Subtitle */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Welcome Back! <span className="inline-block">👋</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Sign in to your workspace
          </p>
        </div>

        {/* Workspace Card */}
        <div className="p-2 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200/80 flex items-center justify-center text-purple-700 flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {workspace.name}
                </span>
                <CheckCircle className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                <span>Workspace URL:</span>
                <span className="font-semibold text-slate-700">{workspace.url}</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="text-slate-400 hover:text-slate-600 ml-0.5"
                  title="Copy URL"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {copied && <span className="text-[9px] text-emerald-600 font-bold">Copied!</span>}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSwitchingWorkspace(!isSwitchingWorkspace)}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center hover:underline transition-all"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Switch Workspace</span>
          </button>
        </div>

        {/* Switch Workspace Quick Dropdown simulation */}
        {isSwitchingWorkspace && (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <p className="font-semibold text-slate-700">Select Workspace:</p>
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
                className="p-2 rounded-xl bg-white border border-slate-200 hover:border-purple-500 cursor-pointer flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-slate-900">{ws.name}</div>
                  <div className="text-[10px] text-purple-600">{ws.url}</div>
                </div>
                {workspace.url === ws.url && (
                  <CheckCircle className="w-3.5 h-3.5 text-purple-600" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
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
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 font-semibold">
                Remember me
              </span>
            </label>

            <a
              href="#forgot"
              onClick={(e) => {
                e.preventDefault();
                alert("Password reset instructions sent.");
              }}
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors"
            >
              Forgot password?
            </a>
          </div>

          {/* Gradient Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs sm:text-sm font-bold tracking-wide shadow-lg shadow-purple-500/25 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group"
          >
            <span>Sign In to Workspace</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="bg-white px-3 text-slate-400 font-medium">
              or continue with
            </span>
          </div>
        </div>

        {/* Social Buttons: Google & Microsoft */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => alert("Google Sign-In")}
            className="py-2.5 px-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={() => alert("Microsoft Sign-In")}
            className="py-2.5 px-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            <span>Microsoft</span>
          </button>
        </div>

        {/* Green Security Box */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-100 flex items-start gap-3">
          <div className="p-1 rounded-full bg-emerald-100 text-emerald-600 mt-0.5 flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-emerald-950 leading-snug">
              Your data is secure with enterprise-grade encryption
            </p>
            <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
              ISO 27001 Certified • GDPR Compliant
            </p>
          </div>
        </div>

        {/* Footer Link */}
        <div className="text-center pt-1">
          <p className="text-xs text-slate-500 font-medium">
            Don't have an account?{" "}
            <a
              href="#contact-admin"
              onClick={(e) => {
                e.preventDefault();
                alert("Contacting administrator...");
              }}
              className="font-bold text-purple-600 hover:text-purple-700 hover:underline transition-colors"
            >
              Contact your administrator
            </a>
          </p>
        </div>
      </div>
    );
  };

export default LoginForm;
