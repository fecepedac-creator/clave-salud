import React, { useEffect, useRef } from "react";
import { Appointment, AgendaConfig } from "../types";
import { getStandardSlots, getDaysInMonth } from "../utils";
import { ChevronLeft, ChevronRight, Calendar, Zap } from "lucide-react";

interface AgendaViewProps {
  currentMonth: Date;
  selectedAgendaDate: string;
  appointments: Appointment[];
  doctorId: string;
  agendaConfig?: AgendaConfig;
  onMonthChange: (increment: number) => void;
  onDateClick: (date: Date) => void;
  onToggleSlot: (time: string) => void;
  onOpenPatient: (appointment: Appointment) => void;
  readOnly?: boolean; // NEW PROP
  isSyncingAppointments?: boolean;
}

const AgendaView: React.FC<AgendaViewProps> = ({
  currentMonth,
  selectedAgendaDate,
  appointments,
  doctorId,
  agendaConfig,
  onMonthChange,
  onDateClick,
  onToggleSlot,
  onOpenPatient,
  readOnly = false,
  isSyncingAppointments = false,
}) => {
  const slotsSectionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic for mobile
  useEffect(() => {
    if (selectedAgendaDate && slotsSectionRef.current) {
      const isMobile = window.innerWidth < 1024; // lg breakpoint in Tailwind
      if (isMobile) {
        slotsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [selectedAgendaDate]);

  const appointmentDoctorUid = (a: Appointment) => (a as any).doctorUid ?? a.doctorId;
  const activeAppointments = appointments.filter(
    (a) => a?.active !== false && (a as any).activo !== false
  );
  const standardSlots = getStandardSlots(selectedAgendaDate, doctorId, agendaConfig);

  // Date comparison helper
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Safe Date for Header
  const headerDate = selectedAgendaDate ? new Date(selectedAgendaDate + "T00:00:00") : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn items-start">
      {/* Left: Configuration & Calendar */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          {/* VISUAL CALENDAR */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={() => onMonthChange(-1)}
                className="p-1 hover:bg-white rounded shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-bold text-slate-800 uppercase">
                {currentMonth.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => onMonthChange(1)}
                className="p-1 hover:bg-white rounded shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 mb-2">
              <div>L</div>
              <div>M</div>
              <div>M</div>
              <div>J</div>
              <div>V</div>
              <div>S</div>
              <div>D</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentMonth).map((day, idx) => {
                if (!day) return <div key={idx}></div>;

                const formattedDay = day.toISOString().split("T")[0];
                const isSelected = formattedDay === selectedAgendaDate;
                const hasSlots = activeAppointments.some(
                  (a) => appointmentDoctorUid(a) === doctorId && a.date === formattedDay
                );

                // Check if past
                const isPast = day < today;

                return (
                  <button
                    key={idx}
                    onClick={() => onDateClick(day)}
                    className={`
                                            h-10 rounded-lg flex flex-col items-center justify-center transition-all relative
                                            ${isSelected
                        ? "bg-blue-600 text-white shadow-md scale-105 z-10"
                        : isPast
                          ? "bg-red-50 text-red-300 border border-red-50 cursor-not-allowed"
                          : "bg-white text-slate-700 hover:bg-blue-50 border border-slate-100"
                      }
                                        `}
                  >
                    <span className="font-bold text-sm">{day.getDate()}</span>
                    {hasSlots && !isSelected && !isPast && (
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-0.5"></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Scheduled Appointments & Slot Management */}
      <div
        ref={slotsSectionRef}
        className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-[500px]"
      >
        <h3 className="font-bold text-2xl text-slate-800 mb-6 flex flex-wrap justify-between items-center gap-2">
          <span>
            {headerDate
              ? `Agenda del ${headerDate.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}`
              : "Seleccione una fecha"}
          </span>
          {selectedAgendaDate && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-normal">
                Clic para Abrir/Cerrar Bloques
              </span>
              {isSyncingAppointments && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                  Guardando...
                </span>
              )}
            </div>
          )}
        </h3>

        <div className="flex-1 overflow-auto">
          {!selectedAgendaDate ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Calendar className="w-16 h-16 mb-4 opacity-20" />
              <p>Seleccione un día en el calendario para gestionar su agenda.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Grid de Bloques (Gestión) */}
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {standardSlots.map((templateSlot) => {
                  const realSlot = activeAppointments.find(
                    (a) =>
                      appointmentDoctorUid(a) === doctorId &&
                      a.date === selectedAgendaDate &&
                      a.time === templateSlot.time
                  );
                  const isOpen = !!realSlot;
                  const isBooked = realSlot?.status === "booked";

                  // Check past date specifically for slots? Usually redundant if calendar handles it, but good for safety
                  const slotDate = new Date(selectedAgendaDate + "T00:00:00");
                  const isPastDate = slotDate < today;

                  return (
                    <button
                      key={templateSlot.time}
                      onClick={() => onToggleSlot(templateSlot.time)}
                      disabled={isPastDate || readOnly} // Disable if readOnly
                      className={`
                                                py-3 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center justify-center gap-1
                                                ${isPastDate || readOnly
                          ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-60"
                          : isBooked
                            ? "bg-blue-100 border-blue-300 text-blue-800"
                            : isOpen
                              ? "bg-green-100 border-green-400 text-green-800 shadow-sm hover:bg-green-50"
                              : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                        }
                                            `}
                    >
                      {templateSlot.time}
                      <span className="text-[10px] uppercase">
                        {isPastDate
                          ? "Pasado"
                          : isBooked
                            ? "Paciente"
                            : isOpen
                              ? "Disponible"
                              : "Cerrado"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Lista de Pacientes Agendados */}
              <div className="border-t border-slate-100 pt-6">
                <h4 className="font-bold text-slate-700 mb-4 text-lg">Pacientes Agendados</h4>
                {activeAppointments.filter(
                  (a) =>
                    appointmentDoctorUid(a) === doctorId &&
                    a.date === selectedAgendaDate &&
                    a.status === "booked"
                ).length === 0 ? (
                  <p className="text-slate-400 italic">No hay pacientes agendados para este día.</p>
                ) : (
                  <div className="space-y-3">
                    {activeAppointments
                      .filter(
                        (a) =>
                          appointmentDoctorUid(a) === doctorId &&
                          a.date === selectedAgendaDate &&
                          a.status === "booked"
                      )
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((apt) => (
                        <div
                          key={apt.id}
                          className="p-4 rounded-xl border border-blue-200 bg-blue-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3"
                        >
                          <div className="flex items-center gap-4">
                            <div className="bg-white px-3 py-1 rounded-lg font-bold text-blue-600 shadow-sm border border-blue-100">
                              {apt.time}
                            </div>
                            <div>
                              <h4 className="font-bold text-lg text-slate-800">
                                {apt.patientName}
                              </h4>
                              <p className="text-sm text-slate-500">
                                {apt.patientRut} • {apt.patientPhone}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenPatient(apt)}
                              className="bg-white text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors"
                            >
                              Abrir ficha
                            </button>
                            <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase">
                              Confirmado
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgendaView;
