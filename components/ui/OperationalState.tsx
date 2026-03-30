import React from "react";
import { AlertTriangle, FolderOpen, RefreshCcw } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";

type OperationalStateTone = "neutral" | "warning" | "danger";

interface OperationalStateProps {
  kind: "loading" | "empty" | "error" | "degraded";
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  tone?: OperationalStateTone;
}

const toneClasses: Record<OperationalStateTone, string> = {
  neutral: "bg-slate-50 border-slate-200 text-slate-700",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  danger: "bg-red-50 border-red-200 text-red-800",
};

export const OperationalState: React.FC<OperationalStateProps> = ({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  tone = "neutral",
}) => {
  if (kind === "loading") {
    return (
      <div className={compact ? "py-8" : "py-12"}>
        <LoadingSpinner message={title} size={compact ? "small" : "medium"} />
        {description && (
          <p className="mt-2 text-center text-sm text-slate-500 max-w-md mx-auto">{description}</p>
        )}
      </div>
    );
  }

  const Icon = kind === "empty" ? FolderOpen : AlertTriangle;
  const actionText = actionLabel ?? (kind === "error" ? "Reintentar" : "Volver a intentar");

  return (
    <div
      className={`rounded-2xl border px-6 py-8 text-center flex flex-col items-center gap-3 ${toneClasses[tone]}`}
    >
      <div className="w-14 h-14 rounded-full bg-white/80 border border-current/10 flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-base">{title}</h3>
        {description && <p className="text-sm opacity-80 max-w-lg">{description}</p>}
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-700 font-semibold border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <RefreshCcw className="w-4 h-4" /> {actionText}
        </button>
      )}
    </div>
  );
};

export default OperationalState;
