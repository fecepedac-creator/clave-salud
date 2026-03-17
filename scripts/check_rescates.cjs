const admin = require("../node_modules/firebase-admin");
const fs = require("fs");
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
  let output = "Revisando pacientes...\n";
  const centersSnap = await db.collection("centers").get();
  let countTotal = 0;
  let targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  const targetDateStr = targetDate.toISOString().split("T")[0];
  output += `Target Date para 7 días: ${targetDateStr}\n`;

  for (const c of centersSnap.docs) {
    const patientsSnap = await db
      .collection("centers")
      .doc(c.id)
      .collection("patients")
      .where("active", "==", true)
      .get();
    for (const p of patientsSnap.docs) {
      const data = p.data();
      const activeConsultations = (data.consultations || []).filter((c) => c.active !== false);
      if (activeConsultations.length === 0) continue;

      activeConsultations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastConsult = activeConsultations[0];

      if (lastConsult.nextControlDate) {
        output += `Paciente ${data.fullName} - Próximo control programado: ${lastConsult.nextControlDate}\n`;
        if (lastConsult.nextControlDate === targetDateStr) {
          countTotal++;
          output += `  -> ¡Este paciente debió haber recibido el auto-rescate!\n`;
        }
      }
    }
  }
  output += `\nPacientes que cumplieron criterio exacto (hoy + 7 días) para recibir WhatsApp: ${countTotal}\n`;
  fs.writeFileSync("check_rescates_output.txt", output);
  console.log("Terminado. Resultados en check_rescates_output.txt");
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
