const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const centerId = 'c_cf35oz9w';

async function inspect() {
    console.log(`--- Inspecting Staff for Center: ${centerId} ---`);
    const staffRef = db.collection('centers').doc(centerId).collection('staff');
    const snapshot = await staffRef.get();

    if (snapshot.empty) {
        console.log('No staff found.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  Name: ${data.fullName || data.nombre}`);
        console.log(`  Email: ${data.email || data.correo}`);
        console.log(`  EmailLower: ${data.emailLower}`);
        console.log(`  Role: ${data.role || data.professionalRole}`);
        console.log(`  UID: ${data.uid}`);
        console.log('------------------');
    });
}

inspect().catch(console.error);
