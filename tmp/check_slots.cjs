const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'clavesalud-2' });
const db = admin.firestore();

async function check() {
    const snap = await db.collection("centers").doc("LosAndes").collection("appointments").where("status", "==", "available").limit(5).get();
    console.log(`Found ${snap.size} available slots:`);
    snap.forEach(doc => {
        console.log(`- ID: ${doc.id}`, doc.data());
    });
}
check().catch(console.error);
