import { createHash } from "node:crypto";
import * as functions from "firebase-functions/v1";
import { FieldValue, db } from "./firebaseAdmin";

type CorrectionKind = "clinical_note" | "new_information" | "document_correction";

interface CorrectionInput {
  centerId: string;
  patientId: string;
  consultationId: string;
  requestId: string;
  kind: CorrectionKind;
  text: string;
  documentId?: string;
}

interface CorrectionActor {
  uid: string;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{16,128}$/;
const CLINICAL_ROLES = new Set([
  "medico",
  "doctor",
  "enfermera",
  "tens",
  "nutricionista",
  "psicologo",
  "kinesiologo",
  "terapeuta_ocupacional",
  "fonoaudiologo",
  "podologo",
  "tecnologo_medico",
  "asistente_social",
  "preparador_fisico",
  "matrona",
  "odontologo",
  "quimico_farmaceutico",
  "professional",
  "profesional",
]);

const normalizeRole = (value: unknown) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const assertId = (value: unknown, field: string) => {
  if (!SAFE_ID.test(String(value || ""))) {
    throw new functions.https.HttpsError("invalid-argument", `${field} inválido.`);
  }
};

const correctionId = (seed: string) =>
  `correction_${createHash("sha256").update(seed).digest("hex").slice(0, 32)}`;

const isActive = (staff: Record<string, unknown>) => staff.active === true || staff.activo === true;

const hasCorrectionCapability = (staff: Record<string, unknown>) => {
  const role = normalizeRole(staff.clinicalRole || staff.professionalRole || staff.role);
  if (!CLINICAL_ROLES.has(role)) return false;
  const capabilities = Array.isArray(staff.capabilities) ? staff.capabilities : null;
  return capabilities === null || capabilities.includes("clinical_record.addendum");
};

const patientBelongsToCenter = (patient: Record<string, unknown>, centerId: string) => {
  const accessControl = patient.accessControl as { centerIds?: unknown; allowedUids?: unknown } | undefined;
  return (
    patient.centerId === centerId ||
    (Array.isArray(accessControl?.centerIds) && accessControl.centerIds.includes(centerId))
  );
};

const actorCanAccessPatient = (patient: Record<string, unknown>, actorUid: string) => {
  const accessControl = patient.accessControl as { allowedUids?: unknown; centerIds?: unknown } | undefined;
  return (
    patient.ownerUid === actorUid ||
    (Array.isArray(accessControl?.allowedUids) && accessControl.allowedUids.includes(actorUid)) ||
    (Array.isArray(patient.careTeamUids) && patient.careTeamUids.includes(actorUid))
  );
};

const originalAuthorUid = (consultation: Record<string, unknown>) =>
  String(consultation.authorUid || consultation.createdByUid || consultation.professionalId || "");

const assertBaseInput = (input: CorrectionInput) => {
  assertId(input.centerId, "centerId");
  assertId(input.patientId, "patientId");
  assertId(input.consultationId, "consultationId");
  if (!SAFE_REQUEST_ID.test(String(input.requestId || ""))) {
    throw new functions.https.HttpsError("invalid-argument", "requestId inválido.");
  }
  if (!(["clinical_note", "new_information", "document_correction"] as string[]).includes(input.kind)) {
    throw new functions.https.HttpsError("invalid-argument", "Tipo de corrección inválido.");
  }
  const text = String(input.text || "").trim();
  if (!text || text.length > 10000) {
    throw new functions.https.HttpsError("invalid-argument", "La corrección debe tener entre 1 y 10.000 caracteres.");
  }
  if (input.documentId) assertId(input.documentId, "documentId");
};

async function authorize(input: Pick<CorrectionInput, "centerId" | "patientId">, actor: CorrectionActor) {
  const [staff, patient] = await Promise.all([
    db.collection("centers").doc(input.centerId).collection("staff").doc(actor.uid).get(),
    db.collection("patients").doc(input.patientId).get(),
  ]);
  const staffData = (staff.data() || {}) as Record<string, unknown>;
  const patientData = (patient.data() || {}) as Record<string, unknown>;
  if (!staff.exists || !isActive(staffData) || !hasCorrectionCapability(staffData)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene autorización clínica para agregar correcciones.");
  }
  if (!patient.exists || !patientBelongsToCenter(patientData, input.centerId) || !actorCanAccessPatient(patientData, actor.uid)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene acceso a esta ficha clínica.");
  }
  return { staffData, patientData };
}

export async function appendClinicalCorrectionTransaction(input: CorrectionInput, actor: CorrectionActor) {
  assertBaseInput(input);
  const { staffData } = await authorize(input, actor);
  const patientRef = db.collection("patients").doc(input.patientId);
  const correctionRef = patientRef
    .collection("consultationCorrections")
    .doc(correctionId(`${input.centerId}:${input.patientId}:${input.consultationId}:${input.requestId}`));
  const originalRef = patientRef.collection("consultations").doc(input.consultationId);
  const auditRef = db
    .collection("centers")
    .doc(input.centerId)
    .collection("auditLogs")
    .doc(correctionId(`audit:${input.centerId}:${input.patientId}:${input.consultationId}:${input.requestId}`));

  return db.runTransaction(async (transaction) => {
    const [patient, original, existingCorrection, audit] = await Promise.all([
      transaction.get(patientRef),
      transaction.get(originalRef),
      transaction.get(correctionRef),
      transaction.get(auditRef),
    ]);
    if (existingCorrection.exists || audit.exists) {
      return {
        success: true,
        idempotent: true,
        correction: { id: correctionRef.id, ...(existingCorrection.data() || {}) },
      };
    }
    const patientData = (patient.data() || {}) as Record<string, unknown>;
    const embedded = Array.isArray(patientData.consultations)
      ? (patientData.consultations as Record<string, unknown>[]).find((item) => item?.id === input.consultationId)
      : undefined;
    const originalData = (original.data() || embedded || {}) as Record<string, unknown>;
    if ((!original.exists && !embedded) || originalAuthorUid(originalData) !== actor.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Solo el profesional autor puede corregir esta atención."
      );
    }
    if (input.documentId) {
      const docs = Array.isArray(originalData.prescriptions) ? originalData.prescriptions : [];
      if (!docs.some((doc: Record<string, unknown>) => doc?.id === input.documentId)) {
        throw new functions.https.HttpsError("not-found", "El documento emitido no pertenece a esta atención.");
      }
    }
    const correction = {
      id: correctionRef.id,
      centerId: input.centerId,
      patientId: input.patientId,
      consultationId: input.consultationId,
      ...(input.documentId ? { documentId: input.documentId } : {}),
      kind: input.kind,
      text: String(input.text).trim(),
      authorUid: actor.uid,
      professionalName: String(staffData.fullName || staffData.name || ""),
      professionalRole: String(staffData.clinicalRole || staffData.professionalRole || staffData.role || ""),
      createdAt: FieldValue.serverTimestamp(),
    };
    transaction.create(correctionRef, correction);
    transaction.create(auditRef, {
      type: "ACTION",
      action: "CLINICAL_CORRECTION_APPENDED",
      entityType: "consultation_correction",
      entityId: correctionRef.id,
      centerId: input.centerId,
      patientId: input.patientId,
      actorUid: actor.uid,
      resourceType: "consultation",
      resourcePath: `/patients/${input.patientId}/consultations/${input.consultationId}`,
      timestamp: FieldValue.serverTimestamp(),
      metadata: { kind: input.kind, documentId: input.documentId || null },
    });
    return { success: true, idempotent: false, correction: { ...correction, createdAt: new Date().toISOString() } };
  });
}

export async function listClinicalCorrections(input: Pick<CorrectionInput, "centerId" | "patientId" | "consultationId">, actor: CorrectionActor) {
  assertId(input.centerId, "centerId");
  assertId(input.patientId, "patientId");
  assertId(input.consultationId, "consultationId");
  await authorize(input, actor);
  const snapshot = await db
    .collection("patients")
    .doc(input.patientId)
    .collection("consultationCorrections")
    .where("consultationId", "==", input.consultationId)
    .limit(50)
    .get();
  return {
    corrections: snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((left: any, right: any) => String(left.createdAt || "").localeCompare(String(right.createdAt || ""))),
  };
}

const actorFromContext = (context: functions.https.CallableContext): CorrectionActor => {
  if (!context.auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión.");
  return { uid: context.auth.uid };
};

export const appendClinicalCorrection = functions.https.onCall((data, context) =>
  appendClinicalCorrectionTransaction(data as CorrectionInput, actorFromContext(context))
);

export const getClinicalCorrections = functions.https.onCall((data, context) =>
  listClinicalCorrections(data as Pick<CorrectionInput, "centerId" | "patientId" | "consultationId">, actorFromContext(context))
);
