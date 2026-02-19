import type { Patient, PatientCommunication, PatientCommunicationChannel } from "../types";

const DEFAULT_CHANNEL: PatientCommunicationChannel = {
  consent: false,
  optedOut: false,
};

export const DEFAULT_PATIENT_COMMUNICATION: PatientCommunication = {
  email: { ...DEFAULT_CHANNEL },
  whatsapp: { ...DEFAULT_CHANNEL },
};

export const withDefaultPatientCommunication = <T extends Partial<Patient>>(patient: T): T & {
  communication: PatientCommunication;
} => ({
  ...patient,
  communication: {
    email: { ...DEFAULT_CHANNEL, ...(patient.communication?.email || {}) },
    whatsapp: { ...DEFAULT_CHANNEL, ...(patient.communication?.whatsapp || {}) },
  },
});

export const isChannelOptedOut = (
  patient: Partial<Patient> | null | undefined,
  channel: keyof PatientCommunication
): boolean => {
  const merged = withDefaultPatientCommunication(patient || {});
  return merged.communication[channel].optedOut === true;
};
