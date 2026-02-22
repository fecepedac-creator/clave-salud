const admin = require('firebase-admin');
const path = require('path');

// Fix paths to be absolute relative to this script
const serviceAccount = require(path.join(__dirname, '..', 'service-account.json.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const centerId = 'c_cf35oz9w';
const targetEmail = 'dr.felipecepeda@gmail.com';

async function inspect() {
    console.log(`\n=== INSPECTING EMAIL: ${targetEmail} ===`);

    // 1. Check Global Users Collection
    console.log(`\n--- Global Users Collection ---`);
    const usersRef = db.collection('users');
    const userSnapshot = await usersRef.where('email', '==', targetEmail).get();

    if (userSnapshot.empty) {
        console.log(`No user found in global users collection with email: ${targetEmail}`);
        // Try emailLower
        const userSnapshotLower = await usersRef.where('emailLower', '==', targetEmail.toLowerCase()).get();
        if (!userSnapshotLower.empty) {
            userSnapshotLower.forEach(doc => {
                console.log(`ID (UID): ${doc.id}`);
                console.log(JSON.stringify(doc.data(), null, 2));
            });
        }
    } else {
        userSnapshot.forEach(doc => {
            console.log(`ID (UID): ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }

    // 2. Check Center Staff Collection
    console.log(`\n--- Center Staff Collection (${centerId}) ---`);
    const staffRef = db.collection('centers').doc(centerId).collection('staff');
    const staffSnapshot = await staffRef.get();

    staffSnapshot.forEach(doc => {
        const data = doc.data();
        const email = (data.email || data.emailLower || '').toLowerCase();
        if (email === targetEmail.toLowerCase()) {
            console.log(`Matched Staff Record ID: ${doc.id}`);
            console.log(JSON.stringify(data, null, 2));
        }
    });

    console.log(`\n--- Other matching staff by UID? ---`);
    // If we found a UID above, check if any staff records match that UID
    const uids = [];
    userSnapshot.forEach(d => uids.push(d.id));

    for (const uid of uids) {
        const staffByUid = await staffRef.doc(uid).get();
        if (staffByUid.exists) {
            console.log(`Staff Record found matching UID ${uid}:`);
            console.log(JSON.stringify(staffByUid.data(), null, 2));
        }
    }
}

inspect().catch(console.error);
