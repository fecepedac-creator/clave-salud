import React from "react";
import { Appointment, Doctor } from "../../../types";
import { MessageCircle, Trash2 } from "lucide-react";
import { normalizePhone } from "../../../utils";

export interface TodayActivityProps {
  appointments: Appointment[];
  doctors: Doctor[];
  onOpenPatient: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
}

const TodayActivity: React.FC<TodayActivityProps> = ({
  appointments,
  doctors,
  onOpenPatient,
  onCancel,
}) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const activeDoctors = doctors.filter((doc) =>
    appointments.some(
      (a) => (a.doctorId === doc.id || (a as any).doctorUid === doc.id) && a.date === todayStr
    )
  );

  if (activeDoctors.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 text-center">
        <p className="text-slate-500 italic">No hay citas programadas para hoy.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 shadow-xl">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Actividad del Día
      </h3>
      <div className="space-y-8">
        {activeDoctors.map((doc) => {
          const docAppts = appointments
            .filter(
              (a) =>
                (a.doctorId === doc.id || (a as any).doctorUid === doc.id) && a.date === todayStr
            )
            .sort((a, b) => a.time.localeCompare(b.time));

          return (
            <div key={doc.id} className="space-y-4">
              <h4 className="font-black text-xs text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2 opacity-80">
                {doc.fullName}
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {docAppts.map((appt) => (
                  <div
                    key={appt.id}
                    className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between ${
                      appt.status === "booked"
                        ? "bg-slate-700/40 border-slate-600/50 hover:border-emerald-500/30 hover:bg-slate-700/60 group"
                        : "bg-slate-900/30 border-slate-800/50 opacity-40"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-900/50 flex flex-col items-center justify-center border border-slate-700/50 group-hover:border-emerald-500/30 transition-colors">
                        <span className="font-mono font-bold text-emerald-400 text-sm">{appt.time}</span>
                      </div>
                      
                      <div
                        onClick={() => appt.status === "booked" && onOpenPatient(appt)}
                        className={appt.status === "booked" ? "cursor-pointer" : ""}
                      >
                        {appt.status === "booked" ? (
                          <>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white group-hover:text-emerald-300 transition-colors">{appt.patientName}</p>
                              {appt.type === "SERVICE" && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  {appt.serviceName || "Servicio"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium">{appt.patientRut}</p>
                          </>
                        ) : (
                          <span className="text-slate-600 italic text-sm">Disponible</span>
                        )}
                      </div>
                    </div>

                    {appt.status === "booked" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const waUrl = `https://wa.me/${normalizePhone(appt.patientPhone || "")}`;
                            window.open(waUrl, "_blank");
                          }}
                          className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-900/20"
                          title="Contactar por WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        {onCancel && (
                          <button
                            onClick={() => onCancel(appt)}
                            className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                            title="Cancelar Cita"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TodayActivity;
