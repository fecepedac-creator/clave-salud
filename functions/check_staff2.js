const admin = require("firebase-admin");
try {
  admin.initializeApp();
} catch (e) {}
const db = admin.firestore();

async function run() {
  const cn = await db
    .collection("centers")
    .doc("c_cf35oz9w")
    .collection("staff")
    .doc("u5PSaYNBn9bPpAWdZ0lvqeVGwg33")
    .get();
  if (cn.exists) {
    const data = cn.data();
    console.log("Found staff:", data.fullName || data.name, !!data.isActive, !!data.active);
  } else {
    console.log("NOT FOUND in staff collection");
  }

  const cn2 = await db.collection("centers").doc("c_cf35oz9w").collection("staff").get();
  cn2.forEach((d) => {
    const data = d.data();
    console.log(
      d.id,
      "active:",
      data.active,
      "isActive:",
      data.isActive,
      "name:",
      data.fullName || data.name
    );
  });
}
run().catch(console.error);
