import { createHash } from "node:crypto";
import * as functions from "firebase-functions/v1";
import { FieldValue, db } from "./firebaseAdmin";

type ClinicalCapability =
  | "clinical_record.read"
  | "clinical_draft.create"
  | "clinical_draft.edit_own"
  | "clinical_record.sign"
  | "clinical_record.addendum";

interface ClinicalActor {
  uid: string;
  skipAuthorization?: boolean;
}

interface CommandBase {
  centerId: string;
  patientId: string;
  requestId: string;
}

export interface CreateDraftInput extends CommandBase {
  appointmentId?: string;
  consultationType?: "morbidity" | "pscv";
}

export interface UpdateDraftInput extends CommandBase {
  draftId: string;
  patch: Record<string, unknown>;
}

export interface SignDraftInput extends CommandBase {
  draftId: string;
}

export interface AppendAddendumInput extends CommandBase {
  signedDocumentId: string;
  text: string;
}

export interface ClinicalCommandResult {
  success: true;
  idempotent: boolean;
  documentId: string;
}

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

const EDITABLE_DRAFT_FIELDS = new Set([
  "consultationType",
  "reason",
  "anamnesis",
  "physicalExam",
  "diagnosis",
  "diagnoses",
  "prescriptions",
  "prescriptionTypes",
  "hasControlledPrescription",
  "weight",
  "height",
  "bmi",
  "bloodPressure",
  "heartRate",
  "hgt",
  "waist",
  "hip",
  "dentalMap",
  "podogram",
  "exams",
  "examSheets",
  "nextControlDate",
  "nextControlReason",
  "reminderActive",
  "encounterMetadata",
]);

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{16,128}$/;

const cleanRole = (value: unknown) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const clinicalRoleHasCapability = (
  roleValue: unknown,
  explicitCapabilities: unknown,
  capability: ClinicalCapability
) => {
  const role = cleanRole(roleValue);
  const explicit = Array.isArray(explicitCapabilities) ? explicitCapabilities : null;
  if (!CLINICAL_ROLES.has(role)) return false;
  if (explicit !== null) return explicit.includes(capability);
  return !(capability === "clinical_record.sign" && role === "tens");
};

const assertIdentifier = (value: unknown, field: string) => {
  if (!SAFE_ID.test(String(value || ""))) {
    throw new functions.https.HttpsError("invalid-argument", `${field} inválido.`);
  }
};

const assertBase = (input: CommandBase) => {
  assertIdentifier(input.centerId, "centerId");
  assertIdentifier(input.patientId, "patientId");
  if (!SAFE_REQUEST_ID.test(String(input.requestId || ""))) {
    throw new functions.https.HttpsError("invalid-argument", "requestId inválido.");
  }
};

const commandId = (action: string, seed: string) =>
  `${action}_${createHash("sha256").update(seed).digest("hex").slice(0, 32)}`;

const canonicalize = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  const timestamp = value as { toMillis?: () => number };
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)])
  );
};

const SIGNATURE_METADATA_FIELDS = new Set([
  "contentHashSha256",
  "recordStatus",
  "signedAt",
  "signedByUid",
  "updatedAt",
  "updatedBy",
]);

export const computeClinicalDocumentHash = (data: Record<string, unknown>) => {
  const clinicalContent = Object.fromEntries(
    Object.entries(data).filter(([key]) => !SIGNATURE_METADATA_FIELDS.has(key))
  );
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(clinicalContent)))
    .digest("hex");
};

async function authorizeClinicalActor(
  centerId: string,
  actor: ClinicalActor,
  capability: ClinicalCapability
) {
  if (actor.skipAuthorization) return;
  const staff = await db
    .collection("centers")
    .doc(centerId)
    .collection("staff")
    .doc(actor.uid)
    .get();
  const data = staff.data() || {};
  if (
    !staff.exists ||
    (data.active !== true && data.activo !== true) ||
    !clinicalRoleHasCapability(
      data.clinicalRole || data.professionalRole || data.role,
      data.capabilities,
      capability
    )
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No tiene la capacidad clínica requerida en este centro."
    );
  }
}

