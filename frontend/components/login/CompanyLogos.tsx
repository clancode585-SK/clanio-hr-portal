import React from "react";
import { Building2, Sparkles, Box, Layers, Cpu } from "lucide-react";

export const CompanyLogos: React.FC = () => {
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
    <div className="w-full max-w-lg bg-white/70 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
      <p className="text-[11px] font-semibold text-slate-500 text-center mb-2.5">
        Trusted by 500+ companies worldwide
      </p>

      <div className="flex items-center justify-between gap-2 px-1">
        {companies.map((company, index) => (
          <div
            key={index}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <div className="text-slate-400">{company.icon}</div>
            <div className="leading-none text-[10px]">
              <span className="font-bold text-slate-700 block">{company.name}</span>
              <span className="text-[8px] text-slate-400 block font-medium">{company.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompanyLogos;
