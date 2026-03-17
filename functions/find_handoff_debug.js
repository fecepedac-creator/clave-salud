const admin = require("firebase-admin");
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

async function findHandoff() {
  const phone = "56994408011";
  console.log(`Searching handoff for phone: ${phone}`);

  const centersSnap = await db.collection("centers").get();
  for (const centerDoc of centersSnap.docs) {
    const handoffsSnap = await db
      .collection("centers")
      .doc(centerDoc.id)
      .collection("handoff_requests")
      .where("patientPhone", "==", phone)
      .orderBy("requestedAt", "desc")
      .limit(1)
      .get();

    if (!handoffsSnap.empty) {
      const handoff = handoffsSnap.docs[0].data();
      console.log(`Found handoff in center: ${centerDoc.id} (${centerDoc.data().name})`);
      console.log(JSON.stringify(handoff, null, 2));

      // Now we know the centerId, let's check the conversation
      const convKey = `${centerId}_${phone}`; // Wait, I need to use the actual centerId
      const centerId = centerDoc.id;
      const key = `${centerId}_${phone}`;
      const convDoc = await db.collection("conversations").doc(key).get();
      if (convDoc.exists) {
        console.log(`Conversation Flow State: ${convDoc.data().flowState}`);
        console.log("Recent History:");
        console.log(JSON.stringify(convDoc.data().history?.slice(-5), null, 2));
        console.log("Agent Log (Tools):");
        console.log(JSON.stringify(convDoc.data().agentLog, null, 2));
      }
    }
  }
}

findHandoff().catch(console.error);