const patientBelongsToCenter = (patient: Record<string, unknown>, centerId: string) => {
  const accessControl = patient.accessControl as { centerIds?: unknown } | undefined;
  return (
    patient.centerId === centerId ||
    (Array.isArray(accessControl?.centerIds) && accessControl.centerIds.includes(centerId))
  );
};

const actorHasPatientRelationship = (patient: Record<string, unknown>, actorUid: string) => {
  const accessControl = patient.accessControl as { allowedUids?: unknown } | undefined;
  return (
    patient.ownerUid === actorUid ||
    (Array.isArray(accessControl?.allowedUids) && accessControl.allowedUids.includes(actorUid)) ||
    (Array.isArray(patient.careTeamUids) && patient.careTeamUids.includes(actorUid))
  );
};

const refs = (centerId: string, patientId: string, auditId: string) => {
  const patientRef = db.collection("patients").doc(patientId);
  return {
    patientRef,
    consultations: patientRef.collection("consultations"),
    auditRef: db.collection("centers").doc(centerId).collection("auditLogs").doc(auditId),
  };
};

const writeAudit = (
  transaction: FirebaseFirestore.Transaction,
  auditRef: FirebaseFirestore.DocumentReference,
  input: CommandBase,
  actor: ClinicalActor,
  action: string,
  documentId: string
) => {
  transaction.create(auditRef, {
    type: "ACTION",
    centerId: input.centerId,
    patientId: input.patientId,
    actorUid: actor.uid,
    action,
    entityType: "consultation",
    entityId: documentId,
    resourceType: "consultation",
    resourcePath: `/patients/${input.patientId}/consultations/${documentId}`,
    requestId: input.requestId,
    timestamp: FieldValue.serverTimestamp(),
  });
};

export async function createDraftFromAppointmentTransaction(
  input: CreateDraftInput,
  actor: ClinicalActor
): Promise<ClinicalCommandResult> {
  assertBase(input);
  if (input.appointmentId) assertIdentifier(input.appointmentId, "appointmentId");
  if (input.consultationType && !["morbidity", "pscv"].includes(input.consultationType)) {
    throw new functions.https.HttpsError("invalid-argument", "Tipo de consulta inválido.");
  }
  await authorizeClinicalActor(input.centerId, actor, "clinical_draft.create");
  const auditId = commandId("clinical_draft_create", input.requestId);
  const { patientRef, consultations, auditRef } = refs(input.centerId, input.patientId, auditId);
  const draftSeed = input.appointmentId
    ? `${input.centerId}:${input.patientId}:${input.appointmentId}`
    : input.requestId;
  const draftRef = consultations.doc(commandId("draft", draftSeed));
  const appointmentRef = input.appointmentId
    ? db
        .collection("centers")
        .doc(input.centerId)
        .collection("appointments")
        .doc(input.appointmentId)
    : null;

  return db.runTransaction(async (transaction) => {
    const [audit, existingDraft, patient, appointment] = await Promise.all([
      transaction.get(auditRef),
      transaction.get(draftRef),
      transaction.get(patientRef),
      appointmentRef ? transaction.get(appointmentRef) : Promise.resolve(null),
    ]);
    if (audit.exists || existingDraft.exists) {
      const existing = existingDraft.data() || {};
      if (
        existingDraft.exists &&
        existing.centerId === input.centerId &&
        existing.patientId === input.patientId &&
        existing.authorUid === actor.uid
      ) {
        return { success: true, idempotent: true, documentId: draftRef.id };
      }
      throw new functions.https.HttpsError(
        "already-exists",
        "La cita ya posee un documento clínico iniciado."
      );
    }
    const patientData = patient.data() || {};
    if (!patient.exists || !patientBelongsToCenter(patientData, input.centerId)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Paciente fuera del centro activo."
      );
    }
    if (
      appointmentRef &&
      (!appointment?.exists ||
        appointment.data()?.patientId !== input.patientId ||
        appointment.data()?.centerId !== input.centerId)
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "La reserva no está vinculada al paciente y centro indicados."
      );
    }
    const appointmentData = appointment?.data() || {};
    const assignedProfessional = appointmentData.doctorUid || appointmentData.doctorId;
    if (
      !actor.skipAuthorization &&
      !actorHasPatientRelationship(patientData, actor.uid) &&
      (!appointmentRef || assignedProfessional !== actor.uid)
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "El profesional no tiene relación asistencial con este paciente."
      );
    }
    transaction.create(draftRef, {
      id: draftRef.id,
      centerId: input.centerId,
      patientId: input.patientId,
      ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}),
      consultationType: input.consultationType || "morbidity",
      date: new Date().toISOString(),
      recordStatus: "draft",
      authorUid: actor.uid,
      createdBy: actor.uid,
      createdByUid: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      revision: 1,
    });
    writeAudit(transaction, auditRef, input, actor, "CLINICAL_DRAFT_CREATED", draftRef.id);
    return { success: true, idempotent: false, documentId: draftRef.id };
  });
}

