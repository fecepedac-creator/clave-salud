import React, { useEffect, useRef } from "react";
import { Appointment, AgendaConfig } from "../types";
import { getStandardSlots, getDaysInMonth } from "../utils";
import { ChevronLeft, ChevronRight, Calendar, Zap, Info } from "lucide-react";
import { resolveActiveState } from "../utils/activeState";
import SensitiveField from "./clinical/SensitiveField";
import OperationalState from "./ui/OperationalState";

interface AgendaViewProps {
  currentMonth: Date;
  selectedAgendaDate: string;
  appointments: Appointment[];
  centerId?: string;
  doctorId: string;
  agendaConfig?: AgendaConfig;
  onMonthChange: (increment: number) => void;
  onDateClick: (date: Date) => void;
  onToggleSlot: (time: string) => void;
  onOpenPatient: (appointment: Appointment) => void;
  onToggleAttendance?: (app: Appointment, status: "completed" | "no-show" | "cancelled") => void;
  readOnly?: boolean;
  isSyncingAppointments?: boolean;
  isLoadingAppointments?: boolean;
  appointmentsError?: string;
  onRetryAppointments?: () => void;
}

const AgendaView: React.FC<AgendaViewProps> = ({
  currentMonth,
  selectedAgendaDate,
  appointments,
  centerId,
  doctorId,
  agendaConfig,
  onMonthChange,
  onDateClick,
  onToggleSlot,
  onOpenPatient,
  onToggleAttendance,
  readOnly = false,
  isSyncingAppointments = false,
  isLoadingAppointments = false,
  appointmentsError = "",
  onRetryAppointments,
}) => {
  const [mobileView, setMobileView] = React.useState<"calendar" | "slots">("calendar");
  const slotsSectionRef = useRef<HTMLDivElement>(null);

  // Switch to slots automatically on mobile when a date is selected
  useEffect(() => {
    if (selectedAgendaDate && window.innerWidth < 1024) {
      setMobileView("slots");
    }
  }, [selectedAgendaDate]);

  // Auto-scroll logic for mobile
  useEffect(() => {
    if (selectedAgendaDate && slotsSectionRef.current) {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        slotsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [selectedAgendaDate]);

  const appointmentDoctorUid = (a: Appointment) => (a as any).doctorUid ?? a.doctorId;
  const activeAppointments = appointments.filter((a) => resolveActiveState(a as any));
  const standardSlots = getStandardSlots(selectedAgendaDate, doctorId, agendaConfig);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const headerDate = selectedAgendaDate ? new Date(selectedAgendaDate + "T00:00:00") : null;

  return (
    <div className="flex flex-col gap-6 animate-fadeIn items-start h-full w-full">
      {/* Mobile Toggle Selector */}
      <div className="lg:hidden flex p-1 bg-slate-100 rounded-2xl w-full border border-slate-200">
        <button
          onClick={() => setMobileView("calendar")}
          className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${mobileView === "calendar" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
        >
          <Calendar className="w-4 h-4" /> Calendario
        </button>
        <button
          onClick={() => setMobileView("slots")}
          className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${mobileView === "slots" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
        >
          <Zap className="w-4 h-4" /> Horas y Gestión
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
        {/* Left: Configuration & Calendar */}
        <div
          className={`lg:col-span-4 space-y-6 ${mobileView === "calendar" ? "block" : "hidden lg:block"}`}
        >
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            {!doctorId && (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-4">
                <p className="text-xs font-bold text-amber-700 flex items-center gap-2">
                  <Info className="w-4 h-4" /> Paso 1: Selecciona profesional
                </p>
              </div>
            )}
            <div className="mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                  2
                </span>
                Selecciona un d?a
              </p>
            </div>

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
                  const isPast = day < today;

                  return (
                    <button
                      key={idx}
                      onClick={() => onDateClick(day)}
                      className={`h-10 rounded-lg flex flex-col items-center justify-center transition-all relative ${isSelected ? "bg-blue-600 text-white shadow-md scale-105 z-10" : isPast ? "bg-red-50 text-red-300 border border-red-50 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-blue-50 border border-slate-100"}`}
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
          className={`lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-[500px] ${mobileView === "slots" ? "block" : "hidden lg:block"}`}
        >
          {selectedAgendaDate && (
            <div className="lg:hidden mb-4 flex items-center justify-between bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-800">
                  {headerDate?.toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                </span>
              </div>
              <button
                onClick={() => setMobileView("calendar")}
                className="text-xs font-bold text-blue-600 underline"
              >
                Cambiar fecha
              </button>
            </div>
          )}

          <h3 className="font-bold text-2xl text-slate-800 mb-6 flex flex-wrap justify-between items-center gap-2 sticky top-0 bg-white z-10 py-1 border-b border-slate-50">
            <span>
              {headerDate
                ? `Agenda del ${headerDate.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}`
                : "Seleccione una fecha"}
            </span>
            {selectedAgendaDate && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Clic para Abrir/Cerrar Bloques
                </span>
                {isSyncingAppointments && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full animate-pulse">
                    Guardando...
                  </span>
                )}
              </div>
            )}
          </h3>

          <div className="flex-1 overflow-auto">
            {!selectedAgendaDate ? (
              <OperationalState
                kind="empty"
                title="Selecciona una fecha"
                description="Elige un d?a del calendario para ver bloques, pacientes agendados y gesti?n operativa."
              />
            ) : isLoadingAppointments ? (
              <OperationalState
                kind="loading"
                title="Cargando agenda..."
                description="Estamos sincronizando bloques, pacientes y estados de asistencia."
              />
            ) : appointmentsError ? (
              <OperationalState
                kind="error"
                title="No pudimos cargar la agenda"
                description={appointmentsError}
                onAction={onRetryAppointments}
              />
            ) : (
              <div className="space-y-8 pb-10">
                {/* Grid de Bloques (Gesti?n) */}
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
                    const slotDate = new Date(selectedAgendaDate + "T00:00:00");
                    const isPastDate = slotDate < today;

                    return (
                      <button
                        key={templateSlot.time}
                        onClick={() => onToggleSlot(templateSlot.time)}
                        disabled={isPastDate || readOnly}
                        className={`py-3 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 ${isPastDate || readOnly ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-60" : isBooked ? "bg-blue-100 border-blue-300 text-blue-800 shadow-sm" : isOpen ? "bg-green-100 border-green-400 text-green-800 shadow-sm hover:bg-green-50" : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"}`}
                      >
                        {templateSlot.time}
                        <span className="text-[10px] uppercase">
                          {isPastDate
                            ? "Pasado"
                            : isBooked
                              ? realSlot.type === "SERVICE"
                                ? realSlot.serviceName || "Servicio"
                                : "Paciente"
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
                  <h4 className="font-black text-slate-700 mb-4 text-sm uppercase tracking-widest">
                    Pacientes Agendados
                  </h4>
                  {activeAppointments.filter(
                    (a) =>
                      appointmentDoctorUid(a) === doctorId &&
                      a.date === selectedAgendaDate &&
                      a.status === "booked"
                  ).length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-400 italic text-sm">
                        No hay pacientes agendados para este día.
                      </p>
                    </div>
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
                            className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="bg-white px-3 py-1 rounded-lg font-black text-blue-600 shadow-sm border border-blue-100">
                                {apt.time}
                              </div>
                              <div>
                                <h4 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                  {apt.patientName}
                                  {apt.type === "SERVICE" && (
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-600 border border-blue-200">
                                      {apt.serviceName}
                                    </span>
                                  )}
                                </h4>
                                <p className="text-sm text-slate-500 font-medium">
                                  <SensitiveField
                                    value={apt.patientRut}
                                    kind="rut"
                                    centerId={centerId}
                                    entityType="appointment"
                                    entityId={apt.id}
                                    patientId={apt.patientId}
                                    auditLabel="Revelaci?n de RUT desde agenda."
                                  />
                                  {" | "}
                                  <SensitiveField
                                    value={apt.patientPhone}
                                    kind="phone"
                                    centerId={centerId}
                                    entityType="appointment"
                                    entityId={apt.id}
                                    patientId={apt.patientId}
                                    auditLabel="Revelaci?n de tel?fono desde agenda."
                                  />
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0">
                              {(() => {
                                const slotDate = new Date(selectedAgendaDate + "T00:00:00");
                                const isPast = slotDate < today;
                                return (
                                  onToggleAttendance &&
                                  !readOnly &&
                                  !isPast && (
                                    <div className="flex bg-white rounded-full border border-slate-200 overflow-hidden shadow-sm">
                                      <button
                                        type="button"
                                        onClick={() => onToggleAttendance(apt, "completed")}
                                        className={`px-3 py-1.5 text-xs font-bold transition-colors ${apt.attendanceStatus === "completed" ? "bg-emerald-500 text-white" : "hover:bg-emerald-50 text-slate-500"}`}
                                        title="Atendido"
                                      >
                                        OK
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onToggleAttendance(apt, "no-show")}
                                        className={`px-3 py-1.5 text-xs font-bold transition-colors border-l border-r border-slate-200 ${apt.attendanceStatus === "no-show" ? "bg-rose-500 text-white" : "hover:bg-rose-50 text-slate-500"}`}
                                        title="No show"
                                      >
                                        NS
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onToggleAttendance(apt, "cancelled")}
                                        className={`px-3 py-1.5 text-xs font-bold transition-colors ${apt.attendanceStatus === "cancelled" ? "bg-slate-500 text-white" : "hover:bg-slate-100 text-slate-500"}`}
                                        title="Anular"
                                      >
                                        /
                                      </button>
                                    </div>
                                  )
                                );
                              })()}
                              <button
                                type="button"
                                onClick={() => onOpenPatient(apt)}
                                className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all shadow-md active:scale-95"
                              >
                                Abrir ficha
                              </button>
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
    </div>
  );
};

export default AgendaView;
