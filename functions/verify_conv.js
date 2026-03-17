const admin = require("firebase-admin");
try {
  admin.initializeApp();
} catch (e) {}
const db = admin.firestore();

async function run() {
  const snap = await db.collection("conversations").orderBy("updatedAt", "desc").limit(3).get();
  snap.forEach((doc) => {
    console.log("CONV ID:", doc.id);
    const data = doc.data();
    console.log("HISTORY:");
    (data.history || []).forEach((h) => console.log(`  ${h.role}: ${h.text}`));
    console.log("-----");
  });
}
run().catch(console.error);
