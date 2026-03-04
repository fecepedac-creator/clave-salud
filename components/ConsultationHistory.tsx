import React, { useEffect, useMemo, useState } from "react";
import { Consultation, Prescription } from "../types";
import { Calendar, User, Mail, Copy, Printer, FileText, Search, ChevronDown, ChevronUp } from "lucide-react";
import { auth } from "../firebase";
import { logAccessSafe, useAuditLog } from "../hooks/useAuditLog";
import { getCategoryLabel } from "../utils/examOrderCatalog";

interface ConsultationHistoryProps {
  consultations: Consultation[];
  centerId?: string;
  patientId?: string;
  onPrint: (docs: Prescription[]) => void;
  onOpen: (consultation: Consultation) => void;
  onSendEmail: (consultation: Consultation) => void;
}

const ConsultationHistory: React.FC<ConsultationHistoryProps> = ({
  consultations,
  centerId,
  patientId,
  onPrint,
  onOpen,
  onSendEmail,
}) => {
  const { logAccess } = useAuditLog();
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Efecto de Debounce para aligerar la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(inputValue), 350);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const activeConsultations = useMemo(
    () => (consultations || []).filter((c) => c.active !== false),
    [consultations]
  );

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set(activeConsultations.map(c => c.id).filter(id => id !== undefined));
    setExpandedIds(allIds as Set<string>);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  useEffect(() => {
    if (!centerId || !patientId) return;
    activeConsultations.forEach((consultation) => {
      if (!consultation.id) return;
      logAccessSafe(logAccess, {
        centerId,
        resourceType: "consultation",
        resourcePath: `/centers/${centerId}/patients/${patientId}/consultations/${consultation.id}`,
        patientId,
        actorUid: auth.currentUser?.uid ?? undefined,
      });
    });
  }, [activeConsultations, centerId, logAccess, patientId]);

  const filteredConsultations = useMemo(() => {
    if (!searchTerm.trim()) return activeConsultations;
    const lowerTerm = searchTerm.toLowerCase();
    return activeConsultations.filter(c => {
      return (
        (c.reason || "").toLowerCase().includes(lowerTerm) ||
        (c.diagnosis || "").toLowerCase().includes(lowerTerm) ||
        (c.anamnesis || "").toLowerCase().includes(lowerTerm) ||
        (c.physicalExam || "").toLowerCase().includes(lowerTerm)
      );
    });
  }, [activeConsultations, searchTerm]);

  // Sort consultations: Newest First (Desc)
  const sortedConsultations = [...filteredConsultations].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow shadow-sm text-sm"
            placeholder="Buscar en el historial clínico (motivos, diagnósticos, evolución...)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>

        {sortedConsultations.length > 0 && (
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={collapseAll}
              className="flex-1 md:flex-none px-4 py-3 text-sm font-bold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Contraer todo
            </button>
            <button
              onClick={expandAll}
              className="flex-1 md:flex-none px-4 py-3 text-sm font-bold rounded-2xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              Expandir todo
            </button>
          </div>
        )}
      </div>

      {sortedConsultations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">
            {searchTerm ? "No se encontraron atenciones que coincidan con la búsqueda." : "No hay consultas registradas para este paciente."}
          </p>
        </div>
      ) : (
        sortedConsultations.map((c) => {
          const isExpanded = expandedIds.has(c.id);
          const orderDocs = (c.prescriptions || []).filter((doc) => doc.type === "OrdenExamenes");
          const orderCounts = orderDocs.reduce(
            (acc, doc) => {
              const key = String(doc.category || "");
              if (!key) return acc;
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );
          return (
            <div
              key={c.id}
              className={`bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden ${isExpanded ? 'p-8' : 'p-5'}`}
            >
              {/* Header / Resumen */}
              <div className={`flex flex-col md:flex-row md:justify-between md:items-start gap-4 ${isExpanded ? 'mb-6 border-b border-slate-100 pb-4' : ''}`}>
                <div className="flex-1 flex flex-col gap-2 cursor-pointer" onClick={() => toggleExpand(c.id)}>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(c.date).toLocaleDateString()}
                    </div>
                    <span className="text-slate-500 text-sm flex items-center gap-1 font-semibold">
                      <User className="w-4 h-4" /> {c.professionalName || "(No registrado)"}
                    </span>
                    {c.centerName && (
                      <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-200 uppercase tracking-tighter">
                        {c.centerName}
                      </span>
                    )}
                  </div>
                  {!isExpanded && (
                    <div>
                      <h4 className="text-base font-bold text-slate-800 line-clamp-1">{c.reason}</h4>
                      {c.diagnosis && <p className="text-sm font-semibold text-blue-600 line-clamp-1">{c.diagnosis}</p>}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.prescriptions && c.prescriptions.length > 0 && (
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1">
                      Docs: {c.prescriptions.length}
                    </span>
                  )}
                  {Object.entries(orderCounts).map(([category, count]) => (
                    <span
                      key={`${c.id}-${category}`}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1"
                    >
                      {getCategoryLabel(category as any)}({count})
                    </span>
                  ))}

                  <div className="flex gap-2 opacity-100 transition-opacity ml-2 border-l pl-2 border-slate-100">
                    {isExpanded && (
                      <>
                        <button
                          onClick={() => onPrint(c.prescriptions || [])}
                          disabled={!c.prescriptions || c.prescriptions.length === 0}
                          className="px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                          title="Reimprimir"
                        >
                          Reimprimir
                        </button>
                        <button
                          onClick={() => onSendEmail(c)}
                          className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"
                          title="Enviar mail"
                        >
                          <Mail className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200 ml-1"
                      title={isExpanded ? "Contraer" : "Expandir"}
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Detalle Expandido */}
              {isExpanded && (
                <div className="grid md:grid-cols-12 gap-8 animate-fadeIn">
                  <div className="md:col-span-8 space-y-6">
                    <div>
                      <h4 className="text-xl font-bold text-slate-800">{c.reason}</h4>
                      <p className="text-base font-bold text-blue-600">{c.diagnosis}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Anamnesis
                      </p>
                      {/* Added whitespace-pre-wrap to handle line breaks */}
                      <p className="text-slate-600 text-lg leading-relaxed whitespace-pre-wrap">
                        {c.anamnesis}
                      </p>
                    </div>

                    {/* Saved Prescriptions View */}
                    {c.prescriptions && c.prescriptions.length > 0 && (
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                            Documentos Emitidos
                          </p>
                          {c.prescriptions.length > 1 && (
                            <button
                              onClick={() => onPrint(c.prescriptions)}
                              className="text-blue-600 hover:bg-blue-50 text-xs font-bold px-2 py-1 rounded flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" /> Imprimir Todo
                            </button>
                          )}
                        </div>
                        <ul className="space-y-3">
                          {c.prescriptions.map((doc) => (
                            <li
                              key={doc.id}
                              className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200"
                            >
                              <div className="flex-1">
                                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">
                                  {doc.type}
                                </span>
                                <span className="text-slate-800 text-sm line-clamp-1">
                                  {doc.content}
                                </span>
                              </div>
                              <button
                                onClick={() => onPrint([doc])}
                                className="text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1"
                              >
                                <Printer className="w-4 h-4" /> Ver
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {c.nextControlDate && (
                      <div className="flex items-center gap-2 text-base text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl w-fit">
                        <Calendar className="w-5 h-5" /> Próximo Control:{" "}
                        {new Date(c.nextControlDate).toLocaleDateString()} ({c.nextControlReason})
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-4 flex flex-col gap-4">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">
                        Antropometría
                      </p>
                      <div className="grid grid-cols-2 gap-y-6 text-center">
                        <div>
                          <span className="block text-2xl font-bold text-slate-700">
                            {c.weight || "-"}
                          </span>
                          <span className="text-xs text-slate-400">kg</span>
                        </div>
                        <div>
                          <span className="block text-2xl font-bold text-slate-700">
                            {c.height || "-"}
                          </span>
                          <span className="text-xs text-slate-400">cm</span>
                        </div>
                        {(c.waist || c.hip) && (
                          <>
                            <div className="col-span-2 pt-3 border-t border-slate-200 mb-2"></div>
                            <div>
                              <span className="block text-lg font-bold text-slate-700">
                                {c.waist || "-"}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase">Cintura</span>
                            </div>
                            <div>
                              <span className="block text-lg font-bold text-slate-700">
                                {c.hip || "-"}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase">Cadera</span>
                            </div>
                          </>
                        )}
                        <div className="col-span-2 pt-3 border-t border-slate-200">
                          <span className="block text-lg font-bold text-slate-600">
                            IMC: {c.bmi || "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between px-6 py-4 bg-red-50 text-red-700 rounded-2xl text-lg font-bold border border-red-100">
                      <span>PA: {c.bloodPressure || "--"}</span>
                      <span>HGT: {c.hgt || "--"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default ConsultationHistory;
