import React, { useState } from "react";
import LegalLinks from "../../../components/LegalLinks";

interface Appointment {
  doctorId: string;
  status: string;
  date: string;
}

interface DoctorMainHeaderProps {
  doctorName: string;
  activeCenter?: {
    logoUrl?: string;
    name?: string;
  };
  appointments: Appointment[];
  doctorId: string;
  onOpenLegal: (type: "terms" | "privacy") => void;
}

const DoctorMainHeader: React.FC<DoctorMainHeaderProps> = ({
  doctorName,
  activeCenter,
  appointments,
  doctorId,
  onOpenLegal,
}) => {
  const [centerLogoError, setCenterLogoError] = useState(false);

  const todayCount = appointments.filter(
    (a) =>
      ((a as any).doctorUid ?? a.doctorId) === doctorId &&
      a.status === "booked" &&
      a.date === new Date().toISOString().split("T")[0]
  ).length;

  return (
    <header className="sticky top-0 z-20 flex-shrink-0 border-b border-health-100/60 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-md md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center rounded-full border border-health-100 bg-health-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-health-700">
            Trabajo clínico
          </div>
          <div className="mt-3">
            <h1 className="truncate text-2xl font-black text-slate-900">Panel profesional</h1>
            <p className="mt-1 text-sm text-slate-500">
              Bienvenido, <span className="font-semibold text-slate-700">{doctorName}</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-3 md:justify-end">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Centro activo
            </p>
            <div className="mt-2 flex items-center gap-3">
              {activeCenter?.logoUrl && !centerLogoError ? (
                <img
                  src={activeCenter.logoUrl}
                  alt={`Logo ${activeCenter.name}`}
                  className="h-8 w-auto max-w-[108px] rounded object-contain"
                  onError={() => setCenterLogoError(true)}
                />
              ) : (
                <div className="h-8 w-8 rounded-xl bg-health-100" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">
                  {activeCenter?.name || "Sin centro activo"}
                </p>
                <p className="text-xs text-slate-500">Agenda y ficha clínica del día</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-health-100 bg-health-50 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-health-700">
              Hoy
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-health-700">{todayCount}</span>
              <span className="text-sm font-semibold text-health-700">
                {todayCount === 1 ? "cita agendada" : "citas agendadas"}
              </span>
            </div>
          </div>

          <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <LegalLinks
              onOpenTerms={() => onOpenLegal("terms")}
              onOpenPrivacy={() => onOpenLegal("privacy")}
              className="flex gap-2"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default DoctorMainHeader;
