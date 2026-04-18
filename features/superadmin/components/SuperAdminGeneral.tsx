import React from "react";
import {
  TrendingUp,
  Users,
  Zap,
  Building2,
  Activity,
  ShieldCheck,
} from "lucide-react";
import MetricCard from "../../../components/MetricCard";
import { MedicalCenter } from "../../../types";

type Tab = "general" | "centers" | "finanzas" | "metrics" | "comunicacion" | "users";

interface SuperAdminGeneralProps {
  totals: {
    total: number;
    active: number;
    maxUsers: number;
    billingStats: any;
    atRisk: number;
  };
  metrics: { patients: number; professionals: number };
  metricsLoading: boolean;
  metricsUpdatedAt: string;
  metricsError: string;
  setActiveTab: (tab: Tab) => void;
  canUsePreview?: boolean;
  centers: MedicalCenter[];
  previewCenterSelection: string;
  setPreviewCenterSelection: (id: string) => void;
  previewRoles: any[];
  previewRoleSelection: string;
  setPreviewRoleSelection: (roleId: string) => void;
  onStartPreview?: (centerId: string, role: string) => void;
  showToast: (msg: string, type: "success" | "error" | "warning" | "info") => void;
  previewCenterId?: string;
  previewRole?: string;
  onExitPreview?: () => void;
  setShowMarketingModal: (show: boolean) => void;
}

export const SuperAdminGeneral: React.FC<SuperAdminGeneralProps> = ({
  totals,
  metrics,
  metricsLoading,
  metricsUpdatedAt,
  metricsError,
  setActiveTab,
  canUsePreview,
  centers,
  previewCenterSelection,
  setPreviewCenterSelection,
  previewRoles,
  previewRoleSelection,
  setPreviewRoleSelection,
  onStartPreview,
  showToast,
  previewCenterId,
  previewRole,
  onExitPreview,
  setShowMarketingModal,
}) => {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-700">
              Vista ejecutiva
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
              Visión General
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Sigue salud operativa, centros activos y riesgo comercial desde un mismo
              tablero, con acceso rápido a preview, métricas y campañas.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Centros activos
              </p>
              <p className="mt-2 text-3xl font-black text-slate-900">{totals.active}</p>
              <p className="mt-1 text-xs text-slate-500">Sobre {totals.total} centros totales</p>
            </div>
            <div className="rounded-2xl border border-health-100 bg-health-50 px-4 py-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-health-700">
                Pacientes
              </p>
              <p className="mt-2 text-3xl font-black text-health-700">
                {metricsLoading ? "—" : metrics.patients.toLocaleString("es-CL")}
              </p>
              <p className="mt-1 text-xs text-health-700/80">Conteo global consolidado</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">
                Riesgo
              </p>
              <p className="mt-2 text-3xl font-black text-rose-700">{totals.atRisk}</p>
              <p className="mt-1 text-xs text-rose-700/80">Centros con baja actividad</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Centros" value={totals.total} icon="Building2" colorClass="text-indigo-400" />
        <MetricCard title="Centros Activos" value={totals.active} icon="Zap" colorClass="text-health-400" />
        <MetricCard title="Cupos Totales" value={totals.maxUsers} icon="Users" colorClass="text-sky-400" />
        <MetricCard title="Atrasados" value={totals.billingStats.overdue || 0} icon="TrendingUp" colorClass="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <MetricCard
          title="Pacientes Totales"
          value={metricsLoading ? "—" : metrics.patients.toLocaleString("es-CL")}
          icon="Activity"
          colorClass="text-rose-400"
          loading={metricsLoading}
        />
        <MetricCard
          title="Profesionales Activos"
          value={metricsLoading ? "—" : metrics.professionals.toLocaleString("es-CL")}
          icon="ShieldCheck"
          colorClass="text-health-400"
          loading={metricsLoading}
        />
        <button
          onClick={() => setActiveTab("metrics")}
          className="group rounded-3xl border border-rose-100 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-2xl bg-rose-50 p-3 text-rose-500">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">
              Crítico
            </div>
          </div>
          <h3 className="mb-1 text-sm font-medium text-slate-500">Baja actividad clínica</h3>
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900">{totals.atRisk}</span>
            <div className="text-rose-500 opacity-0 transition-opacity group-hover:opacity-100">
              Analizar -&gt;
            </div>
          </div>
        </button>
      </div>

      {metricsUpdatedAt && (
        <div className="mt-0 text-[10px] italic text-slate-400">
          Última sincronización de métricas globales: {new Date(metricsUpdatedAt).toLocaleString("es-CL")}
        </div>
      )}
      {metricsError && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
          {metricsError}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-600 shadow-sm">
        <p className="mb-2 font-semibold text-slate-800">Nota importante</p>
        <p>
          Por seguridad, este panel <b>no crea usuarios/contraseñas</b> en Firebase Auth desde el navegador.
          Para un alta segura de administradores, usa una <b>Cloud Function</b> (Admin SDK) o un flujo de invitación controlado.
        </p>
      </div>

      {canUsePreview && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-1">
            <h2 className="text-xl font-bold text-slate-800">Preview de Roles</h2>
            <p className="text-sm text-slate-500">
              Simula dashboards por rol y centro sin crear usuarios ni cambiar login.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 ml-1 block text-xs font-bold uppercase text-slate-500">Centro</label>
              <select className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-700" value={previewCenterSelection} onChange={(e) => setPreviewCenterSelection(e.target.value)}>
                <option value="">Selecciona un centro</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>{center.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 ml-1 block text-xs font-bold uppercase text-slate-500">Rol clínico</label>
              <select className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-700" value={previewRoleSelection} onChange={(e) => setPreviewRoleSelection(e.target.value)}>
                <option value="">Selecciona un rol</option>
                {previewRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!previewCenterSelection || !previewRoleSelection) {
                    showToast("Selecciona un centro y un rol para activar preview.", "error");
                    return;
                  }
                  onStartPreview?.(previewCenterSelection, previewRoleSelection);
                  showToast("Preview activado. Abriendo dashboard.", "success");
                }}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700"
              >
                Activar preview
              </button>
              {previewCenterId && previewRole && (
                <button type="button" onClick={onExitPreview} className="w-full rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200">
                  Salir de preview
                </button>
              )}
            </div>
          </div>

          {previewCenterId && previewRole && (
            <div className="mt-4 text-xs text-slate-500">
              Preview activo en <span className="font-semibold text-slate-700">{previewCenterId}</span> con rol <span className="font-semibold text-slate-700">{previewRole}</span>.
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-800">Marketing Digital</h2>
          <p className="text-sm text-slate-500">
            Genera flyers publicitarios de alta calidad para promocionar ClaveSalud en redes sociales.
          </p>
        </div>
        <button
          onClick={() => setShowMarketingModal(true)}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 text-center font-bold text-white shadow-md transition-all hover:from-blue-700 hover:to-cyan-700 hover:shadow-lg"
        >
          Crear Flyer de ClaveSalud
        </button>
      </div>
    </div>
  );
};