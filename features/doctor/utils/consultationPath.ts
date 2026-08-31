/**
 * Resolves the storage location used by the consultation writer.
 *
 * Clinical records are canonical documents in `/patients`. Operational directory
 * entries are the only remaining records stored under their centre document.
 */
export const consultationCollectionPath = (
  centerId: string,
  patientId: string,
  dataScope?: "clinical" | "operational"
) =>
  dataScope === "operational"
    ? ["centers", centerId, "patients", patientId, "consultations"]
    : ["patients", patientId, "consultations"];
