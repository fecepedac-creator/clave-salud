const admin = require("firebase-admin");
try {
  admin.initializeApp();
} catch (e) {}
const db = admin.firestore();

async function getAvailableSlots(centerId, staffId, date) {
  let snap = await db
    .collection("centers")
    .doc(centerId)
    .collection("appointments")
    .where("doctorId", "==", staffId)
    .where("date", "==", date)
    .where("status", "==", "available")
    .orderBy("time", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, time: d.data().time }));
}

async function run() {
  const dates = [
    "2026-03-12",
    "2026-03-13",
    "2026-03-14",
    "2026-03-15",
    "2026-03-16",
    "2026-03-17",
    "2026-03-18",
    "2026-03-19",
  ];
  console.log("Checking slots for Felipe...");
  for (const d of dates) {
    try {
      const s1 = await getAvailableSlots("c_cf35oz9w", "2fFcAftcfuW4OoJnCxjTejs9kvy2", d);
      if (s1.length) console.log(d, "Dr Felipe:", s1.length, "slots");
    } catch (e) {
      console.log("Error for doctorId:", e.message);
    }
  }
}
run().catch(console.error);
