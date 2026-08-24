import type { Patient } from "../types";

const stringValue = (value: unknown): string => (typeof value === "string" ? value : "");

export const mapPatientDirectoryEntry = (
  documentId: string,
  value: Record<string, unknown>
): Patient => {
  const gender = stringValue(value.gender);
  return {
    id: documentId,
    centerId: stringValue(value.centerId),
    dataScope: "operational",
    rut: stringValue(value.rut),
    fullName: stringValue(value.fullName) || "Paciente sin nombre",
    birthDate: stringValue(value.birthDate),
    gender: ["Masculino", "Femenino", "Otro"].includes(gender)
      ? (gender as Patient["gender"])
      : "Otro",
    email: stringValue(value.email) || undefined,
    phone: stringValue(value.phone) || undefined,
    address: stringValue(value.address) || undefined,
    commune: stringValue(value.commune) || undefined,
    active: value.active !== false,
    medicalHistory: [],
    surgicalHistory: [],
    smokingStatus: "No fumador",
    alcoholStatus: "No consumo",
    medications: [],
    allergies: [],
    consultations: [],
    attachments: [],
    lastUpdated: stringValue(value.lastUpdated),
  };
};
