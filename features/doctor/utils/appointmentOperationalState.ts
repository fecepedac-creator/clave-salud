import { Appointment } from "../../../types";

export type AppointmentOperationalState =
  | "reserved"
  | "confirmed"
  | "arrived"
  | "in-care"
  | "attended"
  | "absent"
  | "cancelled";

type StatePresentation = { label: string; className: string };

const presentation: Record<AppointmentOperationalState, StatePresentation> = {
  reserved: { label: "Reservado", className: "bg-sky-100 text-sky-800" },
  confirmed: { label: "Confirmado", className: "bg-indigo-100 text-indigo-800" },
  arrived: { label: "Llegó", className: "bg-amber-100 text-amber-800" },
  "in-care": { label: "En atención", className: "bg-violet-100 text-violet-800" },
  attended: { label: "Atendido", className: "bg-emerald-100 text-emerald-800" },
  absent: { label: "Ausente", className: "bg-rose-100 text-rose-800" },
  cancelled: { label: "Cancelado", className: "bg-slate-200 text-slate-700" },
};

export const getAppointmentOperationalState = (
  appointment: Appointment
): AppointmentOperationalState => {
  const legacy = appointment as Appointment & {
    arrivalStatus?: string;
    careStatus?: string;
    confirmationStatus?: string;
  };

  if (appointment.status === "cancelled" || appointment.attendanceStatus === "cancelled") {
    return "cancelled";
  }
  if (appointment.attendanceStatus === "completed") return "attended";
  if (appointment.attendanceStatus === "no-show") return "absent";
  if (legacy.careStatus === "in-progress") return "in-care";
  if (legacy.arrivalStatus === "arrived") return "arrived";
  if (legacy.confirmationStatus === "confirmed") return "confirmed";
  return "reserved";
};

export const getAppointmentStatePresentation = (appointment: Appointment): StatePresentation =>
  presentation[getAppointmentOperationalState(appointment)];
