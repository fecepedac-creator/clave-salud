const admin = require("firebase-admin");
try { admin.initializeApp(); } catch (e) { }
const db = admin.firestore();

async function run() {
    const snap = await db.collection("centers").doc("c_cf35oz9w").collection("appointments")
        .where("doctorUid", "==", "2fFcAftcfuW4OoJnCxjTejs9kvy2").where("status", "==", "available").get();

    console.log("Felipe doctorUid available slots:", snap.size);
    snap.forEach(d => console.log(d.data().date, d.data().time));
}
run().catch(console.error);
