import React from "react";
import { AlertCircle, Check, ShieldCheck } from "lucide-react";
import { MedicalCenter } from "../types";

interface MigrationModalProps {
  center: MedicalCenter;
  onClose: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({ center, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Migracion clinica controlada
          </h2>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
            <Check className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-bold">La importacion JSON desde navegador esta deshabilitada.</p>
              <p className="mt-1">
                Para proteger fichas clinicas, toda migracion debe ejecutarse como job servidor con
                validacion previa, dry-run, respaldo, conciliacion y registro de auditoria.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Centro seleccionado: <strong>{center.name}</strong>
          </p>
          <p className="text-sm text-slate-600">
            Solicita la apertura de un job de migracion al SuperAdmin y adjunta el informe de
            origen.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
