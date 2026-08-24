import { describe, expect, it } from "vitest";
import { canApplyAgendaOverride, normalizeAgendaPolicy } from "../../domain/agendaPolicy";

describe("agenda policy contract", () => {
  it("defaults to conservative operating rules", () => {
    expect(normalizeAgendaPolicy("center-a", "default", null)).toMatchObject({
      requirePatientContact: true,
      allowInternalOutsideHours: false,
      appointmentConflictMode: "block",
      resourceConflictMode: "block",
    });
  });

  it("rejects malformed values instead of broadening access", () => {
    expect(
      normalizeAgendaPolicy("center-a", "default", {
        slotDurationMinutes: -1,
        cancellationWindowHours: 9999,
        appointmentConflictMode: "allow" as never,
      })
    ).toMatchObject({
      slotDurationMinutes: 30,
      cancellationWindowHours: 24,
      appointmentConflictMode: "block",
    });
  });

  it("requires mode, capability and a reason for an override", () => {
    expect(
      canApplyAgendaOverride({
        conflictMode: "require_override",
        hasOverrideCapability: true,
        reason: "Paciente derivado desde urgencia",
      })
    ).toBe(true);
    expect(
      canApplyAgendaOverride({
        conflictMode: "require_override",
        hasOverrideCapability: false,
        reason: "Paciente derivado desde urgencia",
      })
    ).toBe(false);
    expect(
      canApplyAgendaOverride({
        conflictMode: "require_override",
        hasOverrideCapability: true,
        reason: " ",
      })
    ).toBe(false);
  });
});