export async function updateOwnDraftTransaction(
  input: UpdateDraftInput,
  actor: ClinicalActor
): Promise<ClinicalCommandResult> {
  assertBase(input);
  assertIdentifier(input.draftId, "draftId");
  if (!input.patch || typeof input.patch !== "object" || Array.isArray(input.patch)) {
    throw new functions.https.HttpsError("invalid-argument", "Cambios de borrador inválidos.");
  }
  const entries = Object.entries(input.patch);
  if (!entries.length || entries.some(([key]) => !EDITABLE_DRAFT_FIELDS.has(key))) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "El cambio incluye campos protegidos."
    );
  }
  await authorizeClinicalActor(input.centerId, actor, "clinical_draft.edit_own");
  const auditId = commandId("clinical_draft_update", input.requestId);
  const { consultations, auditRef } = refs(input.centerId, input.patientId, auditId);
  const draftRef = consultations.doc(input.draftId);
  return db.runTransaction(async (transaction) => {
    const [audit, draft] = await Promise.all([
      transaction.get(auditRef),
      transaction.get(draftRef),
    ]);
    if (audit.exists) return { success: true, idempotent: true, documentId: input.draftId };
    const current = draft.data() || {};
    if (
      !draft.exists ||
      current.centerId !== input.centerId ||
      current.patientId !== input.patientId
    ) {
      throw new functions.https.HttpsError("not-found", "Borrador no encontrado.");
    }
    if (current.recordStatus !== "draft" || current.authorUid !== actor.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Solo el autor puede editar su borrador."
      );
    }
    transaction.update(draftRef, {
      ...Object.fromEntries(entries),
      revision: Number(current.revision || 1) + 1,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    });
    writeAudit(transaction, auditRef, input, actor, "CLINICAL_DRAFT_UPDATED", input.draftId);
    return { success: true, idempotent: false, documentId: input.draftId };
  });
}

export async function signDraftTransaction(
  input: SignDraftInput,
  actor: ClinicalActor
): Promise<ClinicalCommandResult> {
  assertBase(input);
  assertIdentifier(input.draftId, "draftId");
  await authorizeClinicalActor(input.centerId, actor, "clinical_record.sign");
  const auditId = commandId("clinical_draft_sign", input.requestId);
  const { consultations, auditRef } = refs(input.centerId, input.patientId, auditId);
  const draftRef = consultations.doc(input.draftId);
  return db.runTransaction(async (transaction) => {
    const [audit, draft] = await Promise.all([
      transaction.get(auditRef),
      transaction.get(draftRef),
    ]);
    if (audit.exists) return { success: true, idempotent: true, documentId: input.draftId };
    const current = draft.data() || {};
    if (
      !draft.exists ||
      current.centerId !== input.centerId ||
      current.patientId !== input.patientId
    ) {
      throw new functions.https.HttpsError("not-found", "Borrador no encontrado.");
    }
    if (current.recordStatus !== "draft" || current.authorUid !== actor.uid) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "El documento no es un borrador firmable."
      );
    }
    transaction.update(draftRef, {
      recordStatus: "signed",
      signedByUid: actor.uid,
      signedAt: FieldValue.serverTimestamp(),
      contentHashSha256: computeClinicalDocumentHash(current),
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAudit(transaction, auditRef, input, actor, "CLINICAL_RECORD_SIGNED", input.draftId);
    return { success: true, idempotent: false, documentId: input.draftId };
  });
}

