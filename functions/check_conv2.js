const admin = require("firebase-admin");
try { admin.initializeApp(); } catch (e) { }
const db = admin.firestore();

async function run() {
    const cn = await db.collection("conversations").doc("c_cf35oz9w_56994408011").get();
    console.log(JSON.stringify(cn.data(), null, 2));
}
run().catch(console.error);
