import {
  canConfigureAgendaPolicy,
  canOverrideAgenda,
  defaultAgendaPolicy,
  sanitizeAgendaPolicy,
} from "../agendaPolicy";

describe("agenda policy backend", () => {
  it("uses conservative defaults", () => {
    expect(defaultAgendaPolicy("center-a", "main")).toMatchObject({
      requirePatientContact: true,
      allowInternalOutsideHours: false,
      appointmentConflictMode: "block",
      resourceConflictMode: "block",
    });
  });

  it("sanitizes malformed input", () => {
    expect(
      sanitizeAgendaPolicy("center-a", "main", {
        slotDurationMinutes: -1,
        cancellationWindowHours: 1000,
        resourceConflictMode: "allow",
      })
    ).toMatchObject({
      slotDurationMinutes: 30,
      cancellationWindowHours: 24,
      resourceConflictMode: "block",
    });
  });

  it("requires explicit center.configure when capabilities exist", () => {
    expect(canConfigureAgendaPolicy({ active: true, accessRole: "ADMIN_CENTRO" })).toBe(true);
    expect(
      canConfigureAgendaPolicy({
        active: true,
        accessRole: "ADMIN_CENTRO",
        capabilities: [],
      })
    ).toBe(false);
    expect(
      canConfigureAgendaPolicy({
        active: true,
        accessRole: "ADMIN_CENTRO",
        capabilities: ["center.configure"],
      })
    ).toBe(true);
  });

  it("never grants override through a legacy role", () => {
    expect(canOverrideAgenda({ active: true, accessRole: "ADMIN_CENTRO" })).toBe(false);
    expect(
      canOverrideAgenda({
        active: true,
        accessRole: "ADMINISTRATIVO",
        capabilities: ["agenda.override"],
      })
    ).toBe(true);
  });
});
