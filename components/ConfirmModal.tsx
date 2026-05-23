import React, { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: "confirm" | "delete-reason" | "export-options" | "text-prompt";
  onConfirm: (value?: any) => void;
  warningText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type,
  onConfirm,
  warningText,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>("2"); // default to "Error administrativo" or "1"
  const [customReason, setCustomReason] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setCustomReason("");
      setSelectedReason("2");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (type === "delete-reason") {
      let reason = "";
      if (selectedReason === "1") reason = "Duplicado";
      else if (selectedReason === "2") reason = "Error administrativo";
      else if (selectedReason === "3") reason = "Solicitud del paciente (Ley 19.628)";
      else {
        reason = customReason.trim() ? `Otro: ${customReason.trim()}` : "Otro";
      }
      onConfirm(reason);
    } else if (type === "text-prompt") {
      onConfirm(customReason.trim());
    } else if (type === "confirm") {
      onConfirm(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            {type === "delete-reason" && <AlertCircle className="w-5 h-5 text-amber-500" />}
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 text-slate-600 space-y-4">
          <p className="text-sm font-medium leading-relaxed">{message}</p>

          {warningText && (
            <div className="p-3.5 bg-amber-50 border border-amber-200/60 rounded-xl flex items-start gap-2.5 text-amber-855 text-xs font-semibold leading-snug">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{warningText}</span>
            </div>
          )}

          {/* Delete reason form fields */}
          {type === "delete-reason" && (
            <div className="space-y-3.5 mt-3 text-slate-700">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Seleccione el motivo de archivado:
              </label>
              <div className="space-y-2">
                {[
                  { value: "1", label: "Duplicado" },
                  { value: "2", label: "Error administrativo" },
                  { value: "3", label: "Solicitud del paciente (Ley 19.628)" },
                  { value: "4", label: "Otro motivo (especificar)" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer text-sm font-semibold"
                  >
                    <input
                      type="radio"
                      name="delete-reason-option"
                      value={opt.value}
                      checked={selectedReason === opt.value}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>

              {selectedReason === "4" && (
                <div className="space-y-1.5 animate-slideDown">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Especifique el motivo:
                  </label>
                  <textarea
                    rows={2}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Escriba aquí el motivo detallado de archivado..."
                    className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-550 outline-none transition-all resize-none shadow-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Text Prompt fields */}
          {type === "text-prompt" && (
            <div className="space-y-1.5 mt-3 text-slate-700 animate-slideDown">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Indique el motivo o justificación:
              </label>
              <textarea
                rows={3}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Escriba aquí el motivo..."
                className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-indigo-550 focus:ring-1 focus:ring-indigo-550 outline-none transition-all resize-none shadow-sm text-slate-800"
              />
            </div>
          )}

          {/* Export Options buttons */}
          {type === "export-options" && (
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => onConfirm("all")}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl font-bold transition-all shadow-md active:scale-98 text-sm"
              >
                Exportar Todo el Historial
              </button>
              <button
                onClick={() => onConfirm("last20")}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all border border-slate-200 active:scale-98 text-sm"
              >
                Exportar Últimas 20 Consultas
              </button>
            </div>
          )}
        </div>

        {/* Footer (Not needed for export-options) */}
        {type !== "export-options" && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                (type === "delete-reason" && selectedReason === "4" && !customReason.trim()) ||
                (type === "text-prompt" && !customReason.trim())
              }
              className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl transition-all shadow-md active:scale-95"
            >
              {type === "delete-reason" ? "Confirmar Archivo" : "Confirmar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
