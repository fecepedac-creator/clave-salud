import { createHash } from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

type OperationalAction = "check_in" | "attendance";
type AttendanceStatus = "completed" | "no-show";

interface OperationActor {
  uid: string;
}

export interface ArrivalOperationInput {
  centerId: string;
  appointmentId: string;
  requestId: string;
  arrived: boolean;
}

export interface AttendanceOperationInput {
  centerId: string;
  appointmentId: string;
  requestId: string;
  attendanceStatus: AttendanceStatus;
}

const normalizeRole = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const legacyOperationalRole = (value: unknown) =>
  [
    "center_admin",
    "admin_centro",
    "admin",
    "administrative",
    "administrativo",
    "secretaria",
    "secretary",
  ].includes(normalizeRole(value));

const hasOperationalCapability = (
  staff: FirebaseFirestore.DocumentData | undefined,
  action: OperationalAction
) => {
  const required = action === "check_in" ? "agenda.check_in" : "agenda.attendance";
  if (Array.isArray(staff?.capabilities)) return staff.capabilities.includes(required);
  return legacyOperationalRole(staff?.accessRole || staff?.role);
};

const assertBaseInput = (input: { centerId: string; appointmentId: string; requestId: string }) => {
  if (!input?.centerId || !input.appointmentId) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos de la cita.");
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(input.requestId || "")) {
    throw new functions.https.HttpsError("invalid-argument", "La solicitud no es válida.");
  }
};

const auditDocumentId = (action: OperationalAction, appointmentId: string, requestId: string) =>
  `appointment_${action}_${createHash("sha256")
    .update(`${appointmentId}|${requestId}`)
    .digest("hex")
    .slice(0, 40)}`;

const references = (centerId: string, appointmentId: string, actorUid: string) => {
  const centerRef = db.collection("centers").doc(centerId);
  return {
    appointment: centerRef.collection("appointments").doc(appointmentId),
    staff: centerRef.collection("staff").doc(actorUid),
  };
};

export async function updateAppointmentArrivalTransaction(
  input: ArrivalOperationInput,
  actor: OperationActor
) {
  assertBaseInput(input);
  if (typeof input.arrived !== "boolean") {
    throw new functions.https.HttpsError("invalid-argument", "El estado de llegada no es válido.");
  }
  const refs = references(input.centerId, input.appointmentId, actor.uid);
  const auditRef = db
    .collection("centers")
    .doc(input.centerId)
    .collection("auditLogs")
    .doc(auditDocumentId("check_in", input.appointmentId, input.requestId));

  return db.runTransaction(async transaction => {
    const [appointmentSnapshot, staffSnapshot] = await Promise.all([
      transaction.get(refs.appointment),
      transaction.get(refs.staff),
    ]);
    const staff = staffSnapshot.data();
    if (
      !staffSnapshot.exists ||
      staff?.active !== true ||
      !hasOperationalCapability(staff, "check_in")
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tiene permiso para registrar llegadas."
      );
    }
    if (!appointmentSnapshot.exists) {
      throw new functions.https.HttpsError("not-found", "La cita no existe.");
    }
    const appointment = appointmentSnapshot.data() || {};
    if (appointment.status !== "booked" || appointment.active === false) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "La cita no admite cambios de llegada."
      );
    }
    const nextStatus = input.arrived ? "arrived" : null;
    if (appointment.arrivalStatus === nextStatus) return { success: true, idempotent: true };

    transaction.update(refs.appointment, {
      arrivalStatus: nextStatus,
      arrivedAt: input.arrived ? admin.firestore.FieldValue.serverTimestamp() : null,
      arrivedBy: input.arrived ? actor.uid : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      centerId: input.centerId,
      actorUid: actor.uid,
      action: input.arrived ? "APPOINTMENT_ARRIVED" : "APPOINTMENT_ARRIVAL_REVERTED",
      entityType: "appointment",
      entityId: input.appointmentId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, idempotent: false };
  });
}

export async function updateAppointmentOperationalAttendanceTransaction(
  input: AttendanceOperationInput,
  actor: OperationActor
) {
  assertBaseInput(input);
  if (!(["completed", "no-show"] as string[]).includes(input.attendanceStatus)) {
    throw new functions.https.HttpsError("invalid-argument", "El estado de asistencia no es válido.");
  }
  const refs = references(input.centerId, input.appointmentId, actor.uid);
  const auditRef = db
    .collection("centers")
    .doc(input.centerId)
    .collection("auditLogs")
    .doc(auditDocumentId("attendance", input.appointmentId, input.requestId));

  return db.runTransaction(async transaction => {
    const [appointmentSnapshot, staffSnapshot] = await Promise.all([
      transaction.get(refs.appointment),
      transaction.get(refs.staff),
    ]);
    const staff = staffSnapshot.data();
    if (
      !staffSnapshot.exists ||
      staff?.active !== true ||
      !hasOperationalCapability(staff, "attendance")
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tiene permiso para registrar asistencia."
      );
    }
    if (!appointmentSnapshot.exists) {
      throw new functions.https.HttpsError("not-found", "La cita no existe.");
    }
    const appointment = appointmentSnapshot.data() || {};
    if (appointment.status !== "booked" || appointment.active === false) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "La cita no admite cambios de asistencia."
      );
    }
    if (appointment.attendanceStatus === input.attendanceStatus) {
      return { success: true, idempotent: true };
    }

    transaction.update(refs.appointment, {
      attendanceStatus: input.attendanceStatus,
      attendanceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      attendanceUpdatedBy: actor.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      centerId: input.centerId,
      actorUid: actor.uid,
      action:
        input.attendanceStatus === "completed"
          ? "APPOINTMENT_ATTENDED"
          : "APPOINTMENT_ABSENT",
      entityType: "appointment",
      entityId: input.appointmentId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, idempotent: false };
  });
}

export const updateAppointmentArrival = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  return updateAppointmentArrivalTransaction(data as ArrivalOperationInput, { uid });
});

export const updateAppointmentOperationalAttendance = functions.https.onCall(
  async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    return updateAppointmentOperationalAttendanceTransaction(data as AttendanceOperationInput, {
      uid,
    });
  }
);
