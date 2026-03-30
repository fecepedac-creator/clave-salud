import * as crypto from "crypto";

export const PUBLIC_APPOINTMENT_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type PublicAppointmentAction = "lookup" | "cancel" | "book";

export function normalizePublicAppointmentPhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("56")) {
    return `+${digits}`;
  }
  if (digits.startsWith("9") && digits.length >= 9) {
    return `+56${digits}`;
  }
  if (digits.length === 8) {
    return `+569${digits}`;
  }
  return `+56${digits}`;
}

export function buildPublicAppointmentSubjectHash(
  action: PublicAppointmentAction,
  centerId: string,
  rut: string,
  phone: string
): string {
  const normalized = `${action}:${centerId}:${String(rut).trim().toUpperCase()}:${normalizePublicAppointmentPhone(
    phone
  )}`;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function hashPublicAppointmentChallengeToken(token: string): string {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function verifyPublicAppointmentChallengeToken(
  token: string,
  expectedHash: string | null | undefined
): boolean {
  if (!token || !expectedHash) return false;
  const provided = Buffer.from(hashPublicAppointmentChallengeToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

export function isPublicAppointmentChallengeExpired(
  expiresAtMs: number,
  nowMs: number = Date.now()
): boolean {
  return expiresAtMs <= nowMs;
}
