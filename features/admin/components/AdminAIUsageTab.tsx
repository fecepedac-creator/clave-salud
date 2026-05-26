import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  Stethoscope,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Appointment, Consultation, Doctor, Patient } from "../../../types";
import { db, functions } from "../../../firebase";

type AiLog = {
  id: string;
  action: string;
  actorUid?: string;
  actorEmail?: string;
  actorRole?: string;
  timestamp?: any;
  metadata?: Record<string, any>;
};

interface AdminAIUsageTabProps {
  centerId: string;
  doctors: Doctor[];
  appointments: Appointment[];
  patients: Patient[];
}

type ConsultRow = {
  patientId: string;
  patientName: string;
  consultation: Consultation;
};

const AMBIGUOUS_TERMS = [
  /\betc\b/i,
  /\bnormal\b/i,
  /\bestable\b/i,
  /\ba evaluar\b/i,
  /\bpendiente\b/i,
  /\bprobable\b/i,
  /\bposible\b/i,
];

const SPECIALTY_TEMPLATES: Record<string, Array<{ title: string; focus: string }>> = {
  MEDICO: [
    { title: "Control crónico", focus: "Motivo, evolución, plan farmacológico y próximo control." },
    { title: "Consulta aguda respiratoria", focus: "Síntomas, examen segmentario, signos de alarma." },
  ],
  KINESIOLOGO: [
    { title: "Sesión kinésica motora", focus: "Dolor EVA, movilidad, intervención y objetivos." },
    { title: "Rehabilitación respiratoria", focus: "Síntomas, técnica aplicada y tolerancia." },
  ],
  NUTRICIONISTA: [
    { title: "Control nutricional", focus: "Anamnesis alimentaria, antropometría y plan dietario." },
    { title: "Seguimiento metabólico", focus: "Adherencia, barreras y metas SMART." },
  ],
  ENFERMERA: [
    { title: "Control de enfermería", focus: "Signos vitales, educación y plan de cuidado." },
    { title: "Procedimiento clínico", focus: "Indicación, técnica, tolerancia y seguimiento." },
  ],
  PSICOLOGO: [
    { title: "Sesión psicoterapia", focus: "Motivo, contenido de sesión, objetivos y tareas." },
    { title: "Evaluación inicial", focus: "Antecedentes, hipótesis clínica y plan terapéutico." },
  ],
};

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toDateLabel(value: any): string {
  const d = toDate(value);
  return d ? d.toLocaleString("es-CL") : "-";
}

