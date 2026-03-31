import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import {
  CriticalActionRequest,
  CriticalActionResult,
  criticalActionEventName,
} from "../utils/criticalActions";

type PendingAction = {
  request: CriticalActionRequest;
  resolve: (result: CriticalActionResult | null) => void;
};

const CriticalActionHost: React.FC = () => {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reasonSelection, setReasonSelection] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<PendingAction>;
      setPending(customEvent.detail);
      setReasonSelection("");
      setCustomReason("");
      setConfirmed(false);
    };

    window.addEventListener(criticalActionEventName, handler as EventListener);
    return () => window.removeEventListener(criticalActionEventName, handler as EventListener);
  }, []);

  const resolvedReason = useMemo(() => {
    if (reasonSelection === "__custom__") return customReason.trim();
    if (reasonSelection) return reasonSelection;
    return customReason.trim();
  }, [customReason, reasonSelection]);

  if (!pending) return null;

  const { request } = pending;
  const canSubmit = request.reasonRequired
    ? Boolean(resolvedReason) && (!request.requireFinalConfirmation || confirmed)
    : !request.requireFinalConfirmation || confirmed;

  const close = (result: CriticalActionResult | null) => {
    pending.resolve(result);
    setPending(null);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-2xl bg-amber-100 text-amber-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">{request.title}</h3>
              <p className="text-sm text-slate-600 mt-1">{request.message}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {request.warning && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{request.warning}</span>
            </div>
          )}

          {request.reasonRequired && (
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">
                {request.reasonLabel || "Motivo"}
              </label>
              {request.reasonOptions?.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {request.reasonOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setReasonSelection(option)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                        reasonSelection === option
                          ? "border-sky-300 bg-sky-50 text-sky-800"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setReasonSelection("__custom__")}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      reasonSelection === "__custom__"
                        ? "border-sky-300 bg-sky-50 text-sky-800"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Otro motivo
                  </button>
                </div>
              ) : null}
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
                placeholder={request.reasonPlaceholder || "Escribe el motivo"}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
          )}

          {request.requireFinalConfirmation && (
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span>{request.confirmationLabel || "Confirmo que deseo ejecutar esta acción."}</span>
            </label>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button
            type="button"
            onClick={() => close({ confirmed: false })}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
          >
            {request.cancelLabel || "Cancelar"}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => close({ confirmed: true, reason: resolvedReason || undefined })}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50"
          >
            {request.confirmLabel || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CriticalActionHost;