export async function appendAddendumTransaction(
  input: AppendAddendumInput,
  actor: ClinicalActor
): Promise<ClinicalCommandResult> {
  assertBase(input);
  assertIdentifier(input.signedDocumentId, "signedDocumentId");
  const text = String(input.text || "").trim();
  if (!text || text.length > 10000) {
    throw new functions.https.HttpsError("invalid-argument", "Adenda inválida.");
  }
  await authorizeClinicalActor(input.centerId, actor, "clinical_record.addendum");
  const auditId = commandId("clinical_addendum", input.requestId);
  const { patientRef, consultations, auditRef } = refs(input.centerId, input.patientId, auditId);
  const signedRef = consultations.doc(input.signedDocumentId);
  const addendumRef = consultations.doc(commandId("addendum", input.requestId));
  return db.runTransaction(async (transaction) => {
    const [audit, signed, patient] = await Promise.all([
      transaction.get(auditRef),
      transaction.get(signedRef),
      transaction.get(patientRef),
    ]);
    if (audit.exists) return { success: true, idempotent: true, documentId: addendumRef.id };
    const original = signed.data() || {};
    const patientData = patient.data() || {};
    if (
      !signed.exists ||
      original.centerId !== input.centerId ||
      original.patientId !== input.patientId ||
      original.recordStatus !== "signed"
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "La adenda requiere un documento firmado."
      );
    }
    if (
      !actor.skipAuthorization &&
      original.authorUid !== actor.uid &&
      !actorHasPatientRelationship(patientData, actor.uid)
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "El profesional no tiene relación asistencial vigente con este paciente."
      );
    }
    const addendumContent = {
      id: addendumRef.id,
      centerId: input.centerId,
      patientId: input.patientId,
      date: new Date().toISOString(),
      documentType: "addendum",
      addendumOf: input.signedDocumentId,
      text,
      authorUid: actor.uid,
      createdBy: actor.uid,
      revision: 1,
    };
    transaction.create(addendumRef, {
      ...addendumContent,
      recordStatus: "signed",
      signedByUid: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      signedAt: FieldValue.serverTimestamp(),
      contentHashSha256: computeClinicalDocumentHash(addendumContent),
    });
    writeAudit(transaction, auditRef, input, actor, "CLINICAL_ADDENDUM_APPENDED", addendumRef.id);
    return { success: true, idempotent: false, documentId: addendumRef.id };
  });
}

const actorFromContext = (context: functions.https.CallableContext): ClinicalActor => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión.");
  }
  return { uid: context.auth.uid };
};

export const createDraftFromAppointment = functions.https.onCall((data, context) =>
  createDraftFromAppointmentTransaction(data as CreateDraftInput, actorFromContext(context))
);
export const updateOwnDraft = functions.https.onCall((data, context) =>
  updateOwnDraftTransaction(data as UpdateDraftInput, actorFromContext(context))
);
export const signDraft = functions.https.onCall((data, context) =>
  signDraftTransaction(data as SignDraftInput, actorFromContext(context))
);
export const appendAddendum = functions.https.onCall((data, context) =>
  appendAddendumTransaction(data as AppendAddendumInput, actorFromContext(context))
);
