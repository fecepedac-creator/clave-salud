import { describe, expect, it } from "vitest";
import { mapPatientDirectoryEntry } from "../../utils/patientDirectoryProjection";

describe("patient directory frontend projection", () => {
  it("creates an explicitly operational patient without copying clinical fields", () => {
    const patient = mapPatientDirectoryEntry("patient-a", {
      centerId: "center-a",
      fullName: "Paciente Uno",
      rut: "12.345.678-9",
      gender: "Femenino",
      medicalHistory: ["No copiar"],
      consultations: [{ diagnosis: "No copiar" }],
      accessControl: { allowedUids: ["No copiar"] },
    });

    expect(patient.dataScope).toBe("operational");
    expect(patient.medicalHistory).toEqual([]);
    expect(patient.consultations).toEqual([]);
    expect(patient).not.toHaveProperty("accessControl");
    expect(JSON.stringify(patient)).not.toContain("No copiar");
  });
});
