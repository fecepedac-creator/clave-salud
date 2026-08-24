import * as crypto from "crypto";

export interface PublicRateLimitState {
  count: number;
  windowStartedAtMs: number;
}

export function hashPublicRateLimitKey(parts: string[]): string {
  return crypto
    .createHash("sha256")
    .update(parts.map((part) => part.trim().toLowerCase()).join("|"))
    .digest("hex");
}

export function consumeFixedWindowRateLimit(params: {
  current?: PublicRateLimitState | null;
  nowMs: number;
  windowMs: number;
  limit: number;
}) {
  const { current, nowMs, windowMs, limit } = params;
  const activeWindow =
    current &&
    Number.isFinite(current.windowStartedAtMs) &&
    nowMs - current.windowStartedAtMs >= 0 &&
    nowMs - current.windowStartedAtMs < windowMs;
  const next = activeWindow
    ? { count: current.count + 1, windowStartedAtMs: current.windowStartedAtMs }
    : { count: 1, windowStartedAtMs: nowMs };
  return { allowed: next.count <= limit, next };
}

export function canCancelPublicAppointment(
  appointment: Record<string, unknown> | null | undefined,
  patientRut: string,
  phone: string,
  normalizeRut: (value: unknown) => string
): boolean {
  return Boolean(
    appointment &&
    appointment.status === "booked" &&
    appointment.active !== false &&
    normalizeRut(appointment.patientRut) === patientRut &&
    String(appointment.patientPhone || "") === phone
  );
}
