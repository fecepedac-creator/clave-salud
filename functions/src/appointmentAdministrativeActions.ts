import { createHash } from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { agendaResourceLockDocumentId, agendaSlotLockDocumentId } from "./administrativeBooking";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

type AdministrativeAction = "contact" | "rebook" | "reminder";
type ContactChannel = "call" | "whatsapp";
type ReminderChannel = ContactChannel | "other";
type ReminderStatus = "sent" | "confirmed" | "declined" | "no_response";

interface ActionActor {
  uid: string;
}

export interface ContactAttemptInput {
  centerId: string;
  appointmentId: string;
  requestId: string;
  channel: ContactChannel;
}

export interface RebookAppointmentInput {
  centerId: string;
  sourceAppointmentId: string;
  targetAppointmentId: string;
  requestId: string;
}

export interface AppointmentReminderStatusInput {
  centerId: string;
  appointmentId: string;
  requestId: string;
  status: ReminderStatus;
  channel?: ReminderChannel;
}

export type RebookAppointmentResult =
  | { success: true; idempotent: boolean; targetAppointmentId: string }
  | { success: false; error: "TARGET_TAKEN" };

const normalizeRole = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const legacyAdministrativeRole = (value: unknown) =>
  [
    "center_admin",
    "admin_centro",
    "admin",
    "administrative",
    "administrativo",
    "secretaria",
    "secretary",
  ].includes(normalizeRole(value));

const hasAdministrativeCapability = (
  staff: FirebaseFirestore.DocumentData | undefined,
  action: AdministrativeAction
) => {
  if (!staff || staff.active !== true) return false;
  const capability = action === "rebook" ? "agenda.rebook" : "agenda.contact";
  if (Array.isArray(staff.capabilities)) return staff.capabilities.includes(capability);
  return legacyAdministrativeRole(staff.accessRole || staff.role);
};

const validateId = (value: unknown, label: string) => {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(normalized)) {
    throw new functions.https.HttpsError("invalid-argument", `${label} no válido.`);
  }
  return normalized;
};

const validateRequestId = (value: unknown) => {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(normalized)) {
    throw new functions.https.HttpsError("invalid-argument", "La solicitud no es válida.");
  }
  return normalized;
};

const auditDocumentId = (action: AdministrativeAction, appointmentId: string, requestId: string) =>
  `appointment_${action}_${createHash("sha256")
    .update(`${appointmentId}|${requestId}`)
    .digest("hex")
    .slice(0, 40)}`;

const centerReferences = (centerId: string) => {
  const center = db.collection("centers").doc(centerId);
  return {
    center,
    appointments: center.collection("appointments"),
    staff: center.collection("staff"),
    audit: center.collection("auditLogs"),
    slotLocks: center.collection("agendaSlotLocks"),
    resourceLocks: center.collection("agendaResourceLocks"),
  };
};

export async function recordAppointmentContactAttemptTransaction(
  input: ContactAttemptInput,
  actor: ActionActor
) {
  const centerId = validateId(input?.centerId, "Centro");
  const appointmentId = validateId(input?.appointmentId, "Cita");
  const requestId = validateRequestId(input?.requestId);
  if (!(["call", "whatsapp"] as string[]).includes(input?.channel)) {
    throw new functions.https.HttpsError("invalid-argument", "El canal no es válido.");
  }
  const refs = centerReferences(centerId);
  const appointmentRef = refs.appointments.doc(appointmentId);
  const auditRef = refs.audit.doc(auditDocumentId("contact", appointmentId, requestId));

  return db.runTransaction(async (transaction) => {
    const [staffSnapshot, appointmentSnapshot, auditSnapshot] = await Promise.all([
      transaction.get(refs.staff.doc(actor.uid)),
      transaction.get(appointmentRef),
      transaction.get(auditRef),
    ]);
    if (!hasAdministrativeCapability(staffSnapshot.data(), "contact")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tiene permiso para contactar pacientes desde la agenda."
      );
    }
    if (!appointmentSnapshot.exists) {
      throw new functions.https.HttpsError("not-found", "La cita no existe.");
    }
    const appointment = appointmentSnapshot.data() || {};
    if (appointment.status !== "booked" || appointment.active === false) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "La cita no admite contacto operativo."
      );
    }
    if (auditSnapshot.exists) return { success: true, idempotent: true };

    transaction.create(auditRef, {
      centerId,
      actorUid: actor.uid,
      action: "APPOINTMENT_CONTACT_INITIATED",
      entityType: "appointment",
      entityId: appointmentId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { channel: input.channel, date: appointment.date, time: appointment.time },
    });
    return { success: true, idempotent: false };
  });
}

