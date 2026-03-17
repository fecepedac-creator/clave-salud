const admin = require("firebase-admin");
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

async function checkConversation() {
  const phone = "56994408011";
  console.log(`Checking conversation for phone: ${phone}`);

  // Check legacy
  const legacyDoc = await db.collection("conversations").doc(phone).get();
  if (legacyDoc.exists) {
    console.log("Found legacy conversation:");
    console.log(JSON.stringify(legacyDoc.data(), null, 2));
  }

  // Check with centerId prefix (searching by suffix)
  const snap = await db.collection("conversations").get();

  snap.forEach((doc) => {
    if (doc.id.endsWith(phone)) {
      console.log(`Found conversation doc: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    }
  });
}

checkConversation().catch(console.error);
