export type SensitiveFieldKind = "rut" | "phone" | "email" | "text";

export type SensitiveClassification =
  | "identifier"
  | "contact"
  | "clinical"
  | "financial"
  | "administrative";

export interface SensitiveFieldDescriptor {
  field: string;
  label: string;
  classification: SensitiveClassification;
  maskByDefault: boolean;
}

export const SENSITIVE_DATA_CATALOG = {
  patient: [
    { field: "rut", label: "RUT", classification: "identifier", maskByDefault: true },
    { field: "phone", label: "Telefono", classification: "contact", maskByDefault: true },
    { field: "email", label: "Email", classification: "contact", maskByDefault: true },
    { field: "medicalHistory", label: "Antecedentes", classification: "clinical", maskByDefault: false },
    { field: "allergies", label: "Alergias", classification: "clinical", maskByDefault: false },
  ],
  appointment: [
    { field: "patientRut", label: "RUT paciente", classification: "identifier", maskByDefault: true },
    { field: "patientPhone", label: "Telefono paciente", classification: "contact", maskByDefault: true },
    { field: "patientEmail", label: "Email paciente", classification: "contact", maskByDefault: true },
  ],
  doctor: [
    { field: "rut", label: "RUT profesional", classification: "identifier", maskByDefault: true },
    { field: "email", label: "Email profesional", classification: "contact", maskByDefault: true },
    { field: "phone", label: "Telefono profesional", classification: "contact", maskByDefault: true },
  ],
} as const satisfies Record<string, SensitiveFieldDescriptor[]>;

const maskKeepingTail = (value: string, visibleTail: number, maskChar = "*") => {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= visibleTail) return maskChar.repeat(trimmed.length);
  const tail = trimmed.slice(-visibleTail);
  return `${maskChar.repeat(Math.max(trimmed.length - visibleTail, 0))}${tail}`;
};

export const maskRut = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const tail = normalized.slice(-4);
  return `***.***${tail}`;
};

export const maskPhone = (value?: string | null) => maskKeepingTail(String(value || ""), 4);

export const maskEmail = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized.includes("@")) return maskKeepingTail(normalized, 2);
  const [local, domain] = normalized.split("@");
  const safeLocal = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
};

export const maskSensitiveValue = (value: string | undefined | null, kind: SensitiveFieldKind) => {
  if (!value) return "";
  if (kind === "rut") return maskRut(value);
  if (kind === "phone") return maskPhone(value);
  if (kind === "email") return maskEmail(value);
  return maskKeepingTail(String(value), 3);
};
