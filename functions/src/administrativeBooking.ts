import { createHash } from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { agendaOperationsV2Enabled } from "./agendaOperationsFeature";
import { agendaPolicyRef, canOverrideAgenda, sanitizeAgendaPolicy } from "./agendaPolicy";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export interface AdministrativeBookingInput {
  centerId: string;
  appointmentId: string;
  idempotencyKey: string;
  locationId?: string;
  slot: { doctorId: string; date: string; time: string; resourceId?: string };
  override?: { reason?: string };
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
  | {
      success: false;
      error:
        | "SLOT_TAKEN"
        | "CONTACT_REQUIRED"
        | "OUTSIDE_HOURS"
        | "APPOINTMENT_CONFLICT"
        | "RESOURCE_CONFLICT"
        | "OVERRIDE_REQUIRED";
    };

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

const lockId = (scope: string, ...parts: string[]) =>
  `${scope}_${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40)}`;

export const agendaSlotLockDocumentId = (doctorId: string, date: string, time: string) =>
  lockId("slot", doctorId, date, time);

export const agendaResourceLockDocumentId = (resourceId: string, date: string, time: string) =>
  lockId("resource", resourceId, date, time);

const isWithinAgendaHours = (
  time: string,
  agendaConfig: FirebaseFirestore.DocumentData | undefined
) => {
  const startTime = String(agendaConfig?.startTime || "");
  const endTime = String(agendaConfig?.endTime || "");
  return /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime)
    ? time >= startTime && time < endTime
    : false;
};

const requiresOverride = (
  mode: "block" | "require_override",
  staff: FirebaseFirestore.DocumentData | undefined,
  reason: string
) => mode === "require_override" && canOverrideAgenda(staff) && reason.length >= 10;

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
  const staffRef = db.collection("centers").doc(input.centerId).collection("staff").doc(actor.uid);
  const auditRef = db
    .collection("centers")
    .doc(input.centerId)
    .collection("auditLogs")
    .doc(auditId(input.appointmentId, input.idempotencyKey));
  const locationId = input.locationId?.trim() || "default";
  const policyRef = agendaPolicyRef(input.centerId, locationId);
  const doctorRef = db
    .collection("centers")
    .doc(input.centerId)
    .collection("staff")
    .doc(input.slot.doctorId);
  const slotLockRef = db
    .collection("centers")
    .doc(input.centerId)
    .collection("agendaSlotLocks")
    .doc(agendaSlotLockDocumentId(input.slot.doctorId, input.slot.date, input.slot.time));
  const resourceLockRef = input.slot.resourceId
    ? db
        .collection("centers")
        .doc(input.centerId)
        .collection("agendaResourceLocks")
        .doc(agendaResourceLockDocumentId(input.slot.resourceId, input.slot.date, input.slot.time))
    : null;

  return db.runTransaction(async (transaction) => {
    const policyEnabled = agendaOperationsV2Enabled();
    const [
      appointmentSnapshot,
      staffSnapshot,
      policySnapshot,
      doctorSnapshot,
      slotLockSnapshot,
      resourceLockSnapshot,
    ] = await Promise.all([
      transaction.get(appointmentRef),
      actor.skipAuthorization ? Promise.resolve(null) : transaction.get(staffRef),
      policyEnabled ? transaction.get(policyRef) : Promise.resolve(null),
      policyEnabled ? transaction.get(doctorRef) : Promise.resolve(null),
      policyEnabled ? transaction.get(slotLockRef) : Promise.resolve(null),
      policyEnabled && resourceLockRef ? transaction.get(resourceLockRef) : Promise.resolve(null),
    ]);
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
    if (
      appointmentSnapshot.exists &&
      (current.status !== "available" || current.active === false)
    ) {
      return { success: false, error: "SLOT_TAKEN" };
    }

    let overrideReason = "";
    let overrideScope: "appointment" | "resource" | "outside_hours" | "" = "";
    let policyRevision: number | null = null;
    if (policyEnabled) {
      const policy = sanitizeAgendaPolicy(input.centerId, locationId, policySnapshot?.data());
      policyRevision = policy.revision;
      const staff = staffSnapshot?.data();
      overrideReason = String(input.override?.reason || "")
        .trim()
        .slice(0, 300);

      if (
        policy.requirePatientContact &&
        !input.patient.phone?.trim() &&
        !input.patient.email?.trim()
      ) {
        return { success: false, error: "CONTACT_REQUIRED" };
      }

      if (
        !appointmentSnapshot.exists &&
        !policy.allowInternalOutsideHours &&
        !isWithinAgendaHours(input.slot.time, doctorSnapshot?.data()?.agendaConfig)
      ) {
        if (!requiresOverride("require_override", staff, overrideReason)) {
          return {
            success: false,
            error: canOverrideAgenda(staff) ? "OVERRIDE_REQUIRED" : "OUTSIDE_HOURS",
          };
        }
        overrideScope = "outside_hours";
      }

      const slotConflict =
        slotLockSnapshot?.exists && slotLockSnapshot.get("appointmentId") !== input.appointmentId;
      if (slotConflict) {
        if (!requiresOverride(policy.appointmentConflictMode, staff, overrideReason)) {
          return {
            success: false,
            error:
              policy.appointmentConflictMode === "require_override" && canOverrideAgenda(staff)
                ? "OVERRIDE_REQUIRED"
                : "APPOINTMENT_CONFLICT",
          };
        }
        overrideScope = "appointment";
      }

      const resourceConflict =
        resourceLockSnapshot?.exists &&
        resourceLockSnapshot.get("appointmentId") !== input.appointmentId;
      if (resourceConflict) {
        if (!requiresOverride(policy.resourceConflictMode, staff, overrideReason)) {
          return {
            success: false,
            error:
              policy.resourceConflictMode === "require_override" && canOverrideAgenda(staff)
                ? "OVERRIDE_REQUIRED"
                : "RESOURCE_CONFLICT",
          };
        }
        overrideScope = "resource";
      }
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
      locationId,
      resourceId: input.slot.resourceId || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (appointmentSnapshot.exists) transaction.update(appointmentRef, booking);
    else transaction.create(appointmentRef, booking);
    if (policyEnabled) {
      transaction.set(
        slotLockRef,
        {
          centerId: input.centerId,
          appointmentId: input.appointmentId,
          appointmentIds: admin.firestore.FieldValue.arrayUnion(input.appointmentId),
          doctorId: input.slot.doctorId,
          date: input.slot.date,
          time: input.slot.time,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      if (resourceLockRef) {
        transaction.set(
          resourceLockRef,
          {
            centerId: input.centerId,
            appointmentId: input.appointmentId,
            appointmentIds: admin.firestore.FieldValue.arrayUnion(input.appointmentId),
            resourceId: input.slot.resourceId,
            date: input.slot.date,
            time: input.slot.time,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
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
        policyEnabled,
        locationId,
        overrideApplied: Boolean(overrideScope),
        overrideScope: overrideScope || null,
        overrideReason: overrideScope ? overrideReason : null,
        policyRevision,
        resourceId: input.slot.resourceId || null,
        date: input.slot.date,
        time: input.slot.time,
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
