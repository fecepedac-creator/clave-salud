import React from "react";
import { Consultation, Prescription } from "../types";
import { Calendar, FileText, Printer, User, X } from "lucide-react";

interface ConsultationDetailModalProps {
  isOpen: boolean;
  consultation: Consultation | null;
  onClose: () => void;
  onPrint: (docs: Prescription[]) => void;
}

const ConsultationDetailModal: React.FC<ConsultationDetailModalProps> = ({
  isOpen,
  consultation,
  onClose,
  onPrint,
}) => {
  if (!isOpen || !consultation) return null;

  const docs = consultation.prescriptions || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Detalle de atención</h3>
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(consultation.date).toLocaleString("es-CL")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrint(docs)}
              disabled={docs.length === 0}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
            >
              <Printer className="w-4 h-4 inline mr-1" /> Imprimir documentos
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-xs uppercase font-bold text-slate-500">Profesional</p>
            <p className="text-slate-800 font-semibold flex items-center gap-2">
              <User className="w-4 h-4" /> {consultation.professionalName || "-"}
            </p>
          </div>

          <section>
            <p className="text-xs uppercase font-bold text-slate-500 mb-1">Motivo</p>
            <p className="text-slate-800 whitespace-pre-wrap">{consultation.reason || "-"}</p>
          </section>
          <section>
            <p className="text-xs uppercase font-bold text-slate-500 mb-1">Anamnesis</p>
            <p className="text-slate-800 whitespace-pre-wrap">{consultation.anamnesis || "-"}</p>
          </section>
          <section>
            <p className="text-xs uppercase font-bold text-slate-500 mb-1">Examen físico</p>
            <p className="text-slate-800 whitespace-pre-wrap">{consultation.physicalExam || "-"}</p>
          </section>
          <section className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs uppercase font-bold text-blue-600 mb-1">Diagnóstico</p>
            <p className="text-slate-900 font-bold text-lg">{consultation.diagnosis || "-"}</p>
          </section>

          <section className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-xs uppercase font-bold text-slate-500 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Documentos ({docs.length})
            </p>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-500">Sin documentos en esta atención.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li key={doc.id} className="bg-white rounded-lg border border-slate-200 p-3">
                    <p className="text-xs uppercase text-slate-500 font-bold">{doc.type}</p>
                    <p className="text-slate-700 text-sm whitespace-pre-wrap">{doc.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ConsultationDetailModal;
