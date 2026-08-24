import * as admin from "firebase-admin";
import { executePatientDemographicsUpsert, sanitizePatientDemographics } from "../patientDirectory";

const emulatorDescribe = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

emulatorDescribe("patient directory Firestore integration", () => {
  const projectId = "clavesalud-patient-directory-test";
  const app = admin.apps.find((candidate) => candidate?.name === "patient-directory-test")
    ? admin.app("patient-directory-test")
    : admin.initializeApp({ projectId }, "patient-directory-test");
  const firestore = app.firestore();

  it("updates demographics atomically without replacing clinical content", async () => {
    const centerId = "center-a";
    const patientId = `patient-${Date.now()}`;
    await firestore
      .collection("patients")
      .doc(patientId)
      .set({
        id: patientId,
        centerId,
        accessControl: { centerIds: [centerId], allowedUids: ["doctor-a"] },
        fullName: "Nombre anterior",
        rut: "12.345.678-9",
        diagnosis: "Contenido clínico que debe permanecer",
        medicalHistory: ["Antecedente que debe permanecer"],
        consultations: [{ id: "consult-a", evolution: "Evolución privada" }],
      });

    const result = await executePatientDemographicsUpsert({
      firestore,
      centerId,
      patientId,
      actorUid: "admin-a",
      demographics: sanitizePatientDemographics({
        fullName: "Nombre actualizado",
        rut: "12.345.678-9",
        phone: "+56912345678",
        diagnosis: "Intento de reemplazo",
        consultations: [],
      }),
    });

    expect(result).toMatchObject({ ok: true, patientId, created: false });
    const patient = (await firestore.collection("patients").doc(patientId).get()).data();
    expect(patient).toMatchObject({
      fullName: "Nombre actualizado",
      phone: "+56912345678",
      diagnosis: "Contenido clínico que debe permanecer",
      medicalHistory: ["Antecedente que debe permanecer"],
      consultations: [{ id: "consult-a", evolution: "Evolución privada" }],
    });
    expect(JSON.stringify(patient)).not.toContain("Intento de reemplazo");

    const audit = await firestore
      .collection("centers")
      .doc(centerId)
      .collection("auditLogs")
      .where("patientId", "==", patientId)
      .get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].data()).toMatchObject({
      action: "PATIENT_DEMOGRAPHICS_UPDATE",
      containsClinicalContent: false,
    });
  });
});
