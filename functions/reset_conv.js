const admin = require("firebase-admin");
try { admin.initializeApp(); } catch (e) { }
const db = admin.firestore();

async function run() {
    await db.collection("conversations").doc("c_cf35oz9w_56994408011").delete();
    console.log("Conversation reset!");
}
run().catch(console.error);
