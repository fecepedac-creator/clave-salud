import React from "react";
import { Appointment, Doctor, Preadmission } from "../../../types";
import MetricCard from "../../../components/MetricCard";
import TodayActivity from "./TodayActivity";
import PreadmissionList from "./PreadmissionList";
import { Users, Calendar, Activity, Clock } from "lucide-react";

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
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Pacientes Totales"
          value={stats.totalPatients}
          icon="Users"
          colorClass="text-emerald-400"
          trend={{ value: "+12%", isUp: true }}
        />
        <MetricCard
          title="Citas Hoy"
          value={stats.todayAppointments}
          icon="Calendar"
          colorClass="text-blue-400"
          trend={{ value: "+5", isUp: true }}
        />
        <MetricCard
          title="Preingresos"
          value={stats.pendingPreadmissions}
          icon="Clock"
          colorClass="text-amber-400"
          trend={{ value: "-2", isUp: false }}
        />
        <MetricCard
          title="Médicos Activos"
          value={stats.activeDoctors}
          icon="Activity"
          colorClass="text-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Activity */}
        <TodayActivity
          appointments={appointments}
          doctors={doctors}
          onOpenPatient={onOpenPatient}
          onCancel={onCancelAppointment}
        />

        {/* Preadmissions */}
        <PreadmissionList
          preadmissions={preadmissions}
          doctors={doctors}
          onApprove={onApprovePreadmission}
        />
      </div>
    </div>
  );
};

export default AdminCommandCenter;
