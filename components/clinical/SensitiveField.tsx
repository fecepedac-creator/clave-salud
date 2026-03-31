import React, { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { logAuditEventSafe } from "../../hooks/useAuditLog";
import { maskSensitiveValue, SensitiveFieldKind } from "../../utils/sensitiveData";

interface SensitiveFieldProps {
  value?: string | null;
  kind: SensitiveFieldKind;
  centerId?: string;
  entityType?: string;
  entityId?: string;
  patientId?: string;
  auditLabel?: string;
  timeoutMs?: number;
  className?: string;
}

const SensitiveField: React.FC<SensitiveFieldProps> = ({
  value,
  kind,
  centerId,
  entityType = "patient",
  entityId,
  patientId,
  auditLabel,
  timeoutMs = 15000,
  className = "",
}) => {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(false), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [revealed, timeoutMs]);

  const masked = useMemo(() => maskSensitiveValue(value, kind), [kind, value]);
  const visibleValue = value || "";

  if (!visibleValue) return <span className={className}>-</span>;

  const handleReveal = async () => {
    const next = !revealed;
    setRevealed(next);
    if (next && centerId && entityId) {
      await logAuditEventSafe({
        centerId,
        action: "PII_REVEAL",
        entityType,
        entityId,
        patientId,
        details: auditLabel || `Revelacion explicita de campo sensible (${kind}).`,
        metadata: { fieldKind: kind },
      });
    }
  };

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span>{revealed ? visibleValue : masked}</span>
      <button
        type="button"
        onClick={handleReveal}
        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
        title={revealed ? "Ocultar dato" : "Revelar dato por 15 segundos"}
      >
        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
};

export default SensitiveField;
