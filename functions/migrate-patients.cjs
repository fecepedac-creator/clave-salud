/**
 * migrate-patients.cjs
 * 
 * Migrates patient data from centers/{centerId}/patients → root /patients
 * and consultations from centers/{centerId}/consultations → /patients/{patientId}/consultations
 * 
 * USAGE (from functions/ directory):
 *   1. First login for application-default credentials:
 *      gcloud auth application-default login
 *   
 *   2. Dry run (preview changes without writing):
 *      set DRY_RUN=true && node migrate-patients.cjs
 *   
 *   3. Live run (writes to Firestore):
 *      node migrate-patients.cjs
 * 
 * ALTERNATIVE: If gcloud is not installed, use Firebase Functions shell:
 *   firebase functions:shell
 *   > migratePatients()
 */

const admin = require("firebase-admin");

// Use Firebase CLI credentials via a workaround:
// If GOOGLE_APPLICATION_CREDENTIALS is not set, try to use the Firebase token
const { execSync } = require("child_process");

function getFirebaseToken() {
    try {
        const token = execSync("firebase login:ci --no-localhost 2>/dev/null || echo ''", { encoding: "utf8" }).trim();
        return token || null;
    } catch {
        return null;
    }
}

if (!admin.apps.length) {
    try {
        // Try default credentials first
        admin.initializeApp({
            projectId: "clavesalud-2",
        });
        console.log("✅ Initialized with default credentials");
    } catch (e) {
        console.error("❌ Could not initialize Firebase Admin SDK.");
        console.error("   Please run: gcloud auth application-default login");
        console.error("   Or set GOOGLE_APPLICATION_CREDENTIALS to a service account key file.");
        process.exit(1);
    }
}

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === "true";

async function migratePatientsForCenter(centerId) {
    console.log(`\n📋 Processing center: ${centerId}`);

    // 1. Get all patients from the center subcollection
    const patientsSnap = await db.collection("centers").doc(centerId).collection("patients").get();

    if (patientsSnap.empty) {
        console.log(`  ⚠️  No patients found in center ${centerId}`);
        return { patients: 0, consultations: 0, skipped: 0 };
    }

    console.log(`  Found ${patientsSnap.size} patients`);

    // 2. Get all staff to determine the "owner" professional for this center
    const staffSnap = await db.collection("centers").doc(centerId).collection("staff").get();
    const staffMembers = [];
    staffSnap.forEach(doc => {
        const data = doc.data();
        staffMembers.push({ uid: doc.id, ...data });
    });

    // Find the first professional (doctor/professional role) to be the default owner
    const defaultOwner = staffMembers.find(s =>
        s.roles?.includes("doctor") ||
        s.roles?.includes("MEDICO") ||
        s.roles?.includes("professional")
    ) || staffMembers[0]; // Fallback to first staff member

    const defaultOwnerUid = defaultOwner?.uid || "migration-orphan";
    console.log(`  Default owner UID: ${defaultOwnerUid} (${defaultOwner?.displayName || defaultOwner?.name || "unknown"})`);

    // 3. Get all consultations from the center
    const consultationsSnap = await db.collection("centers").doc(centerId).collection("consultations").get();
    const consultationsByPatientId = {};
    consultationsSnap.forEach(doc => {
        const data = doc.data();
        const patientId = data.patientId;
        if (patientId) {
            if (!consultationsByPatientId[patientId]) {
                consultationsByPatientId[patientId] = [];
            }
            consultationsByPatientId[patientId].push({ id: doc.id, ...data });
        }
    });
    console.log(`  Found ${consultationsSnap.size} consultations`);

    let migratedPatients = 0;
    let migratedConsultations = 0;
    let skipped = 0;

    // 4. Migrate each patient
    for (const patientDoc of patientsSnap.docs) {
        const patientData = patientDoc.data();
        const patientId = patientDoc.id;

        // Check if already migrated (exists in root patients collection)
        const existingRoot = await db.collection("patients").doc(patientId).get();
        if (existingRoot.exists) {
            console.log(`  ⏭️  Patient ${patientId} (${patientData.fullName || "?"}) already exists in root — skipping`);
            skipped++;
            continue;
        }

        // Determine the owner — use consultation creator if available, fallback to default
        const patientConsultations = consultationsByPatientId[patientId] || [];
        const consultationCreator = patientConsultations.find(c => c.createdByUid)?.createdByUid;
        const ownerUid = consultationCreator || defaultOwnerUid;

        // Build the migrated patient document
        const migratedPatient = {
            ...patientData,
            id: patientId,
            ownerUid: ownerUid,
            accessControl: {
                allowedUids: [ownerUid],
                centerIds: [centerId],
            },
            centerId: centerId, // Keep for backward compat
            migratedFrom: `centers/${centerId}/patients/${patientId}`,
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (DRY_RUN) {
            console.log(`  [DRY] Would migrate patient ${patientId} (${patientData.fullName || "?"}) → owner: ${ownerUid}`);
        } else {
            await db.collection("patients").doc(patientId).set(migratedPatient);
            console.log(`  ✅ Migrated patient ${patientId} (${patientData.fullName || "?"}) → owner: ${ownerUid}`);
        }
        migratedPatients++;

        // 5. Migrate consultations for this patient
        for (const consult of patientConsultations) {
            const consultId = consult.id;
            if (DRY_RUN) {
                console.log(`    [DRY] Would migrate consultation ${consultId}`);
            } else {
                await db.collection("patients").doc(patientId).collection("consultations").doc(consultId).set({
                    ...consult,
                    migratedFrom: `centers/${centerId}/consultations/${consultId}`,
                    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`    ✅ Migrated consultation ${consultId}`);
            }
            migratedConsultations++;
        }
    }

    return { patients: migratedPatients, consultations: migratedConsultations, skipped };
}

async function main() {
    console.log("=".repeat(60));
    console.log(`🚀 Patient Migration: centers/*/patients → /patients`);
    console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "⚠️  LIVE (writing to Firestore)"}`);
    console.log("=".repeat(60));

    // Get all centers
    const centersSnap = await db.collection("centers").get();
    console.log(`\nFound ${centersSnap.size} centers to process`);

    let totalPatients = 0;
    let totalConsultations = 0;
    let totalSkipped = 0;

    for (const centerDoc of centersSnap.docs) {
        const result = await migratePatientsForCenter(centerDoc.id);
        totalPatients += result.patients;
        totalConsultations += result.consultations;
        totalSkipped += result.skipped;
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Migration Summary:");
    console.log(`   Patients migrated:      ${totalPatients}`);
    console.log(`   Consultations migrated: ${totalConsultations}`);
    console.log(`   Patients skipped:       ${totalSkipped}`);
    console.log(`   Mode:                   ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
    console.log("=".repeat(60));

    if (DRY_RUN) {
        console.log("\n💡 To run for real:");
        console.log("   node migrate-patients.cjs");
    }
}

// Export for use in Firebase Functions shell
module.exports = { main, migratePatientsForCenter };

// Run if called directly
if (require.main === module) {
    main().then(() => process.exit(0)).catch(err => {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    });
}
