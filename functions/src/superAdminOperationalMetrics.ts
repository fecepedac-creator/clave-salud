import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";

if (!admin.apps.length) admin.initializeApp();

type AuthToken = Record<string, unknown>;

export const canReadSuperAdminOperationalMetrics = (token: AuthToken): boolean => {
  const roles = Array.isArray(token.roles) ? token.roles.map(String) : [];
  return (
    token.super_admin === true ||
    token.superadmin === true ||
    token.superAdmin === true ||
    roles.includes("super_admin") ||
    roles.includes("superadmin")
  );
};

export interface SuperAdminOperationalMetrics {
  patients: number;
  professionals: number;
  generatedAt: string;
}

export const toSuperAdminOperationalMetrics = (
  patients: number,
  professionals: number,
  generatedAt: string
): SuperAdminOperationalMetrics => ({ patients, professionals, generatedAt });

export const getSuperAdminOperationalMetrics = functions
  .region("us-central1")
  .https.onCall(async (_data, context): Promise<SuperAdminOperationalMetrics> => {
    if (!context.auth || !canReadSuperAdminOperationalMetrics(context.auth.token)) {
      throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
    }

    const db = admin.firestore();
    const [patientCount, staffCount] = await Promise.all([
      db.collection("patients").count().get(),
      db.collectionGroup("staff").count().get(),
    ]);
    const generatedAt = new Date().toISOString();

    await db.collection("auditLogs").add({
      action: "SUPERADMIN_OPERATIONAL_METRICS_READ",
      actorUid: context.auth.uid,
      generatedAt,
      dataClasses: ["aggregate.patient_count", "aggregate.staff_count"],
      containsClinicalContent: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return toSuperAdminOperationalMetrics(
      patientCount.data().count,
      staffCount.data().count,
      generatedAt
    );
  });
