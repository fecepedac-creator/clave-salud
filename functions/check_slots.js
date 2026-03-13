const admin = require("firebase-admin");
try { admin.initializeApp(); } catch (e) { }
const db = admin.firestore();

async function run() {
    const cn = await db.collection("centers").doc("c_cf35oz9w").collection("appointments")
        .where("status", "==", "available").limit(10).get();
    console.log("Found:", cn.size, "available slots");
    cn.forEach(d => {
        const act = d.data();
        console.log(act.date, act.time, "Dr:", act.doctorId || act.doctorUid, "DocId:", d.id);
    });
}
run().catch(console.error);
