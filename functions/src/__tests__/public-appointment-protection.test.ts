import {
  canCancelPublicAppointment,
  consumeFixedWindowRateLimit,
  hashPublicRateLimitKey,
} from "../publicAppointmentProtection";

describe("protección de callables públicas de agenda", () => {
  it("genera una clave opaca estable sin exponer identificadores", () => {
    const key = hashPublicRateLimitKey([
      "listPatientAppointments",
      "center-a",
      "12.345.678-9",
      "+56912345678",
    ]);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("12345678");
    expect(key).toBe(
      hashPublicRateLimitKey([
        "LISTPATIENTAPPOINTMENTS",
        " center-a ",
        "12.345.678-9",
        "+56912345678",
      ])
    );
  });

  it("trata citas ausentes, inactivas y no coincidentes como el mismo no-op", () => {
    const normalize = (value: unknown) => String(value || "").replace(/\D/g, "");
    const expectedRut = "123456789";
    const phone = "+56912345678";
    expect(canCancelPublicAppointment(null, expectedRut, phone, normalize)).toBe(false);
    expect(
      canCancelPublicAppointment(
        { status: "available", patientRut: "12.345.678-9", patientPhone: phone },
        expectedRut,
        phone,
        normalize
      )
    ).toBe(false);
    expect(
      canCancelPublicAppointment(
        {
          status: "booked",
          active: false,
          patientRut: "12.345.678-9",
          patientPhone: phone,
        },
        expectedRut,
        phone,
        normalize
      )
    ).toBe(false);
    expect(
      canCancelPublicAppointment(
        { status: "booked", patientRut: "12.345.678-9", patientPhone: phone },
        expectedRut,
        phone,
        normalize
      )
    ).toBe(true);
  });

  it("bloquea al superar el límite y reinicia al expirar la ventana", () => {
    const start = Date.parse("2026-08-18T12:00:00.000Z");
    let state = { count: 0, windowStartedAtMs: start };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const decision = consumeFixedWindowRateLimit({
        current: state,
        nowMs: start + attempt,
        windowMs: 60_000,
        limit: 3,
      });
      expect(decision.allowed).toBe(true);
      state = decision.next;
    }
    expect(
      consumeFixedWindowRateLimit({ current: state, nowMs: start + 4, windowMs: 60_000, limit: 3 })
        .allowed
    ).toBe(false);
    expect(
      consumeFixedWindowRateLimit({
        current: state,
        nowMs: start + 60_000,
        windowMs: 60_000,
        limit: 3,
      })
    ).toEqual({ allowed: true, next: { count: 1, windowStartedAtMs: start + 60_000 } });
  });
});
