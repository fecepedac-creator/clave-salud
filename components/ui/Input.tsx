import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  icon,
  className = "",
  id,
  ...props
}) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-slate-300 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
        )}
        <input
          id={id}
          className={`
            w-full bg-slate-900/50 border rounded-xl px-4 py-2.5 text-white placeholder-slate-500
            transition-all duration-200 outline-none
            ${icon ? "pl-10" : "pl-4"}
            ${
              error
                ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                : "border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            }
            ${className}
          `}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs text-red-500 ml-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 ml-1">{helperText}</p>
      ) : null}
    </div>
  );
};

export default Input;
