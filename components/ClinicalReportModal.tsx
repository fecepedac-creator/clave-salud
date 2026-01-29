import React, { useEffect, useMemo, useState } from "react";
import { Patient, Consultation, ProfessionalRole, ExamDefinition } from "../types";
import { calculateAge, formatPersonName } from "../utils";
import { TRACKED_EXAMS_OPTIONS } from "../constants";
import { FileText, Printer, X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  centerName: string;
  centerLogoUrl?: string;
  professionalName: string;
  professionalRole: ProfessionalRole;
  professionalRegistry?: string;
  examDefinitions?: ExamDefinition[];
};

const toDateOnly = (iso: string) => iso.split("T")[0];

const MISSING_RECORD = "No consta en el registro";

const ensureValue = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : MISSING_RECORD;
};

const buildExamLabelMap = (customExams: ExamDefinition[] = []) => {
  const map = new Map<string, string>();
  TRACKED_EXAMS_OPTIONS.forEach((exam) => map.set(exam.id, exam.label));
  customExams.forEach((exam) => map.set(exam.id, exam.label));
  return map;
};

const buildClinicalEncountersJSON = (
  consultations: Consultation[],
  examLabelMap: Map<string, string>
) => {
  return consultations
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((c) => {
      const findings: string[] = [];
      if (c.anamnesis) findings.push(`Anamnesis: ${c.anamnesis}`);
      if (c.physicalExam) findings.push(`Examen físico: ${c.physicalExam}`);
      if (c.exams && Object.keys(c.exams).length > 0) {
        Object.entries(c.exams).forEach(([key, value]) => {
          if (!value) return;
          const label = examLabelMap.get(key) || key;
          findings.push(`Examen ${label}: ${value}`);
        });
      }

      const planItems: string[] = [];
      if (Array.isArray(c.prescriptions) && c.prescriptions.length > 0) {
        c.prescriptions.forEach((p) => {
          if (!p.content) return;
          planItems.push(`${p.type}: ${p.content}`);
        });
      }
      if (c.nextControlDate || c.nextControlReason) {
        const controlLabel = c.nextControlDate
          ? `Próximo control: ${c.nextControlDate}`
          : "Próximo control";
        const reason = c.nextControlReason ? ` (${c.nextControlReason})` : "";
        planItems.push(`${controlLabel}${reason}`);
      }

      return {
        fecha: toDateOnly(c.date),
        motivo: ensureValue(c.reason),
        hallazgosRelevantes: findings.length > 0 ? findings : [MISSING_RECORD],
        diagnostico: ensureValue(c.diagnosis),
        procedimientos: MISSING_RECORD,
        indicacionesPlan: planItems.length > 0 ? planItems : [MISSING_RECORD],
      };
    });
};

const buildPrompt = (params: {
  patient: Patient;
  centerName: string;
  professionalName: string;
  professionalRole: ProfessionalRole;
  professionalRegistry?: string;
  reportObjective: string;
  startDate: string;
  endDate: string;
  clinicalEncountersJSON: string;
}) => {
  const age = calculateAge(params.patient.birthDate);
  const ageLabel = Number.isFinite(age) ? String(age) : MISSING_RECORD;
  const reportObjective = ensureValue(params.reportObjective);

  return `Actúa como un profesional de la salud redactando un INFORME CLÍNICO FORMAL,
destinado a ser presentado ante otros profesionales de salud o instituciones administrativas.
El informe debe ser claro, objetivo, ordenado cronológicamente y basado EXCLUSIVAMENTE en la información entregada.
NO inventes datos. Si falta información: “No consta en el registro”.

Contexto del paciente:
- Nombre: ${formatPersonName(params.patient.fullName)}
- RUT: ${params.patient.rut}
- Fecha nacimiento: ${params.patient.birthDate} (Edad: ${ageLabel})
- Sexo: ${params.patient.gender}
- Centro médico: ${params.centerName}

Profesional tratante:
- Nombre: ${params.professionalName}
- Rol: ${params.professionalRole}
- Registro profesional: ${params.professionalRegistry || "No informado"}

Objetivo del informe:
${reportObjective}

Atenciones incluidas: entre ${params.startDate} y ${params.endDate}
Datos estructurados:
${params.clinicalEncountersJSON}

Estructura obligatoria:
1. Identificación del paciente
2. Antecedentes clínicos relevantes (solo si constan)
3. Resumen cronológico de atenciones
4. Evolución clínica / funcional (solo si se desprende)
5. Tratamientos o intervenciones realizadas
6. Conclusión clínica y recomendaciones (solo si se desprenden)

Al final agregar EXACTO:
“Borrador asistido por IA. Requiere revisión clínica.”`;
};

