import {
  decideReminderClaim,
  redactedReminderErrorCode,
  reminderJobId,
} from "../reminderStateMachine";

describe("reminder state machine", () => {
  it("claims a new job with a bounded lease", () => {
    expect(
      decideReminderClaim({ current: null, nowMs: 1_000, leaseMs: 60_000, leaseOwner: "run-1" })
    ).toEqual({
      action: "claim",
      next: {
        status: "processing",
        attemptCount: 1,
        leaseOwner: "run-1",
        leaseExpiresAtMs: 61_000,
      },
    });
  });

  it("allows exactly one active lease", () => {
    expect(
      decideReminderClaim({
        current: {
          status: "processing",
          attemptCount: 1,
          leaseOwner: "run-1",
          leaseExpiresAtMs: 70_000,
        },
        nowMs: 2_000,
        leaseMs: 60_000,
        leaseOwner: "run-2",
      })
    ).toEqual({ action: "skip", reason: "active_lease" });
  });

  it("never resends automatically after an ambiguous expired send lease", () => {
    const result = decideReminderClaim({
      current: {
        status: "processing",
        attemptCount: 1,
        leaseOwner: "crashed-run",
        leaseExpiresAtMs: 1_500,
      },
      nowMs: 2_000,
      leaseMs: 60_000,
      leaseOwner: "retry-run",
    });
    expect(result).toMatchObject({
      action: "manual_review",
      reason: "expired_send_lease",
      next: { status: "manual_review", attemptCount: 1 },
    });
  });

  it.each(["sent", "delivered", "confirmed", "skipped"] as const)(
    "does not claim terminal state %s",
    (status) => {
      expect(
        decideReminderClaim({
          current: { status, attemptCount: 1 },
          nowMs: 2_000,
          leaseMs: 60_000,
          leaseOwner: "retry-run",
        })
      ).toEqual({ action: "skip", reason: "terminal" });
    }
  );

  it("requires review rather than automatically retrying a known failure", () => {
    expect(
      decideReminderClaim({
        current: { status: "failed", attemptCount: 1 },
        nowMs: 2_000,
        leaseMs: 60_000,
        leaseOwner: "retry-run",
      })
    ).toEqual({ action: "skip", reason: "requires_review" });
  });

  it("generates stable opaque ids without exposing the source identifiers", () => {
    const parts = ["control", "center-a", "patient-rut-123", "consultation-1", "2026-08-30"];
    const first = reminderJobId(parts);
    expect(first).toBe(reminderJobId(parts));
    expect(first).toMatch(/^reminder_[a-f0-9]{48}$/);
    expect(first).not.toContain("patient-rut-123");
  });

  it("reduces errors to a non-PII class code", () => {
    const error = new TypeError("Falló el teléfono +56912345678");
    expect(redactedReminderErrorCode(error)).toBe("TYPEERROR");
    expect(redactedReminderErrorCode("secret details")).toBe("UNKNOWN");
  });
});
