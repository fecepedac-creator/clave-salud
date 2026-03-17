const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require("../clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function debugSlots() {
  const centerId = "c_cf35oz9w";
  const date = "2026-03-20";

  console.log(`Checking ALL documents for center ${centerId} on date ${date}...`);

  const snap = await db
    .collection("centers")
    .doc(centerId)
    .collection("appointments")
    .where("date", "==", date)
    .get();

  if (snap.empty) {
    console.log("No documents found for this date.");
    return;
  }

  console.log(`Found ${snap.size} documents:`);
  snap.forEach((doc) => {
    const data = doc.data();
    console.log(
      `- Time: ${data.time}, Status: ${data.status}, Active: ${data.active}, DoctorId: ${data.doctorId}, DocID: ${doc.id}`
    );
  });
}

debugSlots().catch(console.error);
