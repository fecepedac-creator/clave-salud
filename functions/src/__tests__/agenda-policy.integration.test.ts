process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "clavesalud-2";

import * as admin from "firebase-admin";
import { updateAgendaPolicyTransaction } from "../agendaPolicy";

const integration = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const db = admin.firestore();

integration("agenda policy persistence", () => {
  jest.setTimeout(60000);
  let centerId = "";

  beforeEach(async () => {
    centerId = `c_agenda_policy_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const centerRef = db.collection("centers").doc(centerId);
    await Promise.all([
      centerRef
        .collection("staff")
        .doc("admin-a")
        .set({
          active: true,
          accessRole: "center_admin",
          capabilities: ["center.configure"],
        }),
      centerRef.collection("staff").doc("admin-denied").set({
        active: true,
        accessRole: "center_admin",
        capabilities: [],
      }),
      centerRef.collection("agendaPolicies").doc("default").set({
        centerId,
        locationId: "default",
        appointmentConflictMode: "block",
        resourceConflictMode: "block",
        revision: 1,
      }),
      centerRef.collection("appointments").doc("future-booking").set({
        centerId,
        doctorId: "doctor-a",
        date: "2099-09-01",
        time: "10:00",
        status: "booked",
        active: true,
        patientId: "patient-a",
      }),
    ]);
  });

  afterEach(async () => {
    const centerRef = db.collection("centers").doc(centerId);
    const collections = await Promise.all(
      ["staff", "agendaPolicies", "appointments", "auditLogs"].map((name) =>
        centerRef.collection(name).get()
      )
    );
    await Promise.all(
      collections.flatMap((snapshot) => snapshot.docs.map((document) => document.ref.delete()))
    );
  });

  it("updates once, audits once and leaves future reservations untouched", async () => {
    const input = {
      centerId,
      locationId: "default",
      requestId: "request-policy-update-a",
      policy: { appointmentConflictMode: "require_override" },
    };

    const first = await updateAgendaPolicyTransaction(input, "admin-a");
    const retry = await updateAgendaPolicyTransaction(input, "admin-a");

    expect(first).toMatchObject({ revision: 2, appointmentConflictMode: "require_override" });
    expect(retry).toEqual(first);
    const centerRef = db.collection("centers").doc(centerId);
    expect((await centerRef.collection("auditLogs").get()).size).toBe(1);
    expect((await centerRef.collection("appointments").doc("future-booking").get()).data()).toEqual(
      expect.objectContaining({
        status: "booked",
        patientId: "patient-a",
        date: "2099-09-01",
        time: "10:00",
      })
    );
  });

  it("denies a center admin whose explicit capability list is empty", async () => {
    await expect(
      updateAgendaPolicyTransaction(
        {
          centerId,
          locationId: "default",
          requestId: "request-policy-denied-a",
          policy: { allowInternalOutsideHours: true },
        },
        "admin-denied"
      )
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(
      (
        await db
          .collection("centers")
          .doc(centerId)
          .collection("agendaPolicies")
          .doc("default")
          .get()
      ).data()?.revision
    ).toBe(1);
  });
});
