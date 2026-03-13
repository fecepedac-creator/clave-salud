const admin = require("firebase-admin");
const path = require("path");

const SERVICE_ACCOUNT_PATH = "C:\\Users\\fecep\\clave-salud\\clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json";

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
        projectId: "clavesalud-2",
    });
}

const db = admin.firestore();

async function auditIsolation() {
    console.log("--- INICIANDO AUDITORÍA DE AISLAMIENTO DE DATOS (MULTI-TENANCY) ---");

    const collectionsToAudit = [
        { name: "patients", description: "Colección Global de Pacientes", isGlobal: true },
        { name: "centers", description: "Colecciones de Centros (Sub-colecciones)", isGlobal: false }
    ];

    for (const coll of collectionsToAudit) {
        console.log(`\nAuditando ${coll.description} [${coll.name}]...`);

        if (coll.isGlobal) {
            const snapshot = await db.collection(coll.name).get();
            let orphans = 0;
            let healthy = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                // En el modelo global, buscamos centerId o accessControl.centerIds
                const hasCenterId = data.centerId || (data.accessControl && data.accessControl.centerIds && data.accessControl.centerIds.length > 0);

                if (!hasCenterId) {
                    console.warn(`[REGISTRO HUÉRFANO DETECTADO] ID: ${doc.id} - Nombre: ${data.fullName || 'N/A'}`);
                    orphans++;
                } else {
                    healthy++;
                }
            });
            console.log(`Resultado: ${healthy} válidos, ${orphans} huérfanos.`);
        } else {
            const centersSnap = await db.collection("centers").get();
            for (const centerDoc of centersSnap.docs) {
                const centerId = centerDoc.id;
                const centerName = centerDoc.data().name;
                // Audit sub-collections
                const subCollections = ["patients", "appointments", "staff"];
                for (const sub of subCollections) {
                    const subSnap = await db.collection("centers").doc(centerId).collection(sub).get();
                    let problematic = 0;
                    subSnap.forEach(doc => {
                        const data = doc.data();
                        // En sub-colecciones, DEBEN tener el centerId correcto si se usa para filtrado global o simplemente existir allí.
                        // El hecho de estar en la sub-colección ya los segrega, pero verificamos si tienen el campo 'centerId' para redundancia y seguridad en queries.
                        if (data.centerId && data.centerId !== centerId) {
                            console.error(`[CRITICAL] Data Mismatch! Registro ${doc.id} en centro ${centerId} tiene centerId ${data.centerId}`);
                            problematic++;
                        }
                    });
                    if (problematic > 0) {
                        console.error(`Centro: ${centerName} (${centerId}) - ${sub}: ${problematic} errores de mismatch.`);
                    }
                }
            }
            console.log("Sub-colecciones de centros validadas.");
        }
    }
    console.log("\n--- AUDITORÍA FINALIZADA ---");
}

auditIsolation()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("Error en la auditoría:", err);
        process.exit(1);
    });
