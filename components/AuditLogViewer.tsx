import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { AuditLogEntry, AuditAction, Doctor, Patient } from "../types";
import { Download, Filter, RefreshCw } from "lucide-react";

const RANGE_OPTIONS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
];

const ACTION_OPTIONS: AuditAction[] = [
  "ACCESS",
  "PATIENT_CREATE",
  "PATIENT_UPDATE",
  "PATIENT_ARCHIVE",
  "CONSULTATION_CREATE",
  "CONSULTATION_UPDATE",
  "CONSULTATION_ARCHIVE",
  "APPOINTMENT_CREATE",
  "APPOINTMENT_UPDATE",
  "APPOINTMENT_CANCEL",
  "APPOINTMENT_ARCHIVE",
  "CARE_TEAM_UPDATE",
  "CENTER_ACCESSMODE_UPDATE",
  "ARCHIVE_BLOCKED_RETENTION",
];

function toDate(value: AuditLogEntry["timestamp"]): Date | null {
  if (!value) return null;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return null;
}

function formatCsvValue(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

interface AuditLogViewerProps {
  centerId: string;
  staff: Doctor[];
  patients: Patient[];
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ centerId, staff, patients }) => {
  const [rangeDays, setRangeDays] = useState(RANGE_OPTIONS[1].days);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [patientQuery, setPatientQuery] = useState<string>("");
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const patientLookup = useMemo(() => {
    return new Map(patients.map((p) => [p.id, p]));
  }, [patients]);

  const actorOptions = useMemo(
    () =>
      staff
        .filter((s) => s.active !== false && s.activo !== false)
        .map((s) => ({ value: s.id, label: s.fullName || s.email || s.id })),
    [staff]
  );

  const fetchLogs = async (mode: "initial" | "next" = "initial") => {
    if (!db || !centerId) return;
    setLoading(true);

    const logsRef = collection(db, "centers", centerId, "auditLogs");
    const filters = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    filters.push(where("timestamp", ">=", Timestamp.fromDate(cutoff)));

    if (actionFilter) {
      filters.push(where("action", "==", actionFilter));
    }
    if (actorFilter) {
      filters.push(where("actorUid", "==", actorFilter));
    }

    let q = query(logsRef, orderBy("timestamp", "desc"), ...filters, limit(50));
    if (mode === "next" && lastDoc) {
      q = query(logsRef, orderBy("timestamp", "desc"), ...filters, startAfter(lastDoc), limit(50));
    }
    try {
      const snapshot = await getDocs(q);
      const nextLogs = snapshot.docs.map((docSnap) => docSnap.data() as AuditLogEntry);
      setLogs((prev) => (mode === "next" ? [...prev, ...nextLogs] : nextLogs));
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
    } catch (error) {
      console.error("audit logs fetch", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, rangeDays, actionFilter, actorFilter]);

  const filteredLogs = useMemo(() => {
    const queryNorm = patientQuery.trim().toLowerCase();
    if (!queryNorm) return logs;
    return logs.filter((log) => {
      const patient = log.patientId ? patientLookup.get(log.patientId) : undefined;
      if (!patient) return false;
      return (
        patient.fullName?.toLowerCase().includes(queryNorm) ||
        patient.rut?.toLowerCase().includes(queryNorm)
      );
    });
  }, [logs, patientQuery, patientLookup]);

  const exportCsv = () => {
    const headers = ["Fecha", "Actor", "Acción", "Entidad", "Paciente", "Detalles"];
    const rows = filteredLogs.map((log) => {
      const date = toDate(log.timestamp)?.toLocaleString("es-CL") ?? "";
      const actor = log.actorName || log.actorUid || "-";
      const action = log.action || log.metadata?.action || log.type || "-";
      const entity = log.entityType ? `${log.entityType}:${log.entityId}` : log.entityId || "-";
      const patient =
        (log.patientId && patientLookup.get(log.patientId)?.fullName) || log.patientId || "-";
      const details = log.details || (log.metadata?.details as string) || "";
      return [date, actor, action, entity, patient, details];
    });

    const csv = [
      headers.map(formatCsvValue).join(","),
      ...rows.map((row) => row.map((cell) => formatCsvValue(String(cell))).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${centerId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-bold text-white text-2xl flex items-center gap-2">
            <Filter className="w-6 h-6 text-indigo-400" /> Auditoría de seguridad
          </h3>
          <p className="text-slate-400 mt-1 text-sm">
            Registro de accesos y cambios críticos en la ficha clínica.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs("initial")}
            className="flex items-center gap-2 text-xs font-bold text-slate-200 bg-slate-700 px-3 py-2 rounded-lg hover:bg-slate-600"
          >
            <RefreshCw className="w-4 h-4" /> Recargar
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 text-xs font-bold text-emerald-200 bg-emerald-700/40 px-3 py-2 rounded-lg hover:bg-emerald-600/60"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
          <label className="text-xs uppercase text-slate-400 font-bold">Rango</label>
          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
            className="mt-2 w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                Últimos {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
          <label className="text-xs uppercase text-slate-400 font-bold">Acción</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="mt-2 w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {ACTION_OPTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
          <label className="text-xs uppercase text-slate-400 font-bold">Actor</label>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="mt-2 w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {actorOptions.map((actor) => (
              <option key={actor.value} value={actor.value}>
                {actor.label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
          <label className="text-xs uppercase text-slate-400 font-bold">Paciente</label>
          <input
            value={patientQuery}
            onChange={(e) => setPatientQuery(e.target.value)}
            placeholder="Buscar por RUT o nombre"
            className="mt-2 w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
            <tr>
              <th className="p-4">Fecha / Hora</th>
              <th className="p-4">Actor</th>
              <th className="p-4">Acción</th>
              <th className="p-4">Paciente</th>
              <th className="p-4">Entidad</th>
              <th className="p-4">Detalles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700 bg-slate-800/50">
            {filteredLogs.map((log) => {
              const date = toDate(log.timestamp);
              const patient = log.patientId ? patientLookup.get(log.patientId) : undefined;
              return (
                <tr key={log.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4 text-slate-300 font-mono text-sm">
                    <div className="font-bold text-white">
                      {date ? date.toLocaleDateString("es-CL") : "-"}
                    </div>
                    <div className="text-xs opacity-60">
                      {date ? date.toLocaleTimeString("es-CL") : ""}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-white">{log.actorName || "Usuario"}</div>
                    <div className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded w-fit mt-1">
                      {log.actorRole || "staff"}
                    </div>
                  </td>
                  <td className="p-4 text-xs font-bold uppercase text-indigo-200">
                    {log.action || log.type || "ACCION"}
                  </td>
                  <td className="p-4 text-slate-300 text-sm">
                    {patient?.fullName || log.patientId || "-"}
                  </td>
                  <td className="p-4 text-slate-300 text-sm">
                    {log.entityType ? `${log.entityType} · ${log.entityId}` : log.entityId || "-"}
                  </td>
                  <td className="p-4 text-slate-300 text-sm">
                    {log.details || (log.metadata?.details as string) || "-"}
                  </td>
                </tr>
              );
            })}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                  {loading ? "Cargando registros..." : "No hay registros para estos filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={() => fetchLogs("next")}
          disabled={!lastDoc || loading}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm font-bold hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cargar más
        </button>
      </div>
    </div>
  );
};

export default AuditLogViewer;
