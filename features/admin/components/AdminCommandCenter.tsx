import React from "react";
import { Appointment, Doctor, Preadmission } from "../../../types";
import MetricCard from "../../../components/MetricCard";
import TodayActivity from "./TodayActivity";
import PreadmissionList from "./PreadmissionList";

export interface AdminCommandCenterProps {
  stats: {
    totalPatients: number;
    todayAppointments: number;
    pendingPreadmissions: number;
    activeDoctors: number;
  };
  appointments: Appointment[];
  doctors: Doctor[];
  preadmissions: Preadmission[];
  onOpenPatient: (appointment: Appointment) => void;
  onCancelAppointment: (appointment: Appointment) => void;
  onApprovePreadmission: (preadmission: Preadmission) => void;
}

const AdminCommandCenter: React.FC<AdminCommandCenterProps> = ({
  stats,
  appointments,
  doctors,
  preadmissions,
  onOpenPatient,
  onCancelAppointment,
  onApprovePreadmission,
}) => {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <section className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-black/20 md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-health-500/20 bg-health-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-health-300">
              Operación del día
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white">Command Center</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Supervisa cartera, agenda y preingresos desde una vista breve que prioriza decisiones rápidas del centro.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Hoy</p>
              <p className="mt-2 text-3xl font-black text-white">{stats.todayAppointments}</p>
              <p className="mt-1 text-xs text-slate-400">Citas activas en agenda</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Pendiente</p>
              <p className="mt-2 text-3xl font-black text-amber-200">{stats.pendingPreadmissions}</p>
              <p className="mt-1 text-xs text-amber-100/80">Preingresos por resolver</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Pacientes Totales" value={stats.totalPatients} icon="Users" colorClass="text-emerald-400" />
        <MetricCard title="Citas Hoy" value={stats.todayAppointments} icon="Calendar" colorClass="text-blue-400" />
        <MetricCard title="Preingresos" value={stats.pendingPreadmissions} icon="Clock" colorClass="text-amber-400" />
        <MetricCard title="Médicos Activos" value={stats.activeDoctors} icon="Activity" colorClass="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TodayActivity appointments={appointments} doctors={doctors} onOpenPatient={onOpenPatient} onCancel={onCancelAppointment} />
        <PreadmissionList preadmissions={preadmissions} doctors={doctors} onApprove={onApprovePreadmission} />
      </div>
    </div>
  );
};

export default AdminCommandCenter;