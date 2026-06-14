// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "clavesalud-rules-test";
const CENTER_A = "centerA";
const CENTER_B = "centerB";

let testEnv: RulesTestEnvironment;

function authedDb(uid: string, email = `${uid}@example.test`, claims: Record<string, unknown> = {}) {
  return testEnv.authenticatedContext(uid, { email, ...claims }).firestore();
}

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "centers", CENTER_A), {
      id: CENTER_A,
      name: "Centro A",
      isActive: true,
      accessMode: "CARE_TEAM",
    });
    await setDoc(doc(db, "centers", CENTER_B), {
      id: CENTER_B,
      name: "Centro B",
      isActive: true,
      accessMode: "CARE_TEAM",
    });

    await setDoc(doc(db, "centers", CENTER_A, "staff", "adminA"), {
      active: true,
      accessRole: "center_admin",
      role: "center_admin",
      clinicalRole: "",
      email: "admin@example.test",
    });
    await setDoc(doc(db, "centers", CENTER_A, "staff", "secretaryA"), {
      active: true,
      accessRole: "administrative",
      role: "administrative",
      clinicalRole: "administrative",
      email: "secretary@example.test",
    });
    await setDoc(doc(db, "centers", CENTER_A, "staff", "doctorA"), {
      active: true,
      accessRole: "professional",
      role: "professional",
      clinicalRole: "medico",
      email: "doctor@example.test",
    });
    await setDoc(doc(db, "centers", CENTER_B, "staff", "doctorB"), {
      active: true,
      accessRole: "professional",
      role: "professional",
      clinicalRole: "medico",
      email: "doctor-b@example.test",
    });

    await setDoc(doc(db, "centers", CENTER_A, "patients", "patientA"), {
      id: "patientA",
      centerId: CENTER_A,
      fullName: "Paciente A",
      careTeamUids: ["doctorA"],
      accessControl: { centerIds: [CENTER_A], allowedUids: ["doctorA"] },
      active: true,
    });
    await setDoc(doc(db, "centers", CENTER_B, "patients", "patientB"), {
      id: "patientB",
      centerId: CENTER_B,
      fullName: "Paciente B",
      careTeamUids: ["doctorB"],
      accessControl: { centerIds: [CENTER_B], allowedUids: ["doctorB"] },
      active: true,
    });
    await setDoc(doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "consultA"), {
      centerId: CENTER_A,
      patientId: "patientA",
      professionalId: "doctorA",
      professionalName: "Doctor A",
      professionalRole: "medico",
      evolution: "Evolucion clinica privada",
      prescriptions: [],
      prescriptionTypes: [],
      hasControlledPrescription: false,
    });
    await setDoc(doc(db, "centers", CENTER_A, "appointments", "openAppt"), {
      centerId: CENTER_A,
      status: "booked",
      date: "2026-06-10",
      time: "10:00",
      doctorUid: "doctorA",
      patientId: "patientA",
      patientName: "Paciente A",
      attendanceStatus: "pending",
      billable: false,
      amount: 0,
    });
    await setDoc(doc(db, "centers", CENTER_A, "appointments", "closedAppt"), {
      centerId: CENTER_A,
      status: "booked",
      date: "2026-05-10",
      time: "10:00",
      doctorUid: "doctorA",
      patientId: "patientA",
      patientName: "Paciente A",
      attendanceStatus: "pending",
      billable: false,
      amount: 0,
    });
    await setDoc(doc(db, "centers", CENTER_A, "closures_month", "2026-05"), {
      status: "closed",
      closedAt: new Date("2026-06-01T00:00:00.000Z"),
    });
  });
}

describe("Firestore security rules - pilot RBAC", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedBaseData();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("prevents a professional from reading another center patient by changing ids", async () => {
    const db = authedDb("doctorA");
    await assertFails(getDoc(doc(db, "centers", CENTER_B, "patients", "patientB")));
  });

  it("allows a care-team professional to read their patient and consultation", async () => {
    const db = authedDb("doctorA");
    await assertSucceeds(getDoc(doc(db, "centers", CENTER_A, "patients", "patientA")));
    await assertSucceeds(
      getDoc(doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "consultA"))
    );
  });

  it("blocks administrative staff from reading clinical consultations in CARE_TEAM mode", async () => {
    const db = authedDb("secretaryA");
    await assertFails(
      getDoc(doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "consultA"))
    );
  });

  it("blocks a non-clinical center admin from editing clinical evolution", async () => {
    const db = authedDb("adminA");
    await assertFails(
      updateDoc(doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "consultA"), {
        evolution: "Cambio no clinico",
      })
    );
  });

  it("blocks appointment changes in a closed month", async () => {
    const db = authedDb("secretaryA");
    await assertFails(
      updateDoc(doc(db, "centers", CENTER_A, "appointments", "closedAppt"), {
        patientName: "Cambio bloqueado",
      })
    );
  });

  it("allows administrative staff to update agenda data in an open month", async () => {
    const db = authedDb("secretaryA");
    await assertSucceeds(
      updateDoc(doc(db, "centers", CENTER_A, "appointments", "openAppt"), {
        patientName: "Paciente Actualizado",
      })
    );
  });

  it("allows super admin to read audit logs but blocks client writes", async () => {
    const superDb = authedDb("superAdmin", "super@example.test", { super_admin: true });
    await assertSucceeds(getDoc(doc(superDb, "centers", CENTER_A, "auditLogs", "missing-ok")));
    await assertFails(
      setDoc(doc(superDb, "centers", CENTER_A, "auditLogs", "manual"), {
        action: "manual",
      })
    );
  });

  it("keeps root patients clinical-only and blocks administrative reads", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "patients", "rootPatientA"), {
        centerId: CENTER_A,
        fullName: "Root Paciente A",
        accessControl: { centerIds: [CENTER_A], allowedUids: ["doctorA"] },
        careTeamUids: ["doctorA"],
      });
    });

    await assertSucceeds(getDoc(doc(authedDb("doctorA"), "patients", "rootPatientA")));
    await assertFails(getDoc(doc(authedDb("secretaryA"), "patients", "rootPatientA")));
  });

  it("blocks a non-clinical center admin from reading clinical consultations", async () => {
    const db = authedDb("adminA");
    await expect(
      getDoc(doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "consultA"))
    ).rejects.toThrow();
  });
});
