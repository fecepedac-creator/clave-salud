const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccount = require(path.join(__dirname, '..', 'service-account.json.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const centerId = 'c_cf35oz9w';
const targetEmail = 'dr.felipecepeda@gmail.com';

async function inspect() {
    let output = "";
    const log = (msg) => {
        console.log(msg);
        output += msg + "\n";
    };

    log(`\n=== DEEP INSPECTION: ${targetEmail} ===`);

    // 1. Global Users
    log(`\n--- Global Users ---`);
    const userSnapshot = await db.collection('users').where('emailLower', '==', targetEmail.toLowerCase()).get();
    userSnapshot.forEach(doc => {
        log(`User UID: ${doc.id}`);
        log(JSON.stringify(doc.data(), null, 2));
    });

    // 2. All staff in center
    log(`\n--- All Staff in Center: ${centerId} ---`);
    const staffSnapshot = await db.collection('centers').doc(centerId).collection('staff').get();
    staffSnapshot.forEach(doc => {
        const data = doc.data();
        log(`Staff ID: ${doc.id} | Name: ${data.fullName || data.nombre} | Email: ${data.email || data.emailLower} | Role: ${data.role}`);

        if (data.emailLower === targetEmail.toLowerCase() || data.email === targetEmail) {
            log(`>>> MATCHED EMAIL <<<`);
            log(JSON.stringify(data, null, 2));
        }
    });

    // 3. Invites for this email
    log(`\n--- Invites for ${targetEmail} ---`);
    const inviteSnapshot = await db.collection('invites').where('emailLower', '==', targetEmail.toLowerCase()).get();
    inviteSnapshot.forEach(doc => {
        log(`Invite Token: ${doc.id} | Status: ${doc.get('status')} | Role: ${doc.get('role')} | Center: ${doc.get('centerName')}`);
        log(JSON.stringify(doc.data(), null, 2));
    });

    fs.writeFileSync(path.join(__dirname, 'deep_debug_output.txt'), output, 'utf8');
}

inspect().catch(console.error);
