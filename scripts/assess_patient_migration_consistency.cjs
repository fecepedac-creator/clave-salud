const path = require("path");
const admin = require("firebase-admin");
const {
  comparePatientConsistency,
} = require("../functions/lib/patientMigrationConsistency.js");

const SERVICE_ACCOUNT_PATH =
  "C:\\Users\\fecep\\clave-salud\\clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json";
const PROJECT_ID = "clavesalud-2";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    centerId: "",
    patientId: "",
    limit: 200,
    includeMatching: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--centerId") options.centerId = String(args[index + 1] || "").trim();
    if (arg === "--patientId") options.patientId = String(args[index + 1] || "").trim();
    if (arg === "--limit") options.limit = Number(args[index + 1] || "200");
    if (arg === "--includeMatching") options.includeMatching = true;
  }

  return options;
}

async function run() {
  const options = parseArgs();

  const centersDocs = options.centerId
    ? [await db.collection("centers").doc(options.centerId).get()].filter((docSnap) => docSnap.exists)
    : (await db.collection("centers").get()).docs;

  const report = [];
  let comparedPatients = 0;
  let okPatients = 0;
  let warningPatients = 0;
  let criticalPatients = 0;

  for (const centerDoc of centersDocs) {
    const centerId = centerDoc.id;
    const legacyPatientsRef = db.collection("centers").doc(centerId).collection("patients");
    const legacyPatientsDocs = options.patientId
      ? [await legacyPatientsRef.doc(options.patientId).get()].filter((docSnap) => docSnap.exists)
      : (await legacyPatientsRef.limit(options.limit).get()).docs;

    const legacyConsultationsSnap = await db
      .collection("centers")
      .doc(centerId)
      .collection("consultations")
      .get();

    const legacyConsultationsByPatient = new Map();
    legacyConsultationsSnap.forEach((consultationDoc) => {
      const consultation = { id: consultationDoc.id, ...consultationDoc.data() };
      const patientId = String(consultation.patientId || "").trim();
      if (!patientId) return;
      const current = legacyConsultationsByPatient.get(patientId) || [];
      current.push(consultation);
      legacyConsultationsByPatient.set(patientId, current);
    });

    for (const legacyPatientDoc of legacyPatientsDocs) {
      const patientId = legacyPatientDoc.id;
      const legacyPatient = legacyPatientDoc.data();
      const rootPatientDoc = await db.collection("patients").doc(patientId).get();
      const rootPatient = rootPatientDoc.exists ? rootPatientDoc.data() : null;
      const rootConsultationsSnap = rootPatientDoc.exists
        ? await db.collection("patients").doc(patientId).collection("consultations").get()
        : null;

      const result = comparePatientConsistency({
        patientId,
        centerId,
        rootPatient,
        legacyPatient,
        rootConsultations:
          rootConsultationsSnap?.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })) ??
          [],
        legacyConsultations: legacyConsultationsByPatient.get(patientId) || [],
      });

      comparedPatients += 1;
      if (result.status === "ok") okPatients += 1;
      if (result.status === "warning") warningPatients += 1;
      if (result.status === "critical") criticalPatients += 1;

      if (options.includeMatching || result.status !== "ok") {
        report.push({
          centerId,
          ...result,
        });
      }
    }
  }

  const summary = {
    ok: true,
    projectId: PROJECT_ID,
    comparedPatients,
    okPatients,
    warningPatients,
    criticalPatients,
    report,
  };

  console.log(JSON.stringify(summary, null, 2));
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[assess_patient_migration_consistency] failed", error);
    process.exit(1);
  });
