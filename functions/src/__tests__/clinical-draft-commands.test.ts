import { clinicalRoleHasCapability, computeClinicalDocumentHash } from "../clinicalDraftCommands";

describe("capacidades clínicas de borrador, firma y adenda", () => {
  it("mantiene compatibilidad para profesiones clínicas legacy", () => {
    expect(clinicalRoleHasCapability("MÉDICO", undefined, "clinical_draft.create")).toBe(true);
    expect(clinicalRoleHasCapability("PSICÓLOGO", undefined, "clinical_draft.edit_own")).toBe(true);
  });

  it("deniega roles administrativos aunque declaren capacidad clínica", () => {
    expect(
      clinicalRoleHasCapability("ADMIN_CENTRO", ["clinical_record.sign"], "clinical_record.sign")
    ).toBe(false);
  });

  it("respeta la lista explícita y deniega una lista vacía", () => {
    expect(
      clinicalRoleHasCapability("ENFERMERA", ["clinical_record.read"], "clinical_record.sign")
    ).toBe(false);
    expect(clinicalRoleHasCapability("MEDICO", [], "clinical_draft.create")).toBe(false);
  });

  it("no concede firma legacy a TENS salvo capacidad explícita", () => {
    expect(clinicalRoleHasCapability("TENS", undefined, "clinical_record.sign")).toBe(false);
    expect(
      clinicalRoleHasCapability("TENS", ["clinical_record.sign"], "clinical_record.sign")
    ).toBe(true);
  });

  it("calcula un hash canónico verificable después de firmar", () => {
    const original = {
      patientId: "patient_1",
      reason: "Control",
      diagnoses: [{ code: "A", display: "Diagnóstico" }],
      recordStatus: "draft",
      updatedAt: 10,
    };
    const signed = {
      diagnoses: [{ display: "Diagnóstico", code: "A" }],
      reason: "Control",
      patientId: "patient_1",
      recordStatus: "signed",
      signedByUid: "doctor_1",
      signedAt: 20,
      updatedAt: 20,
      contentHashSha256: "ignored",
    };
    expect(computeClinicalDocumentHash(original)).toBe(computeClinicalDocumentHash(signed));
  });
});