export async function updateAppointmentReminderStatusTransaction(
  input: AppointmentReminderStatusInput,
  actor: ActionActor
) {
  const centerId = validateId(input?.centerId, "Centro");
  const appointmentId = validateId(input?.appointmentId, "Cita");
  const requestId = validateRequestId(input?.requestId);
  if (!(["sent", "confirmed", "declined", "no_response"] as string[]).includes(input?.status)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "El estado de recordatorio no es válido."
    );
  }
  if (
    input.status === "sent" &&
    !(["call", "whatsapp", "other"] as string[]).includes(input?.channel || "")
  ) {
    throw new functions.https.HttpsError("invalid-argument", "Indique el canal del recordatorio.");
  }
  const refs = centerReferences(centerId);
  const appointmentRef = refs.appointments.doc(appointmentId);
  const auditRef = refs.audit.doc(auditDocumentId("reminder", appointmentId, requestId));

  return db.runTransaction(async (transaction) => {
    const [staffSnapshot, appointmentSnapshot, auditSnapshot] = await Promise.all([
      transaction.get(refs.staff.doc(actor.uid)),
      transaction.get(appointmentRef),
      transaction.get(auditRef),
    ]);
    if (!hasAdministrativeCapability(staffSnapshot.data(), "reminder")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tiene permiso para actualizar recordatorios de citas."
      );
    }
    if (!appointmentSnapshot.exists) {
      throw new functions.https.HttpsError("not-found", "La cita no existe.");
    }
    const appointment = appointmentSnapshot.data() || {};
    if (
      appointment.status !== "booked" ||
      appointment.active === false ||
      ["completed", "no-show", "cancelled"].includes(appointment.attendanceStatus)
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "La cita no admite cambios de recordatorio."
      );
    }
    if (auditSnapshot.exists) return { success: true, idempotent: true };

    const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (input.status === "sent") {
      update.reminderStatus = "sent";
      update.reminderChannel = input.channel || null;
      update.reminderSentAt = admin.firestore.FieldValue.serverTimestamp();
      update.reminderSentBy = actor.uid;
      update.confirmationStatus = "pending";
      update.confirmationUpdatedAt = null;
      update.confirmationUpdatedBy = null;
    } else {
      if (appointment.reminderStatus !== "sent") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Primero debe registrar que el recordatorio fue enviado."
        );
      }
      update.confirmationStatus = input.status;
      update.confirmationUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
      update.confirmationUpdatedBy = actor.uid;
    }
    transaction.update(appointmentRef, update);
    transaction.create(auditRef, {
      centerId,
      actorUid: actor.uid,
      action: `APPOINTMENT_REMINDER_${input.status.toUpperCase()}`,
      entityType: "appointment",
      entityId: appointmentId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        channel: input.status === "sent" ? input.channel : appointment.reminderChannel || null,
      },
    });
    return { success: true, idempotent: false };
  });
}

