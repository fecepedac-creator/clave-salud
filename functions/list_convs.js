const admin = require("firebase-admin");
try { admin.initializeApp(); } catch (e) { }
const db = admin.firestore();

async function run() {
    const cn = await db.collection("conversations").limit(10).get();
    cn.forEach(d => {
        console.log(d.id);
    });
}
run().catch(console.error);
