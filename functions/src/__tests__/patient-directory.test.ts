import { buildPatientDirectoryProjection, sanitizePatientDemographics } from "../patientDirectory";

describe("patient directory projection", () => {
  it("projects only operational demographics", () => {
    const projection = buildPatientDirectoryProjection("patient-a", "center-a", {
      fullName: " Paciente Uno ",
      rut: "12.345.678-9",
      phone: "+56912345678",
      email: "patient@example.test",
      birthDate: "1990-01-01",
      gender: "Femenino",
      active: true,
      medicalHistory: ["Diagnóstico privado"],
      consultations: [{ evolution: "Contenido clínico" }],
      allergies: ["Alergia privada"],
      medications: ["Tratamiento privado"],
      accessControl: { allowedUids: ["doctor-a"] },
    });

    expect(projection).toEqual({
      id: "patient-a",
      patientId: "patient-a",
      centerId: "center-a",
      entityType: "patient_directory_entry",
      fullName: "Paciente Uno",
      rut: "12.345.678-9",
      phone: "+56912345678",
      email: "patient@example.test",
      birthDate: "1990-01-01",
      gender: "Femenino",
      active: true,
      directoryVersion: 2,
    });
    expect(projection).not.toHaveProperty("medicalHistory");
    expect(projection).not.toHaveProperty("consultations");
    expect(projection).not.toHaveProperty("allergies");
    expect(projection).not.toHaveProperty("medications");
    expect(projection).not.toHaveProperty("accessControl");
  });

  it("accepts only allowlisted demographic fields", () => {
    expect(
      sanitizePatientDemographics({
        fullName: "Paciente Uno",
        rut: "12.345.678-9",
        phone: "+56912345678",
        diagnosis: "No debe salir",
        medications: ["No debe salir"],
        accessControl: { allowedUids: ["attacker"] },
      })
    ).toEqual({
      fullName: "Paciente Uno",
      rut: "12.345.678-9",
      phone: "+56912345678",
    });
  });

  it("requires a patient name and RUT", () => {
    expect(() => sanitizePatientDemographics({ fullName: "Paciente" })).toThrow(
      "INVALID_DEMOGRAPHICS"
    );
    expect(() => sanitizePatientDemographics(null)).toThrow("INVALID_DEMOGRAPHICS");
  });
});
