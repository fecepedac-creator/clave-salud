process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "clavesalud-2";

import { db } from "../firebaseAdmin";
import {
  appendClinicalCorrectionTransaction,
  listClinicalCorrections,
} from "../clinicalCorrections";

const integration = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

integration("correcciones clínicas inmutables (Firestore Emulator)", () => {
  jest.setTimeout(20000);
  const actor = { uid: "doctor-correction" };
  let centerId: string;
  let patientId: string;
  let consultationId: string;

  beforeEach(async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    centerId = `center_correction_${suffix}`;
    patientId = `patient_correction_${suffix}`;
    consultationId = `consultation_correction_${suffix}`;
    await Promise.all([
      db.collection("centers").doc(centerId).collection("staff").doc(actor.uid).set({
        active: true,
        clinicalRole: "MEDICO",
        capabilities: ["clinical_record.addendum"],
        fullName: "Profesional Sintético",
      }),
      db.collection("patients").doc(patientId).set({
        centerId,
        accessControl: { centerIds: [centerId], allowedUids: [actor.uid] },
        consultations: [
          {
            id: consultationId,
            professionalId: actor.uid,
            reason: "Atención original",
            prescriptions: [{ id: "doc_1", type: "Receta Médica", content: "Original" }],
          },
        ],
      }),
    ]);
  });

  afterEach(async () => {
    const patient = db.collection("patients").doc(patientId);
    const [corrections, audits] = await Promise.all([
      patient.collection("consultationCorrections").get(),
      db.collection("centers").doc(centerId).collection("auditLogs").get(),
    ]);
    await Promise.all([
      ...corrections.docs.map((document) => document.ref.delete()),
      ...audits.docs.map((document) => document.ref.delete()),
      patient.delete(),
      db.collection("centers").doc(centerId).collection("staff").doc(actor.uid).delete(),
    ]);
  });

  it("agrega una corrección auditada sin alterar la atención legacy original", async () => {
    const result = await appendClinicalCorrectionTransaction(
      {
        centerId,
        patientId,
        consultationId,
        documentId: "doc_1",
        requestId: "append-correction-request-0001",
        kind: "document_correction",
        text: "Se actualiza la indicación posterior a la atención.",
      },
      actor
    );
    expect(result).toMatchObject({ success: true, idempotent: false });
    const patient = await db.collection("patients").doc(patientId).get();
    expect(patient.data()?.consultations).toEqual([
      expect.objectContaining({ id: consultationId, reason: "Atención original" }),
    ]);
    const listed = await listClinicalCorrections({ centerId, patientId, consultationId }, actor);
    expect(listed.corrections).toHaveLength(1);
    expect(listed.corrections[0]).toMatchObject({ documentId: "doc_1", kind: "document_correction" });
    const audits = await db.collection("centers").doc(centerId).collection("auditLogs").get();
    expect(audits.docs.map((document) => document.data().action)).toContain(
      "CLINICAL_CORRECTION_APPENDED"
    );
  });

  it("deniega la corrección de una atención escrita por otro profesional", async () => {
    await expect(
      appendClinicalCorrectionTransaction(
        {
          centerId,
          patientId,
          consultationId,
          requestId: "append-correction-request-0002",
          kind: "clinical_note",
          text: "Intento no autorizado.",
        },
        { uid: "other-clinician" }
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
