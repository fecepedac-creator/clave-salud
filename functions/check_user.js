const admin = require("firebase-admin");
try { admin.initializeApp(); } catch (e) { }
const db = admin.firestore();

async function run() {
    const cn = await db.collection("users").doc("u5PSaYNBn9bPpAWdZ0lvqeVGwg33").get();
    if (cn.exists) {
        const data = cn.data();
        console.log("Found user:", data.name, data.email);
    } else {
        console.log("NOT FOUND in users collection");
    }
}
run().catch(console.error);
