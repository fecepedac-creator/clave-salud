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

  // Count today's booked appointments for this doctor
  const todayCount = appointments.filter(
    (a) =>
      ((a as any).doctorUid ?? a.doctorId) === doctorId &&
      a.status === "booked" &&
      a.date === new Date().toISOString().split("T")[0]
  ).length;

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-health-100/50 shadow-sm px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-20 flex-shrink-0 gap-4 transition-all duration-300">
      <div className="flex items-center gap-3 w-full md:w-auto">
        <h1 className="text-xl font-bold text-slate-800">Panel Médico</h1>
        <p className="text-xs text-slate-400 font-medium">Bienvenido, {doctorName}</p>
      </div>

      <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto justify-center">
        {activeCenter?.logoUrl && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider">
              Centro
            </span>
            {!centerLogoError ? (
              <img
                src={activeCenter.logoUrl}
                alt={`Logo ${activeCenter.name}`}
                className="h-6 w-auto max-w-[100px] object-contain rounded transition-opacity hover:opacity-80"
                onError={() => setCenterLogoError(true)}
              />
            ) : (
              <span className="text-health-700 text-[10px] font-bold">{activeCenter.name}</span>
            )}
          </div>
        )}

        <div className="bg-health-50 text-health-700 px-4 py-2 rounded-xl font-bold text-[10px] sm:text-xs border border-health-100 flex items-center gap-2 whitespace-nowrap shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-health-500 animate-pulse"></span>
          {todayCount} Citas Hoy
        </div>

        <div className="hidden xs:block border-l border-slate-100 pl-3">
          <LegalLinks
            onOpenTerms={() => onOpenLegal("terms")}
            onOpenPrivacy={() => onOpenLegal("privacy")}
            className="flex gap-2"
          />
        </div>
      </div>
    </header>
  );
};

export default DoctorMainHeader;
