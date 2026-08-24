import { describe, expect, it } from "vitest";
import { Appointment } from "../../types";
import {
  ExternalCalendarSyncDisabledError,
  ExternalCalendarSyncService,
  resolveCalendarConflict,
  toExternalCalendarPayload,
} from "../../domain/externalCalendarSync";

const appointment = {
  id: "appointment-1",
  centerId: "center-test",
  doctorId: "doctor-test",
  date: "2099-08-18",
  time: "09:00",
  status: "booked",
  active: true,
  patientId: "patient-secret",
  patientName: "Nombre Confidencial",
  patientRut: "11.111.111-1",
  patientPhone: "+56911111111",
  patientEmail: "private@example.com",
  diagnosis: "dato clínico",
  indications: "dato clínico",
} as Appointment & { diagnosis: string; indications: string };

describe("external calendar contract", () => {
  it("emits a private minimal payload without identity, contact or clinical data", () => {
    const payload = toExternalCalendarPayload(appointment, {
      durationMinutes: 20,
      timeZone: "America/Santiago",
    });

    expect(payload).toEqual({
      localAppointmentId: "appointment-1",
      title: "Agenda ocupada",
      start: { date: "2099-08-18", time: "09:00", timeZone: "America/Santiago" },
      durationMinutes: 20,
      availability: "busy",
      visibility: "private",
      status: "confirmed",
    });
    const serialized = JSON.stringify(payload).toLowerCase();
    for (const forbidden of [
      "patient",
      "rut",
      "phone",
      "email",
      "diagnosis",
      "indications",
      "confidencial",
      "11.111.111-1",
      "+56911111111",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects malformed timing before any adapter could receive it", () => {
    expect(() =>
      toExternalCalendarPayload(
        { ...appointment, time: "9:00" },
        {
          durationMinutes: 20,
          timeZone: "America/Santiago",
        }
      )
    ).toThrow("INVALID_APPOINTMENT_TIME");
    expect(() =>
      toExternalCalendarPayload(appointment, { durationMinutes: 20, timeZone: "invalid" })
    ).toThrow("INVALID_TIME_ZONE");
  });

  it("remains disabled until both the feature and OAuth are configured", () => {
    for (const configuration of [
      { enabled: false, oauthConfigured: false, timeZone: "America/Santiago" },
      { enabled: true, oauthConfigured: false, timeZone: "America/Santiago" },
    ]) {
      const service = new ExternalCalendarSyncService(configuration);
      expect(() => service.prepareEvent(appointment, 20)).toThrow(
        ExternalCalendarSyncDisabledError
      );
    }
  });
});

describe("calendar conflict policy", () => {
  it("sends competing changes to manual review by default", () => {
    expect(
      resolveCalendarConflict({
        localStatus: "booked",
        externalStatus: "busy",
        linkedToSameAppointment: false,
        localChanged: true,
        externalChanged: true,
      })
    ).toBe("manual_review");
  });

  it("external_busy_blocks only blocks availability and never overwrites a booking", () => {
    expect(
      resolveCalendarConflict(
        {
          localStatus: "available",
          externalStatus: "busy",
          linkedToSameAppointment: false,
          localChanged: false,
          externalChanged: true,
        },
        "external_busy_blocks"
      )
    ).toBe("block_local");
    expect(
      resolveCalendarConflict(
        {
          localStatus: "booked",
          externalStatus: "busy",
          linkedToSameAppointment: false,
          localChanged: true,
          externalChanged: true,
        },
        "external_busy_blocks"
      )
    ).toBe("manual_review");
  });

  it("propagates a local cancellation only for the same linked event", () => {
    expect(
      resolveCalendarConflict({
        localStatus: "cancelled",
        externalStatus: "busy",
        linkedToSameAppointment: true,
        localChanged: true,
        externalChanged: false,
      })
    ).toBe("cancel_external");
  });
});
