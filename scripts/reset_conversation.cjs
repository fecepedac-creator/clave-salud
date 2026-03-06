/**
 * reset_conversation.cjs
 * Resetea el estado de conversación del bot para un número de teléfono.
 * Útil cuando la conversación queda atascada en HANDOFF u otro estado.
 */
const admin = require("../node_modules/firebase-admin");

const SERVICE_ACCOUNT_PATH = "C:\\Users\\fecep\\clave-salud\\clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json";
const PHONE_TO_RESET = "56994408011"; // número a resetear

admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
    projectId: "clavesalud-2",
});

const db = admin.firestore();

async function main() {
    console.log(`🔄 Reseteando conversación para ${PHONE_TO_RESET}...`);
    await db.collection("conversations").doc(PHONE_TO_RESET).set({
        state: "IDLE",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Listo! Estado reseteado a IDLE. El bot responderá como nuevo.`);
    process.exit(0);
}

main().catch(e => {
    console.error("❌ Error:", e.message);
    process.exit(1);
});
