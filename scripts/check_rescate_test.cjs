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
  console.log("Revisando base de datos buscando pacientes con control para '2026-03-13'...");

  const centersSnap = await db.collection("centers").where("isActive", "==", true).get();
  const targetDateStr = "2026-03-12"; // SIMULANDO ser ayer o probando la fecha específica
  let countTotal = 0;

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

      activeConsultations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastConsult = activeConsultations[0];

      if (lastConsult.nextControlDate === targetDateStr) {
        console.log(`\n========================================`);
        console.log(`[Paciente Encontrado] Felipe, el paciente ${data.fullName} SÍ califica!`);
        console.log(`- Fecha Control: ${lastConsult.nextControlDate}`);
        const targetDoctorId = lastConsult.professionalId || "";

        let hasFutureApp = false;
        if (targetDoctorId) {
          const existingApps = await db
            .collection("centers")
            .doc(centerId)
            .collection("appointments")
            .where("patientRut", "==", data.rut)
            .where("status", "==", "booked")
            .where("date", ">=", new Date().toISOString().split("T")[0])
            .get();
          hasFutureApp = existingApps.docs.some((doc) => doc.data().doctorId === targetDoctorId);
        }
        console.log(
          `- ¿Cita agendada a futuro con este Dr?: ${hasFutureApp ? "SÍ (Será ignorado por el bot)" : "NO (Recibirá WhatsApp de Autorescate)"}`
        );

        const hasExams = (lastConsult.prescriptions || []).some(
          (p) => p.type === "OrdenExamenes" || p.type === "Solicitud de Examen"
        );
        console.log(
          `- ¿Tiene órdenes de exámenes pendientes?: ${hasExams ? "SÍ (Bot detectará y adaptará template)" : "NO (Flujo normal)"}`
        );
        console.log(`- Teléfono del paciente guardado en ficha: ${data.phone}`);
        console.log(`========================================\n`);
        countTotal++;
      }
    }
  }

  if (countTotal === 0) {
    console.log(
      "No se encontró ningún paciente que cumpla la condición. ¿Seguro que guardaste la Ficha Clínica y en el campo Final 'Próximo control' le marcaste '13 de marzo del 2026'?"
    );
  }
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
