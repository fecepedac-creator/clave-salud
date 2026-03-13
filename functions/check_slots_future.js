const admin = require("firebase-admin");
try { admin.initializeApp(); } catch (e) { }
const db = admin.firestore();

async function run() {
    const cn = await db.collection("centers").doc("c_cf35oz9w").collection("appointments")
        .where("status", "==", "available")
        .where("date", ">=", "2026-03-12")
        .limit(10).get();
    console.log("Found:", cn.size, "future available slots");
    cn.forEach(d => {
        const act = d.data();
        console.log(act.date, act.time, "Dr:", act.doctorId || act.doctorUid, "DocId:", d.id);
    });
}
run().catch(console.error);