function resolveConsultDate(consultation: Consultation): Date | null {
  if (consultation.date) {
    const d = new Date(`${consultation.date}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return toDate(consultation.createdAt) || null;
}

const AdminAIUsageTab: React.FC<AdminAIUsageTabProps> = ({
  centerId,
  doctors,
  appointments,
  patients,
}) => {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fieldFilter, setFieldFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  useEffect(() => {
    if (!db || !centerId) return;
    setLoading(true);
    const q = query(
      collection(db, "centers", centerId, "auditLogs"),
      orderBy("timestamp", "desc"),
      limit(500)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setLogs(
          snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AiLog)
            .filter((log) => String(log.action || "").startsWith("AI_CLINICAL_"))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [centerId]);

  const fields = useMemo(
    () => Array.from(new Set(logs.map((log) => String(log.metadata?.field || "")).filter(Boolean))),
    [logs]
  );
  const users = useMemo(
    () =>
      Array.from(
        new Set(logs.map((log) => log.actorEmail || log.actorRole || log.actorUid || "").filter(Boolean))
      ),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const date = toDate(log.timestamp);
      const field = String(log.metadata?.field || "");
      const user = log.actorEmail || log.actorRole || log.actorUid || "";
      if (dateFrom && date && date < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && date && date > new Date(`${dateTo}T23:59:59`)) return false;
      if (fieldFilter !== "all" && field !== fieldFilter) return false;
      if (userFilter !== "all" && user !== userFilter) return false;
      return true;
    });
  }, [logs, dateFrom, dateTo, fieldFilter, userFilter]);

  const allConsultations = useMemo<ConsultRow[]>(() => {
    const rows: ConsultRow[] = [];
    patients.forEach((patient) => {
      (patient.consultations || []).forEach((consultation) => {
        rows.push({
          patientId: patient.id,
          patientName: patient.fullName || "Paciente",
          consultation,
        });
      });
    });
    return rows;
  }, [patients]);

  const recentConsultations = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return allConsultations.filter((row) => {
      const d = resolveConsultDate(row.consultation);
      return d && d >= from;
    });
  }, [allConsultations]);

  const aiStats = useMemo(() => {
    const generated = filteredLogs.filter((log) => log.action === "AI_CLINICAL_TEXT_SUGGESTED").length;
    const accepted = filteredLogs.filter((log) => log.action === "AI_CLINICAL_TEXT_ACCEPTED").length;
    const discarded = filteredLogs.filter((log) => log.action === "AI_CLINICAL_TEXT_DISCARDED").length;
    const finalized = filteredLogs.filter((log) => log.action === "AI_CLINICAL_TEXT_FINALIZED");
    const confirmedAlerts = filteredLogs.filter((log) => log.action === "AI_CLINICAL_ALERT_CONFIRMED").length;
    const falsePositiveAlerts = filteredLogs.filter(
      (log) => log.action === "AI_CLINICAL_ALERT_FALSE_POSITIVE"
    ).length;
    const warningTotal = filteredLogs.reduce(
      (sum, log) => sum + Number(log.metadata?.warningCount || 0),
      0
    );
    const acceptanceRate = generated ? Math.round((accepted / generated) * 100) : 0;
    const estimatedSecondsSaved = accepted * 45;
    const avgEditDelta = finalized.length
      ? Math.round(
          finalized.reduce((sum, log) => sum + Number(log.metadata?.editDeltaPct || 0), 0) /
            finalized.length
        )
      : 0;
    return {
      generated,
      accepted,
      discarded,
      warningTotal,
      acceptanceRate,
      estimatedSecondsSaved,
      avgEditDelta,
      confirmedAlerts,
      falsePositiveAlerts,
    };
  }, [filteredLogs]);

  const productivityRows = useMemo(() => {
    const map = new Map<
      string,
      { doctorName: string; role: string; consultations: number; completed: number; noShow: number }
    >();
    const doctorById = new Map(doctors.map((d) => [d.id, d]));

    recentConsultations.forEach((row) => {
      const id = row.consultation.professionalId || "unknown";
      const doc = doctorById.get(id);
      const current = map.get(id) || {
        doctorName: row.consultation.professionalName || doc?.fullName || "Profesional",
        role: String(row.consultation.professionalRole || doc?.role || "N/A"),
        consultations: 0,
        completed: 0,
        noShow: 0,
      };
      current.consultations += 1;
      current.completed += 1;
      map.set(id, current);
    });

    const last30Date = new Date();
    last30Date.setDate(last30Date.getDate() - 30);
    appointments
      .filter((a) => a.status === "booked" && a.attendanceStatus === "no-show")
      .forEach((a) => {
        const d = new Date(`${a.date}T12:00:00`);
        if (Number.isNaN(d.getTime()) || d < last30Date) return;
        const id = (a as any).doctorUid || a.doctorId || "unknown";
        const doc = doctorById.get(id);
        const current = map.get(id) || {
          doctorName: doc?.fullName || "Profesional",
          role: String(doc?.role || "N/A"),
          consultations: 0,
          completed: 0,
          noShow: 0,
        };
        current.noShow += 1;
        map.set(id, current);
      });

    return Array.from(map.entries())
      .map(([doctorId, row]) => ({ doctorId, ...row }))
      .sort((a, b) => b.consultations - a.consultations)
      .slice(0, 12);
  }, [doctors, appointments, recentConsultations]);

  const patientAlerts = useMemo(() => {
    const now = new Date();
    const noControlThreshold = new Date();
    noControlThreshold.setDate(now.getDate() - 90);
    const pendingExamThreshold = new Date();
    pendingExamThreshold.setDate(now.getDate() - 60);

    const noControl: Array<{ patientId: string; patientName: string; days: number }> = [];
    const pendingExams: Array<{ patientId: string; patientName: string; exams: number; days: number }> = [];
    const overdueFollowup: Array<{ patientId: string; patientName: string; nextControlDate: string }> = [];

    patients.forEach((patient) => {
      const consultations = [...(patient.consultations || [])].sort((a, b) => {
        const da = resolveConsultDate(a)?.getTime() || 0;
        const dbb = resolveConsultDate(b)?.getTime() || 0;
        return dbb - da;
      });
      const last = consultations[0];
      const lastDate = last ? resolveConsultDate(last) : null;

      if (!lastDate || lastDate < noControlThreshold) {
        const days = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : 999;
        noControl.push({ patientId: patient.id, patientName: patient.fullName, days });
      }

      if (Array.isArray(patient.activeExams) && patient.activeExams.length > 0) {
        const days = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : 999;
        if (!lastDate || lastDate < pendingExamThreshold) {
          pendingExams.push({
            patientId: patient.id,
            patientName: patient.fullName,
            exams: patient.activeExams.length,
            days,
          });
        }
      }

      if (last?.nextControlDate) {
        const nextDate = new Date(`${last.nextControlDate}T12:00:00`);
        if (!Number.isNaN(nextDate.getTime()) && nextDate < now) {
          overdueFollowup.push({
            patientId: patient.id,
            patientName: patient.fullName,
            nextControlDate: last.nextControlDate,
          });
        }
      }
    });

    return {
      noControl: noControl.sort((a, b) => b.days - a.days).slice(0, 20),
      pendingExams: pendingExams.sort((a, b) => b.days - a.days).slice(0, 20),
      overdueFollowup: overdueFollowup.slice(0, 20),
    };
  }, [patients]);

  const quality = useMemo(() => {
    let missingCore = 0;
    let ambiguous = 0;
    let withoutPlan = 0;
    const issues: Array<{ patientName: string; date: string; issue: string; professional: string }> = [];

    const recent = [...allConsultations]
      .sort(
        (a, b) =>
          (resolveConsultDate(b.consultation)?.getTime() || 0) -
          (resolveConsultDate(a.consultation)?.getTime() || 0)
      )
      .slice(0, 300);

    recent.forEach((row) => {
      const c = row.consultation;
      const date = c.date || "-";
      const professional = c.professionalName || c.professionalRole || "Profesional";
      const coreMissing = !String(c.reason || "").trim() || !String(c.anamnesis || "").trim();
      const lacksPlan = !String(c.nextControlReason || "").trim() && !String(c.nextControlDate || "").trim();
      const text = `${c.anamnesis || ""} ${c.physicalExam || ""} ${c.diagnosis || ""}`.trim();
      const hasAmbiguous = AMBIGUOUS_TERMS.some((pattern) => pattern.test(text));

      if (coreMissing) {
        missingCore += 1;
        issues.push({ patientName: row.patientName, date, issue: "Campos esenciales incompletos", professional });
      }
      if (lacksPlan) {
        withoutPlan += 1;
        issues.push({ patientName: row.patientName, date, issue: "Sin plan ni seguimiento", professional });
      }
      if (hasAmbiguous) {
        ambiguous += 1;
        issues.push({ patientName: row.patientName, date, issue: "Texto ambiguo a revisar", professional });
      }
    });

    const total = recent.length || 1;
    const qualityScore = Math.max(
      0,
      Math.round(100 - ((missingCore * 1.2 + withoutPlan * 1.3 + ambiguous * 0.8) / total) * 100)
    );
    return {
      totalReviewed: recent.length,
      missingCore,
      withoutPlan,
      ambiguous,
      qualityScore,
      issues: issues.slice(0, 40),
    };
  }, [allConsultations]);

  const templateSuggestions = useMemo(() => {
    const roleSet = new Set(doctors.map((d) => String(d.role || "").toUpperCase()));
    const list: Array<{ role: string; title: string; focus: string }> = [];
    roleSet.forEach((role) => {
      (SPECIALTY_TEMPLATES[role] || []).forEach((tpl) => list.push({ role, ...tpl }));
    });
    return list.slice(0, 10);
  }, [doctors]);

  const fieldCounts = useMemo(() => {
    return filteredLogs.reduce<Record<string, number>>((acc, log) => {
      const field = String(log.metadata?.field || "sin_campo");
      acc[field] = (acc[field] || 0) + 1;
      return acc;
    }, {});
  }, [filteredLogs]);

  const recordAlertFeedback = async (sourceLogId: string, feedback: "confirmed" | "false_positive") => {
    const fn = httpsCallable<
      { centerId: string; sourceLogId: string; feedback: string },
      { ok: boolean }
    >(functions, "recordClinicalAiAlertFeedback");
    await fn({ centerId, sourceLogId, feedback });
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold text-white flex items-center gap-3">
              <BrainCircuit className="w-7 h-7 text-indigo-300" /> Inteligencia Operacional
            </h3>
            <p className="text-slate-400 text-sm mt-2">
              IA clínica, productividad, alertas de seguimiento y calidad documental.
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3">
            <p className="text-[10px] uppercase font-black text-slate-500">Calidad documental</p>
            <p className="text-2xl font-black text-white">{quality.qualityScore}/100</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
            <p className="text-xs uppercase font-black text-slate-500 mb-2">IA Aceptación</p>
            <p className="text-3xl font-black text-white">{aiStats.acceptanceRate}%</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
            <p className="text-xs uppercase font-black text-slate-500 mb-2">Alertas IA</p>
            <p className="text-3xl font-black text-amber-300">{aiStats.warningTotal}</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
            <p className="text-xs uppercase font-black text-slate-500 mb-2">Sin control &gt;90d</p>
            <p className="text-3xl font-black text-rose-300">{patientAlerts.noControl.length}</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
            <p className="text-xs uppercase font-black text-slate-500 mb-2">Exámenes pendientes</p>
            <p className="text-3xl font-black text-indigo-300">{patientAlerts.pendingExams.length}</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
            <p className="text-xs uppercase font-black text-slate-500 mb-2">Tiempo ahorrado IA</p>
            <p className="text-3xl font-black text-health-300">
              {Math.round(aiStats.estimatedSecondsSaved / 60)} min
            </p>
          </div>
        </div>

        <div className="mt-6 bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-400" />
            <p className="text-xs uppercase font-black text-slate-500">Filtros IA</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            />
            <select
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="all">Todos los campos</option>
              {fields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="all">Todos los usuarios</option>
              {users.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
          <h4 className="font-bold text-white mb-4 flex items-center gap-2">
            <UsersRound className="w-5 h-5 text-cyan-300" /> Productividad (30 días)
          </h4>
          <div className="space-y-3">
            {productivityRows.map((row) => (
              <div key={row.doctorId} className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-bold">{row.doctorName}</p>
                    <p className="text-xs text-slate-400">{row.role}</p>
                  </div>
                  <p className="text-sm text-slate-300">No-show: {row.noShow}</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-slate-800 rounded px-2 py-1 text-slate-300">
                    Consultas: <span className="font-bold text-white">{row.consultations}</span>
                  </div>
                  <div className="bg-slate-800 rounded px-2 py-1 text-slate-300">
                    Efectivas: <span className="font-bold text-emerald-300">{row.completed}</span>
                  </div>
                </div>
              </div>
            ))}
            {productivityRows.length === 0 && (
              <p className="text-sm text-slate-500">Sin datos de productividad reciente.</p>
            )}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
          <h4 className="font-bold text-white mb-4 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-rose-300" /> Alertas clínicas
          </h4>
          <div className="space-y-3 text-sm">
            <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
              <p className="font-bold text-rose-200">Pacientes sin control (&gt;90 días)</p>
              <p className="text-slate-400">{patientAlerts.noControl.length} casos</p>
            </div>
            <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
              <p className="font-bold text-indigo-200">Pacientes con exámenes pendientes</p>
              <p className="text-slate-400">{patientAlerts.pendingExams.length} casos</p>
            </div>
            <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
              <p className="font-bold text-amber-200">Próximo control vencido</p>
              <p className="text-slate-400">{patientAlerts.overdueFollowup.length} casos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
          <h4 className="font-bold text-white mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-300" /> Motor de calidad documental
          </h4>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-900/70 rounded-xl p-3 border border-slate-700">
              <p className="text-xs text-slate-500 uppercase">Campos vacíos</p>
              <p className="text-2xl font-black text-rose-300">{quality.missingCore}</p>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-3 border border-slate-700">
              <p className="text-xs text-slate-500 uppercase">Texto ambiguo</p>
              <p className="text-2xl font-black text-amber-300">{quality.ambiguous}</p>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-3 border border-slate-700">
              <p className="text-xs text-slate-500 uppercase">Sin plan/seguimiento</p>
              <p className="text-2xl font-black text-indigo-300">{quality.withoutPlan}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Muestra basada en {quality.totalReviewed} consultas recientes del centro.
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
          <h4 className="font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-300" /> Plantillas sugeridas por especialidad
          </h4>
          <div className="space-y-3">
            {templateSuggestions.map((tpl, idx) => (
              <div key={`${tpl.role}-${idx}`} className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
                <div className="flex justify-between gap-2">
                  <p className="text-white font-bold">{tpl.title}</p>
                  <span className="text-[10px] px-2 py-1 rounded bg-indigo-500/20 text-indigo-200 font-black">
                    {tpl.role}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{tpl.focus}</p>
              </div>
            ))}
            {templateSuggestions.length === 0 && (
              <p className="text-sm text-slate-500">Sin especialidades activas para sugerencias.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h4 className="font-bold text-white">Eventos IA recientes</h4>
          {loading && <span className="text-xs text-slate-500">Cargando...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/70 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3">Fecha</th>
                <th className="text-left px-5 py-3">Acción</th>
                <th className="text-left px-5 py-3">Campo</th>
                <th className="text-left px-5 py-3">Usuario</th>
                <th className="text-left px-5 py-3">Prompt</th>
                <th className="text-left px-5 py-3">Alertas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredLogs.slice(0, 80).map((log) => (
                <tr key={log.id} className="hover:bg-slate-700/30">
                  <td className="px-5 py-3 text-slate-400">{toDateLabel(log.timestamp)}</td>
                  <td className="px-5 py-3 text-white font-semibold">{log.action}</td>
                  <td className="px-5 py-3 text-slate-300">{log.metadata?.field || "-"}</td>
                  <td className="px-5 py-3 text-slate-300">
                    {log.actorEmail || log.actorRole || log.actorUid || "-"}
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {log.metadata?.promptId || "-"}
                    {log.metadata?.promptVersion ? `@${log.metadata.promptVersion}` : ""}
                  </td>
                  <td className="px-5 py-3 text-amber-300">
                    <div className="flex items-center gap-2">
                      <span>{log.metadata?.warningCount || 0}</span>
                      {Number(log.metadata?.warningCount || 0) > 0 && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => recordAlertFeedback(log.id, "confirmed")}
                            className="px-2 py-1 rounded bg-amber-500/10 text-amber-200 text-[10px] font-bold"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => recordAlertFeedback(log.id, "false_positive")}
                            className="px-2 py-1 rounded bg-slate-700 text-slate-200 text-[10px] font-bold"
                          >
                            Falso +
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Sin eventos de IA clínica registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
          <h4 className="font-bold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-300" /> Casos críticos de seguimiento
          </h4>
          <div className="space-y-2 text-sm max-h-72 overflow-y-auto">
            {patientAlerts.noControl.slice(0, 12).map((item) => (
              <div key={`nocontrol-${item.patientId}`} className="bg-slate-900/70 border border-slate-700 rounded-lg p-2">
                <p className="text-white font-semibold">{item.patientName}</p>
                <p className="text-slate-400">Sin control hace {item.days} días</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
          <h4 className="font-bold text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-300" /> Incidencias documentales
          </h4>
          <div className="space-y-2 text-sm max-h-72 overflow-y-auto">
            {quality.issues.slice(0, 12).map((item, idx) => (
              <div key={`issue-${idx}`} className="bg-slate-900/70 border border-slate-700 rounded-lg p-2">
                <p className="text-white font-semibold">{item.patientName}</p>
                <p className="text-slate-400">
                  {item.date} - {item.issue} - {item.professional}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden">
        {Object.entries(fieldCounts).map(([field, count]) => (
          <span key={field}>
            {field}:{count}
          </span>
        ))}
      </div>
    </div>
  );
};

export default AdminAIUsageTab;
