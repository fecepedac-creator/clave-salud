import * as admin from "firebase-admin";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const DIRECTORY_VERSION = 1;

type PatientData = Record<string, unknown>;

const DEMOGRAPHIC_FIELDS = [
  "fullName",
  "rut",
  "birthDate",
  "gender",
  "phone",
  "email",
  "address",
  "commune",
] as const;

const optionalString = (value: unknown): string | undefined => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
};

export const buildPatientDirectoryProjection = (
  patientId: string,
  centerId: string,
  patient: PatientData
) => {
  const projection: Record<string, unknown> = {
    id: patientId,
    patientId,
    centerId,
    entityType: "patient_directory_entry",
    fullName: optionalString(patient.fullName) ?? "Paciente sin nombre",
    rut: optionalString(patient.rut) ?? "",
    active: patient.active !== false,
    directoryVersion: DIRECTORY_VERSION,
  };

  const optionalFields = ["birthDate", "gender", "phone", "email", "lastUpdated"] as const;
  optionalFields.forEach((field) => {
    const value = optionalString(patient[field]);
    if (value !== undefined) projection[field] = value;
  });

  return projection;
};

export const sanitizePatientDemographics = (input: unknown): PatientData => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("INVALID_DEMOGRAPHICS");
  }
  const source = input as PatientData;
  const sanitized: PatientData = {};
  DEMOGRAPHIC_FIELDS.forEach((field) => {
    const value = optionalString(source[field]);
    if (value !== undefined) sanitized[field] = value;
  });
  if (!optionalString(sanitized.fullName) || !optionalString(sanitized.rut)) {
    throw new Error("INVALID_DEMOGRAPHICS");
  }
  return sanitized;
};

const patientCenterIds = (patient: PatientData | undefined): string[] => {
  if (!patient) return [];
  const accessControl = patient.accessControl as Record<string, unknown> | undefined;
  const centerIds = Array.isArray(accessControl?.centerIds)
    ? accessControl.centerIds.filter((value): value is string => typeof value === "string")
    : [];
  const directCenterId = optionalString(patient.centerId);
  return [...new Set([...centerIds, ...(directCenterId ? [directCenterId] : [])])];
};

export const syncPatientDirectory = onDocumentWritten("patients/{patientId}", async (event) => {
  const beforeSnapshot = event.data?.before;
  const afterSnapshot = event.data?.after;
  const before = beforeSnapshot?.exists ? (beforeSnapshot.data() as PatientData) : undefined;
  const after = afterSnapshot?.exists ? (afterSnapshot.data() as PatientData) : undefined;
  const beforeCenters = patientCenterIds(before);
  const afterCenters = patientCenterIds(after);
  const batch = db.batch();

  beforeCenters
    .filter((centerId) => !afterCenters.includes(centerId))
    .forEach((centerId) => {
      batch.delete(
        db
          .collection("centers")
          .doc(centerId)
          .collection("patientDirectory")
          .doc(String(event.params.patientId))
      );
    });

  if (after) {
    afterCenters.forEach((centerId) => {
      batch.set(
        db
          .collection("centers")
          .doc(centerId)
          .collection("patientDirectory")
          .doc(String(event.params.patientId)),
        {
          ...buildPatientDirectoryProjection(String(event.params.patientId), centerId, after),
          updatedAt: FieldValue.serverTimestamp(),
        }
      );
    });
  }

  await batch.commit();
});

const isOperationalDirectoryManager = (staff: PatientData | undefined): boolean => {
  if (!staff || (staff.active !== true && staff.activo !== true)) return false;
  const role = String(staff.accessRole ?? staff.role ?? "")
    .trim()
    .toLowerCase();
  return [
    "center_admin",
    "admin_centro",
    "admin",
    "administrative",
    "administrativo",
    "administrativa",
    "secretaria",
  ].includes(role);
};

