import React from "react";
import Image from "next/image";

export const ClanioLogo: React.FC<{ className?: string; isDark?: boolean }> = ({
  className = "",
  isDark = false,
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Image
        src="/images/logo/Clanio.png"
        alt="Clanio Logo"
        width={180}
        height={50}
        priority
        className="h-16 sm:h-20 w-auto object-contain rounded-xl drop-shadow-sm"
      />
      <div className={`text-[16px] font-semibold tracking-tight flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
        isDark ? "bg-slate-800/80 border-slate-700/80 text-slate-200" : "bg-white/80 border-slate-200/80 text-slate-700 shadow-sm"
      }`}>
        <span className="text-blue-600 dark:text-blue-400 font-bold">Work.</span>
        <span className="text-purple-600 dark:text-purple-400 font-bold">Manage.</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Grow.</span>
        <span className={isDark ? "text-slate-200 font-bold" : "text-slate-800 font-bold"}>Together.</span>
      </div>
    </div>
  );
};

export default ClanioLogo;
