export type StaffAccessRole =
  | "center_admin"
  | "administrative"
  | "professional"
  | "auditor"
  | "support";

export const STAFF_CAPABILITIES = [
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
] as const;

export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

const CLINICAL_PROFESSIONS = new Set([
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

const DEFAULTS: Record<StaffAccessRole, readonly StaffCapability[]> = {
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
};

const GRANTABLE: Record<StaffAccessRole, readonly StaffCapability[]> = {
  center_admin: [...DEFAULTS.center_admin, "agenda.override"],
  administrative: [...DEFAULTS.administrative, "agenda.block", "agenda.override"],
  professional: [
    ...DEFAULTS.professional,
    "agenda.manage",
    "agenda.block",
    "agenda.override",
    "agenda.contact",
    "agenda.check_in",
    "agenda.attendance",
    "agenda.rebook",
    "patient.demographics.write",
    "clinical_record.export",
  ],
  auditor: ["audit.read"],
  support: ["support.diagnostics"],
};

const ALIASES: Record<string, StaffCapability> = {
  "appointment.contact": "agenda.contact",
  "appointment.check_in": "agenda.check_in",
};

const normalizeAccessRole = (value: unknown): StaffAccessRole => {
  const role = String(value || "")
    .trim()
    .toLowerCase();
  if (["center_admin", "admin_centro", "admin"].includes(role)) return "center_admin";
  if (["administrative", "administrativo", "secretaria", "secretary"].includes(role)) {
    return "administrative";
  }
  if (role === "auditor") return "auditor";
  if (role === "support") return "support";
  return "professional";
};

const normalizeClinicalProfession = (value: unknown) => {
  const role = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return CLINICAL_PROFESSIONS.has(role) ? role : "";
};

export const sanitizeStaffCapabilities = (
  accessRole: StaffAccessRole,
  requested: unknown
): StaffCapability[] => {
  if (!Array.isArray(requested)) return [...DEFAULTS[accessRole]];
  const known = new Set<StaffCapability>(STAFF_CAPABILITIES);
  const allowed = new Set(GRANTABLE[accessRole]);
  return Array.from(
    new Set(
      requested
        .map((value) => ALIASES[String(value)] || value)
        .filter(
          (value): value is StaffCapability =>
            known.has(value as StaffCapability) && allowed.has(value as StaffCapability)
        )
    )
  );
};

export const sanitizeStaffMembershipProfile = (
  accessRoleValue: unknown,
  profileDataValue: unknown
) => {
  const accessRole = normalizeAccessRole(accessRoleValue);
  const profileData =
    profileDataValue && typeof profileDataValue === "object"
      ? (profileDataValue as Record<string, unknown>)
      : {};
  const clinicalRole =
    accessRole === "professional"
      ? normalizeClinicalProfession(profileData.clinicalRole || profileData.role)
      : "";
  const capabilities = sanitizeStaffCapabilities(accessRole, profileData.capabilities);
  return {
    accessRole,
    clinicalRole,
    capabilities:
      accessRole === "professional" && clinicalRole === "TENS"
        ? capabilities.filter((capability) => capability !== "clinical_record.sign")
        : capabilities,
    visibleInBooking: accessRole === "professional" && profileData.visibleInBooking === true,
    isAdmin: accessRole === "center_admin",
  };
};
