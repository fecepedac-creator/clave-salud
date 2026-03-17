/**
 * fix_whatsapp_config.cjs
 * Muestra todos los centros y parchea whatsappConfig.phoneNumberId
 * en el centro que corresponda.
 */
const admin = require("../node_modules/firebase-admin");

const SERVICE_ACCOUNT_PATH =
  "C:\\Users\\fecep\\clave-salud\\clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json";
const PHONE_NUMBER_ID = "1080795685106150"; // el que llega del webhook de Meta

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
  projectId: "clavesalud-2",
});

const db = admin.firestore();

async function main() {
  console.log("🔧 Parcheando whatsappConfig en Centro Medico Los Andes (c_cf35oz9w)...");

  await db.collection("centers").doc("c_cf35oz9w").update({
    "whatsappConfig.phoneNumberId": PHONE_NUMBER_ID,
  });

  console.log("✅ Listo! whatsappConfig.phoneNumberId =", PHONE_NUMBER_ID);
  console.log("   El bot debería responder ahora correctamente.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
