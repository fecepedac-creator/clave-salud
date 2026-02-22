import type { AnyRole, CanonicalRole } from "../types";

export function normalizeRole(role: unknown): CanonicalRole | null {
    if (!role) return null;
    const r = String(role).trim();

    // Canonical
    if (r === "super_admin" || r === "center_admin" || r === "admin" || r === "doctor")
        return r as CanonicalRole;

    // Common legacy variants
    const upper = r.toUpperCase();
    if (upper === "SUPERADMIN" || upper === "SUPER_ADMIN") return "super_admin";
    if (upper === "CENTER_ADMIN" || upper === "ADMIN_CENTRO") return "center_admin";
    if (upper === "ADMIN" || upper === "ADMINISTRADOR") return "admin";
    if (upper === "MEDICO" || upper === "DOCTOR") return "doctor";
    if (upper === "STAFF") return "staff";

    return null;
}

export function normalizeRoles(input: unknown): CanonicalRole[] {
    const arr = Array.isArray(input) ? input : input ? [input] : [];
    const out: CanonicalRole[] = [];
    for (const x of arr) {
        const n = normalizeRole(x);
        if (n && !out.includes(n)) out.push(n);
    }
    return out;
}

export function hasRole(
    roles: AnyRole[] | CanonicalRole[] | undefined | null,
    required: CanonicalRole
): boolean {
    if (!roles) return false;
    const norm = normalizeRoles(roles as any);
    return norm.includes(required);
}
