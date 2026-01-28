import React, { useMemo, useState } from "react";
import { Patient, Consultation, ProfessionalRole } from "../types";
import { calculateAge, formatPersonName } from "../utils";
import { CORPORATE_LOGO } from "../constants";
import { FileText, Printer, X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  centerName: string;
  centerLogoUrl?: string;
  professionalName: string;
  professionalRole: ProfessionalRole;
};

const toDateOnly = (iso: string) => iso.split("T")[0];

const buildDraftFromConsultations = (patient: Patient, consultations: Consultation[]) => {
  const blocks: string[] = [];

  blocks.push(`Identificación del paciente: ${formatPersonName(patient.fullName)} (RUT: ${patient.rut}).`);
  const age = calculateAge(patient.birthDate);
  blocks.push(`Edad: ${age ?? "-"} años. Sexo: ${patient.gender}.`);

  blocks.push("");
  blocks.push("Resumen de atenciones incluidas:");

  consultations
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((c, idx) => {
      const dateStr = new Date(c.date).toLocaleDateString("es-CL");
      const parts: string[] = [];
      if (c.reason) parts.push(`Motivo: ${c.reason}`);
      if (c.anamnesis) parts.push(`Anamnesis: ${c.anamnesis}`);
      if (c.physicalExam) parts.push(`Examen físico: ${c.physicalExam}`);
      if (c.diagnosis) parts.push(`Diagnóstico: ${c.diagnosis}`);

      // Evitar duplicidad evidente: remover frases repetidas exactas
      const uniq = Array.from(new Set(parts.map((p) => p.trim()).filter(Boolean)));

      blocks.push("");
      blocks.push(`${idx + 1}) Atención ${dateStr}`);
      if (uniq.length === 0) {
        blocks.push("— Sin información clínica registrada en los campos principales.");
      } else {
        uniq.forEach((u) => blocks.push(`- ${u}`));
      }
    });

  blocks.push("");
  blocks.push("Comentario clínico (editable):");
  blocks.push(
    "Este borrador se generó a partir de los datos registrados en la ficha clínica. Ajuste, corrija o complemente según corresponda."
  );

  return blocks.join("\n");
};

const ClinicalReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  patient,
  centerName,
  centerLogoUrl,
  professionalName,
  professionalRole,
}) => {
  const consultations = patient?.consultations || [];

  const minDate = useMemo(() => {
    if (consultations.length === 0) return "";
    const min = consultations.reduce((acc, c) => {
      const d = new Date(c.date).getTime();
      return d < acc ? d : acc;
    }, Number.POSITIVE_INFINITY);
    return new Date(min).toISOString().split("T")[0];
  }, [consultations]);

  const maxDate = useMemo(() => {
    if (consultations.length === 0) return "";
    const max = consultations.reduce((acc, c) => {
      const d = new Date(c.date).getTime();
      return d > acc ? d : acc;
    }, 0);
    return new Date(max).toISOString().split("T")[0];
  }, [consultations]);

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [title, setTitle] = useState<string>("Informe Clínico");
  const [draft, setDraft] = useState<string>("");

  const filtered = useMemo(() => {
    if (!patient) return [];
    const f = from || minDate;
    const t = to || maxDate;
    const fTime = f ? new Date(f + "T00:00:00").getTime() : Number.NEGATIVE_INFINITY;
    const tTime = t ? new Date(t + "T23:59:59").getTime() : Number.POSITIVE_INFINITY;

    return (patient.consultations || []).filter((c) => {
      const time = new Date(c.date).getTime();
      return time >= fTime && time <= tTime;
    });
  }, [patient, from, to, minDate, maxDate]);

  const canPrint = Boolean(patient) && filtered.length > 0;

  const handleGenerate = () => {
    if (!patient) return;
    if (filtered.length === 0) {
      setDraft("");
      return;
    }
    setDraft(buildDraftFromConsultations(patient, filtered));
  };

  if (!isOpen || !patient) return null;

  const patientAge = calculateAge(patient.birthDate);
  const dateRangeLabel =
    (from || minDate) && (to || maxDate) ? `${from || minDate} a ${to || maxDate}` : "";

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[120] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:block">
      <div className="bg-white w-full max-w-[22cm] h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-fadeIn print:shadow-none print:h-auto print:w-full print:overflow-visible print:rounded-none">
        {/* Toolbar (Hidden in Print) */}
        <div className="bg-slate-900 p-4 flex justify-between items-center text-white print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h3 className="font-bold text-lg">Informe Clínico</h3>
            <span className="text-xs text-white/60">
              Borrador asistido por IA. Requiere revisión clínica.
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              disabled={!canPrint}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className="bg-white/15 hover:bg-white/25 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Cerrar
            </button>
          </div>
        </div>

        {/* Editor (Hidden in Print) */}
        <div className="p-5 border-b border-slate-100 bg-white print:hidden">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end">
            <div className="lg:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Desde</label>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Hasta</label>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 outline-none"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Atenciones en rango: <span className="font-bold">{filtered.length}</span>
              {dateRangeLabel ? <span className="text-slate-400"> • {dateRangeLabel}</span> : null}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Generar borrador
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold text-slate-500 uppercase">Contenido (editable)</label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              placeholder="Haz clic en 'Generar borrador' para crear un texto base editable."
              className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none font-medium text-slate-700"
            />
            <p className="mt-2 text-xs text-slate-400">
              Nota: en esta versión el borrador se genera automáticamente desde los datos registrados.
              La integración con IA puede habilitarse en una siguiente iteración.
            </p>
          </div>
        </div>

        {/* Printable A4 */}
        <div className="flex-1 overflow-auto bg-slate-100 p-6 print:p-0 print:bg-white print:block print:overflow-visible">
          <div className="bg-white w-full max-w-[21cm] min-h-[29.7cm] mx-auto p-10 shadow-lg print:shadow-none print-document">
            {/* Header with logos */}
            <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <img src={CORPORATE_LOGO} alt="ClaveSalud" className="h-10 w-auto" />
              </div>
              <div className="text-center flex-1">
                <h1 className="text-xl font-extrabold text-slate-900 uppercase tracking-wide">
                  {title || "Informe Clínico"}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Borrador asistido por IA. Requiere revisión clínica.
                </p>
                {dateRangeLabel ? (
                  <p className="text-xs text-slate-500 mt-1">Rango: {dateRangeLabel}</p>
                ) : null}
              </div>
              <div className="flex items-center justify-end min-w-[110px]">
                {centerLogoUrl ? (
                  <img
                    src={centerLogoUrl}
                    alt={`Logo ${centerName}`}
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-400 font-bold">{centerName}</div>
                )}
              </div>
            </header>

            {/* Patient header */}
            <section className="mt-6 p-4 border border-slate-200 rounded-xl">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-bold text-slate-500 uppercase text-xs">Paciente</span>
                  <div className="text-slate-900 font-bold text-base">
                    {formatPersonName(patient.fullName)}
                  </div>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-xs">RUT</span>
                  <div className="font-mono text-slate-900">{patient.rut}</div>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-xs">Edad / Sexo</span>
                  <div className="text-slate-900">
                    {patientAge ?? "-"} años • {patient.gender}
                  </div>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-xs">Centro</span>
                  <div className="text-slate-900">{centerName}</div>
                </div>
              </div>
            </section>

            {/* Body */}
            <section className="mt-6">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide mb-2">
                Contenido
              </h2>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900 border-l-2 border-slate-200 pl-4">
                {draft || "— No hay borrador generado. Vuelve a la vista de edición y presiona 'Generar borrador'."}
              </div>
            </section>

            {/* Signature */}
            <footer className="mt-10 pt-10 flex justify-between items-end">
              <div className="text-xs text-slate-500">
                <p>Generado el: {new Date().toLocaleDateString("es-CL")}</p>
                <p>Rol profesional: {professionalRole}</p>
              </div>

              <div className="text-center">
                <div className="w-72 border-t-2 border-slate-800 mb-2"></div>
                <p className="font-bold text-slate-900 text-sm">{professionalName}</p>
                <p className="text-xs text-slate-500">{centerName}</p>
                <p className="text-[10px] text-slate-400 mt-1">Firma y timbre</p>
              </div>
            </footer>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #root { display: none; }
          .print\:block { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999; }
          .print-document {
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 2.2cm !important;
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
};

export default ClinicalReportModal;
