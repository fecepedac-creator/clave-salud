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
  const centersSnap = await db.collection("centers").get();
  let samplePrinted = 0;

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
        console.log(
          `[Paciente Encontrado] Felipe, el paciente ${data.fullName} SÍ califica! Fecha Control: ${lastConsult.nextControlDate}`
        );
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
          `  - Tiene cita agendada a futuro con este Dr?: ${hasFutureApp ? "SÍ (Será ignorado)" : "NO (Recibirá WhatsApp)"}`
        );

        const hasExams = (lastConsult.prescriptions || []).some(
          (p) => p.type === "OrdenExamenes" || p.type === "Solicitud de Examen"
        );
        console.log(`  - Tiene órdenes de exámenes pendientes?: ${hasExams ? "SÍ" : "NO"}`);
        countTotal++;
      }
    }
  }
  console.log(`Total encontrados con control date: ${samplePrinted}`);
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
