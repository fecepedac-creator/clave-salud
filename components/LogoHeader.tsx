import React, { useState } from "react";

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
          src="/assets/logo.png"
          alt="ClaveSalud Logo"
          className={`${sizes[size]} object-contain`}
          onError={() => setLogoError(true)}
        />
      ) : (
        <div
          className={`${sizes[size]} bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-200`}
        >
          <span className={`text-white font-bold ${size === "sm" ? "text-xs" : "text-sm"}`}>
            CS
          </span>
        </div>
      )}

      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold text-slate-800 ${textSizes[size]} leading-tight`}>
            ClaveSalud
          </span>
          <span className="text-[10px] text-slate-400 leading-tight">
            Ficha Clínica Electrónica
          </span>
        </div>
      )}
    </div>
  );
};

export default LogoHeader;
