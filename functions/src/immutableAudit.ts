import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

type AuditAction = "CREATE" | "UPDATE" | "ARCHIVE" | "DELETE";
type AuditEntity = "patient" | "consultation";

function asArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function resolvePatientCenterIds(before: any, after: any): string[] {
  const candidates = [
    after?.centerId,
    before?.centerId,
    ...asArray(after?.accessControl?.centerIds),
    ...asArray(before?.accessControl?.centerIds),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

function resolveConsultationCenterIds(before: any, after: any): string[] {
  const candidates = [after?.centerId, before?.centerId]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

function resolveAction(beforeExists: boolean, afterExists: boolean, before: any, after: any): AuditAction {
  if (!afterExists) return "DELETE";
  if (!beforeExists) return "CREATE";
  if (before?.active !== false && after?.active === false) return "ARCHIVE";
  return "UPDATE";
}

function changedFieldNames(before: any, after: any): string[] {
  const ignored = new Set(["updatedAt", "lastUpdated", "lastUpdatedByUid", "lastUpdatedByName"]);
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changed: string[] = [];

  for (const key of allKeys) {
    if (ignored.has(key)) continue;
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
      changed.push(key);
    }
  }

  return changed.sort();
}

function resolveActor(before: any, after: any) {
  return {
    actorUid:
      after?.lastUpdatedByUid ||
      after?.updatedBy ||
      after?.createdByUid ||
      before?.lastUpdatedByUid ||
      before?.updatedBy ||
      before?.createdByUid ||
      "system_trigger",
    actorName:
      after?.lastUpdatedByName ||
      after?.professionalName ||
      before?.lastUpdatedByName ||
      before?.professionalName ||
      "Trigger Automatico",
    actorRole:
      after?.professionalRole ||
      before?.professionalRole ||
      after?.lastUpdatedByRole ||
      before?.lastUpdatedByRole ||
      "unknown",
  };
}

async function logAudit(params: {
  centerId: string;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  patientId?: string;
  resourcePath: string;
  before: any;
  after: any;
}) {
  const actor = resolveActor(params.before, params.after);
  const auditLogRef = db.collection("centers").doc(params.centerId).collection("auditLogs").doc();

  await auditLogRef.set({
    type: "ACTION",
    action: `${params.entityType.toUpperCase()}_${params.action}`,
    entityType: params.entityType,
    entityId: params.entityId,
    patientId: params.patientId,
    actorUid: actor.actorUid,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    resourceType: params.entityType,
    resourcePath: params.resourcePath,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      source: "cloud_function_trigger",
      immutable: true,
      changedFields: params.action === "UPDATE" || params.action === "ARCHIVE"
        ? changedFieldNames(params.before, params.after)
        : null,
    },
  });
}

export const onPatientWriteAudit = functions.firestore.onDocumentWritten(
  "patients/{patientId}",
  async (event) => {
    const patientId = String(event.params.patientId);
    const beforeExists = event.data?.before.exists ?? false;
    const afterExists = event.data?.after.exists ?? false;
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};
    const action = resolveAction(beforeExists, afterExists, before, after);
    const centerIds = resolvePatientCenterIds(before, after);

    await Promise.all(
      centerIds.map((centerId) =>
        logAudit({
          centerId,
          action,
          entityType: "patient",
          entityId: patientId,
          patientId,
          resourcePath: `patients/${patientId}`,
          before,
          after,
        })
      )
    );
  }
);

export const onConsultationWriteAudit = functions.firestore.onDocumentWritten(
  "patients/{patientId}/consultations/{consultationId}",
  async (event) => {
    const patientId = String(event.params.patientId);
    const consultationId = String(event.params.consultationId);
    const beforeExists = event.data?.before.exists ?? false;
    const afterExists = event.data?.after.exists ?? false;
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};
    const action = resolveAction(beforeExists, afterExists, before, after);
    const centerIds = resolveConsultationCenterIds(before, after);

    await Promise.all(
      centerIds.map((centerId) =>
        logAudit({
          centerId,
          action,
          entityType: "consultation",
          entityId: consultationId,
          patientId,
          resourcePath: `patients/${patientId}/consultations/${consultationId}`,
          before,
          after,
        })
      )
    );
  }
);
