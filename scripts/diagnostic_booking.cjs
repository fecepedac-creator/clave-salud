const admin = require('firebase-admin');

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            projectId: "clavesalud-2"
        });
        console.log("✅ Initialized with default credentials");
    } catch (e) {
        console.error("❌ Failed to initialize with default credentials. Error:", e.message);
        process.exit(1);
    }
}

const db = admin.firestore();
const centerId = 'c_cf35oz9w';

async function runDiagnostic() {
    console.log(`\n=== DIAGNOSTIC: Center ${centerId} ===`);

    // 1. Inspect 'staff' collection (Internal)
    console.log(`\n--- [INTERNAL STAFF] ---`);
    const staffSnap = await db.collection('centers').doc(centerId).collection('staff').get();
    if (staffSnap.empty) {
        console.log('No internal staff records found.');
    } else {
        staffSnap.forEach(doc => {
            const d = doc.data();
            console.log(`ID: ${doc.id}`);
            console.log(`  Name: ${d.fullName || d.name}`);
            console.log(`  Role: ${d.role || d.clinicalRole}`);
            console.log(`  ClinicalRole: ${d.clinicalRole}`);
            console.log(`  AccessRole: ${d.accessRole}`);
            console.log(`  Active: ${d.active ?? d.activo}`);
            console.log(`  VisibleInBooking: ${d.visibleInBooking}`);
            console.log(`  HasAgendaConfig: ${!!d.agendaConfig}`);
        });
    }

    // 2. Inspect 'publicStaff' collection (Patient View)
    console.log(`\n--- [PUBLIC STAFF (Patient Portal)] ---`);
    const publicSnap = await db.collection('centers').doc(centerId).collection('publicStaff').get();
    if (publicSnap.empty) {
        console.log('No public staff records found.');
    } else {
        publicSnap.forEach(doc => {
            const d = doc.data();
            console.log(`ID: ${doc.id}`);
            console.log(`  Name: ${d.fullName}`);
            console.log(`  Role: ${d.role}`);
            console.log(`  Active: ${d.active}`);
            console.log(`  VisibleInBooking: ${d.visibleInBooking}`);
        });
    }
}

runDiagnostic().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
