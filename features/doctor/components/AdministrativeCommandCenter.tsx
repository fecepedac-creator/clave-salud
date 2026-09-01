import React, { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  UsersRound,
} from "lucide-react";
import { Appointment, Doctor } from "../../../types";
import { AdminTeamAgenda } from "../../admin/components/AdminTeamAgenda";

const toIsoDate = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const isVisibleAppointment = (appointment: Appointment) =>
  appointment.active !== false &&
  (appointment as Appointment & { activo?: boolean }).activo !== false;

const appointmentDoctorId = (appointment: Appointment) =>
  String(appointment.doctorUid || appointment.doctorId || "");

const attendanceLabel = (appointment: Appointment) => {
  switch (appointment.attendanceStatus) {
    case "completed":
      return "Atendida";
    case "no-show":
      return "No asistió";
    case "cancelled":
      return "Cancelada";
    default:
      return "Pendiente";
  }
};

interface AdministrativeCommandCenterProps {
  appointments: Appointment[];
  doctors: Doctor[];
}

/**
 * Operational home for administrative staff. It intentionally exposes only the
 * information required to coordinate the day's agenda, never clinical records.
 */
export const AdministrativeCommandCenter: React.FC<AdministrativeCommandCenterProps> = ({
  appointments,
  doctors,
}) => {
  const today = toIsoDate(new Date());
  const activeDoctors = useMemo(
    () =>
      doctors.filter(
        (doctor) =>
          doctor.active !== false &&
          (doctor as Doctor & { activo?: boolean }).activo !== false &&
          !["ADMIN_CENTRO", "ADMINISTRATIVO"].includes(String(doctor.role).toUpperCase())
      ),
    [doctors]
  );

  const todayAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            isVisibleAppointment(appointment) &&
            appointment.date === today &&
            appointment.status === "booked"
        )
        .sort((left, right) => String(left.time).localeCompare(String(right.time))),
    [appointments, today]
  );

  const doctorById = useMemo(
    () => new Map(activeDoctors.map((doctor) => [doctor.id, doctor])),
    [activeDoctors]
  );
  const completed = todayAppointments.filter(
    (appointment) => appointment.attendanceStatus === "completed"
  ).length;
  const pending = todayAppointments.filter((appointment) => !appointment.attendanceStatus).length;
  const scheduledDoctorCount = new Set(todayAppointments.map(appointmentDoctorId).filter(Boolean))
    .size;

  const metrics = [
    {
      label: "Citas hoy",
      value: todayAppointments.length,
      icon: CalendarDays,
      color: "text-health-300",
    },
    { label: "Atendidas", value: completed, icon: CheckCircle2, color: "text-emerald-300" },
    { label: "Por confirmar", value: pending, icon: Clock3, color: "text-amber-300" },
    {
      label: "Profesionales con agenda",
      value: scheduledDoctorCount,
      icon: UsersRound,
      color: "text-sky-300",
    },
  ];

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-8 md:px-8">
      <section className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 text-white shadow-xl">
        <header className="border-b border-slate-700/80 px-6 py-6 md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-black md:text-3xl">
                <Activity className="h-7 w-7 text-health-400" /> Mesa de Control
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Resumen operativo del día para coordinar la atención de todo el centro.
              </p>
            </div>
            <p className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200">
              {new Date().toLocaleDateString("es-CL", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>
          </div>
        </header>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 md:p-7">
          {metrics.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4">
              <Icon className={`h-5 w-5 ${color}`} />
              <p className="mt-3 text-3xl font-black">{value}</p>
              <p className="mt-1 text-sm font-medium text-slate-300">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <header className="mb-5 flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-5 w-5 text-health-600" />
          <div>
            <h2 className="text-xl font-black text-slate-900">Atención de hoy</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pacientes agendados por profesional y estado de asistencia. No contiene ficha clínica.
            </p>
          </div>
        </header>

        {todayAppointments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No hay citas agendadas para hoy.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-bold">Hora</th>
                  <th className="px-3 py-3 font-bold">Paciente</th>
                  <th className="px-3 py-3 font-bold">Profesional</th>
                  <th className="px-3 py-3 font-bold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((appointment) => {
                  const doctor = doctorById.get(appointmentDoctorId(appointment));
                  const label = attendanceLabel(appointment);
                  return (
                    <tr key={appointment.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3 font-bold text-slate-800">{appointment.time}</td>
                      <td className="px-3 py-3 font-semibold text-slate-800">
                        {appointment.patientName || "Paciente"}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {doctor?.fullName || "Profesional asignado"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            label === "Atendida"
                              ? "bg-emerald-100 text-emerald-700"
                              : label === "No asistió" || label === "Cancelada"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-lg font-black text-amber-900">
          <AlertTriangle className="h-5 w-5" /> Pendientes operativos
        </h2>
        <p className="mt-2 text-sm text-amber-900/80">
          {pending > 0
            ? `${pending} cita${pending === 1 ? "" : "s"} de hoy todavía no registra asistencia. Revise la confirmación y el estado al finalizar la jornada.`
            : "Todas las citas de hoy tienen un estado de asistencia registrado."}
        </p>
      </section>

      <AdminTeamAgenda appointments={appointments} doctors={activeDoctors} />
    </div>
  );
};
