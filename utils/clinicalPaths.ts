export const rootPatientPath = (patientId: string) => `/patients/${patientId}`;

export const rootPatientConsultationPath = (patientId: string, consultationId: string) =>
  `/patients/${patientId}/consultations/${consultationId}`;
