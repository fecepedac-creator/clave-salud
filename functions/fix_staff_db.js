const admin = require("firebase-admin");
try {
  admin.initializeApp();
} catch (e) {}
const db = admin.firestore();

async function run() {
  const centerRef = db.collection("centers").doc("c_cf35oz9w");

  // Get existing profile
  const doc = await centerRef.collection("staff").doc("2fFcAftcfuW4OoJnCxjTejs9kvy2").get();
  const data = doc.data();

  // 1. Create correct staff profile matching current auth UID
  data.uid = "u5PSaYNBn9bPpAWdZ0lvqeVGwg33"; // associate correct UID
  await centerRef.collection("staff").doc("u5PSaYNBn9bPpAWdZ0lvqeVGwg33").set(data);

  // 2. Hide old overlapping profiles so the bot doesn't see "3 Felipes"
  await centerRef.collection("staff").doc("1tdw3xy").update({ active: false });
  await centerRef.collection("staff").doc("2fFcAftcfuW4OoJnCxjTejs9kvy2").update({ active: false });

  console.log("Database fixed!");
}
run().catch(console.error);
