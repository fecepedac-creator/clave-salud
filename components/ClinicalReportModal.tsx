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
  examLabelMap: Map<string, string>,
  kinesiologyPrograms?: any[] // Added optional kine programs
) => {
  // 1. Process standard Consultations
  const allEvents = consultations.map(c => ({
    date: c.date,
    type: "CONSULTATION",
    data: c
  }));

  // 2. Process Kine Sessions
  if (kinesiologyPrograms) {
    kinesiologyPrograms.forEach(prog => {
      prog.sessions?.forEach((sess: any) => {
        allEvents.push({
          date: sess.date,
          type: "KINE_SESSION",
          data: { ...sess, programType: prog.type, diagnosis: prog.diagnosis }
        });
      });
    });
  }

  // 3. Sort Chronologically
  return allEvents
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((event) => {
      if (event.type === "CONSULTATION") {
        const c = event.data as Consultation;
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
      } else {
        // KINE SESSION
        const s = event.data as any; // Cast to any to avoid TS errors with Consultation type
        const findings = [];
        if (s.observations) findings.push(`Observaciones: ${s.observations}`);
        if (s.response) findings.push(`Respuesta: ${s.response}`);
        if (s.tolerance) findings.push(`Tolerancia: ${s.tolerance}`);
        if (s.vitals) findings.push(`Vitals Pre: ${s.vitals.pre.pa}/${s.vitals.pre.fc} - Post: ${s.vitals.post.pa}/${s.vitals.post.fc}`);

        return {
          fecha: toDateOnly(s.date),
          motivo: `Sesión Kinesiológica (${s.programType})`,
          hallazgosRelevantes: findings.length > 0 ? findings : [MISSING_RECORD],
          diagnostico: ensureValue(s.diagnosis),
          procedimientos: Array.isArray(s.techniques) ? s.techniques.join(", ") : MISSING_RECORD,
          indicacionesPlan: [MISSING_RECORD]
        };
      }
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

const buildKinesiologyReport = (params: {
  patient: Patient;
  centerName: string;
  professionalName: string;
  professionalRole: ProfessionalRole;
  reportObjective: string;
  startDate: string;
  endDate: string;
  encounters: ReturnType<typeof buildClinicalEncountersJSON>;
  kinePrograms?: any[];
}) => {
  const age = calculateAge(params.patient.birthDate);
  const ageLabel = Number.isFinite(age) ? `${age}` : MISSING_RECORD;

  // Try to find the active program or the most recent one
  // In a real scenario, we might want to let the user select the program, 
  // but for now we take the one that overlaps with the report dates.
  const program = params.kinePrograms?.[0]; // Simplification: take the first relevant program found

  const diagnosis = program?.diagnosis || params.encounters.find(e => e.diagnostico !== MISSING_RECORD)?.diagnostico || MISSING_RECORD;
  const sessionsCount = program?.sessions?.length || params.encounters.filter(e => e.motivo.includes("Sesión")).length || 0;
  const frequency = "Por determinar"; // This data is not currently structured in the program
  const startDate = program?.createdAt ? toDateOnly(program.createdAt.toDate ? program.createdAt.toDate().toISOString() : new Date(program.createdAt.seconds * 1000).toISOString()) : params.startDate;

  const lines: string[] = [];

  // HEADER
  lines.push(`INFORME KINÉSICO`);
  lines.push("");
  lines.push(`Nombre Paciente: ${formatPersonName(params.patient.fullName)}`);
  lines.push(`Edad: ${ageLabel}`);
  lines.push(`Rut: ${params.patient.rut}`);
  lines.push(`Diagnóstico: ${diagnosis}`);
  lines.push(`Numero de sesiones: ${sessionsCount}`);
  lines.push(`Frecuencia: ${frequency}`);
  lines.push(`Inicio tratamiento: ${startDate}`);
  lines.push("");

  // EVALUACIÓN INICIAL
  lines.push("Evaluación Inicial");
  lines.push("");
  // Try to get data from the first session or program initial condition
  const initialCondition = program?.initialCondition || MISSING_RECORD;
  lines.push(`• Condición inicial: ${initialCondition}`);
  // Extract findings from first session if available
  const firstSession = params.encounters.find(e => e.motivo.includes("Sesión"));
  if (firstSession && firstSession.hallazgosRelevantes.length > 0) {
    firstSession.hallazgosRelevantes.forEach(h => lines.push(`• ${h}`));
  }
  lines.push("");

  // OBJETIVOS
  lines.push("Objetivo General");
  lines.push("");
  lines.push("• Reincorporar al paciente a las actividades de la vida diaria."); // Standard default or extract if exists
  lines.push("");

  lines.push("Objetivos de tratamiento");
  lines.push("");
  if (program?.objectives && Array.isArray(program.objectives)) {
    program.objectives.forEach((obj: string) => lines.push(`• ${obj}`));
  } else {
    lines.push(`• ${MISSING_RECORD}`);
  }
  lines.push("");

  // TRATAMIENTO
  lines.push("Tratamiento Kinésico");
  lines.push("");
  lines.push("Fisioterapia");
  // Summarize techniques from all sessions
  const allTechniques = new Set<string>();
  params.encounters.forEach(e => {
    if (e.procedimientos !== MISSING_RECORD) {
      e.procedimientos.split(", ").forEach(t => allTechniques.add(t));
    }
  });

  // Naive classification (in a real app, techniques would have categories)
  const physioKeywords = ["TENS", "CHC", "Ultra", "Laser", "Masoterapia", "Crioterapia", "Calor"];
  const exerciseKeywords = ["Ejercicios", "Fortalecimiento", "Elongación", "Propiocepción", "Coordinación", "Motor"];

  const physioTechs = Array.from(allTechniques).filter(t => physioKeywords.some(k => t.includes(k)));
  const exerciseTechs = Array.from(allTechniques).filter(t => !physioKeywords.some(k => t.includes(k))); // Fallback: everything else looks like exercise/manual

  if (physioTechs.length > 0) {
    physioTechs.forEach(t => lines.push(`• ${t}`));
  } else {
    lines.push("• No se registran procedimientos de fisioterapia específicos.");
  }
  lines.push("");

  lines.push("Ejercicios Terapéuticos");
  lines.push("");
  if (exerciseTechs.length > 0) {
    exerciseTechs.forEach(t => lines.push(`• ${t}`));
  } else {
    lines.push("• Se realizan ejercicios según tolerancia y evolución (ver detalle sesiones).");
  }
  lines.push("");

  // CONCLUSIONES
  lines.push("Conclusiones");
  lines.push("");
  lines.push(`Paciente ha completado ${sessionsCount} sesiones.`);
  lines.push("Evolución general: Se observa evolución favorable en los parámetros evaluados.");
  // Add last session notes as "Current State"
  const lastSession = [...params.encounters].reverse().find(e => e.motivo.includes("Sesión"));
  if (lastSession) {
    lines.push(`En la última sesión (${lastSession.fecha}):`);
    lastSession.hallazgosRelevantes.forEach(h => lines.push(`- ${h}`));
  }
  lines.push("Sugerencias: Control y evaluación con médico tratante.");
  lines.push("");
  lines.push("");

  // SIGNATURE
  lines.push("                                                                                   Kinesióloga.");
  lines.push(`                                                                                   ${params.professionalName}.`);
  lines.push(`                                                                                   ${params.centerName}.`);

  return lines.join("\n");
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
  kinePrograms?: any[]; // Pass this through
}) => {
  // Use Specialized Kinesiology Report
  if (params.professionalRole === "KINESIOLOGO") {
    return buildKinesiologyReport(params);
  }

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

  // Determine if this is primarily a Kinesiology report (has kine sessions)
  const hasKineSessions = params.encounters.some(e => e.motivo.startsWith("Sesión Kinesiológica"));

  if (hasKineSessions) {
    lines.push("2. Diagnóstico y Antecedentes");
    // Use the diagnosis from the first kine session or program
    const mainDiagnosis = params.encounters.find(e => e.diagnostico !== MISSING_RECORD)?.diagnostico || MISSING_RECORD;
    lines.push(`Diagnóstico de ingreso: ${mainDiagnosis}`);

    const antecedents: string[] = [];
    if (params.patient.medicalHistory?.length) antecedents.push(`Mórbidos: ${params.patient.medicalHistory.join(", ")}`);
    if (params.patient.surgicalHistory?.length) antecedents.push(`Quirúrgicos: ${params.patient.surgicalHistory.join(", ")}`);
    if (antecedents.length > 0) {
      lines.push(`Antecedentes relevantes: ${antecedents.join(". ")}.`);
    } else {
      lines.push("No se registran antecedentes mórbidos relevantes.");
    }
    lines.push("");

    lines.push("3. Evolución del Tratamiento (Narrativa)");
    if (params.encounters.length === 0) {
      lines.push("No se registraron sesiones en el período seleccionado.");
    } else {
      params.encounters.forEach((encounter, idx) => {
        if (encounter.motivo.startsWith("Sesión Kinesiológica")) {
          // Narrative construction
          const fecha = new Date(encounter.fecha).toLocaleDateString("es-CL", { weekday: 'long', day: 'numeric', month: 'long' });

          // Extract clean arrays from hallazgos (which are strings like "Observaciones: xyz")
          const observaciones = encounter.hallazgosRelevantes
            .filter(h => h.startsWith("Observaciones:"))
            .map(h => h.replace("Observaciones:", "").trim())
            .join(". ");

          const tolerancia = encounter.hallazgosRelevantes
            .find(h => h.startsWith("Tolerancia:"))?.replace("Tolerancia:", "").trim().toLowerCase();

          const respuesta = encounter.hallazgosRelevantes
            .find(h => h.startsWith("Respuesta:"))?.replace("Respuesta:", "").trim().toLowerCase();

          const vitals = encounter.hallazgosRelevantes
            .find(h => h.startsWith("Vitals"))?.replace("Vitals", "Signos vitales").trim();

          const tecnicas = encounter.procedimientos !== MISSING_RECORD ? encounter.procedimientos : "procedimientos de rutina";

          let paragraph = `El día ${fecha}, se realizó la sesión. `;
          if (observaciones) paragraph += `Se observó que ${observaciones}. `;
          paragraph += `Se trabajaron ${tecnicas}. `;
          if (tolerancia) paragraph += `El paciente presentó una tolerancia ${tolerancia} al esfuerzo. `;
          if (respuesta) paragraph += `La respuesta inmediata al tratamiento fue de ${respuesta}. `;
          if (vitals) paragraph += `(${vitals}).`;

          lines.push(paragraph);
          lines.push("");
        } else {
          // Fallback for medical mixed encounters
          lines.push(`Atención Médica (${encounter.fecha}): ${encounter.motivo}. ${encounter.diagnostico}.`);
        }
      });
    }

  } else {
    // STANDARD MEDICAL REPORT STRUCTURE
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
  }

  lines.push("");
  lines.push(hasKineSessions ? "4. Conclusión Kinesiológica y Sugerencias" : "6. Conclusión clínica y recomendaciones");
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
  const consultations = (patient?.consultations || []).filter((c) => c.active !== false);

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
      if (c.active === false) return false;
      const time = new Date(c.date).getTime();
      return time >= fTime && time <= tTime;
    });
  }, [patient, from, to, minDate, maxDate]);

  const canPrint = Boolean(patient) && draft.trim().length > 0;

  const handleGenerate = () => {
    if (!patient) return;
    const f = from || minDate || MISSING_RECORD;
    const t = to || maxDate || MISSING_RECORD;
    // Pass kine programs to the builder
    const encounters = buildClinicalEncountersJSON(filtered, examLabelMap, patient.kinesiologyPrograms);
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
