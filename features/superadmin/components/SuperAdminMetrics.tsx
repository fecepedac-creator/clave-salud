import React from "react";
import { Activity, TrendingUp, Users, RefreshCw } from "lucide-react";
import { MedicalCenter } from "../../../types";

type PlanKey = "trial" | "basic" | "pro" | "enterprise";
type BillingStatus = "paid" | "due" | "overdue" | "grace" | "suspended";

type BillingInfo = {
  plan?: PlanKey;
  monthlyUF?: number;
  billingStatus?: BillingStatus;
  nextDueDate?: string;
  lastPaidAt?: string;
  notes?: string;
};

type CenterExt = MedicalCenter & {
  adminEmail?: string;
  billing?: BillingInfo;
  logoUrl?: string;
  stats?: {
    consultationCount: number;
    staffCount: number;
    patientCount: number;
  };
};

interface SuperAdminMetricsProps {
  centers: CenterExt[];
  doctors: any[];
  metricsLoading: boolean;
  handleRecalcStats: () => void;
}

export const SuperAdminMetrics: React.FC<SuperAdminMetricsProps> = ({
  centers,
  doctors,
  metricsLoading,
  handleRecalcStats,
}) => {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-700">
              Analítica transversal
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Uso de Plataforma</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
              Monitorea actividad clínica, dotación y salud operativa por centro desde una misma capa de métricas.
            </p>
          </div>
          <button
            onClick={() => handleRecalcStats()}
            disabled={metricsLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${metricsLoading ? "animate-spin" : ""}`} />
            Actualizar todo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-400">Atenciones (total)</div>
            <div className="text-2xl font-bold text-slate-800">
              {centers.reduce((acc, c) => acc + ((c as any).stats?.consultationCount || 0), 0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-400">Profesionales (total)</div>
            <div className="text-2xl font-bold text-slate-800">
              {centers.reduce((acc, c) => acc + ((c as any).stats?.staffCount || 0), 0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-400">Pacientes Registrados</div>
            <div className="text-2xl font-bold text-slate-800">
              {centers.reduce((acc, c) => acc + ((c as any).stats?.patientCount || 0), 0)}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 p-6">
          <h3 className="font-bold text-slate-800">Ranking de Actividad por Centro</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-6 py-4">Centro Médico</th>
                <th className="px-6 py-4">Profesionales</th>
                <th className="px-6 py-4">Consultas acumuladas</th>
                <th className="px-6 py-4">Status Salud</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {centers.map((c) => {
                const staffCount = (c as any).stats?.staffCount || 0;
                const consultationCount = (c as any).stats?.consultationCount || 0;

                let healthColor = "text-emerald-500 bg-emerald-50 border-emerald-100";
                let healthLabel = "Activo / Privado";

                if (consultationCount > 50) {
                  healthLabel = "Activo / Estable";
                } else if (consultationCount > 0) {
                  healthLabel = "Inicio de operación";
                  healthColor = "text-blue-500 bg-blue-50 border-blue-100";
                } else {
                  healthLabel = "Inactivo / Demo";
                  healthColor = "text-slate-400 bg-slate-50 border-slate-100";
                }

                if (consultationCount > 0 && staffCount === 0) {
                  healthLabel = "Anomalía (Sin staff)";
                  healthColor = "text-amber-500 bg-amber-50 border-amber-100";
                }

                return (
                  <tr key={c.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{c.name}</div>
                      <div className="font-mono text-xs text-slate-400">/{c.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">{staffCount}</span>
                        <span className="text-xs text-slate-400">/{(c as any).maxUsers || 10}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-lg font-bold text-slate-800">{consultationCount}</td>
                    <td className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">
                      <span className={`rounded-full border px-3 py-1 ${healthColor}`}>{healthLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};