export const ensurePatientDirectory = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    const centerId = optionalString(data?.centerId);
    if (!uid || !centerId) {
      throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
    }

    const staffSnapshot = await db
      .collection("centers")
      .doc(centerId)
      .collection("staff")
      .doc(uid)
      .get();
    if (!isOperationalDirectoryManager(staffSnapshot.data())) {
      throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
    }

    const stateRef = db
      .collection("centers")
      .doc(centerId)
      .collection("settings")
      .doc("patientDirectory");
    const state = await stateRef.get();
    if (state.data()?.version === DIRECTORY_VERSION && state.data()?.status === "ready") {
      return { ready: true, processed: 0, version: DIRECTORY_VERSION };
    }

    let processed = 0;
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    do {
      let patientQuery = db
        .collection("patients")
        .where("accessControl.centerIds", "array-contains", centerId)
        .orderBy(FieldPath.documentId())
        .limit(400);
      if (cursor) patientQuery = patientQuery.startAfter(cursor);
      const snapshot = await patientQuery.get();
      if (snapshot.empty) break;

      const batch = db.batch();
      snapshot.docs.forEach((patientSnapshot) => {
        batch.set(
          db
            .collection("centers")
            .doc(centerId)
            .collection("patientDirectory")
            .doc(patientSnapshot.id),
          {
            ...buildPatientDirectoryProjection(
              patientSnapshot.id,
              centerId,
              patientSnapshot.data()
            ),
            updatedAt: FieldValue.serverTimestamp(),
          }
        );
      });
      await batch.commit();
      processed += snapshot.size;
      cursor = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < 400) break;
    } while (cursor);

    const completedAt = FieldValue.serverTimestamp();
    const finalBatch = db.batch();
    finalBatch.set(stateRef, { status: "ready", version: DIRECTORY_VERSION, completedAt });
    finalBatch.set(db.collection("centers").doc(centerId).collection("auditLogs").doc(), {
      action: "PATIENT_DIRECTORY_REBUILT",
      actorUid: uid,
      entityType: "patient_directory",
      entityId: centerId,
      processed,
      containsClinicalContent: false,
      timestamp: completedAt,
    });
    await finalBatch.commit();

    return { ready: true, processed, version: DIRECTORY_VERSION };
  });

export const executePatientDemographicsUpsert = async (params: {
  firestore: FirebaseFirestore.Firestore;
  centerId: string;
  patientId: string;
  demographics: PatientData;
  actorUid: string;
}) => {
  const { firestore, centerId, patientId, demographics, actorUid } = params;
  const patientRef = firestore.collection("patients").doc(patientId);
  const auditRef = firestore.collection("centers").doc(centerId).collection("auditLogs").doc();
  const result = await firestore.runTransaction(async (transaction) => {
    const patientSnapshot = await transaction.get(patientRef);
    const existing = patientSnapshot.exists ? patientSnapshot.data() : undefined;
    if (existing && !patientCenterIds(existing).includes(centerId)) {
      throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
    }

    const now = FieldValue.serverTimestamp();
    const patientPayload: PatientData = existing
      ? { ...demographics, lastUpdated: now }
      : {
          ...demographics,
          id: patientId,
          centerId,
          accessControl: { centerIds: [centerId], allowedUids: [] },
          careTeamUids: [],
          medicalHistory: [],
          surgicalHistory: [],
          medications: [],
          allergies: [],
          consultations: [],
          attachments: [],
          smokingStatus: "No fumador",
          alcoholStatus: "No consumo",
          active: true,
          createdAt: now,
          lastUpdated: now,
        };

    transaction.set(patientRef, patientPayload, { merge: true });
    transaction.set(auditRef, {
      action: patientSnapshot.exists ? "PATIENT_DEMOGRAPHICS_UPDATE" : "PATIENT_CREATE",
      actorUid,
      entityType: "patient_demographics",
      entityId: patientId,
      patientId,
      changedFields: Object.keys(demographics),
      containsClinicalContent: false,
      timestamp: now,
    });
    return { created: !patientSnapshot.exists };
  });

  return { ok: true, patientId, ...result };
};

export const upsertPatientDemographics = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    const centerId = optionalString(data?.centerId);
    const patientId = optionalString(data?.patientId);
    if (!uid || !centerId || !patientId) {
      throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
    }

    const staffSnapshot = await db
      .collection("centers")
      .doc(centerId)
      .collection("staff")
      .doc(uid)
      .get();
    if (!isOperationalDirectoryManager(staffSnapshot.data())) {
      throw new functions.https.HttpsError("permission-denied", "Acceso no autorizado.");
    }

    let demographics: PatientData;
    try {
      demographics = sanitizePatientDemographics(data?.demographics);
    } catch {
      throw new functions.https.HttpsError("invalid-argument", "Datos demográficos inválidos.");
    }

    return executePatientDemographicsUpsert({
      firestore: db,
      centerId,
      patientId,
      demographics,
      actorUid: uid,
    });
  });
