const admin = require('firebase-admin');
const serviceAccount = require('./clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const centersSnap = await db.collection('centers').limit(5).get();
  console.log('Centers found:');
  for (const doc of centersSnap.docs) {
    const data = doc.data();
    console.log(`- ${doc.id}: ${data.name}`);
    
    // Check for slots
    const slotsSnap = await db.collection('centers').doc(doc.id).collection('appointments')
      .where('status', '==', 'available')
      .limit(1)
      .get();
      
    if (!slotsSnap.empty) {
      console.log(`  -> HAS AVAILABLE SLOTS`);
    } else {
      console.log(`  -> NO AVAILABLE SLOTS`);
    }
  }
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
