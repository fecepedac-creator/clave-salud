import React, { useMemo } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Phone } from "lucide-react";
import { Appointment, Doctor, Preadmission } from "../../../types";

interface SecretaryTaskPanelProps {
  appointments: Appointment[];
  doctors: Doctor[];
  preadmissions: Preadmission[];
  onApprovePreadmission: (preadmission: Preadmission) => void;
  onCancelAppointment: (appointment: Appointment) => void;
}

type SecretaryTask = {
  id: string;
  priority: "alta" | "media" | "baja";
  title: string;
  subtitle: string;
  badge: string;
  actionLabel?: string;
  onAction?: () => void;
};

const todayIso = () => new Date().toISOString().split("T")[0];

const SecretaryTaskPanel: React.FC<SecretaryTaskPanelProps> = ({
  appointments,
  doctors,
  preadmissions,
  onApprovePreadmission,
  onCancelAppointment,
}) => {
  const tasks = useMemo<SecretaryTask[]>(() => {
    const pending: SecretaryTask[] = [];
    const today = todayIso();

    preadmissions
      .filter((item) => !item.status || item.status === "pending" || item.status === "requires_contact")
      .slice(0, 8)
      .forEach((item) => {
        const name = item.contact?.name || item.patientDraft?.fullName || "Paciente sin nombre";
        const phone = item.contact?.phone || item.patientDraft?.phone || "Sin telefono";
        pending.push({
          id: `preadmission-${item.id}`,
          priority: item.status === "requires_contact" ? "alta" : "media",
          title: `Preingreso pendiente: ${name}`,
          subtitle: `${phone} - ${item.appointmentDraft?.date || "sin fecha solicitada"} ${item.appointmentDraft?.time || ""}`.trim(),
          badge: "Preingreso",
          actionLabel: "Aprobar",
          onAction: () => onApprovePreadmission(item),
        });
      });

    appointments
      .filter((appt) => appt.status === "booked")
      .filter((appt) => !appt.patientPhone || !appt.patientRut || !appt.patientName)
      .slice(0, 8)
      .forEach((appt) => {
        pending.push({
          id: `incomplete-${appt.id}`,
          priority: "alta",
          title: `Reserva con datos incompletos`,
          subtitle: `${appt.date} ${appt.time} - ${appt.patientName || "Sin nombre"}`,
          badge: "Contactar",
        });
      });

    appointments
      .filter((appt) => appt.status === "booked" && appt.date === today && !appt.attendanceStatus)
      .slice(0, 8)
      .forEach((appt) => {
        const doctor = doctors.find((doc) => doc.id === ((appt as any).doctorUid || appt.doctorId));
        pending.push({
          id: `today-${appt.id}`,
          priority: "baja",
          title: `Confirmar asistencia de hoy`,
          subtitle: `${appt.time} - ${appt.patientName} - ${doctor?.fullName || "Profesional"}`,
          badge: "Hoy",
        });
      });

    appointments
      .filter((appt) => appt.attendanceStatus === "no-show" || appt.attendanceStatus === "cancelled")
      .slice(0, 6)
      .forEach((appt) => {
        pending.push({
          id: `followup-${appt.id}`,
          priority: appt.attendanceStatus === "no-show" ? "media" : "baja",
          title: appt.attendanceStatus === "no-show" ? "Paciente no asistio" : "Cita cancelada",
          subtitle: `${appt.date} ${appt.time} - ${appt.patientName || "Paciente"}`,
          badge: appt.attendanceStatus === "no-show" ? "No asistio" : "Cancelada",
          actionLabel: appt.attendanceStatus === "no-show" ? "Revisar" : undefined,
          onAction: appt.attendanceStatus === "no-show" ? () => onCancelAppointment(appt) : undefined,
        });
      });

    const weight = { alta: 0, media: 1, baja: 2 };
    return pending.sort((a, b) => weight[a.priority] - weight[b.priority]).slice(0, 12);
  }, [appointments, doctors, preadmissions, onApprovePreadmission, onCancelAppointment]);

  const priorityClass = {
    alta: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    media: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    baja: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-white text-xl flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-health-400" /> Tareas de secretaria
          </h3>
          <p className="text-slate-400 text-sm mt-1">Pendientes operativos derivados de agenda y preingresos.</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
          {tasks.length} pendientes
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="border border-emerald-500/20 bg-emerald-500/10 rounded-2xl p-5 flex items-center gap-3 text-emerald-200">
          <CheckCircle2 className="w-5 h-5" />
          No hay tareas criticas pendientes.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${priorityClass[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className="text-[10px] uppercase font-black px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {task.badge}
                    </span>
                  </div>
                  <p className="font-bold text-white">{task.title}</p>
                  <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                    {task.badge === "Contactar" ? <Phone className="w-3.5 h-3.5" /> : <CalendarClock className="w-3.5 h-3.5" />}
                    {task.subtitle}
                  </p>
                </div>
                {task.onAction && task.actionLabel && (
                  <button
                    onClick={task.onAction}
                    className="px-3 py-2 rounded-lg bg-health-500 text-slate-950 text-xs font-black hover:bg-health-400"
                  >
                    {task.actionLabel}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tasks.some((task) => task.priority === "alta") && (
        <div className="mt-4 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Revise primero las tareas marcadas como alta.
        </div>
      )}
    </div>
  );
};

export default SecretaryTaskPanel;
