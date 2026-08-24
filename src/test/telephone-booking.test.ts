import { describe, expect, it } from "vitest";
import { upsertTelephoneBooking } from "../../features/doctor/utils/telephoneBooking";
import { Appointment, Patient } from "../../types";

const slot: Appointment = {
  id: "center-doctor-2099-08-18-0900",
  centerId: "center",
  doctorId: "doctor",
  date: "2099-08-18",
  time: "09:00",
  status: "available",
  patientName: "",
  patientRut: "",
  active: true,
};

const patient = {
  id: "patient-2",
  fullName: "Paciente Dos",
  rut: "11.111.111-1",
  phone: "+56911111111",
  email: "paciente@example.com",
} as Patient;

describe("upsertTelephoneBooking", () => {
  it("reemplaza el cupo disponible sin duplicarlo", () => {
    const result = upsertTelephoneBooking([slot], slot, patient, "2099-08-18T12:00:00.000Z");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: slot.id,
      status: "booked",
      patientId: patient.id,
      patientName: patient.fullName,
      attendanceStatus: null,
    });
  });

  it("usa solo los datos del paciente indicado en la siguiente reserva", () => {
    const previous: Appointment = { ...slot, id: "previous", status: "booked" };
    const result = upsertTelephoneBooking(
      [previous],
      { ...slot, id: "next", time: "09:20" },
      patient,
      "2099-08-18T12:05:00.000Z"
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(previous);
    expect(result[1]).toMatchObject({ patientId: patient.id, patientName: patient.fullName });
  });
});
