import { createHash } from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export interface AdministrativeBookingInput {
  centerId: string;
  appointmentId: string;
  idempotencyKey: string;
  slot: { doctorId: string; date: string; time: string };
  patient: {
    id: string;
    fullName: string;
    rut: string;
    phone?: string;
    email?: string;
  };
}

interface BookingActor {
  uid: string;
  skipAuthorization?: boolean;
}

export type AdministrativeBookingResult =
  | { success: true; idempotent: boolean; appointmentId: string }
  | { success: false; error: "SLOT_TAKEN" };

const normalizeRole = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const canManageAgenda = (staff: FirebaseFirestore.DocumentData | undefined) => {
  if (Array.isArray(staff?.capabilities)) return staff.capabilities.includes("agenda.manage");
  return [
    "center_admin",
    "admin_centro",
    "admin",
    "administrative",
    "administrativo",
    "secretaria",
    "secretary",
  ].includes(normalizeRole(staff?.accessRole || staff?.role));
};

const assertInput = (input: AdministrativeBookingInput) => {
  if (
    !input?.centerId ||
    !input.appointmentId ||
    !input.slot?.doctorId ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.slot.date) ||
    !/^\d{2}:\d{2}$/.test(input.slot.time) ||
    !input.patient?.id ||
    !input.patient.fullName?.trim() ||
    !input.patient.rut?.trim()
  ) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos de la reserva.");
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "La clave de idempotencia no es válida."
    );
  }
};

const auditId = (appointmentId: string, requestId: string) =>
  `administrative_booking_${createHash("sha256")
    .update(`${appointmentId}|${requestId}`)
    .digest("hex")
    .slice(0, 40)}`;

export async function bookAdministrativeAppointmentTransaction(
  input: AdministrativeBookingInput,
  actor: BookingActor
): Promise<AdministrativeBookingResult> {
  assertInput(input);

  const appointmentRef = db
    .collection("centers")
    .doc(input.centerId)
    .collection("appointments")
    .doc(input.appointmentId);
  const staffRef = db
    .collection("centers")
    .doc(input.centerId)
    .collection("staff")
    .doc(actor.uid);
  const auditRef = db
    .collection("centers")
    .doc(input.centerId)
    .collection("auditLogs")
    .doc(auditId(input.appointmentId, input.idempotencyKey));

  return db.runTransaction(async transaction => {
    const appointmentSnapshot = await transaction.get(appointmentRef);
    const staffSnapshot = actor.skipAuthorization ? null : await transaction.get(staffRef);
    const current = appointmentSnapshot.data() || {};

    if (!actor.skipAuthorization) {
      const staff = staffSnapshot?.data();
      if (!staffSnapshot?.exists || staff?.active !== true || !canManageAgenda(staff)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "No tiene permiso para reservar horas en este centro."
        );
      }
    }

    if (
      current.status === "booked" &&
      current.bookingRequestId === input.idempotencyKey &&
      current.bookedBy === actor.uid
    ) {
      return { success: true, idempotent: true, appointmentId: input.appointmentId };
    }
    if (appointmentSnapshot.exists && (current.status !== "available" || current.active === false)) {
      return { success: false, error: "SLOT_TAKEN" };
    }

    const booking = {
      centerId: input.centerId,
      doctorId: current.doctorId || input.slot.doctorId,
      doctorUid: current.doctorUid || current.doctorId || input.slot.doctorId,
      date: current.date || input.slot.date,
      time: current.time || input.slot.time,
      active: true,
      status: "booked",
      patientId: input.patient.id,
      patientName: input.patient.fullName.trim(),
      patientRut: input.patient.rut.trim(),
      patientPhone: input.patient.phone?.trim() || "",
      patientEmail: input.patient.email?.trim().toLowerCase() || "",
      attendanceStatus: null,
      bookedAt: admin.firestore.FieldValue.serverTimestamp(),
      bookedBy: actor.uid,
      bookingSource: "administrative",
      bookingRequestId: input.idempotencyKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (appointmentSnapshot.exists) transaction.update(appointmentRef, booking);
    else transaction.create(appointmentRef, booking);
    transaction.create(auditRef, {
      centerId: input.centerId,
      actorUid: actor.uid,
      action: "ADMINISTRATIVE_APPOINTMENT_BOOKED",
      entityType: "appointment",
      entityId: input.appointmentId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        bookingSource: "administrative",
        requestHash: auditId(input.appointmentId, input.idempotencyKey),
      },
    });

    return { success: true, idempotent: false, appointmentId: input.appointmentId };
  });
}

export const bookAdministrativeAppointment = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  return bookAdministrativeAppointmentTransaction(data as AdministrativeBookingInput, { uid });
});
