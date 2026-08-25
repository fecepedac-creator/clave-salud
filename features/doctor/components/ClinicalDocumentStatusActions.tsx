import React from "react";
import { Loader2, Save } from "lucide-react";

interface ClinicalDocumentStatusActionsProps {
  status: "draft" | "signed";
  busy?: boolean;
  disabled?: boolean;
  onSaveDraft: () => void;
  onSign: () => void;
}

export const ClinicalDocumentStatusActions: React.FC<ClinicalDocumentStatusActionsProps> = ({
  status,
  busy = false,
  disabled = false,
  onSaveDraft,
  onSign,
}) => {
  if (status === "signed") {
    return (
      <div data-testid="clinical-document-signed-actions" role="status">
        <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white">
          Firmado
        </span>
        <p className="mt-2 text-sm text-emerald-900">
          Documento bloqueado. Las correcciones deben registrarse mediante una adenda.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="mr-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
        Borrador
      </span>
      <button
        type="button"
        data-testid="btn-guardar-borrador"
        onClick={onSaveDraft}
        disabled={disabled || busy}
        className="flex items-center gap-2 rounded-xl border border-primary-600 bg-white px-5 py-3 text-sm font-bold text-primary-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        Guardar borrador
      </button>
      <button
        type="button"
        data-testid="btn-firmar-atencion"
        onClick={onSign}
        disabled={disabled || busy}
        className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        Firmar atención
      </button>
    </div>
  );
};
