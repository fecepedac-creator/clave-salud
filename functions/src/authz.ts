import { HttpsError } from "firebase-functions/v2/https";

export type AppRole =
  | "super_admin"
  | "center_admin"
  | "doctor"
  | "professional"
  | "staff";

export function requireAuth(auth: unknown): asserts auth is { uid: string; token?: any } {
  if (!auth || typeof auth !== "object" || !("uid" in auth)) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
}

export function normalizeRole(role: unknown): AppRole | null {
  if (typeof role !== "string") return null;
  const r = role.trim();
  if (!r) return null;

  const lower = r.toLowerCase();

  if (["super_admin", "superadmin", "super-admin"].includes(lower)) return "super_admin";
  if (["center_admin", "admin", "administrador", "centre_admin", "center-admin"].includes(lower)) return "center_admin";
  if (["doctor", "medico", "médico"].includes(lower)) return "doctor";
  if (["professional", "profesional"].includes(lower)) return "professional";
  if (["staff", "equipo"].includes(lower)) return "staff";

  return null;
}

export function hasRoleFromToken(token: any, role: AppRole): boolean {
  if (!token) return false;

  // 1) custom claims (compat)
  if (role === "super_admin" && (token.super_admin === true || token.superadmin === true)) return true;

  // 2) token.role simple
  if (typeof token.role === "string" && normalizeRole(token.role) === role) return true;

  // 3) token.roles array
  if (Array.isArray(token.roles)) {
    const normalized = token.roles.map((x: any) => normalizeRole(x)).filter(Boolean);
    return normalized.includes(role);
  }

  return false;
}

export function requireRole(token: any, role: AppRole) {
  if (!hasRoleFromToken(token, role)) {
    throw new HttpsError("permission-denied", "No tienes permisos para esta acción.");
  }
}
