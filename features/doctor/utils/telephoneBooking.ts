import { Appointment, Patient } from "../../../types";

export const upsertTelephoneBooking = (
  appointments: Appointment[],
  bookingSlot: Appointment,
  patient: Patient,
  bookedAt: string
): Appointment[] => {
  const booked: Appointment = {
    ...bookingSlot,
    status: "booked",
    patientId: patient.id,
    patientName: patient.fullName,
    patientRut: patient.rut,
    patientPhone: patient.phone || "",
    patientEmail: patient.email || "",
    bookedAt,
    attendanceStatus: null,
  };

  const index = appointments.findIndex(appointment => appointment.id === booked.id);
  if (index === -1) return [...appointments, booked];
  return appointments.map((appointment, currentIndex) =>
    currentIndex === index ? booked : appointment
  );
};
