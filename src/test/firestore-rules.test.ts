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

function authedDb(
  uid: string,
  email = `${uid}@example.test`,
  claims: Record<string, unknown> = {}
) {
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
    await setDoc(doc(db, "centers", CENTER_A, "staff", "auditorA"), {
      active: true,
      accessRole: "auditor",
      role: "auditor",
      clinicalRole: "",
      capabilities: ["audit.read"],
      email: "auditor@example.test",
    });
    await setDoc(doc(db, "centers", CENTER_A, "staff", "auditorWithoutCapability"), {
      active: true,
      accessRole: "auditor",
      role: "auditor",
      clinicalRole: "",
      capabilities: [],
      email: "auditor-no-capability@example.test",
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
    await setDoc(doc(db, "centers", CENTER_A, "patientDirectory", "patientA"), {
      id: "patientA",
      patientId: "patientA",
      centerId: CENTER_A,
      entityType: "patient_directory_entry",
      fullName: "Paciente A",
      rut: "12.345.678-9",
      active: true,
      directoryVersion: 1,
    });
    await setDoc(doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "consultA"), {
      centerId: CENTER_A,
      patientId: "patientA",
      professionalId: "doctorA",
      professionalName: "Doctor A",
      professionalRole: "medico",
      professionalRut: "1-9",
      evolution: "Evolucion clinica privada",
      prescriptions: [],
      prescriptionTypes: [],
      hasControlledPrescription: false,
    });
    await setDoc(
      doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "signedConsultA"),
      {
        centerId: CENTER_A,
        patientId: "patientA",
        professionalId: "doctorA",
        professionalName: "Doctor A",
        professionalRole: "medico",
        professionalRut: "1-9",
        authorUid: "doctorA",
        recordStatus: "signed",
        revision: 2,
        diagnosis: "Registro firmado",
        prescriptions: [],
        prescriptionTypes: [],
        hasControlledPrescription: false,
      }
    );
    await setDoc(
      doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "draftConsultA"),
      {
        centerId: CENTER_A,
        patientId: "patientA",
        professionalId: "doctorA",
        professionalName: "Doctor A",
        professionalRole: "medico",
        professionalRut: "1-9",
        authorUid: "doctorA",
        recordStatus: "draft",
        revision: 1,
        diagnosis: "Borrador de servidor",
        prescriptions: [],
        prescriptionTypes: [],
        hasControlledPrescription: false,
      }
    );
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

  const agendaResource = (overrides: Record<string, unknown> = {}) => ({
    id: "roomA",
    centerId: CENTER_A,
    entityType: "agenda_resource",
    resourceType: "room",
    displayName: "Sala de procedimientos",
    description: "Sala 1",
    agendaConfig: { slotDuration: 30, startTime: "08:00", endTime: "18:00" },
    visibleInBooking: false,
    active: true,
    createdAt: new Date("2026-08-23T10:00:00.000Z"),
    updatedAt: new Date("2026-08-23T10:00:00.000Z"),
    ...overrides,
  });

  it("allows a center admin to manage a valid agenda resource", async () => {
    const adminDb = authedDb("adminA", "admin@example.test");
    const resourceRef = doc(adminDb, "centers", CENTER_A, "agendaResources", "roomA");

    await assertSucceeds(setDoc(resourceRef, agendaResource()));
    await assertSucceeds(getDoc(resourceRef));
    await assertSucceeds(
      updateDoc(resourceRef, {
        description: "Sala habilitada",
        updatedAt: new Date("2026-08-23T10:05:00.000Z"),
      })
    );
  });

  it("rejects identity or clinical fields in an agenda resource", async () => {
    const adminDb = authedDb("adminA", "admin@example.test");
    const resourceRef = doc(adminDb, "centers", CENTER_A, "agendaResources", "roomA");

    await assertFails(
      setDoc(
        resourceRef,
        agendaResource({
          role: "MEDICO",
          email: "resource@example.test",
          capabilities: ["clinical_record.read"],
        })
      )
    );
  });

  it("rejects resource writes from administrative and professional staff", async () => {
    const secretaryDb = authedDb("secretaryA");
    const doctorDb = authedDb("doctorA");

    await assertFails(
      setDoc(doc(secretaryDb, "centers", CENTER_A, "agendaResources", "roomA"), agendaResource())
    );
    await assertFails(
      setDoc(doc(doctorDb, "centers", CENTER_A, "agendaResources", "roomA"), agendaResource())
    );
  });

  it("prevents staff from reading agenda resources in another center", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "centers", CENTER_A, "agendaResources", "roomA"),
        agendaResource()
      );
    });

    await assertSucceeds(
      getDoc(doc(authedDb("doctorA"), "centers", CENTER_A, "agendaResources", "roomA"))
    );
    await assertFails(
      getDoc(doc(authedDb("doctorB"), "centers", CENTER_A, "agendaResources", "roomA"))
    );
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

  it("blocks direct creation of a lifecycle document from the client", async () => {
    const db = authedDb("doctorA");
    await assertFails(
      setDoc(
        doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "clientDraft"),
        {
          centerId: CENTER_A,
          patientId: "patientA",
          professionalId: "doctorA",
          professionalName: "Doctor A",
          professionalRole: "medico",
          professionalRut: "1-9",
          authorUid: "doctorA",
          recordStatus: "draft",
          revision: 1,
          prescriptions: [],
          prescriptionTypes: [],
          hasControlledPrescription: false,
        }
      )
    );
  });

  it("blocks direct modification of a signed clinical record", async () => {
    await assertFails(
      updateDoc(
        doc(
          authedDb("doctorA"),
          "centers",
          CENTER_A,
          "patients",
          "patientA",
          "consultations",
          "signedConsultA"
        ),
        { diagnosis: "Intento de sobrescritura" }
      )
    );
  });

  it("blocks direct draft edits so they cannot bypass server audit", async () => {
    await assertFails(
      updateDoc(
        doc(
          authedDb("doctorA"),
          "centers",
          CENTER_A,
          "patients",
          "patientA",
          "consultations",
          "draftConsultA"
        ),
        { diagnosis: "Cambio directo no auditado" }
      )
    );
  });

  it("preserves direct updates for legacy consultations during migration", async () => {
    await assertSucceeds(
      updateDoc(
        doc(
          authedDb("doctorA"),
          "centers",
          CENTER_A,
          "patients",
          "patientA",
          "consultations",
          "consultA"
        ),
        { evolution: "Evolución legacy actualizada" }
      )
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

  it("blocks global super admin audit access without scoped center membership", async () => {
    const superDb = authedDb("superAdmin", "super@example.test", { super_admin: true });
    await assertFails(getDoc(doc(superDb, "centers", CENTER_A, "auditLogs", "missing")));
    await assertFails(
      setDoc(doc(superDb, "centers", CENTER_A, "auditLogs", "manual"), {
        action: "manual",
      })
    );
  });

  it("allows only center-scoped audit readers and keeps writes server-only", async () => {
    const adminDb = authedDb("adminA", "admin@example.test");
    const auditorDb = authedDb("auditorA", "auditor@example.test");
    const auditorWithoutCapabilityDb = authedDb("auditorWithoutCapability");
    const otherCenterDb = authedDb("doctorB");

    await assertSucceeds(getDoc(doc(adminDb, "centers", CENTER_A, "auditLogs", "missing")));
    await assertSucceeds(getDoc(doc(auditorDb, "centers", CENTER_A, "auditLogs", "missing")));
    await assertFails(
      getDoc(doc(auditorWithoutCapabilityDb, "centers", CENTER_A, "auditLogs", "missing"))
    );
    await assertFails(getDoc(doc(otherCenterDb, "centers", CENTER_A, "auditLogs", "missing")));
    await assertFails(
      setDoc(doc(auditorDb, "centers", CENTER_A, "auditLogs", "manual"), {
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

  it("keeps global super admin out of clinical records while preserving staff metadata", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "patients", "rootPatientA", "consultations", "rootConsultA"), {
        centerId: CENTER_A,
        patientId: "rootPatientA",
        professionalId: "doctorA",
        professionalName: "Doctor A",
        professionalRole: "medico",
        evolution: "Contenido clínico privado",
        prescriptions: [],
        prescriptionTypes: [],
        hasControlledPrescription: false,
      });
    });

    const superDb = authedDb("superAdmin", "super@example.test", { super_admin: true });
    await assertFails(getDoc(doc(superDb, "patients", "rootPatientA")));
    await assertFails(
      getDoc(doc(superDb, "patients", "rootPatientA", "consultations", "rootConsultA"))
    );
    await assertFails(getDoc(doc(superDb, "centers", CENTER_A, "patients", "patientA")));
    await assertFails(
      getDoc(doc(superDb, "centers", CENTER_A, "patients", "patientA", "consultations", "consultA"))
    );
    await assertSucceeds(getDoc(doc(superDb, "centers", CENTER_A, "staff", "doctorA")));
  });

  it("exposes the operational patient directory only to same-center staff", async () => {
    const adminDb = authedDb("adminA", "admin@example.test");
    const secretaryDb = authedDb("secretaryA");
    const doctorDb = authedDb("doctorA");
    const otherCenterDb = authedDb("doctorB");

    await assertSucceeds(getDoc(doc(adminDb, "centers", CENTER_A, "patientDirectory", "patientA")));
    await assertSucceeds(
      getDoc(doc(secretaryDb, "centers", CENTER_A, "patientDirectory", "patientA"))
    );
    await assertSucceeds(
      getDoc(doc(doctorDb, "centers", CENTER_A, "patientDirectory", "patientA"))
    );
    await assertFails(
      getDoc(doc(otherCenterDb, "centers", CENTER_A, "patientDirectory", "patientA"))
    );
    await assertFails(
      setDoc(doc(adminDb, "centers", CENTER_A, "patientDirectory", "manual"), {
        fullName: "Paciente manual",
      })
    );
  });

  it("keeps signed root consultations immutable from the client", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "patients", "rootSignedPatient"), {
        centerId: CENTER_A,
        fullName: "Root Paciente Firmado",
        accessControl: { centerIds: [CENTER_A], allowedUids: ["doctorA"] },
        careTeamUids: ["doctorA"],
      });
      await setDoc(doc(db, "patients", "rootSignedPatient", "consultations", "signedRoot"), {
        centerId: CENTER_A,
        patientId: "rootSignedPatient",
        professionalId: "doctorA",
        professionalName: "Doctor A",
        professionalRole: "medico",
        professionalRut: "1-9",
        authorUid: "doctorA",
        recordStatus: "signed",
        revision: 1,
        diagnosis: "Registro firmado",
        prescriptions: [],
        prescriptionTypes: [],
        hasControlledPrescription: false,
      });
    });
    await assertFails(
      updateDoc(
        doc(
          authedDb("doctorA"),
          "patients",
          "rootSignedPatient",
          "consultations",
          "signedRoot"
        ),
        { diagnosis: "Intento de cambio" }
      )
    );
  });

  it("blocks a non-clinical center admin from reading clinical consultations", async () => {
    const db = authedDb("adminA");
    await expect(
      getDoc(doc(db, "centers", CENTER_A, "patients", "patientA", "consultations", "consultA"))
    ).rejects.toThrow();
  });
});
