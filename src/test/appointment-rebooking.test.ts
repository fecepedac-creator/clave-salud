import { describe, expect, it } from "vitest";
import { Appointment } from "../../types";
import { applyAppointmentRebooking } from "../../features/admin/utils/appointmentRebooking";

const source: Appointment = {
  id: "source",
  centerId: "center-a",
  doctorId: "doctor-a",
  date: "2099-01-01",
  time: "09:00",
  status: "booked",
  active: true,
  patientId: "patient-a",
  patientName: "Paciente Uno",
  patientRut: "11.111.111-1",
  patientPhone: "+56911111111",
  type: "CONSULTATION",
};

const target: Appointment = {
  id: "target",
  centerId: "center-a",
  doctorId: "doctor-b",
  date: "2099-01-02",
  time: "10:00",
  status: "available",
  active: true,
  patientName: "",
  patientRut: "",
  billable: false,
  amount: null,
};

describe("appointment rebooking projection", () => {
  it("moves only operational patient data and preserves the target slot", () => {
    const result = applyAppointmentRebooking(
      [source, target],
      source.id,
      target.id,
      "2099-01-01T12:00:00.000Z"
    );

    expect(result.find((item) => item.id === source.id)).toMatchObject({
      status: "cancelled",
      active: false,
      rescheduledToAppointmentId: target.id,
    });
    expect(result.find((item) => item.id === target.id)).toMatchObject({
      doctorId: "doctor-b",
      date: "2099-01-02",
      time: "10:00",
      status: "booked",
      patientId: "patient-a",
      billable: false,
      amount: null,
      rescheduledFromAppointmentId: source.id,
    });
  });

  it("returns the original list when either endpoint is invalid", () => {
    const appointments = [source, target];
    expect(applyAppointmentRebooking(appointments, "missing", target.id, "now")).toBe(appointments);
    expect(applyAppointmentRebooking(appointments, source.id, "missing", "now")).toBe(appointments);
  });
});
