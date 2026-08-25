process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "clavesalud-2";

import { db } from "../firebaseAdmin";
import {
  appendAddendumTransaction,
  computeClinicalDocumentHash,
  createDraftFromAppointmentTransaction,
  signDraftTransaction,
  updateOwnDraftTransaction,
} from "../clinicalDraftCommands";

const integration = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

integration("documentos clínicos transaccionales (Firestore Emulator)", () => {
  jest.setTimeout(20000);
  const actor = { uid: "doctor-r2", skipAuthorization: true };
  const authenticatedActor = { uid: "doctor-r2" };
  let centerId: string;
  let patientId: string;
  let appointmentId: string;

  beforeEach(async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    centerId = `center_r2_${suffix}`;
    patientId = `patient_r2_${suffix}`;
    appointmentId = `appointment_r2_${suffix}`;
    await Promise.all([
      db
        .collection("patients")
        .doc(patientId)
        .set({
          centerId,
          fullName: "Paciente Sintético R2",
          accessControl: { centerIds: [centerId], allowedUids: [actor.uid] },
        }),
      db.collection("centers").doc(centerId).collection("appointments").doc(appointmentId).set({
        centerId,
        patientId,
        doctorId: actor.uid,
        status: "booked",
      }),
      db
        .collection("centers")
        .doc(centerId)
        .collection("staff")
        .doc(actor.uid)
        .set({
          active: true,
          clinicalRole: "MEDICO",
          fullName: "Profesional Sintético",
          rut: "11.111.111-1",
          capabilities: [
            "clinical_draft.create",
            "clinical_draft.edit_own",
            "clinical_record.sign",
            "clinical_record.addendum",
          ],
        }),
    ]);
  });

  afterEach(async () => {
    const consultations = await db
      .collection("patients")
      .doc(patientId)
      .collection("consultations")
      .get();
    const audits = await db.collection("centers").doc(centerId).collection("auditLogs").get();
    await Promise.all([
      ...consultations.docs.map((document) => document.ref.delete()),
      ...audits.docs.map((document) => document.ref.delete()),
      db.collection("patients").doc(patientId).delete(),
      db.collection("centers").doc(centerId).collection("appointments").doc(appointmentId).delete(),
      db.collection("centers").doc(centerId).collection("staff").doc(actor.uid).delete(),
    ]);
  });

  it("toma la identidad profesional del perfil autorizado del servidor", async () => {
    const created = await createDraftFromAppointmentTransaction(
      { centerId, patientId, appointmentId, requestId: "authorized-draft-request-0001" },
      authenticatedActor
    );
    const saved = await db
      .collection("patients")
      .doc(patientId)
      .collection("consultations")
      .doc(created.documentId)
      .get();
    expect(saved.data()).toMatchObject({
      professionalId: actor.uid,
      professionalName: "Profesional Sintético",
      professionalRole: "MEDICO",
      professionalRut: "11.111.111-1",
    });
  });

  it("crea un único borrador por cita incluso con otra clave de solicitud", async () => {
    const first = await createDraftFromAppointmentTransaction(
      { centerId, patientId, appointmentId, requestId: "create-draft-request-0001" },
      actor
    );
    const retry = await createDraftFromAppointmentTransaction(
      { centerId, patientId, appointmentId, requestId: "create-draft-request-0002" },
      actor
    );
    expect(first).toMatchObject({ success: true, idempotent: false });
    expect(retry).toMatchObject({ success: true, idempotent: true, documentId: first.documentId });
    const saved = await db.collection("patients").doc(patientId).collection("consultations").get();
    expect(saved.size).toBe(1);
    expect(saved.docs[0].data()).toMatchObject({
      appointmentId,
      authorUid: actor.uid,
      recordStatus: "draft",
      revision: 1,
    });
  });

  it("permite atención espontánea y hace inmutable el documento firmado", async () => {
    const created = await createDraftFromAppointmentTransaction(
      { centerId, patientId, requestId: "spontaneous-draft-0001" },
      actor
    );
    await updateOwnDraftTransaction(
      {
        centerId,
        patientId,
        draftId: created.documentId,
        requestId: "update-draft-request-0001",
        patch: { reason: "Control sintético", anamnesis: "Sin datos reales" },
      },
      actor
    );
    await signDraftTransaction(
      { centerId, patientId, draftId: created.documentId, requestId: "sign-draft-request-0001" },
      actor
    );
    await expect(
      updateOwnDraftTransaction(
        {
          centerId,
          patientId,
          draftId: created.documentId,
          requestId: "update-signed-request-0001",
          patch: { reason: "Intento posterior" },
        },
        actor
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
    const signed = await db
      .collection("patients")
      .doc(patientId)
      .collection("consultations")
      .doc(created.documentId)
      .get();
    expect(signed.data()).toMatchObject({
      recordStatus: "signed",
      signedByUid: actor.uid,
      reason: "Control sintético",
    });
    expect(signed.data()?.contentHashSha256).toBe(
      computeClinicalDocumentHash(signed.data() as Record<string, unknown>)
    );
  });

  it("crea una adenda separada sin alterar un byte lógico del original", async () => {
    const created = await createDraftFromAppointmentTransaction(
      { centerId, patientId, requestId: "addendum-source-0001" },
      actor
    );
    await signDraftTransaction(
      { centerId, patientId, draftId: created.documentId, requestId: "addendum-sign-0001" },
      actor
    );
    const originalRef = db
      .collection("patients")
      .doc(patientId)
      .collection("consultations")
      .doc(created.documentId);
    const before = (await originalRef.get()).data();
    const addendum = await appendAddendumTransaction(
      {
        centerId,
        patientId,
        signedDocumentId: created.documentId,
        requestId: "append-addendum-0001",
        text: "Aclaración clínica sintética.",
      },
      actor
    );
    const originalAfter = (await originalRef.get()).data();
    const savedAddendum = await db
      .collection("patients")
      .doc(patientId)
      .collection("consultations")
      .doc(addendum.documentId)
      .get();
    expect(originalAfter).toEqual(before);
    expect(savedAddendum.data()).toMatchObject({
      recordStatus: "signed",
      documentType: "addendum",
      addendumOf: created.documentId,
      signedByUid: actor.uid,
    });
  });
});
