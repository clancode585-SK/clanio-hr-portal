import React from "react";
import { Users, ShieldCheck, BarChart2, Smartphone } from "lucide-react";

export interface FeatureItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  iconBg: string;
  iconColor: string;
}

export const featuresData: FeatureItem[] = [
  {
    id: "all-in-one",
    icon: <Users className="w-5 h-5" />,
    title: "All-in-One HR Solution",
    description: "From hiring to retirement, everything in one place.",
    iconBg: "bg-purple-500/10 border-purple-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "security",
    icon: <ShieldCheck className="w-5 h-5" />,
    title: "Secure & Compliant",
    description: "Enterprise-grade security with data compliance.",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "analytics",
    icon: <BarChart2 className="w-5 h-5" />,
    title: "Smart Analytics",
    description: "Make data-driven decisions with powerful insights.",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "accessible",
    icon: <Smartphone className="w-5 h-5" />,
    title: "Accessible Anywhere",
    description: "Cloud-based platform accessible on any device.",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
];

export const FeatureCardList: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
      {featuresData.map((feature) => (
        <div
          key={feature.id}
          className={`group p-3.5 rounded-2xl border transition-all duration-300 backdrop-blur-md ${
            isDark
              ? "bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 shadow-md"
              : "bg-white/75 hover:bg-white/95 border-white/80 shadow-[0_4px_20px_-4px_rgba(37,99,235,0.04)] hover:shadow-[0_8px_25px_-5px_rgba(37,99,235,0.1)]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border ${feature.iconBg} ${feature.iconColor} group-hover:scale-105 transition-transform duration-300 flex-shrink-0 mt-0.5`}
            >
              {feature.icon}
            </div>
            <div>
              <h3 className={`text-xs sm:text-sm font-bold leading-snug ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                {feature.title}
              </h3>
              <p className={`text-[11px] leading-relaxed mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {feature.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FeatureCardList;
