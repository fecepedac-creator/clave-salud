import { Appointment } from "../../../types";

export function applyAppointmentRebooking(
  appointments: Appointment[],
  sourceAppointmentId: string,
  targetAppointmentId: string,
  changedAt: string
): Appointment[] {
  const source = appointments.find((item) => item.id === sourceAppointmentId);
  const target = appointments.find((item) => item.id === targetAppointmentId);
  if (!source || !target || source.status !== "booked" || target.status !== "available") {
    return appointments;
  }

  return appointments.map((item) => {
    if (item.id === sourceAppointmentId) {
      return {
        ...item,
        status: "cancelled",
        attendanceStatus: "cancelled",
        active: false,
        rescheduledToAppointmentId: targetAppointmentId,
        rescheduledAt: changedAt,
      } as Appointment;
    }
    if (item.id === targetAppointmentId) {
      return {
        ...item,
        status: "booked",
        active: true,
        patientId: source.patientId,
        patientName: source.patientName,
        patientRut: source.patientRut,
        patientPhone: source.patientPhone,
        patientEmail: source.patientEmail,
        type: source.type,
        serviceId: source.serviceId,
        serviceName: source.serviceName,
        attendanceStatus: null,
        billable: item.billable,
        amount: item.amount,
        rescheduledFromAppointmentId: sourceAppointmentId,
        rescheduledAt: changedAt,
      } as Appointment;
    }
    return item;
  });
}
