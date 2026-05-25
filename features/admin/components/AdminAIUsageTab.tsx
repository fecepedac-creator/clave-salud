import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { AlertTriangle, BarChart3, BrainCircuit, CheckCircle2, XCircle } from "lucide-react";
import { db } from "../../../firebase";

type AiLog = {
  id: string;
  action: string;
  actorEmail?: string;
  actorRole?: string;
  entityId?: string;
  details?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
};

interface AdminAIUsageTabProps {
  centerId: string;
}

function toDateLabel(value: any): string {
  if (!value) return "-";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString("es-CL");
  if (typeof value === "string") return new Date(value).toLocaleString("es-CL");
  return "-";
}

const AdminAIUsageTab: React.FC<AdminAIUsageTabProps> = ({ centerId }) => {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !centerId) return;
    setLoading(true);
    const q = query(
      collection(db, "centers", centerId, "auditLogs"),
      orderBy("timestamp", "desc"),
      limit(300)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setLogs(
          snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AiLog)
            .filter((log) => String(log.action || "").startsWith("AI_CLINICAL_TEXT_"))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [centerId]);

  const stats = useMemo(() => {
    const generated = logs.filter((log) => log.action === "AI_CLINICAL_TEXT_SUGGESTED").length;
    const accepted = logs.filter((log) => log.action === "AI_CLINICAL_TEXT_ACCEPTED").length;
    const discarded = logs.filter((log) => log.action === "AI_CLINICAL_TEXT_DISCARDED").length;
    const warningTotal = logs.reduce(
      (sum, log) => sum + Number(log.metadata?.warningCount || 0),
      0
    );
    const acceptanceRate = generated ? Math.round((accepted / generated) * 100) : 0;
    const estimatedSecondsSaved = accepted * 45;
    return { generated, accepted, discarded, warningTotal, acceptanceRate, estimatedSecondsSaved };
  }, [logs]);

  const fieldCounts = useMemo(() => {
    return logs.reduce<Record<string, number>>((acc, log) => {
      const field = String(log.metadata?.field || "sin_campo");
      acc[field] = (acc[field] || 0) + 1;
      return acc;
    }, {});
  }, [logs]);

  const cards = [
    {
      label: "Sugerencias",
      value: stats.generated,
      icon: BrainCircuit,
      color: "text-indigo-300",
    },
    {
      label: "Aceptadas",
      value: stats.accepted,
      icon: CheckCircle2,
      color: "text-emerald-300",
    },
    {
      label: "Descartadas",
      value: stats.discarded,
      icon: XCircle,
      color: "text-rose-300",
    },
    {
      label: "Alertas",
      value: stats.warningTotal,
      icon: AlertTriangle,
      color: "text-amber-300",
    },
  ];

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold text-white flex items-center gap-3">
              <BrainCircuit className="w-7 h-7 text-indigo-300" /> Uso de IA Clinica
            </h3>
            <p className="text-slate-400 text-sm mt-2">
              Seguimiento de generacion, aceptacion, descarte y alertas sin almacenar texto clinico.
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3">
            <p className="text-[10px] uppercase font-black text-slate-500">Aceptacion</p>
            <p className="text-2xl font-black text-white">{stats.acceptanceRate}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase font-black text-slate-500">{card.label}</p>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-3xl font-black text-white">{card.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
            <p className="text-xs uppercase font-black text-slate-500 mb-3">Campos usados</p>
            <div className="space-y-2">
              {Object.entries(fieldCounts).map(([field, count]) => (
                <div key={field} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{field}</span>
                  <span className="text-white font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(fieldCounts).length === 0 && (
                <p className="text-slate-500 text-sm">Sin uso clinico de IA registrado.</p>
              )}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
            <p className="text-xs uppercase font-black text-slate-500 mb-3">
              Tiempo ahorrado estimado
            </p>
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-health-400" />
              <div>
                <p className="text-3xl font-black text-white">
                  {Math.round(stats.estimatedSecondsSaved / 60)} min
                </p>
                <p className="text-xs text-slate-500">Base conservadora: 45 segundos por aceptacion.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h4 className="font-bold text-white">Eventos recientes</h4>
          {loading && <span className="text-xs text-slate-500">Cargando...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/70 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3">Fecha</th>
                <th className="text-left px-5 py-3">Accion</th>
                <th className="text-left px-5 py-3">Campo</th>
                <th className="text-left px-5 py-3">Usuario</th>
                <th className="text-left px-5 py-3">Prompt</th>
                <th className="text-left px-5 py-3">Alertas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {logs.slice(0, 80).map((log) => (
                <tr key={log.id} className="hover:bg-slate-700/30">
                  <td className="px-5 py-3 text-slate-400">{toDateLabel((log as any).timestamp)}</td>
                  <td className="px-5 py-3 text-white font-semibold">{log.action}</td>
                  <td className="px-5 py-3 text-slate-300">{log.metadata?.field || "-"}</td>
                  <td className="px-5 py-3 text-slate-300">{log.actorEmail || log.actorRole || "-"}</td>
                  <td className="px-5 py-3 text-slate-400">
                    {log.metadata?.promptId || "-"}
                    {log.metadata?.promptVersion ? `@${log.metadata.promptVersion}` : ""}
                  </td>
                  <td className="px-5 py-3 text-amber-300">{log.metadata?.warningCount || 0}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Sin eventos de IA clinica registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAIUsageTab;
