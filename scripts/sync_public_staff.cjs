const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "clavesalud-2"
    });
}

const db = admin.firestore();
const centerId = process.argv[2] || 'c_cf35oz9w';

async function syncPublicStaff() {
    console.log(`\n=== SYNC PUBLIC STAFF: Center ${centerId} ===`);

    const staffSnap = await db.collection('centers').doc(centerId).collection('staff').get();
    console.log(`Found ${staffSnap.size} internal staff records.`);

    let syncCount = 0;
    for (const doc of staffSnap.docs) {
        const data = doc.data();

        // Only sync if they are active and visible in booking
        const isActive = data.active !== false && data.activo !== false;
        const isVisible = data.visibleInBooking === true;

        if (isActive && isVisible) {
            console.log(`Syncing visible specialist: ${data.fullName} (${doc.id})`);

            const payload = {
                id: doc.id,
                centerId,
                fullName: data.fullName || "",
                specialty: data.specialty || "",
                photoUrl: data.photoUrl || "",
                role: data.clinicalRole || data.role || "Medico",
                clinicalRole: data.clinicalRole || data.role || "",
                accessRole: data.accessRole || (data.isAdmin ? "center_admin" : "doctor"),
                agendaConfig: data.agendaConfig || null,
                visibleInBooking: true,
                active: true,
                activo: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('centers').doc(centerId).collection('publicStaff').doc(doc.id).set(payload, { merge: true });
            syncCount++;
        } else {
            console.log(`Skipping: ${data.fullName} (Active: ${isActive}, Visible: ${isVisible})`);
        }
    }

    console.log(`\n✅ Finished. Synced ${syncCount} specialists.`);
}

syncPublicStaff().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
