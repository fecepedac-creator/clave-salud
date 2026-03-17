const admin = require("firebase-admin");
try {
  admin.initializeApp();
} catch (e) {}
const db = admin.firestore();

async function run() {
  const cn = await db.collection("centers").doc("c_cf35oz9w").collection("staff").get();
  cn.forEach((d) => {
    const data = d.data();
    console.log("Staff ID:", d.id, "Name:", data.fullName || data.name, "UID:", data.uid);
  });
}
run().catch(console.error);
