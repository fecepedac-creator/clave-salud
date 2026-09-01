import React, { useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { BellRing, Check, Clock3, MessageCircleWarning, UserX } from "lucide-react";
import { Appointment, Doctor } from "../../../types";

type ReminderUpdate = "sent" | "confirmed" | "no_response";

const isoToday = () => new Date().toLocaleDateString("en-CA");
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toLocaleDateString("en-CA");
};

const reminderPresentation = (appointment: Appointment) => {
  if (appointment.attendanceStatus === "no-show") {
    return { label: "No asistió", tone: "bg-rose-100 text-rose-800" };
  }
  if (appointment.confirmationStatus === "confirmed") {
    return { label: "Confirmó", tone: "bg-emerald-100 text-emerald-800" };
  }
  if (appointment.confirmationStatus === "no_response") {
    return { label: "Sin respuesta", tone: "bg-amber-100 text-amber-800" };
  }
  if (appointment.confirmationStatus === "declined") {
    return { label: "No confirma", tone: "bg-orange-100 text-orange-800" };
  }
  if (appointment.reminderStatus === "sent") {
    return { label: "Esperando respuesta", tone: "bg-sky-100 text-sky-800" };
  }
  return { label: "Sin recordatorio registrado", tone: "bg-slate-100 text-slate-700" };
};

export const AppointmentReminderPanel: React.FC<{
  centerId: string;
  appointments: Appointment[];
  doctors: Doctor[];
  onUpdateAppointments: (appointments: Appointment[]) => void;
}> = ({ centerId, appointments, doctors, onUpdateAppointments }) => {
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const upcomingAppointments = useMemo(() => {
    const today = isoToday();
    const end = addDays(new Date(), 7);
    return appointments
      .filter(
        (appointment) =>
          appointment.active !== false &&
          appointment.status === "booked" &&
          appointment.date >= today &&
          appointment.date <= end
      )
      .sort((left, right) =>
        `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`)
      );
  }, [appointments]);
  const summary = useMemo(
    () => ({
      sent: upcomingAppointments.filter((item) => item.reminderStatus === "sent").length,
      confirmed: upcomingAppointments.filter((item) => item.confirmationStatus === "confirmed")
        .length,
      pending: upcomingAppointments.filter(
        (item) => item.reminderStatus === "sent" && item.confirmationStatus === "pending"
      ).length,
      noResponse: upcomingAppointments.filter((item) => item.confirmationStatus === "no_response")
        .length,
    }),
    [upcomingAppointments]
  );

  const updateStatus = async (appointment: Appointment, status: ReminderUpdate) => {
    const requestId =
      globalThis.crypto?.randomUUID?.() || `reminder_${Date.now()}_${appointment.id}`;
    setError("");
    setUpdatingId(`${appointment.id}:${status}`);
    try {
      await httpsCallable(
        getFunctions(),
        "updateAppointmentReminderStatus"
      )({
        centerId,
        appointmentId: appointment.id,
        requestId,
        status,
        ...(status === "sent" ? { channel: "whatsapp" } : {}),
      });
      onUpdateAppointments(
        appointments.map((item) => {
          if (item.id !== appointment.id) return item;
          if (status === "sent") {
            return {
              ...item,
              reminderStatus: "sent",
              reminderChannel: "whatsapp",
              confirmationStatus: "pending",
            };
          }
          return { ...item, confirmationStatus: status };
        })
      );
    } catch (cause: any) {
      setError(cause?.message || "No fue posible actualizar el recordatorio.");
    } finally {
      setUpdatingId("");
    }
  };

  const doctorName = (appointment: Appointment) => {
    const doctorId = String(appointment.doctorUid || appointment.doctorId || "");
    return doctors.find((doctor) => doctor.id === doctorId)?.fullName || "Profesional";
  };

  return (
    <section className="rounded-3xl border border-slate-700/60 bg-slate-800/40 p-5 shadow-xl md:p-7">
      <header className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold text-white">
            <BellRing className="h-5 w-5 text-amber-300" /> Recordatorios y confirmaciones
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Próximos 7 días. Registre solo respuestas o envíos que secretaría haya verificado.
          </p>
        </div>
        <p className="text-xs text-slate-500">No envía mensajes automáticamente.</p>
      </header>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Enviados", summary.sent, BellRing, "text-sky-300"],
          ["Confirmaron", summary.confirmed, Check, "text-emerald-300"],
          ["Esperando", summary.pending, Clock3, "text-amber-300"],
          ["Sin respuesta", summary.noResponse, MessageCircleWarning, "text-orange-300"],
        ].map(([label, value, Icon, tone]) => {
          const CardIcon = Icon as React.ComponentType<{ className?: string }>;
          return (
            <div
              key={String(label)}
              className="rounded-xl border border-slate-700 bg-slate-900/45 p-3"
            >
              <CardIcon className={`mb-2 h-4 w-4 ${tone}`} />
              <p className="text-2xl font-bold text-white">{String(value)}</p>
              <p className="text-xs text-slate-400">{String(label)}</p>
            </div>
          );
        })}
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}
      {upcomingAppointments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          No hay citas reservadas durante los próximos siete días.
        </p>
      ) : (
        <div className="space-y-2">
          {upcomingAppointments.map((appointment) => {
            const state = reminderPresentation(appointment);
            const busy = updatingId.startsWith(`${appointment.id}:`);
            return (
              <div
                key={appointment.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/35 p-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <p className="font-bold text-white">{appointment.patientName || "Paciente"}</p>
                  <p className="text-sm text-slate-400">
                    {appointment.date} · {appointment.time} · {doctorName(appointment)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${state.tone}`}>
                    {state.label}
                  </span>
                  {!appointment.reminderStatus && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateStatus(appointment, "sent")}
                      className="rounded-lg border border-sky-500/50 px-3 py-1.5 text-xs font-bold text-sky-200 disabled:opacity-50"
                    >
                      Marcar enviado
                    </button>
                  )}
                  {appointment.reminderStatus === "sent" &&
                    appointment.confirmationStatus !== "confirmed" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateStatus(appointment, "confirmed")}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
                      >
                        Confirmó
                      </button>
                    )}
                  {appointment.reminderStatus === "sent" &&
                    appointment.confirmationStatus === "pending" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateStatus(appointment, "no_response")}
                        className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs font-bold text-amber-200 disabled:opacity-50"
                      >
                        Sin respuesta
                      </button>
                    )}
                  {appointment.attendanceStatus === "no-show" && (
                    <UserX className="h-4 w-4 text-rose-300" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
