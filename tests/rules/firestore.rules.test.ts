// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "clavesalud-rules-test";
const ACTIVE_CENTER_ID = "c_active_rules";
const INACTIVE_CENTER_ID = "c_inactive_rules";
const OWNER_UID = "doctor_owner";
const ALLOWED_UID = "doctor_allowed";

let testEnv: RulesTestEnvironment;
const NOW = new Date("2026-03-30T00:00:00.000Z");

async function seedFirestore() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as any;

    await db.doc(`centers/${ACTIVE_CENTER_ID}`).set({
      id: ACTIVE_CENTER_ID,
      name: "Centro Activo",
      slug: "centro-activo",
      active: true,
      isActive: true,
      accessMode: "CENTER_WIDE",
    });

    await db.doc(`centers/${INACTIVE_CENTER_ID}`).set({
      id: INACTIVE_CENTER_ID,
      name: "Centro Inactivo",
      slug: "centro-inactivo",
      active: false,
      isActive: false,
      accessMode: "CENTER_WIDE",
    });

    await db.doc(`centers/${ACTIVE_CENTER_ID}/staff/${OWNER_UID}`).set({
      active: true,
      accessRole: "doctor",
      role: "doctor",
    });

    await db.doc(`centers/${ACTIVE_CENTER_ID}/staff/${ALLOWED_UID}`).set({
      active: true,
      accessRole: "doctor",
      role: "doctor",
    });

    await db.doc(`centers/${ACTIVE_CENTER_ID}/services/svc_public`).set({
      id: "svc_public",
      name: "Servicio Público",
      active: true,
      isActive: true,
    });

    await db.doc(`centers/${INACTIVE_CENTER_ID}/services/svc_hidden`).set({
      id: "svc_hidden",
      name: "Servicio Oculto",
      active: true,
      isActive: true,
    });

    await db.doc(`centers/${ACTIVE_CENTER_ID}/appointments/appt_public`).set({
      id: "appt_public",
      centerId: ACTIVE_CENTER_ID,
      doctorId: OWNER_UID,
      doctorUid: OWNER_UID,
      date: "2026-04-02",
      time: "09:00",
      status: "available",
      patientName: "",
      patientRut: "",
      patientPhone: "",
      active: true,
      createdAt: NOW,
    });

    await db.doc("patients/p_acl").set({
      id: "p_acl",
      centerId: ACTIVE_CENTER_ID,
      ownerUid: OWNER_UID,
      accessControl: {
        allowedUids: [OWNER_UID, ALLOWED_UID],
        centerIds: [ACTIVE_CENTER_ID],
      },
      rut: "11.111.111-1",
      fullName: "Paciente ACL",
      birthDate: "1990-01-01",
      gender: "Otro",
      phone: "+56911111111",
      medicalHistory: [],
      surgicalHistory: [],
      smokingStatus: "No fumador",
      alcoholStatus: "No consumo",
      medications: [],
      allergies: [],
      consultations: [],
      attachments: [],
      active: true,
      lastUpdated: "2026-03-29T00:00:00.000Z",
      createdAt: NOW,
    });

    await db.doc("patients/p_acl/consultations/c_root").set({
      id: "c_root",
      patientId: "p_acl",
      centerId: ACTIVE_CENTER_ID,
      date: "2026-03-29",
      reason: "Control",
      anamnesis: "",
      physicalExam: "",
      diagnosis: "",
      prescriptions: [],
      professionalName: "Dr. Owner",
      professionalId: OWNER_UID,
      professionalRole: "MEDICO",
      professionalRut: "11.111.111-1",
      active: true,
      createdAt: NOW,
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore Rules - hardening P0/P1", () => {
  it("permite al owner actualizar campos clínicos no ACL", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore() as any;
    const patientRef = db.doc("patients/p_acl");

    await assertSucceeds(
      patientRef.update({
        fullName: "Paciente Actualizado",
        lastUpdated: "2026-03-30T00:00:00.000Z",
      })
    );
  });

  it("deniega al owner modificar accessControl del paciente root", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore() as any;
    const patientRef = db.doc("patients/p_acl");

    await assertFails(
      patientRef.update({
        accessControl: {
          allowedUids: [OWNER_UID],
          centerIds: [ACTIVE_CENTER_ID, "otro-centro"],
        },
      })
    );
  });

  it("deniega a un profesional permitido modificar ownerUid", async () => {
    const db = testEnv.authenticatedContext(ALLOWED_UID).firestore() as any;
    const patientRef = db.doc("patients/p_acl");

    await assertFails(
      patientRef.update({
        ownerUid: ALLOWED_UID,
      })
    );
  });

  it("deniega delete físico del paciente root", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore() as any;
    await assertFails(db.doc("patients/p_acl").delete());
  });

  it("deniega archivado root sin retentionUntil", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore() as any;

    await assertFails(
      db.doc("patients/p_acl").update({
        active: false,
        deletedAt: NOW,
        deletedBy: OWNER_UID,
        deleteReason: "Archivo incompleto",
      })
    );
  });

  it("permite archivado root con retentionUntil", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore() as any;
    const retentionUntil = new Date("2041-03-30T00:00:00.000Z");

    await assertSucceeds(
      db.doc("patients/p_acl").update({
        active: false,
        deletedAt: NOW,
        deletedBy: OWNER_UID,
        deleteReason: "Archivo clínico",
        retentionUntil,
      })
    );
  });

  it("deniega delete físico de consultations root", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore() as any;
    await assertFails(db.doc("patients/p_acl/consultations/c_root").delete());
  });

  it("permite listado público de services solo en centro activo", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore() as any;

    await assertSucceeds(
      anonDb
        .collection(`centers/${ACTIVE_CENTER_ID}/services`)
        .where("active", "==", true)
        .get()
    );
    await assertFails(
      anonDb
        .collection(`centers/${INACTIVE_CENTER_ID}/services`)
        .where("active", "==", true)
        .get()
    );
  });

  it("deniega booking pÃºblico directo sobre appointments", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore() as any;

    await assertFails(
      anonDb.doc(`centers/${ACTIVE_CENTER_ID}/appointments/appt_public`).update({
        centerId: ACTIVE_CENTER_ID,
        doctorId: OWNER_UID,
        doctorUid: OWNER_UID,
        date: "2026-04-02",
        time: "09:00",
        status: "booked",
        patientName: "Paciente PÃºblico",
        patientRut: "12.345.678-5",
        patientPhone: "+56912345678",
        patientId: "p_123456785",
      })
    );
  });

  it("permite crear preadmission pública válida", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore() as any;

    await assertSucceeds(
      anonDb.doc(`centers/${ACTIVE_CENTER_ID}/preadmissions/pre_public_ok`).set({
        id: "pre_public_ok",
        centerId: ACTIVE_CENTER_ID,
        status: "pending",
        source: "public",
        createdAt: NOW,
        contact: {
          name: "Paciente Público",
          rut: "12.345.678-5",
          phone: "+56912345678",
          email: "paciente@test.cl",
        },
      })
    );
  });

  it("deniega preadmission pública con campos extra", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore() as any;

    await assertFails(
      anonDb.doc(`centers/${ACTIVE_CENTER_ID}/preadmissions/pre_extra`).set({
        id: "pre_extra",
        centerId: ACTIVE_CENTER_ID,
        status: "pending",
        source: "public",
        createdAt: NOW,
        contact: {
          name: "Paciente Público",
          rut: "12.345.678-5",
          phone: "+56912345678",
        },
        debugBypass: true,
      })
    );
  });

  it("deniega preadmission anónima con source staff", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore() as any;

    await assertFails(
      anonDb.doc(`centers/${ACTIVE_CENTER_ID}/preadmissions/pre_staff`).set({
        id: "pre_staff",
        centerId: ACTIVE_CENTER_ID,
        status: "pending",
        source: "staff",
        createdAt: NOW,
        contact: {
          name: "Paciente Público",
          rut: "12.345.678-5",
          phone: "+56912345678",
        },
      })
    );
  });
});
