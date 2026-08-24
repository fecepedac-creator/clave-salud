import { describe, expect, it } from "vitest";
import { Appointment } from "../../types";
import {
  getAppointmentOperationalState,
  getAppointmentStatePresentation,
} from "../../features/doctor/utils/appointmentOperationalState";

const appointment = (fields: Partial<Appointment> & Record<string, unknown> = {}) =>
  ({
    id: "appointment-1",
    centerId: "center-1",
    doctorId: "doctor-1",
    date: "2099-08-18",
    time: "09:00",
    status: "booked",
    patientName: "Paciente Uno",
    patientRut: "11.111.111-1",
    active: true,
    ...fields,
  }) as Appointment;

describe("estado operacional de citas", () => {
  it.each([
    [{}, "reserved"],
    [{ confirmationStatus: "confirmed" }, "confirmed"],
    [{ arrivalStatus: "arrived" }, "arrived"],
    [{ careStatus: "in-progress", arrivalStatus: "arrived" }, "in-care"],
    [{ attendanceStatus: "completed" }, "attended"],
    [{ attendanceStatus: "no-show" }, "absent"],
    [{ status: "cancelled", attendanceStatus: "completed" }, "cancelled"],
  ])("normaliza %j como %s", (fields, expected) => {
    expect(
      getAppointmentOperationalState(
        appointment(fields as Partial<Appointment> & Record<string, unknown>)
      )
    ).toBe(expected);
  });

  it("entrega una presentación legible y estable", () => {
    expect(getAppointmentStatePresentation(appointment({ arrivalStatus: "arrived" }))).toEqual({
      label: "Llegó",
      className: "bg-amber-100 text-amber-800",
    });
  });
});
