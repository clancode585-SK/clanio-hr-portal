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
    iconBg: "bg-purple-100/90 border-purple-200/60",
    iconColor: "text-purple-600",
  },
  {
    id: "security",
    icon: <ShieldCheck className="w-5 h-5" />,
    title: "Secure & Compliant",
    description: "Enterprise-grade security with data compliance.",
    iconBg: "bg-emerald-100/90 border-emerald-200/60",
    iconColor: "text-emerald-600",
  },
  {
    id: "analytics",
    icon: <BarChart2 className="w-5 h-5" />,
    title: "Smart Analytics",
    description: "Make data-driven decisions with powerful insights.",
    iconBg: "bg-amber-100/90 border-amber-200/60",
    iconColor: "text-amber-600",
  },
  {
    id: "accessible",
    icon: <Smartphone className="w-5 h-5" />,
    title: "Accessible Anywhere",
    description: "Cloud-based platform accessible on any device.",
    iconBg: "bg-blue-100/90 border-blue-200/60",
    iconColor: "text-blue-600",
  },
];

export const FeatureCardList: React.FC = () => {
  return (
    <div className="space-y-3.5 my-6 max-w-xs">
      {featuresData.map((feature) => (
        <div
          key={feature.id}
          className="group p-3 rounded-2xl bg-white/70 hover:bg-white/95 border border-white/80 shadow-[0_4px_20px_-4px_rgba(37,99,235,0.04)] hover:shadow-[0_8px_25px_-5px_rgba(37,99,235,0.08)] transition-all duration-300 backdrop-blur-md"
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`p-2.5 rounded-2xl border ${feature.iconBg} ${feature.iconColor} group-hover:scale-105 transition-transform duration-300 flex-shrink-0`}
            >
              {feature.icon}
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                {feature.title}
              </h3>

            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FeatureCardList;
