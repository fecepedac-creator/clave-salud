const admin = require("../node_modules/firebase-admin");
const SERVICE_ACCOUNT_PATH = "C:\\Users\\fecep\\clave-salud\\clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json";

admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
    projectId: "clavesalud-2",
});

const db = admin.firestore();

async function main() {
    const snap = await db.collection("centers").doc("c_cf35oz9w").get();
    if (!snap.exists) { console.log("❌ Centro no encontrado"); return; }
    const data = snap.data();
    console.log("whatsappConfig actual:", JSON.stringify(data.whatsappConfig, null, 2));

    // Si falta phoneNumberId, lo restauramos
    if (!data.whatsappConfig?.phoneNumberId) {
        console.log("⚠️  phoneNumberId faltante — restaurando...");
        await db.collection("centers").doc("c_cf35oz9w").update({
            "whatsappConfig.phoneNumberId": "1080795685106150"
        });
        console.log("✅ phoneNumberId restaurado: 1080795685106150");
    } else {
        console.log("✅ phoneNumberId OK:", data.whatsappConfig.phoneNumberId);
        console.log("📱 secretaryPhone:", data.whatsappConfig.secretaryPhone || "(no configurado)");
    }
    process.exit(0);
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
