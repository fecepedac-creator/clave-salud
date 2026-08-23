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
  });

  afterEach(async () => {
    const centerRef = db.collection("centers").doc(centerId);
    const [audit, staff] = await Promise.all([
      centerRef.collection("auditLogs").get(),
      centerRef.collection("staff").get(),
    ]);
    await Promise.all([
      appointmentRef.delete(),
      ...audit.docs.map(document => document.ref.delete()),
      ...staff.docs.map(document => document.ref.delete()),
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

    expect(results.filter(result => result.success)).toHaveLength(1);
    expect(results.filter(result => !result.success && result.error === "SLOT_TAKEN")).toHaveLength(
      1
    );
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
});
