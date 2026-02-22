const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'service-account.json.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const centerId = 'c_cf35oz9w';
const felipeStaffId = 'u5PSaYNBn9bPpAWdZ0lvqeVGwg33'; // The duplicate causing noise
const felipeOldId = 'yirkjzx'; // An old inactive record

async function cleanup() {
    console.log(`\n--- Cleaning up duplicate staff in center ${centerId} ---`);

    // 1. Delete the main duplicate linked to the UID
    console.log(`Deleting staff record: ${felipeStaffId} (Felipe Cepeda Cea - Center Admin)`);
    await db.collection('centers').doc(centerId).collection('staff').doc(felipeStaffId).delete();
    console.log(`Successfully deleted ${felipeStaffId}`);

    // 2. Delete the old inactive record
    console.log(`Deleting staff record: ${felipeOldId} (Old/Inactive record)`);
    await db.collection('centers').doc(centerId).collection('staff').doc(felipeOldId).delete();
    console.log(`Successfully deleted ${felipeOldId}`);

    console.log(`\nCleanup complete. Only "Tere" (oqjmr05) remains for this email.`);
}

cleanup().catch(console.error);
