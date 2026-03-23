import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "glass" | "outline";
  noPadding?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className = "",
  variant = "default",
  noPadding = false,
}) => {
  const baseStyles = "rounded-3xl transition-all duration-300";
  
  const variants = {
    default: "bg-slate-800 border border-slate-700 shadow-premium",
    glass: "bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-premium",
    outline: "bg-transparent border border-slate-700",
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${noPadding ? "" : "p-6"} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
