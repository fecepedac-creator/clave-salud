import React from "react";
import {
  TrendingUp,
  Users,
  Zap,
  Building2,
  AlertTriangle,
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
      <h1 className="text-3xl font-bold text-slate-800">Visión General</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Centros"
          value={totals.total}
          icon="Building2"
          colorClass="text-indigo-400"
        />
        <MetricCard
          title="Centros Activos"
          value={totals.active}
          icon="Zap"
          colorClass="text-health-400"
        />
        <MetricCard
          title="Cupos Totales"
          value={totals.maxUsers}
          icon="Users"
          colorClass="text-sky-400"
        />
        <MetricCard
          title="Atrasados"
          value={totals.billingStats.overdue || 0}
          icon="AlertTriangle"
          colorClass="text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          className="bg-slate-800 p-6 rounded-3xl border border-slate-700 hover:border-red-500/50 transition-all group hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] transform hover:-translate-y-1 text-left"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-slate-900/50 text-red-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="bg-red-500/10 text-red-500 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Crítico
            </div>
          </div>
          <h3 className="text-slate-400 text-sm font-medium mb-1">En Riesgo (Bajo Uso)</h3>
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-white tracking-tight">{totals.atRisk}</span>
            <div className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Analizar →
            </div>
          </div>
        </button>
      </div>

      {metricsUpdatedAt && (
        <div className="text-[10px] text-slate-400 mt-0 italic">
          Última sincronización de métricas globales:{" "}
          {new Date(metricsUpdatedAt).toLocaleString("es-CL")}
        </div>
      )}
      {metricsError && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-4">
          {metricsError}
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-sm text-slate-600">
        <p className="font-semibold text-slate-800 mb-2">Nota importante</p>
        <p>
          Por seguridad, este panel <b>no crea usuarios/contraseñas</b> en Firebase Auth desde el
          navegador. Para un alta segura de administradores, usa una <b>Cloud Function</b> (Admin
          SDK) o un flujo de invitación controlado.
        </p>
      </div>

      {canUsePreview && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col gap-1 mb-6">
            <h2 className="text-xl font-bold text-slate-800">Preview de Roles</h2>
            <p className="text-sm text-slate-500">
              Simula dashboards por rol y centro sin crear usuarios ni cambiar login.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                Centro
              </label>
              <select
                className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-700"
                value={previewCenterSelection}
                onChange={(e) => setPreviewCenterSelection(e.target.value)}
              >
                <option value="">Selecciona un centro</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                Rol clínico
              </label>
              <select
                className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-700"
                value={previewRoleSelection}
                onChange={(e) => setPreviewRoleSelection(e.target.value)}
              >
                <option value="">Selecciona un rol</option>
                {previewRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
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
                className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700"
              >
                Activar preview
              </button>
              {previewCenterId && previewRole && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Salir de preview
                </button>
              )}
            </div>
          </div>

          {previewCenterId && previewRole && (
            <div className="mt-4 text-xs text-slate-500">
              Preview activo en{" "}
              <span className="font-semibold text-slate-700">{previewCenterId}</span> con rol{" "}
              <span className="font-semibold text-slate-700">{previewRole}</span>.
            </div>
          )}
        </div>
      )}

      {/* MARKETING - Flyers de ClaveSalud */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col gap-1 mb-4">
          <h2 className="text-xl font-bold text-slate-800">📢 Marketing Digital</h2>
          <p className="text-sm text-slate-500">
            Genera flyers publicitarios de alta calidad para promocionar ClaveSalud en redes
            sociales.
          </p>
        </div>
        <button
          onClick={() => setShowMarketingModal(true)}
          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg text-center"
        >
          Crear Flyer de ClaveSalud
        </button>
      </div>
    </div>
  );
};