const removeAppointmentFromLock = (
  transaction: FirebaseFirestore.Transaction,
  snapshot: FirebaseFirestore.DocumentSnapshot,
  appointmentId: string
) => {
  if (!snapshot.exists) return;
  const appointmentIds = Array.isArray(snapshot.get("appointmentIds"))
    ? (snapshot.get("appointmentIds") as string[]).filter((id) => id !== appointmentId)
    : [];
  if (appointmentIds.length === 0) {
    transaction.delete(snapshot.ref);
    return;
  }
  transaction.update(snapshot.ref, {
    appointmentId: appointmentIds[0],
    appointmentIds,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

export async function rebookAdministrativeAppointmentTransaction(
  input: RebookAppointmentInput,
  actor: ActionActor
): Promise<RebookAppointmentResult> {
  const centerId = validateId(input?.centerId, "Centro");
  const sourceAppointmentId = validateId(input?.sourceAppointmentId, "Cita de origen");
  const targetAppointmentId = validateId(input?.targetAppointmentId, "Cita de destino");
  const requestId = validateRequestId(input?.requestId);
  if (sourceAppointmentId === targetAppointmentId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "La cita de origen y destino deben ser distintas."
    );
  }
  const refs = centerReferences(centerId);
  const sourceRef = refs.appointments.doc(sourceAppointmentId);
  const targetRef = refs.appointments.doc(targetAppointmentId);
  const auditRef = refs.audit.doc(auditDocumentId("rebook", sourceAppointmentId, requestId));

  return db.runTransaction(async (transaction) => {
    const [staffSnapshot, sourceSnapshot, targetSnapshot, auditSnapshot] = await transaction.getAll(
      refs.staff.doc(actor.uid),
      sourceRef,
      targetRef,
      auditRef
    );
    if (!hasAdministrativeCapability(staffSnapshot.data(), "rebook")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tiene permiso para reagendar citas."
      );
    }
    if (auditSnapshot.exists) {
      return { success: true, idempotent: true, targetAppointmentId };
    }
    if (!sourceSnapshot.exists || !targetSnapshot.exists) {
      throw new functions.https.HttpsError("not-found", "No se encontró uno de los cupos.");
    }
    const source = sourceSnapshot.data() || {};
    const target = targetSnapshot.data() || {};
    if (source.status !== "booked" || source.active === false) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "La cita de origen no se puede reagendar."
      );
    }
    if (
      source.attendanceStatus === "completed" ||
      source.billable === true ||
      (typeof source.amount === "number" && source.amount > 0)
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Una cita atendida o con cobro no puede reagendarse desde la agenda."
      );
    }
    if (target.status !== "available" || target.active === false) {
      return { success: false, error: "TARGET_TAKEN" };
    }

    const sourceDoctorId = String(source.doctorUid || source.doctorId || "");
    const targetDoctorId = String(target.doctorUid || target.doctorId || "");
    const sourceSlotLockRef = refs.slotLocks.doc(
      agendaSlotLockDocumentId(sourceDoctorId, String(source.date), String(source.time))
    );
    const targetSlotLockRef = refs.slotLocks.doc(
      agendaSlotLockDocumentId(targetDoctorId, String(target.date), String(target.time))
    );
    const sourceResourceLockRef = source.resourceId
      ? refs.resourceLocks.doc(
          agendaResourceLockDocumentId(
            String(source.resourceId),
            String(source.date),
            String(source.time)
          )
        )
      : null;
    const targetResourceLockRef = target.resourceId
      ? refs.resourceLocks.doc(
          agendaResourceLockDocumentId(
            String(target.resourceId),
            String(target.date),
            String(target.time)
          )
        )
      : null;
    const lockRefs: FirebaseFirestore.DocumentReference[] = [sourceSlotLockRef, targetSlotLockRef];
    if (sourceResourceLockRef) lockRefs.push(sourceResourceLockRef);
    if (targetResourceLockRef) lockRefs.push(targetResourceLockRef);
    const lockSnapshots = await transaction.getAll(...lockRefs);
    const sourceSlotLock = lockSnapshots[0];
    const targetSlotLock = lockSnapshots[1];
    let lockSnapshotIndex = 2;
    const sourceResourceLock = sourceResourceLockRef ? lockSnapshots[lockSnapshotIndex++] : null;
    const targetResourceLock = targetResourceLockRef ? lockSnapshots[lockSnapshotIndex] : null;
    if (
      (targetSlotLock.exists && targetSlotLock.get("appointmentId") !== targetAppointmentId) ||
      (targetResourceLock?.exists &&
        targetResourceLock.get("appointmentId") !== targetAppointmentId)
    ) {
      return { success: false, error: "TARGET_TAKEN" };
    }

    transaction.update(sourceRef, {
      status: "cancelled",
      attendanceStatus: "cancelled",
      active: false,
      rescheduledToAppointmentId: targetAppointmentId,
      rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
      rescheduledBy: actor.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(targetRef, {
      status: "booked",
      active: true,
      patientId: source.patientId || null,
      patientName: source.patientName || "",
      patientRut: source.patientRut || "",
      patientPhone: source.patientPhone || "",
      patientEmail: source.patientEmail || "",
      type: source.type || "CONSULTATION",
      serviceId: source.serviceId || null,
      serviceName: source.serviceName || null,
      attendanceStatus: null,
      rescheduledFromAppointmentId: sourceAppointmentId,
      rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
      rescheduledBy: actor.uid,
      rebookingRequestId: requestId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    removeAppointmentFromLock(transaction, sourceSlotLock, sourceAppointmentId);
    if (sourceResourceLock) {
      removeAppointmentFromLock(transaction, sourceResourceLock, sourceAppointmentId);
    }
    transaction.set(
      targetSlotLockRef,
      {
        centerId,
        appointmentId: targetAppointmentId,
        appointmentIds: admin.firestore.FieldValue.arrayUnion(targetAppointmentId),
        doctorId: targetDoctorId,
        date: target.date,
        time: target.time,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    if (targetResourceLockRef) {
      transaction.set(
        targetResourceLockRef,
        {
          centerId,
          appointmentId: targetAppointmentId,
          appointmentIds: admin.firestore.FieldValue.arrayUnion(targetAppointmentId),
          resourceId: target.resourceId,
          date: target.date,
          time: target.time,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    transaction.create(auditRef, {
      centerId,
      actorUid: actor.uid,
      action: "APPOINTMENT_RESCHEDULED",
      entityType: "appointment",
      entityId: sourceAppointmentId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        targetAppointmentId,
        fromDate: source.date,
        fromTime: source.time,
        toDate: target.date,
        toTime: target.time,
        fromDoctorId: sourceDoctorId,
        toDoctorId: targetDoctorId,
      },
    });
    return { success: true, idempotent: false, targetAppointmentId };
  });
}

export const recordAppointmentContactAttempt = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  return recordAppointmentContactAttemptTransaction(data as ContactAttemptInput, { uid });
});

export const updateAppointmentReminderStatus = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  return updateAppointmentReminderStatusTransaction(data as AppointmentReminderStatusInput, {
    uid,
  });
});

export const rebookAdministrativeAppointment = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  return rebookAdministrativeAppointmentTransaction(data as RebookAppointmentInput, { uid });
});
