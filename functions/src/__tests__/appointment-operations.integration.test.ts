process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "clavesalud-2";

import * as admin from "firebase-admin";
import {
  updateAppointmentArrivalTransaction,
  updateAppointmentOperationalAttendanceTransaction,
} from "../appointmentOperations";
import { updateAppointmentReminderStatusTransaction } from "../appointmentAdministrativeActions";

const integration = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const db = admin.firestore();

integration("operaciones administrativas de llegada y asistencia", () => {
  jest.setTimeout(60000);
  let centerId = "";
  let appointmentRef: FirebaseFirestore.DocumentReference;
  let staffRef: FirebaseFirestore.CollectionReference;

  beforeEach(async () => {
    centerId = `c_operations_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const centerRef = db.collection("centers").doc(centerId);
    appointmentRef = centerRef.collection("appointments").doc("appointment-1");
    staffRef = centerRef.collection("staff");
    await appointmentRef.set({
      centerId,
      doctorId: "doctor-1",
      date: "2099-08-18",
      time: "09:00",
      status: "booked",
      active: true,
      billable: true,
      amount: 25000,
    });
  });

  afterEach(async () => {
    const centerRef = db.collection("centers").doc(centerId);
    const [staff, audit] = await Promise.all([
      staffRef.get(),
      centerRef.collection("auditLogs").get(),
    ]);
    await Promise.all([
      appointmentRef.delete(),
      ...staff.docs.map((document) => document.ref.delete()),
      ...audit.docs.map((document) => document.ref.delete()),
    ]);
  });

  it("permite a secretaría registrar llegada con auditoría idempotente", async () => {
    await staffRef.doc("secretary-1").set({ active: true, accessRole: "administrative" });
    const input = {
      centerId,
      appointmentId: appointmentRef.id,
      requestId: "arrival-request-0001",
      arrived: true,
    };

    await expect(
      updateAppointmentArrivalTransaction(input, { uid: "secretary-1" })
    ).resolves.toEqual({ success: true, idempotent: false });
    await expect(
      updateAppointmentArrivalTransaction(input, { uid: "secretary-1" })
    ).resolves.toEqual({ success: true, idempotent: true });
    expect((await appointmentRef.get()).data()).toMatchObject({
      arrivalStatus: "arrived",
      arrivedBy: "secretary-1",
    });
    expect((await db.collection("centers").doc(centerId).collection("auditLogs").get()).size).toBe(
      1
    );
  });

  it("registra asistencia sin modificar cobro ni monto", async () => {
    await staffRef.doc("reception-1").set({
      active: true,
      accessRole: "administrative",
      capabilities: ["agenda.attendance"],
    });

    await updateAppointmentOperationalAttendanceTransaction(
      {
        centerId,
        appointmentId: appointmentRef.id,
        requestId: "attendance-request-01",
        attendanceStatus: "completed",
      },
      { uid: "reception-1" }
    );

    expect((await appointmentRef.get()).data()).toMatchObject({
      attendanceStatus: "completed",
      attendanceUpdatedBy: "reception-1",
      billable: true,
      amount: 25000,
    });
  });

  it("registra recordatorio y confirmación sin enviar mensajes", async () => {
    await staffRef.doc("secretary-reminder").set({
      active: true,
      accessRole: "administrative",
      capabilities: ["agenda.contact"],
    });

    await updateAppointmentReminderStatusTransaction(
      {
        centerId,
        appointmentId: appointmentRef.id,
        requestId: "reminder-sent-request-01",
        status: "sent",
        channel: "whatsapp",
      },
      { uid: "secretary-reminder" }
    );
    await updateAppointmentReminderStatusTransaction(
      {
        centerId,
        appointmentId: appointmentRef.id,
        requestId: "reminder-confirm-request-01",
        status: "confirmed",
      },
      { uid: "secretary-reminder" }
    );

    expect((await appointmentRef.get()).data()).toMatchObject({
      reminderStatus: "sent",
      reminderChannel: "whatsapp",
      confirmationStatus: "confirmed",
      confirmationUpdatedBy: "secretary-reminder",
    });
    expect((await db.collection("centers").doc(centerId).collection("auditLogs").get()).size).toBe(
      2
    );
  });

  it("deniega a un profesional clínico y a una membresía con capacidades vacías", async () => {
    await Promise.all([
      staffRef.doc("doctor-1").set({ active: true, accessRole: "professional", role: "MEDICO" }),
      staffRef
        .doc("restricted-admin")
        .set({ active: true, accessRole: "center_admin", capabilities: [] }),
    ]);
    const input = {
      centerId,
      appointmentId: appointmentRef.id,
      requestId: "arrival-request-denied",
      arrived: true,
    };

    await expect(
      updateAppointmentArrivalTransaction(input, { uid: "doctor-1" })
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      updateAppointmentArrivalTransaction(input, { uid: "restricted-admin" })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect((await appointmentRef.get()).data()?.arrivalStatus).toBeUndefined();
  });
});
