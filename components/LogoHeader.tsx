import React, { useState } from "react";
import { CORPORATE_LOGO } from "../constants";

interface LogoHeaderProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const LogoHeader: React.FC<LogoHeaderProps> = ({
  size = "md",
  showText = true,
  className = "",
}) => {
  const [logoError, setLogoError] = useState(false);

  const sizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!logoError ? (
        <img
          src={CORPORATE_LOGO}
          alt="ClaveSalud Logo"
          className={`${sizes[size]} object-contain`}
          onError={() => setLogoError(true)}
        />
      ) : (
        <div
          className={`${sizes[size]} bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-200`}
        >
          <span className={`text-white font-bold ${textSizes[size]}`}>CS</span>
        </div>
      )}

      {showText && (
        <div className="flex flex-col">
          <span className={`font-black text-slate-900 ${size === 'lg' ? 'text-xl' : textSizes[size]} tracking-tight leading-none mb-0.5`}>
            ClaveSalud
          </span>
          <span className={`${size === 'lg' ? 'text-xs' : 'text-[10px]'} font-semibold text-slate-500/80 leading-tight uppercase tracking-wider`}>
            Ficha Clínica Digital
          </span>
        </div>
      )}
    </div>
  );
};

export default LogoHeader;
