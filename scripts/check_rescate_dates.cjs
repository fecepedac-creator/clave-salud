const admin = require("../node_modules/firebase-admin");
const SERVICE_ACCOUNT_PATH =
  "C:\\\\Users\\\\fecep\\\\clave-salud\\\\clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
    projectId: "clavesalud-2",
  });
}

const db = admin.firestore();

async function check() {
  console.log("Listando todas las ÚLTIMAS consultas y su nextControlDate de TODA tu clínica...");
  const centersSnap = await db.collection("centers").where("isActive", "==", true).get();

  for (const c of centersSnap.docs) {
    const centerId = c.id;
    const patientsSnap = await db
      .collection("centers")
      .doc(centerId)
      .collection("patients")
      .where("active", "==", true)
      .get();
    for (const p of patientsSnap.docs) {
      const data = p.data();
      const activeConsultations = (data.consultations || []).filter((c) => c.active !== false);
      if (activeConsultations.length === 0) continue;

      // Ordenamos la última consulta (la más reciente)
      activeConsultations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastConsult = activeConsultations[0];

      if (lastConsult.nextControlDate) {
        console.log(
          `[Revisado hoy] Paciente ${data.fullName} -> Próximo control exacto anotado: "${lastConsult.nextControlDate}"`
        );
      } else {
        console.log(
          `[Paciente ${data.fullName}] Última consulta sin nextControlDate. Objeto: ${JSON.stringify(lastConsult).slice(0, 150)}...`
        );
      }
    }
  }
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
