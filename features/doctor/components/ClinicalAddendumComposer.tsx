import React, { useState } from "react";
import { Loader2, Plus } from "lucide-react";

interface ClinicalAddendumComposerProps {
  allowed: boolean;
  onAppend: (text: string) => Promise<void>;
  confirmAppend?: (message: string) => boolean;
}

export const ClinicalAddendumComposer: React.FC<ClinicalAddendumComposerProps> = ({
  allowed,
  onAppend,
  confirmAppend = (message) => window.confirm(message),
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (!allowed) return null;

  const submit = async () => {
    const normalized = text.trim();
    setSaved(false);
    if (!normalized) {
      setError("Escriba el contenido de la adenda antes de continuar.");
      return;
    }
    if (
      !confirmAppend(
        "La adenda quedará firmada y vinculada al documento original. ¿Desea continuar?"
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAppend(normalized);
      setText("");
      setIsOpen(false);
      setSaved(true);
    } catch {
      setError("No se pudo guardar la adenda. El documento original no fue modificado.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-emerald-200 pt-4">
      {saved && (
        <p role="status" className="mb-3 text-sm font-bold text-emerald-800">
          Adenda firmada y vinculada al documento original.
        </p>
      )}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setSaved(false);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
        >
          <Plus className="h-4 w-4" /> Agregar adenda
        </button>
      ) : (
        <div data-testid="clinical-addendum-composer" className="space-y-3">
          <label className="block text-sm font-bold text-emerald-950" htmlFor="clinical-addendum">
            Contenido de la adenda
          </label>
          <textarea
            id="clinical-addendum"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={busy}
            rows={4}
            className="w-full rounded-lg border border-emerald-300 bg-white p-3 text-sm text-slate-900 disabled:opacity-60"
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar y firmar adenda
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setError("");
              }}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
