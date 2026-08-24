import type { AccessRole, AnyRole, CanonicalRole, Capability, ClinicalProfession } from "../types";

export const CAPABILITIES = [
  "agenda.read",
  "agenda.manage",
  "agenda.block",
  "agenda.override",
  "agenda.contact",
  "agenda.check_in",
  "agenda.attendance",
  "agenda.rebook",
  "operational.export",
  "patient.demographics.read",
  "patient.demographics.write",
  "clinical_record.read",
  "clinical_draft.create",
  "clinical_draft.edit_own",
  "clinical_record.sign",
  "clinical_record.addendum",
  "clinical_record.export",
  "audit.read",
  "support.diagnostics",
  "center.configure",
  "users.manage",
] as const satisfies readonly Capability[];

const CLINICAL_PROFESSIONS = new Set<ClinicalProfession>([
  "MEDICO",
  "ENFERMERA",
  "TENS",
  "NUTRICIONISTA",
  "PSICOLOGO",
  "KINESIOLOGO",
  "TERAPEUTA_OCUPACIONAL",
  "FONOAUDIOLOGO",
  "PODOLOGO",
  "TECNOLOGO_MEDICO",
  "ASISTENTE_SOCIAL",
  "PREPARADOR_FISICO",
  "MATRONA",
  "ODONTOLOGO",
  "QUIMICO_FARMACEUTICO",
]);

const DEFAULT_CAPABILITIES: Record<AccessRole, readonly Capability[]> = {
  super_admin: [],
  center_admin: [
    "agenda.read",
    "agenda.manage",
    "agenda.block",
    "agenda.contact",
    "agenda.check_in",
    "agenda.attendance",
    "agenda.rebook",
    "operational.export",
    "patient.demographics.read",
    "patient.demographics.write",
    "center.configure",
    "users.manage",
  ],
  administrative: [
    "agenda.read",
    "agenda.manage",
    "agenda.contact",
    "agenda.check_in",
    "agenda.attendance",
    "agenda.rebook",
    "patient.demographics.read",
    "patient.demographics.write",
  ],
  professional: [
    "agenda.read",
    "patient.demographics.read",
    "clinical_record.read",
    "clinical_draft.create",
    "clinical_draft.edit_own",
    "clinical_record.sign",
    "clinical_record.addendum",
  ],
  auditor: ["audit.read"],
  support: [],
  patient: [],
  system: [],
};

const GRANTABLE_CAPABILITIES: Record<AccessRole, readonly Capability[]> = {
  super_admin: [],
  center_admin: [
    "agenda.read",
    "agenda.manage",
    "agenda.block",
    "agenda.override",
    "agenda.contact",
    "agenda.check_in",
    "agenda.attendance",
    "agenda.rebook",
    "operational.export",
    "patient.demographics.read",
    "patient.demographics.write",
    "center.configure",
    "users.manage",
  ],
  administrative: [
    "agenda.read",
    "agenda.manage",
    "agenda.block",
    "agenda.override",
    "agenda.contact",
    "agenda.check_in",
    "agenda.attendance",
    "agenda.rebook",
    "patient.demographics.read",
    "patient.demographics.write",
  ],
  professional: [
    "agenda.read",
    "agenda.manage",
    "agenda.block",
    "agenda.override",
    "agenda.contact",
    "agenda.check_in",
    "agenda.attendance",
    "agenda.rebook",
    "patient.demographics.read",
    "patient.demographics.write",
    "clinical_record.read",
    "clinical_draft.create",
    "clinical_draft.edit_own",
    "clinical_record.sign",
    "clinical_record.addendum",
    "clinical_record.export",
  ],
  auditor: ["audit.read"],
  support: ["support.diagnostics"],
  patient: [],
  system: [],
};

const LEGACY_CAPABILITY_ALIASES: Record<string, Capability> = {
  "appointment.contact": "agenda.contact",
  "appointment.check_in": "agenda.check_in",
};

export interface LegacyAccessInput {
  accessRole?: unknown;
  clinicalRole?: unknown;
  professionalRole?: unknown;
  role?: unknown;
  roles?: unknown;
  isAdmin?: boolean;
  capabilities?: unknown;
}

export interface CanonicalAccessProfile {
  accessRole: AccessRole | null;
  clinicalProfession: ClinicalProfession | null;
  capabilities: Capability[];
}

