import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { createHash } from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}

type AuditActorContext = {
  uid?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

type BuildAuditLogEntryInput = {
  centerId?: string | null;
  type: "ACCESS" | "ACTION";
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  actorUid: string;
  actorEmail?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  resourceType?: string | null;
  resourcePath: string;
  patientId?: string | null;
  details?: string | null;
  metadata?: Record<string, any> | null;
  ip?: string | null;
  userAgent?: string | null;
};

type AuditChainState = {
  lastHash?: string;
  lastIndex?: number;
};

function getDb() {
  return admin.firestore();
}

export function resolveActiveFlag(data: Record<string, any> | undefined | null): boolean {
  if (!data) return true;
  if (typeof data.active === "boolean") return data.active;
  if (typeof data.activo === "boolean") return data.activo;
  if (typeof data.isActive === "boolean") return data.isActive;
  return true;
}

export function canonicalizeActiveFields(data: Record<string, any> | undefined | null) {
  const active = resolveActiveFlag(data);
  return { active, activo: active };
}

export function buildAuditLogEntry(input: BuildAuditLogEntryInput) {
  const entry: Record<string, any> = {
    type: input.type,
    action: input.action,
    actorUid: input.actorUid,
    actorEmail: input.actorEmail || "",
    actorRole: input.actorRole || "unknown",
    resourceType: input.resourceType || input.entityType || "patient",
    resourcePath: input.resourcePath,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (input.centerId) entry.centerId = input.centerId;
  if (input.entityType) entry.entityType = input.entityType;
  if (input.entityId) entry.entityId = input.entityId;
  if (input.actorName) entry.actorName = input.actorName;
  if (input.patientId) entry.patientId = input.patientId;
  if (input.details) entry.details = input.details;
  if (input.metadata) entry.metadata = input.metadata;
  if (input.ip) entry.ip = input.ip;
  if (input.userAgent) entry.userAgent = input.userAgent;

  return entry;
}

export function getAuditChainStateRef(centerId?: string | null) {
  const db = getDb();
  if (centerId) {
    return db.collection("centers").doc(centerId).collection("_system").doc("auditChain");
  }
  return db.collection("_system").doc("globalAuditChain");
}

export function createAuditLogRef(centerId?: string | null) {
  const db = getDb();
  if (centerId) {
    return db.collection("centers").doc(centerId).collection("auditLogs").doc();
  }
  return db.collection("auditLogs").doc();
}

export function serializeAuditChainPayload(args: {
  logId: string;
  chainScope: string;
  chainIndex: number;
  prevHash: string;
  signedAt: string;
  entry: Record<string, any>;
}) {
  return JSON.stringify({
    version: 1,
    logId: args.logId,
    chainScope: args.chainScope,
    chainIndex: args.chainIndex,
    prevHash: args.prevHash,
    signedAt: args.signedAt,
    entry: args.entry,
  });
}

export function computeAuditChainHash(serializedPayload: string) {
  return createHash("sha256").update(serializedPayload).digest("hex");
}

export async function appendAuditLogInTransaction(
  transaction: admin.firestore.Transaction,
  input: BuildAuditLogEntryInput,
  ref = createAuditLogRef(input.centerId)
) {
  const entry = buildAuditLogEntry(input);
  const chainScope = input.centerId ? `center:${input.centerId}` : "global";
  const chainStateRef = getAuditChainStateRef(input.centerId);
  const chainStateSnap = await transaction.get(chainStateRef);
  const chainState = (chainStateSnap.data() || {}) as AuditChainState;
  const prevHash = String(chainState.lastHash || "");
  const chainIndex = Number(chainState.lastIndex || 0) + 1;
  const signedAt = new Date().toISOString();
  const canonicalEntry = {
    ...entry,
    timestamp: signedAt,
  };
  const serializedPayload = serializeAuditChainPayload({
    logId: ref.id,
    chainScope,
    chainIndex,
    prevHash,
    signedAt,
    entry: canonicalEntry,
  });
  const chainHash = computeAuditChainHash(serializedPayload);

  transaction.set(ref, {
    id: ref.id,
    ...entry,
    chainScope,
    chainIndex,
    chainPrevHash: prevHash || null,
    chainHash,
    signedAt,
  });
  transaction.set(
    chainStateRef,
    {
      chainScope,
      lastHash: chainHash,
      lastIndex: chainIndex,
      lastLogId: ref.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { id: ref.id, chainHash, chainIndex };
}

export async function writeAuditLog(input: BuildAuditLogEntryInput) {
  const ref = createAuditLogRef(input.centerId);
  await getDb().runTransaction(async (transaction) => {
    await appendAuditLogInTransaction(transaction, input, ref);
  });
  return ref.id;
}

export function buildActorFromContext(
  context: { auth?: { uid?: string; token?: Record<string, any> | null } | null },
  fallback: AuditActorContext = {}
) {
  const token = context.auth?.token || {};
  return {
    actorUid: context.auth?.uid || fallback.uid || "system",
    actorEmail:
      String(token.email || token.email_lower || fallback.email || "").trim().toLowerCase() || "",
    actorName: String(token.name || fallback.name || "").trim() || undefined,
    actorRole: String(token.role || fallback.role || "").trim() || undefined,
  };
}

function getDifference(obj1: any, obj2: any) {
  const diff: any = {};
  const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

  for (const key of allKeys) {
    if (key === "updatedAt" || key === "lastUpdatedByUid" || key === "lastUpdatedByName") continue;
    if (JSON.stringify(obj1?.[key]) !== JSON.stringify(obj2?.[key])) {
      diff[key] = {
        from: obj1?.[key] === undefined ? null : obj1[key],
        to: obj2?.[key] === undefined ? null : obj2[key],
      };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

export const onPatientWriteAudit = functions.firestore.onDocumentWritten(
  "centers/{centerId}/patients/{patientId}",
  async (event) => {
    const { centerId, patientId } = event.params;
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};

    if (!event.data?.after.exists) {
      await writeAuditLog({
        centerId,
        type: "ACTION",
        action: "DELETE",
        entityType: "patient",
        entityId: patientId,
        resourceType: "patient",
        resourcePath: `/centers/${centerId}/patients/${patientId}`,
        actorUid: after?.lastUpdatedByUid || before?.lastUpdatedByUid || "system_trigger",
        actorEmail: "",
        actorName: after?.lastUpdatedByName || before?.lastUpdatedByName || "Trigger Automático",
        actorRole: "system",
        metadata: { source: "cloud_function_trigger" },
      });
      return;
    }

    if (!event.data?.before.exists) {
      await writeAuditLog({
        centerId,
        type: "ACTION",
        action: "CREATE",
        entityType: "patient",
        entityId: patientId,
        resourceType: "patient",
        resourcePath: `/centers/${centerId}/patients/${patientId}`,
        actorUid: after?.lastUpdatedByUid || "system_trigger",
        actorEmail: "",
        actorName: after?.lastUpdatedByName || "Trigger Automático",
        actorRole: "system",
        metadata: { source: "cloud_function_trigger" },
      });
      return;
    }

    await writeAuditLog({
      centerId,
      type: "ACTION",
      action: "UPDATE",
      entityType: "patient",
      entityId: patientId,
      resourceType: "patient",
      resourcePath: `/centers/${centerId}/patients/${patientId}`,
      actorUid: after?.lastUpdatedByUid || before?.lastUpdatedByUid || "system_trigger",
      actorEmail: "",
      actorName: after?.lastUpdatedByName || before?.lastUpdatedByName || "Trigger Automático",
      actorRole: "system",
      metadata: {
        source: "cloud_function_trigger",
        changes: getDifference(before, after),
      },
    });
  }
);
