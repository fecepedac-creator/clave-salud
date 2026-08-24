import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { requireAgendaOperationsV2 } from "./agendaOperationsFeature";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export type AgendaConflictMode = "block" | "require_override";

export interface AgendaPolicyData {
  centerId: string;
  locationId: string;
  slotDurationMinutes: number;
  requirePatientContact: boolean;
  allowPublicCancellation: boolean;
  cancellationWindowHours: number;
  allowInternalOutsideHours: boolean;
  appointmentConflictMode: AgendaConflictMode;
  resourceConflictMode: AgendaConflictMode;
  revision: number;
}

export const defaultAgendaPolicy = (centerId: string, locationId: string): AgendaPolicyData => ({
  centerId,
  locationId,
  slotDurationMinutes: 30,
  requirePatientContact: true,
  allowPublicCancellation: true,
  cancellationWindowHours: 24,
  allowInternalOutsideHours: false,
  appointmentConflictMode: "block",
  resourceConflictMode: "block",
  revision: 1,
});

const integer = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

export const sanitizeAgendaPolicy = (
  centerId: string,
  locationId: string,
  value: FirebaseFirestore.DocumentData | undefined
): AgendaPolicyData => {
  const defaults = defaultAgendaPolicy(centerId, locationId);
  const mode = (candidate: unknown): AgendaConflictMode =>
    candidate === "require_override" ? "require_override" : "block";

  return {
    centerId,
    locationId,
    slotDurationMinutes: integer(value?.slotDurationMinutes, defaults.slotDurationMinutes, 5, 240),
    requirePatientContact: value?.requirePatientContact !== false,
    allowPublicCancellation: value?.allowPublicCancellation !== false,
    cancellationWindowHours: integer(
      value?.cancellationWindowHours,
      defaults.cancellationWindowHours,
      0,
      720
    ),
    allowInternalOutsideHours: value?.allowInternalOutsideHours === true,
    appointmentConflictMode: mode(value?.appointmentConflictMode),
    resourceConflictMode: mode(value?.resourceConflictMode),
    revision: integer(value?.revision, defaults.revision, 1, Number.MAX_SAFE_INTEGER),
  };
};

export const agendaPolicyRef = (centerId: string, locationId: string) =>
  db.collection("centers").doc(centerId).collection("agendaPolicies").doc(locationId);

const normalizeRole = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const legacyCanConfigure = (role: unknown) =>
  ["center_admin", "admin_centro", "admin"].includes(normalizeRole(role));

export function canConfigureAgendaPolicy(
  staff: FirebaseFirestore.DocumentData | undefined
): boolean {
  if (!staff || staff.active !== true) return false;
  if (Array.isArray(staff.capabilities)) return staff.capabilities.includes("center.configure");
  return legacyCanConfigure(staff.accessRole || staff.role);
}

export function canOverrideAgenda(staff: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!staff || staff.active !== true) return false;
  return Array.isArray(staff.capabilities) && staff.capabilities.includes("agenda.override");
}

const validateIdentity = (value: unknown, label: string) => {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(normalized)) {
    throw new functions.https.HttpsError("invalid-argument", `${label} no válido.`);
  }
  return normalized;
};

export const getAgendaPolicy = functions.https.onCall(async (data, context) => {
  requireAgendaOperationsV2();
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  const centerId = validateIdentity(data?.centerId, "Centro");
  const locationId = validateIdentity(data?.locationId || "default", "Sede");
  const staff = await db.collection("centers").doc(centerId).collection("staff").doc(uid).get();
  if (!staff.exists || staff.get("active") !== true) {
    throw new functions.https.HttpsError("permission-denied", "No tiene acceso a este centro.");
  }
  const snapshot = await agendaPolicyRef(centerId, locationId).get();
  return sanitizeAgendaPolicy(centerId, locationId, snapshot.data());
});

export interface UpdateAgendaPolicyInput {
  centerId: string;
  locationId: string;
  requestId: string;
  policy?: FirebaseFirestore.DocumentData;
}

export async function updateAgendaPolicyTransaction(
  input: UpdateAgendaPolicyInput,
  actorUid: string
) {
  const { centerId, locationId, requestId } = input;
  const policyRef = agendaPolicyRef(centerId, locationId);
  const staffRef = db.collection("centers").doc(centerId).collection("staff").doc(actorUid);
  const auditRef = db
    .collection("centers")
    .doc(centerId)
    .collection("auditLogs")
    .doc(`agenda_policy_${requestId}`);

  return db.runTransaction(async (transaction) => {
    const [staffSnapshot, currentSnapshot, auditSnapshot] = await Promise.all([
      transaction.get(staffRef),
      transaction.get(policyRef),
      transaction.get(auditRef),
    ]);
    if (!canConfigureAgendaPolicy(staffSnapshot.data())) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tiene permiso para configurar la agenda."
      );
    }
    if (auditSnapshot.exists) {
      return sanitizeAgendaPolicy(centerId, locationId, currentSnapshot.data());
    }
    const current = sanitizeAgendaPolicy(centerId, locationId, currentSnapshot.data());
    const next = sanitizeAgendaPolicy(centerId, locationId, {
      ...(input.policy || {}),
      revision: current.revision + 1,
    });
    transaction.set(policyRef, {
      ...next,
      updatedBy: actorUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      centerId,
      actorUid,
      action: "AGENDA_POLICY_UPDATED",
      entityType: "agenda_policy",
      entityId: locationId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        requestId,
        previousRevision: current.revision,
        revision: next.revision,
      },
    });
    return next;
  });
}

export const updateAgendaPolicy = functions.https.onCall(async (data, context) => {
  requireAgendaOperationsV2();
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  const input: UpdateAgendaPolicyInput = {
    centerId: validateIdentity(data?.centerId, "Centro"),
    locationId: validateIdentity(data?.locationId || "default", "Sede"),
    requestId: validateIdentity(data?.requestId, "Solicitud"),
    policy: data?.policy || {},
  };
  return updateAgendaPolicyTransaction(input, uid);
});

export const previewAgendaPolicyImpact = functions.https.onCall(async (data, context) => {
  requireAgendaOperationsV2();
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  const centerId = validateIdentity(data?.centerId, "Centro");
  const locationId = validateIdentity(data?.locationId || "default", "Sede");
  const staff = await db.collection("centers").doc(centerId).collection("staff").doc(uid).get();
  if (!canConfigureAgendaPolicy(staff.data())) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No tiene permiso para configurar la agenda."
    );
  }
  const currentSnapshot = await agendaPolicyRef(centerId, locationId).get();
  const current = sanitizeAgendaPolicy(centerId, locationId, currentSnapshot.data());
  const next = sanitizeAgendaPolicy(centerId, locationId, data?.policy || {});
  const future = await db
    .collection("centers")
    .doc(centerId)
    .collection("appointments")
    .where("date", ">=", new Date().toISOString().slice(0, 10))
    .limit(5000)
    .get();
  const futureReservations = future.docs.filter((document) => {
    const appointment = document.data();
    return (
      appointment.status === "booked" &&
      (locationId === "default" || appointment.locationId === locationId)
    );
  }).length;
  const changedFields = Object.keys(next).filter(
    (key) =>
      !["centerId", "locationId", "revision"].includes(key) &&
      next[key as keyof AgendaPolicyData] !== current[key as keyof AgendaPolicyData]
  );
  return { futureReservations, changedFields, mutatesExistingReservations: false };
});
