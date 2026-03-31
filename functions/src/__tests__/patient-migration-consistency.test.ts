import { comparePatientConsistency } from "../patientMigrationConsistency";

describe("patientMigrationConsistency", () => {
  it("marca ok cuando root y legacy coinciden", () => {
    const result = comparePatientConsistency({
      patientId: "p_1",
      centerId: "c_1",
      rootPatient: {
        id: "p_1",
        rut: "12.345.678-5",
        fullName: "Paciente Uno",
        birthDate: "1990-01-01",
        phone: "+56911111111",
        accessControl: { centerIds: ["c_1"] },
      },
      legacyPatient: {
        id: "p_1",
        rut: "12.345.678-5",
        fullName: "Paciente Uno",
        birthDate: "1990-01-01",
        phone: "+56911111111",
        consultations: [{ id: "co_1" }],
      },
      rootConsultations: [{ id: "co_1" }],
      legacyConsultations: [{ id: "co_1" }],
    });

    expect(result.status).toBe("ok");
    expect(result.issues).toHaveLength(0);
  });

  it("marca critical cuando falta root o difieren las consultations", () => {
    const result = comparePatientConsistency({
      patientId: "p_2",
      centerId: "c_1",
      legacyPatient: {
        id: "p_2",
        rut: "22.222.222-2",
        fullName: "Paciente Legacy",
        birthDate: "1980-01-01",
        phone: "+56922222222",
        consultations: [{ id: "co_legacy" }],
      },
      rootConsultations: [],
      legacyConsultations: [{ id: "co_legacy" }],
    });

    expect(result.status).toBe("critical");
    expect(result.issues.some((issue) => issue.code === "ROOT_MISSING")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "CONSULTATION_COUNT_MISMATCH")).toBe(
      true
    );
  });
});
