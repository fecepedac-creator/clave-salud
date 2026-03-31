import {
  PUBLIC_APPOINTMENT_CHALLENGE_TTL_MS,
  buildPublicAppointmentSubjectHash,
  hashPublicAppointmentChallengeToken,
  isPublicAppointmentChallengeExpired,
  normalizePublicAppointmentPhone,
  verifyPublicAppointmentChallengeToken,
} from "../publicAppointmentSecurity";

describe("public appointment security", () => {
  test("normalizes Chilean phone numbers consistently", () => {
    expect(normalizePublicAppointmentPhone("912345678")).toBe("+56912345678");
    expect(normalizePublicAppointmentPhone("+56 9 1234 5678")).toBe("+56912345678");
    expect(normalizePublicAppointmentPhone("12345678")).toBe("+56912345678");
  });

  test("binds challenge scope to action, center, rut and phone", () => {
    const base = buildPublicAppointmentSubjectHash(
      "lookup",
      "center-a",
      "12.345.678-5",
      "+56 9 1234 5678"
    );
    const same = buildPublicAppointmentSubjectHash(
      "lookup",
      "center-a",
      "12.345.678-5",
      "912345678"
    );
    const differentPhone = buildPublicAppointmentSubjectHash(
      "lookup",
      "center-a",
      "12.345.678-5",
      "987654321"
    );
    const differentAction = buildPublicAppointmentSubjectHash(
      "cancel",
      "center-a",
      "12.345.678-5",
      "912345678"
    );
    const bookAction = buildPublicAppointmentSubjectHash(
      "book",
      "center-a",
      "12.345.678-5",
      "912345678"
    );

    expect(base).toBe(same);
    expect(base).not.toBe(differentPhone);
    expect(base).not.toBe(differentAction);
    expect(base).not.toBe(bookAction);
  });

  test("verifies a challenge token only when hashes match", () => {
    const token = "nonce-secret";
    const hash = hashPublicAppointmentChallengeToken(token);

    expect(verifyPublicAppointmentChallengeToken(token, hash)).toBe(true);
    expect(verifyPublicAppointmentChallengeToken("otro-token", hash)).toBe(false);
    expect(verifyPublicAppointmentChallengeToken(token, "")).toBe(false);
  });

  test("detects expired challenges", () => {
    const now = Date.parse("2026-03-30T12:00:00.000Z");
    expect(isPublicAppointmentChallengeExpired(now + PUBLIC_APPOINTMENT_CHALLENGE_TTL_MS, now)).toBe(false);
    expect(isPublicAppointmentChallengeExpired(now - 1, now)).toBe(true);
  });
});
