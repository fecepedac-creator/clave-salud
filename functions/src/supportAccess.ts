import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { createHash, randomUUID } from "crypto";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

type Data = Record<string, unknown>;

const normalizedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const isActiveStaff = (data: Data | undefined): boolean =>
  Boolean(data && (data.active === true || data.activo === true));

const staffRole = (data: Data | undefined): string =>
  normalizedString(data?.accessRole ?? data?.role).toLowerCase();

const isCenterAdminStaff = (data: Data | undefined): boolean =>
  isActiveStaff(data) && ["center_admin", "admin_centro", "admin"].includes(staffRole(data));

const isDiagnosticSupportStaff = (data: Data | undefined): boolean =>
  isActiveStaff(data) &&
  staffRole(data) === "support" &&
  Array.isArray(data?.capabilities) &&
  data.capabilities.includes("support.diagnostics");

export const isValidActiveSupportSession = (
  session: Data | undefined,
  actorUid: string,
  nowMillis: number
): boolean => {
  if (!session || session.status !== "active" || session.granteeUid !== actorUid) return false;
  if (!Array.isArray(session.permissions) || !session.permissions.includes("support.diagnostics")) {
    return false;
  }
  const expiresAt = session.expiresAt as { toMillis?: () => number } | undefined;
  return typeof expiresAt?.toMillis === "function" && expiresAt.toMillis() > nowMillis;
};

const requireCenterAdmin = async (centerId: string, uid: string) => {
  const snapshot = await db.collection("centers").doc(centerId).collection("staff").doc(uid).get();
  if (!isCenterAdminStaff(snapshot.data())) {
    throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
  }
};

export const createSupportDiagnosticSession = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    const centerId = normalizedString(data?.centerId);
    const granteeUid = normalizedString(data?.granteeUid);
    const ticket = normalizedString(data?.ticket);
    const purpose = normalizedString(data?.purpose);
    const durationMinutes = Number(data?.durationMinutes);
    if (
      !uid ||
      !centerId ||
      !granteeUid ||
      ticket.length < 3 ||
      ticket.length > 100 ||
      purpose.length < 5 ||
      purpose.length > 200 ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 240
    ) {
      throw new functions.https.HttpsError("invalid-argument", "Solicitud inválida.");
    }

    await requireCenterAdmin(centerId, uid);
    const supportSnapshot = await db
      .collection("centers")
      .doc(centerId)
      .collection("staff")
      .doc(granteeUid)
      .get();
    if (!isDiagnosticSupportStaff(supportSnapshot.data())) {
      throw new functions.https.HttpsError("failed-precondition", "Soporte no habilitado.");
    }

    const sessionId = randomUUID();
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + durationMinutes * 60 * 1000
    );
    const sessionRef = db
      .collection("centers")
      .doc(centerId)
      .collection("supportSessions")
      .doc(sessionId);
    const auditRef = db.collection("centers").doc(centerId).collection("auditLogs").doc();
    const batch = db.batch();
    batch.set(sessionRef, {
      id: sessionId,
      centerId,
      granteeUid,
      ticketHashSha256: createHash("sha256").update(ticket).digest("hex"),
      purpose,
      permissions: ["support.diagnostics"],
      status: "active",
      createdBy: uid,
      createdAt: now,
      expiresAt,
    });
    batch.set(auditRef, {
      action: "SUPPORT_SESSION_CREATED",
      actorUid: uid,
      entityType: "support_session",
      entityId: sessionId,
      granteeUid,
      purpose,
      expiresAt,
      containsClinicalContent: false,
      timestamp: now,
    });
    await batch.commit();
    return { sessionId, centerId, expiresAt: expiresAt.toDate().toISOString() };
  });

export const getSupportDiagnostics = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    const centerId = normalizedString(data?.centerId);
    const sessionId = normalizedString(data?.sessionId);
    if (!uid || !centerId || !sessionId) {
      throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
    }

    const [staffSnapshot, sessionSnapshot] = await Promise.all([
      db.collection("centers").doc(centerId).collection("staff").doc(uid).get(),
      db.collection("centers").doc(centerId).collection("supportSessions").doc(sessionId).get(),
    ]);
    if (
      !isDiagnosticSupportStaff(staffSnapshot.data()) ||
      !isValidActiveSupportSession(sessionSnapshot.data(), uid, Date.now())
    ) {
      throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
    }

    const [staffCount, appointmentCount, directoryCount] = await Promise.all([
      db.collection("centers").doc(centerId).collection("staff").count().get(),
      db.collection("centers").doc(centerId).collection("appointments").count().get(),
      db.collection("centers").doc(centerId).collection("patientDirectory").count().get(),
    ]);
    const auditRef = db.collection("centers").doc(centerId).collection("auditLogs").doc();
    await auditRef.set({
      action: "SUPPORT_DIAGNOSTICS_READ",
      actorUid: uid,
      entityType: "support_session",
      entityId: sessionId,
      dataClasses: ["aggregate.staff", "aggregate.appointments", "aggregate.patient_directory"],
      containsClinicalContent: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      centerId,
      sessionId,
      counts: {
        staff: staffCount.data().count,
        appointments: appointmentCount.data().count,
        patientDirectory: directoryCount.data().count,
      },
      clinicalDataIncluded: false,
      generatedAt: new Date().toISOString(),
    };
  });

export const revokeSupportDiagnosticSession = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    const centerId = normalizedString(data?.centerId);
    const sessionId = normalizedString(data?.sessionId);
    if (!uid || !centerId || !sessionId) {
      throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
    }
    await requireCenterAdmin(centerId, uid);

    const sessionRef = db
      .collection("centers")
      .doc(centerId)
      .collection("supportSessions")
      .doc(sessionId);
    const auditRef = db.collection("centers").doc(centerId).collection("auditLogs").doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(sessionRef, { status: "revoked", revokedBy: uid, revokedAt: now }, { merge: true });
    batch.set(auditRef, {
      action: "SUPPORT_SESSION_REVOKED",
      actorUid: uid,
      entityType: "support_session",
      entityId: sessionId,
      containsClinicalContent: false,
      timestamp: now,
    });
    await batch.commit();
    return { ok: true, sessionId };
  });