const buildDeterministicReport = (params: {
  patient: Patient;
  centerName: string;
  professionalName: string;
  professionalRole: ProfessionalRole;
  reportObjective: string;
  startDate: string;
  endDate: string;
  encounters: ReturnType<typeof buildClinicalEncountersJSON>;
}) => {
  const age = calculateAge(params.patient.birthDate);
  const ageLabel = Number.isFinite(age) ? `${age}` : MISSING_RECORD;
  const reportObjective = ensureValue(params.reportObjective);

  const lines: string[] = [];
  lines.push("1. Identificación del paciente");
  lines.push(`Nombre: ${formatPersonName(params.patient.fullName)}`);
  lines.push(`RUT: ${params.patient.rut}`);
  lines.push(`Fecha nacimiento: ${params.patient.birthDate} (Edad: ${ageLabel})`);
  lines.push(`Sexo: ${params.patient.gender}`);
  lines.push(`Centro médico: ${params.centerName}`);
  lines.push("");
  lines.push("Objetivo del informe:");
  lines.push(reportObjective);
  lines.push("");
  lines.push("2. Antecedentes clínicos relevantes");

  const antecedents: string[] = [];
  if (params.patient.medicalHistory?.length) {
    antecedents.push(`Antecedentes médicos: ${params.patient.medicalHistory.join(", ")}`);
  }
  if (params.patient.medicalHistoryDetails) {
    antecedents.push(`Detalle antecedentes médicos: ${params.patient.medicalHistoryDetails}`);
  }
  if (params.patient.surgicalHistory?.length) {
    antecedents.push(`Antecedentes quirúrgicos: ${params.patient.surgicalHistory.join(", ")}`);
  }
  if (params.patient.surgicalHistoryDetails) {
    antecedents.push(`Detalle antecedentes quirúrgicos: ${params.patient.surgicalHistoryDetails}`);
  }
  if (params.patient.cancerDetails) {
    antecedents.push(`Antecedentes oncológicos: ${params.patient.cancerDetails}`);
  }
  if (params.patient.drugDetails) {
    antecedents.push(`Consumo de drogas: ${params.patient.drugDetails}`);
  }
  if (params.patient.allergies?.length) {
    const allergyItems = params.patient.allergies.map(
      (a) => `${a.type}: ${a.substance}${a.reaction ? ` (${a.reaction})` : ""}`
    );
    antecedents.push(`Alergias: ${allergyItems.join("; ")}`);
  }
  if (params.patient.medications?.length) {
    const meds = params.patient.medications.map(
      (m) => `${m.name} ${m.dose} ${m.frequency}`.trim()
    );
    antecedents.push(`Medicaciones: ${meds.join("; ")}`);
  }

  if (antecedents.length === 0) {
    lines.push(MISSING_RECORD);
  } else {
    antecedents.forEach((item) => lines.push(`- ${item}`));
  }

  lines.push("");
  lines.push("3. Resumen cronológico de atenciones");
  if (params.encounters.length === 0) {
    lines.push(MISSING_RECORD);
  } else {
    lines.push(`Atenciones incluidas: entre ${params.startDate} y ${params.endDate}`);
    params.encounters.forEach((encounter, idx) => {
      lines.push("");
      lines.push(`${idx + 1}) Fecha: ${encounter.fecha}`);
      lines.push(`- Motivo: ${encounter.motivo}`);
      const findings = Array.isArray(encounter.hallazgosRelevantes)
        ? encounter.hallazgosRelevantes.join(" | ")
        : encounter.hallazgosRelevantes;
      lines.push(`- Hallazgos relevantes: ${findings}`);
      lines.push(`- Diagnóstico: ${encounter.diagnostico}`);
      lines.push(`- Procedimientos: ${encounter.procedimientos}`);
      const plan = Array.isArray(encounter.indicacionesPlan)
        ? encounter.indicacionesPlan.join(" | ")
        : encounter.indicacionesPlan;
      lines.push(`- Indicaciones/Plan: ${plan}`);
    });
  }

  lines.push("");
  lines.push("4. Evolución clínica / funcional");
  lines.push(MISSING_RECORD);
  lines.push("");
  lines.push("5. Tratamientos o intervenciones realizadas");

  const treatments: string[] = [];
  params.encounters.forEach((encounter) => {
    if (Array.isArray(encounter.indicacionesPlan)) {
      treatments.push(...encounter.indicacionesPlan.filter((item) => item !== MISSING_RECORD));
    }
  });

  if (treatments.length === 0) {
    lines.push(MISSING_RECORD);
  } else {
    treatments.forEach((item) => lines.push(`- ${item}`));
  }

  lines.push("");
  lines.push("6. Conclusión clínica y recomendaciones");
  lines.push(MISSING_RECORD);
  lines.push("");
  lines.push("Borrador asistido por IA. Requiere revisión clínica.");

  return lines.join("\n");
};

const ClinicalReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  patient,
  centerName,
  centerLogoUrl,
  professionalName,
  professionalRole,
  professionalRegistry,
  examDefinitions,
}) => {
  const consultations = patient?.consultations || [];

  const examLabelMap = useMemo(
    () => buildExamLabelMap(examDefinitions),
    [examDefinitions]
  );

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
  const [reportObjective, setReportObjective] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [draftPrompt, setDraftPrompt] = useState<string>("");

  useEffect(() => {
    if (!isOpen || !patient) return;
    setFrom(minDate);
    setTo(maxDate);
    setDraft("");
    setReportObjective("");
    setDraftPrompt("");
  }, [isOpen, patient?.id, minDate, maxDate]);

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

  const canPrint = Boolean(patient) && draft.trim().length > 0;

  const handleGenerate = () => {
    if (!patient) return;
    const f = from || minDate || MISSING_RECORD;
    const t = to || maxDate || MISSING_RECORD;
    const encounters = buildClinicalEncountersJSON(filtered, examLabelMap);
    const clinicalEncountersJSON = JSON.stringify(encounters, null, 2);
    const prompt = buildPrompt({
      patient,
      centerName,
      professionalName,
      professionalRole,
      professionalRegistry,
      reportObjective,
      startDate: f,
      endDate: t,
      clinicalEncountersJSON,
    });

    // Hook listo para IA: el prompt queda disponible para integración futura.
    setDraftPrompt(prompt);
    setDraft(
      buildDeterministicReport({
        patient,
        centerName,
        professionalName,
        professionalRole,
        reportObjective,
        startDate: f,
        endDate: t,
        encounters,
      })
    );
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
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              disabled={!canPrint}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimir / Exportar PDF
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
              <label className="text-xs font-bold text-slate-500 uppercase">
                Objetivo del informe
              </label>
              <textarea
                value={reportObjective}
                onChange={(e) => setReportObjective(e.target.value)}
                rows={3}
                placeholder="Describe el objetivo clínico o administrativo del informe."
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none font-medium text-slate-700"
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
              Nota: el borrador se genera usando los datos registrados y el prompt institucional.
              La integración con IA puede habilitarse sin afectar este flujo.
            </p>
            {draftPrompt && (
              <p className="mt-1 text-xs text-slate-400">
                Prompt listo para integración IA (no visible al imprimir).
              </p>
            )}
          </div>
        </div>

        {/* Printable A4 */}
        <div className="flex-1 overflow-auto bg-slate-100 p-6 print:p-0 print:bg-white print:block print:overflow-visible">
          <div className="bg-white w-full max-w-[21cm] min-h-[29.7cm] mx-auto p-10 shadow-lg print:shadow-none print-document">
            {/* Header with logos */}
            <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <img src="/assets/logo.png" alt="ClaveSalud" className="h-10 w-auto" />
              </div>
              <div className="text-center flex-1">
                <h1 className="text-xl font-extrabold text-slate-900 uppercase tracking-wide">
                  Informe Clínico
                </h1>
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
                {draft ||
                  "— No hay borrador generado. Vuelve a la vista de edición y presiona 'Generar borrador'."}
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
            margin: 12mm;
          }
          body {
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\:block { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999; }
          .print-document {
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
};

export default ClinicalReportModal;
