const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "clavesalud-2",
  });
}

const db = admin.firestore();

async function debugSlots() {
  const centerId = "c_cf35oz9w";
  const date = "2026-03-20";

  console.log(`Checking slots for center ${centerId} on date ${date}...`);

  const snap = await db
    .collection("centers")
    .doc(centerId)
    .collection("appointments")
    .where("date", "==", date)
    .where("status", "==", "available")
    .get();

  if (snap.empty) {
    console.log("No available slots found.");
    return;
  }

  console.log(`Found ${snap.size} available slots:`);
  snap.forEach((doc) => {
    const data = doc.data();
    console.log(
      `- Time: ${data.time}, DoctorId: ${data.doctorId}, DoctorUid: ${data.doctorUid}, DocID: ${doc.id}`
    );
  });
}

debugSlots().catch(console.error);