export function normalizeClinicalProfession(role: unknown): ClinicalProfession | null {
  const upper = String(role || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return CLINICAL_PROFESSIONS.has(upper as ClinicalProfession)
    ? (upper as ClinicalProfession)
    : null;
}

export function normalizeAccessRole(role: unknown): AccessRole | null {
  const normalized = normalizeRole(role);
  if (normalized === "super_admin") return "super_admin";
  if (normalized === "center_admin" || normalized === "admin") return "center_admin";
  if (normalized === "administrative") return "administrative";
  if (normalized === "professional" || normalized === "doctor" || normalized === "staff") {
    return "professional";
  }
  const value = String(role || "")
    .trim()
    .toLowerCase();
  if (["auditor", "support", "patient", "system"].includes(value)) return value as AccessRole;
  return null;
}

const normalizeExplicitCapabilities = (input: unknown): Capability[] => {
  if (!Array.isArray(input)) return [];
  const known = new Set<Capability>(CAPABILITIES);
  return Array.from(
    new Set(
      input
        .map((value) => LEGACY_CAPABILITY_ALIASES[String(value)] || value)
        .filter((value): value is Capability => known.has(value as Capability))
    )
  );
};

export const getDefaultCapabilities = (
  accessRole: AccessRole,
  clinicalProfession?: ClinicalProfession | null
): Capability[] => {
  const defaults = [...DEFAULT_CAPABILITIES[accessRole]];
  return clinicalProfession === "TENS"
    ? defaults.filter((capability) => capability !== "clinical_record.sign")
    : defaults;
};

export const sanitizeCapabilitiesForAccessRole = (
  accessRole: AccessRole,
  capabilities: unknown
): Capability[] => {
  const requested = normalizeExplicitCapabilities(capabilities);
  const allowed = new Set(GRANTABLE_CAPABILITIES[accessRole]);
  return requested.filter((capability) => allowed.has(capability));
};

export const getGrantableCapabilities = (accessRole: AccessRole): Capability[] => [
  ...GRANTABLE_CAPABILITIES[accessRole],
];

export function adaptLegacyAccess(input: LegacyAccessInput): CanonicalAccessProfile {
  const clinicalProfession = normalizeClinicalProfession(
    input.clinicalRole ?? input.professionalRole ?? input.role
  );
  const roleCandidates = Array.isArray(input.roles) ? input.roles : [];
  let accessRole = normalizeAccessRole(input.accessRole);
  if (!accessRole) accessRole = roleCandidates.map(normalizeAccessRole).find(Boolean) || null;
  if (!accessRole && input.isAdmin === true) accessRole = "center_admin";
  if (!accessRole && clinicalProfession) accessRole = "professional";
  if (!accessRole) accessRole = normalizeAccessRole(input.role);

  const capabilities = Array.isArray(input.capabilities)
    ? accessRole
      ? sanitizeCapabilitiesForAccessRole(accessRole, input.capabilities)
      : []
    : accessRole
      ? getDefaultCapabilities(accessRole, clinicalProfession)
      : [];
  return { accessRole, clinicalProfession, capabilities };
}

export function hasCapability(
  profile: Pick<CanonicalAccessProfile, "capabilities"> | null | undefined,
  capability: Capability
): boolean {
  return profile?.capabilities.includes(capability) === true;
}

export function normalizeRole(role: unknown): CanonicalRole | null {
  if (!role) return null;
  const r = String(role).trim();

  // Canonical
  if (
    r === "super_admin" ||
    r === "center_admin" ||
    r === "administrative" ||
    r === "professional" ||
    r === "admin" ||
    r === "doctor"
  )
    return r as CanonicalRole;

  // Common legacy variants
  const upper = r.toUpperCase();
  if (upper === "SUPERADMIN" || upper === "SUPER_ADMIN") return "super_admin";
  if (upper === "CENTER_ADMIN" || upper === "ADMIN_CENTRO") return "center_admin";
  if (upper === "ADMIN" || upper === "ADMINISTRADOR") return "admin";
  if (
    upper === "ADMINISTRATIVO" ||
    upper === "ADMINISTRATIVA" ||
    upper === "SECRETARIA" ||
    upper === "SECRETARY"
  )
    return "administrative";
  if (upper === "MEDICO" || upper === "DOCTOR") return "doctor";
  if (upper === "PROFESIONAL" || upper === "PROFESSIONAL") return "professional";
  if (upper === "STAFF") return "staff";

  return null;
}

export function isAdministrativeRole(role: unknown): boolean {
  return normalizeRole(role) === "administrative";
}

/** Los recursos y el superadministrador no se crean como miembros clínicos del centro. */
export function isCreatableCenterStaffRole(role: unknown): boolean {
  const value = String(role || "")
    .trim()
    .toUpperCase();
  return value !== "" && value !== "SERVICIO" && value !== "SUPER_ADMIN";
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
