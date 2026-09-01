import React, { useMemo, useState } from "react";
import { Appointment, Doctor } from "../../../types";
import { CalendarDays, ChevronLeft, ChevronRight, Users } from "lucide-react";

type ViewMode = "day" | "week";

const toIsoDate = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

const mondayFor = (date: Date) => {
  const result = new Date(date);
  const weekday = result.getDay() || 7;
  result.setDate(result.getDate() - weekday + 1);
  return result;
};

const formatDay = (date: Date) =>
  date.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" });

const appointmentDoctorId = (appointment: Appointment) =>
  String((appointment as any).doctorUid || appointment.doctorId || "");

const isVisibleAppointment = (appointment: Appointment) =>
  appointment.active !== false && (appointment as any).activo !== false;

export const AdminTeamAgenda: React.FC<{ appointments: Appointment[]; doctors: Doctor[] }> = ({
  appointments,
  doctors,
}) => {
  const [view, setView] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const monday = mondayFor(anchor);
    return Array.from({ length: 5 }, (_, index) => addDays(monday, index));
  }, [anchor, view]);

  const activeDoctors = useMemo(
    () =>
      doctors.filter(
        (doctor) =>
          doctor.active !== false && (doctor as Doctor & { activo?: boolean }).activo !== false
      ),
    [doctors]
  );

  const appointmentByDoctorAndDate = useMemo(() => {
    const grouped = new Map<string, Appointment[]>();
    appointments.filter(isVisibleAppointment).forEach((appointment) => {
      const key = `${appointmentDoctorId(appointment)}:${appointment.date}`;
      grouped.set(key, [...(grouped.get(key) || []), appointment]);
    });
    grouped.forEach((items) =>
      items.sort((left, right) => String(left.time).localeCompare(String(right.time)))
    );
    return grouped;
  }, [appointments]);

  const move = (direction: -1 | 1) =>
    setAnchor((current) => addDays(current, direction * (view === "week" ? 7 : 1)));

  return (
    <section className="rounded-3xl border border-slate-700/60 bg-slate-800/40 p-5 shadow-xl md:p-7">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold text-white">
            <CalendarDays className="h-5 w-5 text-health-400" /> Agenda consolidada
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Todos los profesionales del centro, sin modificar sus cupos ni reservas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setView("day")}
            className={`rounded-lg px-3 py-2 text-sm font-bold ${view === "day" ? "bg-health-500 text-slate-950" : "border border-slate-600 text-slate-200"}`}
          >
            Día
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className={`rounded-lg px-3 py-2 text-sm font-bold ${view === "week" ? "bg-health-500 text-slate-950" : "border border-slate-600 text-slate-200"}`}
          >
            Semana
          </button>
          <button
            type="button"
            aria-label="Período anterior"
            onClick={() => move(-1)}
            className="rounded-lg border border-slate-600 p-2 text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-bold text-slate-200"
          >
            Hoy
          </button>
          <button
            type="button"
            aria-label="Período siguiente"
            onClick={() => move(1)}
            className="rounded-lg border border-slate-600 p-2 text-slate-200"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>
      {activeDoctors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          No hay agendas activas para el período seleccionado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `180px repeat(${days.length}, minmax(170px, 1fr))` }}
            >
              <div className="rounded-xl bg-slate-900/70 p-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                <Users className="mr-1 inline h-4 w-4" /> Profesional
              </div>
              {days.map((day) => (
                <div
                  key={toIsoDate(day)}
                  className="rounded-xl bg-slate-900/70 p-3 text-center text-xs font-bold uppercase tracking-wide text-slate-300"
                >
                  {formatDay(day)}
                </div>
              ))}
              {activeDoctors.map((doctor) => (
                <React.Fragment key={doctor.id}>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/45 p-3">
                    <p className="font-bold text-white">{doctor.fullName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {doctor.specialty || doctor.role || "Profesional"}
                    </p>
                  </div>
                  {days.map((day) => {
                    const items =
                      appointmentByDoctorAndDate.get(`${doctor.id}:${toIsoDate(day)}`) || [];
                    const booked = items.filter((item) => item.status === "booked");
                    return (
                      <div
                        key={`${doctor.id}-${toIsoDate(day)}`}
                        className="min-h-[92px] rounded-xl border border-slate-700 bg-slate-900/25 p-2"
                      >
                        <p className="mb-2 text-xs font-semibold text-slate-400">
                          {booked.length} cita{booked.length === 1 ? "" : "s"} · {items.length} cupo
                          {items.length === 1 ? "" : "s"}
                        </p>
                        <div className="space-y-1.5">
                          {booked.slice(0, 4).map((item) => (
                            <div
                              key={item.id}
                              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-100"
                            >
                              <span className="font-bold">{item.time}</span> ·{" "}
                              {item.patientName || "Paciente"}
                            </div>
                          ))}
                          {booked.length > 4 && (
                            <p className="text-xs text-slate-500">+{booked.length - 4} más</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
