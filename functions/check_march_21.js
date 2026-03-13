const admin = require("firebase-admin");
try { admin.initializeApp(); } catch (e) { }
const db = admin.firestore();

async function run() {
    const snap = await db.collection("centers").doc("c_cf35oz9w").collection("appointments")
        .where("date", "==", "2026-03-21").get();

    console.log("March 21 slots:", snap.size);
    snap.forEach(d => {
        const data = d.data();
        console.log(data.date, data.time, "status:", data.status, "doctorId:", data.doctorId, "doctorUid:", data.doctorUid);
    });

    // also check other dates just in case
    const snap2 = await db.collection("centers").doc("c_cf35oz9w").collection("appointments")
        .where("status", "==", "available")
        .where("date", ">=", "2026-03-21")
        .limit(10).get();
    console.log("Future available slots from DB query:", snap2.size);
}
run().catch(console.error);
