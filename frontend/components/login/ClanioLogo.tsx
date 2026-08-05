import React from "react";
import Image from "next/image";

export const ClanioLogo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/images/logo/Clanio.png"
        alt="Clanio Logo"
        width={180}
        height={50}
        priority
        className="h-10 sm:h-12 w-auto object-contain rounded-xl"
      />
        <div className="text-[11px] font-semibold pl-4 tracking-tight mt-0.5 flex items-center gap-1">
          <span className="text-blue-600">Work.</span>
          <span className="text-purple-600">Manage.</span>
          <span className="text-emerald-500">Grow.</span>
          <span className="text-slate-800">Together.</span>
        </div>
    </div>
  );
};

export default ClanioLogo;
