process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "clavesalud-2";

import * as admin from "firebase-admin";
import {
  AdministrativeBookingInput,
  bookAdministrativeAppointmentTransaction,
} from "../administrativeBooking";

const integration = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const db = admin.firestore();

integration("reserva administrativa transaccional", () => {
  jest.setTimeout(20000);
  let centerId = "";
  let appointmentRef: FirebaseFirestore.DocumentReference;

  const input = (requestId: string, patientId: string): AdministrativeBookingInput => ({
    centerId,
    appointmentId: "slot-0900",
    idempotencyKey: requestId,
    slot: { doctorId: "doctor-test", date: "2099-08-18", time: "09:00" },
    patient: {
      id: patientId,
      fullName: `Paciente ${patientId}`,
      rut: patientId === "patient-a" ? "11.111.111-1" : "22.222.222-2",
      phone: "+56911111111",
    },
  });

  beforeEach(async () => {
    centerId = `c_admin_booking_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    appointmentRef = db
      .collection("centers")
      .doc(centerId)
      .collection("appointments")
      .doc("slot-0900");
    await appointmentRef.set({
      centerId,
      doctorId: "doctor-test",
      date: "2099-08-18",
      time: "09:00",
      status: "available",
      active: true,
    });
    await db
      .collection("centers")
      .doc(centerId)
      .collection("staff")
      .doc("doctor-test")
      .set({
        active: true,
        agendaConfig: { startTime: "08:00", endTime: "18:00", slotDuration: 30 },
      });
  });

  afterEach(async () => {
    const centerRef = db.collection("centers").doc(centerId);
    const [appointments, audit, staff, policies, slotLocks, resourceLocks] = await Promise.all([
      centerRef.collection("appointments").get(),
      centerRef.collection("auditLogs").get(),
      centerRef.collection("staff").get(),
      centerRef.collection("agendaPolicies").get(),
      centerRef.collection("agendaSlotLocks").get(),
      centerRef.collection("agendaResourceLocks").get(),
    ]);
    await Promise.all([
      ...appointments.docs.map((document) => document.ref.delete()),
      ...audit.docs.map((document) => document.ref.delete()),
      ...staff.docs.map((document) => document.ref.delete()),
      ...policies.docs.map((document) => document.ref.delete()),
      ...slotLocks.docs.map((document) => document.ref.delete()),
      ...resourceLocks.docs.map((document) => document.ref.delete()),
    ]);
  });

  it("permite exactamente una de dos reservas simultáneas", async () => {
    const results = await Promise.all([
      bookAdministrativeAppointmentTransaction(input("request-concurrent-a", "patient-a"), {
        uid: "secretary-a",
        skipAuthorization: true,
      }),
      bookAdministrativeAppointmentTransaction(input("request-concurrent-b", "patient-b"), {
        uid: "secretary-b",
        skipAuthorization: true,
      }),
    ]);

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(
      results.filter((result) => !result.success && result.error === "SLOT_TAKEN")
    ).toHaveLength(1);
    expect(["patient-a", "patient-b"]).toContain((await appointmentRef.get()).data()?.patientId);
  });

  it("trata el reintento con la misma clave como idempotente", async () => {
    const request = input("request-idempotent-a", "patient-a");
    const first = await bookAdministrativeAppointmentTransaction(request, {
      uid: "secretary-a",
      skipAuthorization: true,
    });
    const retry = await bookAdministrativeAppointmentTransaction(request, {
      uid: "secretary-a",
      skipAuthorization: true,
    });

    expect(first).toMatchObject({ success: true, idempotent: false });
    expect(retry).toMatchObject({ success: true, idempotent: true });
    const audit = await db.collection("centers").doc(centerId).collection("auditLogs").get();
    expect(audit.size).toBe(1);
  });

  it("crea atómicamente una reserva cuando el bloque aún no existe", async () => {
    await appointmentRef.delete();
    const result = await bookAdministrativeAppointmentTransaction(
      input("request-direct-slot", "patient-a"),
      { uid: "secretary-a", skipAuthorization: true }
    );

    expect(result).toMatchObject({ success: true, idempotent: false });
    expect((await appointmentRef.get()).data()).toMatchObject({
      status: "booked",
      patientId: "patient-a",
      doctorId: "doctor-test",
    });
  });

  it("permite reservar a una secretaría activa del centro", async () => {
    await db.collection("centers").doc(centerId).collection("staff").doc("secretary-a").set({
      active: true,
      accessRole: "administrative",
    });

    await expect(
      bookAdministrativeAppointmentTransaction(input("request-secretary-a", "patient-a"), {
        uid: "secretary-a",
      })
    ).resolves.toMatchObject({ success: true, idempotent: false });
  });

  it("deniega la reserva administrativa a un profesional clínico sin capacidad", async () => {
    await db.collection("centers").doc(centerId).collection("staff").doc("doctor-a").set({
      active: true,
      accessRole: "professional",
      role: "MEDICO",
    });

    await expect(
      bookAdministrativeAppointmentTransaction(input("request-doctor-a", "patient-a"), {
        uid: "doctor-a",
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect((await appointmentRef.get()).data()?.status).toBe("available");
  });

  it("aplica contacto mínimo y no persiste una reserva rechazada", async () => {
    const request = input("request-without-contact", "patient-a");
    request.patient.phone = "";

    await expect(
      bookAdministrativeAppointmentTransaction(request, {
        uid: "secretary-a",
        skipAuthorization: true,
      })
    ).resolves.toEqual({ success: false, error: "CONTACT_REQUIRED" });
    expect((await appointmentRef.get()).data()?.status).toBe("available");
  });

  it("exige capacidad y motivo fuera de horario y audita la excepción", async () => {
    await appointmentRef.delete();
    const staffRef = db.collection("centers").doc(centerId).collection("staff").doc("secretary-a");
    await staffRef.set({
      active: true,
      accessRole: "administrative",
      capabilities: ["agenda.manage", "agenda.override"],
    });
    const request = input("request-outside-hours", "patient-a");
    request.slot.time = "20:00";

    await expect(
      bookAdministrativeAppointmentTransaction(request, { uid: "secretary-a" })
    ).resolves.toEqual({ success: false, error: "OVERRIDE_REQUIRED" });

    request.override = { reason: "Paciente derivado desde urgencia" };
    await expect(
      bookAdministrativeAppointmentTransaction(request, { uid: "secretary-a" })
    ).resolves.toMatchObject({ success: true, idempotent: false });

    const audit = await db.collection("centers").doc(centerId).collection("auditLogs").get();
    expect(audit.docs[0].data().metadata).toMatchObject({
      overrideApplied: true,
      overrideScope: "outside_hours",
      overrideReason: "Paciente derivado desde urgencia",
      policyRevision: 1,
      time: "20:00",
    });
  });

  it("bloquea un segundo documento sobre el mismo horario", async () => {
    await bookAdministrativeAppointmentTransaction(input("request-slot-first", "patient-a"), {
      uid: "secretary-a",
      skipAuthorization: true,
    });
    const second = input("request-slot-second", "patient-b");
    second.appointmentId = "slot-0900-duplicate";

    await expect(
      bookAdministrativeAppointmentTransaction(second, {
        uid: "secretary-b",
        skipAuthorization: true,
      })
    ).resolves.toEqual({ success: false, error: "APPOINTMENT_CONFLICT" });
    expect(
      (
        await db
          .collection("centers")
          .doc(centerId)
          .collection("appointments")
          .doc(second.appointmentId)
          .get()
      ).exists
    ).toBe(false);
  });

  it("exige excepción explícita y auditada ante un conflicto de recurso", async () => {
    const first = input("request-resource-first", "patient-a");
    first.slot.resourceId = "box-1";
    await bookAdministrativeAppointmentTransaction(first, {
      uid: "secretary-a",
      skipAuthorization: true,
    });

    const centerRef = db.collection("centers").doc(centerId);
    await Promise.all([
      centerRef.collection("agendaPolicies").doc("default").set({
        centerId,
        locationId: "default",
        resourceConflictMode: "require_override",
        appointmentConflictMode: "block",
        revision: 4,
      }),
      centerRef
        .collection("staff")
        .doc("doctor-other")
        .set({
          active: true,
          agendaConfig: { startTime: "08:00", endTime: "18:00", slotDuration: 30 },
        }),
      centerRef
        .collection("staff")
        .doc("secretary-resource")
        .set({
          active: true,
          accessRole: "administrative",
          capabilities: ["agenda.manage", "agenda.override"],
        }),
    ]);

    const second = input("request-resource-second", "patient-b");
    second.appointmentId = "slot-resource-other-doctor";
    second.slot.doctorId = "doctor-other";
    second.slot.resourceId = "box-1";

    await expect(
      bookAdministrativeAppointmentTransaction(second, { uid: "secretary-resource" })
    ).resolves.toEqual({ success: false, error: "OVERRIDE_REQUIRED" });

    second.override = { reason: "Box autorizado por coordinación clínica" };
    await expect(
      bookAdministrativeAppointmentTransaction(second, { uid: "secretary-resource" })
    ).resolves.toMatchObject({ success: true, idempotent: false });

    const audit = await centerRef.collection("auditLogs").get();
    const overrideAudit = audit.docs.find(
      (document) => document.data().metadata?.overrideScope === "resource"
    );
    expect(overrideAudit?.data().metadata).toMatchObject({
      overrideApplied: true,
      overrideScope: "resource",
      overrideReason: "Box autorizado por coordinación clínica",
      policyRevision: 4,
      resourceId: "box-1",
      date: "2099-08-18",
      time: "09:00",
    });
  });
});
