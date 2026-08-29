import type { Patient, PatientCommunication, PatientCommunicationChannel } from "../types";

const defaultChannel = (): PatientCommunicationChannel => ({
  consent: false,
  optedOut: false,
});

export const createDefaultPatientCommunication = (): PatientCommunication => ({
  email: defaultChannel(),
  whatsapp: defaultChannel(),
});

export const withDefaultPatientCommunication = <T extends Partial<Patient>>(
  patient: T
): T & { communication: PatientCommunication } => ({
  ...patient,
  communication: {
    email: { ...defaultChannel(), ...(patient.communication?.email ?? {}) },
    whatsapp: { ...defaultChannel(), ...(patient.communication?.whatsapp ?? {}) },
  },
});

export const isChannelOptedOut = (
  patient: Partial<Patient> | null | undefined,
  channel: keyof PatientCommunication
): boolean => withDefaultPatientCommunication(patient ?? {}).communication[channel].optedOut;

export type PatientCommunicationContext = "transactional" | "clinical" | "marketing";

export const canSendPatientCommunication = (
  patient: Partial<Patient> | null | undefined,
  channel: keyof PatientCommunication,
  context: PatientCommunicationContext
): { allowed: true } | { allowed: false; reason: "opted_out" | "consent_required" } => {
  const preferences = withDefaultPatientCommunication(patient ?? {}).communication[channel];
  if (preferences.optedOut) return { allowed: false, reason: "opted_out" };
  if (context === "marketing" && !preferences.consent) {
    return { allowed: false, reason: "consent_required" };
  }
  return { allowed: true };
};
