process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "clavesalud-2";

import * as admin from "firebase-admin";
import {
  recordAppointmentContactAttemptTransaction,
  rebookAdministrativeAppointmentTransaction,
} from "../appointmentAdministrativeActions";

const integration = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const db = admin.firestore();

integration("administrative appointment actions", () => {
  jest.setTimeout(60000);
  let centerId = "";

  const centerRef = () => db.collection("centers").doc(centerId);
  const appointment = (id: string) => centerRef().collection("appointments").doc(id);

  beforeEach(async () => {
    centerId = `c_admin_actions_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await Promise.all([
      centerRef()
        .collection("staff")
        .doc("secretary-a")
        .set({
          active: true,
          accessRole: "administrative",
          capabilities: ["agenda.contact", "agenda.rebook"],
        }),
      centerRef().collection("staff").doc("doctor-a").set({
        active: true,
        accessRole: "professional",
        capabilities: [],
      }),
      appointment("source-a").set({
        centerId,
        doctorId: "doctor-a",
        date: "2099-10-01",
        time: "09:00",
        status: "booked",
        active: true,
        patientId: "patient-a",
        patientName: "Paciente Uno",
        patientRut: "11.111.111-1",
        patientPhone: "+56911111111",
        attendanceStatus: null,
        billable: false,
        amount: null,
      }),
      appointment("source-b").set({
        centerId,
        doctorId: "doctor-b",
        date: "2099-10-01",
        time: "09:30",
        status: "booked",
        active: true,
        patientId: "patient-b",
        patientName: "Paciente Dos",
        patientRut: "22.222.222-2",
        patientPhone: "+56922222222",
        attendanceStatus: null,
        billable: false,
        amount: null,
      }),
      appointment("target-a").set({
        centerId,
        doctorId: "doctor-c",
        date: "2099-10-02",
        time: "10:00",
        status: "available",
        active: true,
        patientName: "",
        patientRut: "",
        billable: false,
        amount: null,
      }),
    ]);
  });

  afterEach(async () => {
    const collections = await Promise.all(
      ["staff", "appointments", "auditLogs", "agendaSlotLocks", "agendaResourceLocks"].map((name) =>
        centerRef().collection(name).get()
      )
    );
    await Promise.all(
      collections.flatMap((snapshot) => snapshot.docs.map((document) => document.ref.delete()))
    );
  });

  it("records an idempotent contact attempt without PII in the audit", async () => {
    const input = {
      centerId,
      appointmentId: "source-a",
      requestId: "request-contact-call-a",
      channel: "call" as const,
    };
    const first = await recordAppointmentContactAttemptTransaction(input, {
      uid: "secretary-a",
    });
    const retry = await recordAppointmentContactAttemptTransaction(input, {
      uid: "secretary-a",
    });

    expect(first).toEqual({ success: true, idempotent: false });
    expect(retry).toEqual({ success: true, idempotent: true });
    const audit = await centerRef().collection("auditLogs").get();
    expect(audit.size).toBe(1);
    const serialized = JSON.stringify(audit.docs[0].data());
    expect(serialized).not.toContain("Paciente Uno");
    expect(serialized).not.toContain("11.111.111-1");
    expect(serialized).not.toContain("+56911111111");
  });

  it("denies contact and rebooking to a clinical professional without capabilities", async () => {
    await expect(
      recordAppointmentContactAttemptTransaction(
        {
          centerId,
          appointmentId: "source-a",
          requestId: "request-contact-denied-a",
          channel: "whatsapp",
        },
        { uid: "doctor-a" }
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      rebookAdministrativeAppointmentTransaction(
        {
          centerId,
          sourceAppointmentId: "source-a",
          targetAppointmentId: "target-a",
          requestId: "request-rebook-denied-a",
        },
        { uid: "doctor-a" }
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("moves a reservation atomically and keeps financial fields untouched", async () => {
    const input = {
      centerId,
      sourceAppointmentId: "source-a",
      targetAppointmentId: "target-a",
      requestId: "request-rebook-success-a",
    };
    const first = await rebookAdministrativeAppointmentTransaction(input, {
      uid: "secretary-a",
    });
    const retry = await rebookAdministrativeAppointmentTransaction(input, {
      uid: "secretary-a",
    });

    expect(first).toMatchObject({ success: true, idempotent: false });
    expect(retry).toMatchObject({ success: true, idempotent: true });
    expect((await appointment("source-a").get()).data()).toMatchObject({
      status: "cancelled",
      active: false,
      billable: false,
      amount: null,
      rescheduledToAppointmentId: "target-a",
    });
    expect((await appointment("target-a").get()).data()).toMatchObject({
      status: "booked",
      patientId: "patient-a",
      billable: false,
      amount: null,
      rescheduledFromAppointmentId: "source-a",
    });
    expect((await centerRef().collection("auditLogs").get()).size).toBe(1);
  });

  it("allows exactly one of two concurrent moves to the same target", async () => {
    const results = await Promise.all([
      rebookAdministrativeAppointmentTransaction(
        {
          centerId,
          sourceAppointmentId: "source-a",
          targetAppointmentId: "target-a",
          requestId: "request-rebook-concurrent-a",
        },
        { uid: "secretary-a" }
      ),
      rebookAdministrativeAppointmentTransaction(
        {
          centerId,
          sourceAppointmentId: "source-b",
          targetAppointmentId: "target-a",
          requestId: "request-rebook-concurrent-b",
        },
        { uid: "secretary-a" }
      ),
    ]);

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(
      results.filter((result) => !result.success && result.error === "TARGET_TAKEN")
    ).toHaveLength(1);
    expect(["patient-a", "patient-b"]).toContain(
      (await appointment("target-a").get()).data()?.patientId
    );
  });
});
