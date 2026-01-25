import React from "react";

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
      <img
        src="/assets/logo.png"
        alt="ClaveSalud Logo"
        className={`${sizes[size]} object-contain`}
      />

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
