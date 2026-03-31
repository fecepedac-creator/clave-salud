const admin = require("firebase-admin");

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
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: true,
    patientId: "",
    limit: 100,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--live") options.dryRun = false;
    if (arg === "--patientId") options.patientId = String(args[index + 1] || "").trim();
    if (arg === "--limit") options.limit = Number(args[index + 1] || "100");
  }

  return options;
}

async function run() {
  const options = parseArgs();
  const rootPatientsSnap = options.patientId
    ? [await db.collection("patients").doc(options.patientId).get()].filter((docSnap) => docSnap.exists)
    : (await db.collection("patients").limit(options.limit).get()).docs;

  let compared = 0;
  let changed = 0;
  const report = [];

  for (const patientDoc of rootPatientsSnap) {
    const patientData = patientDoc.data() || {};
    const subcollectionSnap = await db
      .collection("patients")
      .doc(patientDoc.id)
      .collection("consultations")
      .orderBy("date", "desc")
      .get();

    const rootConsultations = subcollectionSnap.docs.map((docSnap) => ({
      docId: docSnap.id,
      ...docSnap.data(),
    }));

    const embeddedConsultations = Array.isArray(patientData.consultations)
      ? patientData.consultations
      : [];

    compared += 1;

    const sameLength = embeddedConsultations.length === rootConsultations.length;
    const sameIds =
      sameLength &&
      embeddedConsultations.every(
        (consultation, index) =>
          consultation?.id ===
          (rootConsultations[index]?.id ||
            rootConsultations[index]?.legacyId ||
            rootConsultations[index]?.docId)
      );

    if (sameIds) {
      continue;
    }

    changed += 1;
    report.push({
      patientId: patientDoc.id,
      embeddedCount: embeddedConsultations.length,
      rootCount: rootConsultations.length,
    });

    if (!options.dryRun) {
      const latestConsultation = rootConsultations[0] || null;
      await db
        .collection("patients")
        .doc(patientDoc.id)
        .set(
          {
            consultations: rootConsultations,
            lastConsultationAt: latestConsultation?.date || "",
            lastConsultationReason: latestConsultation?.reason || "",
            nextControlDate: latestConsultation?.nextControlDate || "",
            nextControlReason: latestConsultation?.nextControlReason || "",
            lastUpdated: new Date().toISOString(),
            migrationReconciledAt: serverTimestamp(),
          },
          { merge: true }
        );
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId: PROJECT_ID,
        dryRun: options.dryRun,
        compared,
        changed,
        report,
      },
      null,
      2
    )
  );
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[reconcile_root_patient_consultations_embedded] failed", error);
    process.exit(1);
  });
