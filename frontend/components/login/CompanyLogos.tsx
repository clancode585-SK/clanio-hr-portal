import React from "react";
import { Building2, Sparkles, Box, Layers, Cpu } from "lucide-react";

export const CompanyLogos: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  const companies = [
    {
      name: "ACME",
      sub: "TECHNOLOGIES",
      icon: <Building2 className="w-3.5 h-3.5" />,
    },
    {
      name: "Innova",
      sub: "Solutions",
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    {
      name: "Bright",
      sub: "dynamics",
      icon: <Box className="w-3.5 h-3.5" />,
    },
    {
      name: "NextGen",
      sub: "Systems",
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      name: "TechCorp",
      sub: "Global",
      icon: <Cpu className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className={`w-full max-w-lg backdrop-blur-md rounded-2xl p-3 sm:p-4 border transition-all duration-300 ${
      isDark
        ? "bg-slate-900/60 border-slate-800/80 shadow-lg"
        : "bg-white/70 border-white/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]"
    }`}>
      <p className={`text-[11px] font-semibold text-center mb-2.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Trusted by 500+ companies worldwide
      </p>

      <div className="flex items-center justify-between gap-2 px-1">
        {companies.map((company, index) => (
          <div
            key={index}
            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
              isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <div className={isDark ? "text-slate-500" : "text-slate-400"}>{company.icon}</div>
            <div className="leading-none text-[10px]">
              <span className={`font-bold block ${isDark ? "text-slate-200" : "text-slate-700"}`}>{company.name}</span>
              <span className={`text-[8px] block font-medium ${isDark ? "text-slate-400" : "text-slate-400"}`}>{company.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompanyLogos;
