/**
 * Resolves the storage location used by the consultation writer.
 *
 * Clinical records are canonical documents in `/patients`. Operational directory
 * entries are the only remaining records stored under their centre document.
 */
export type ConsultationCollectionPath =
  | ["patients", string, "consultations"]
  | ["centers", string, "patients", string, "consultations"];

export const consultationCollectionPath = (
  centerId: string,
  patientId: string,
  dataScope?: "clinical" | "operational"
): ConsultationCollectionPath =>
  dataScope === "operational"
    ? ["centers", centerId, "patients", patientId, "consultations"]
    : ["patients", patientId, "consultations"];
