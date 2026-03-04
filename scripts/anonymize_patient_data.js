/**
 * anonymize_patient_data.js
 * Script de utilidad para la Skill ClinicalDataAnonymizer.
 * Elimina PII de un objeto Patient manteniendo la utilidad clínica.
 */

function anonymizePatient(patient) {
    // Crear una copia profunda para no afectar el original
    const securePatient = JSON.parse(JSON.stringify(patient));

    // 1. Eliminar identificadores directos (PII)
    delete securePatient.rut;
    delete securePatient.fullName;
    delete securePatient.phone;
    delete securePatient.email;
    delete securePatient.address;

    // 2. Seudonimización del ID
    // En un entorno real se usaría un hash con salt
    securePatient.originalId = securePatient.id;
    securePatient.id = `pseudo_${Math.random().toString(36).substr(2, 9)}`;

    // 3. Mantener datos demográficos generales pero no exactos
    if (securePatient.birthDate) {
        const year = new Date(securePatient.birthDate).getFullYear();
        securePatient.birthYear = year;
        delete securePatient.birthDate; // Eliminar fecha exacta
    }

    // 4. Limpiar consultas de nombres de profesionales si existen
    if (securePatient.consultations) {
        securePatient.consultations = securePatient.consultations.map(c => {
            delete c.professionalName;
            delete c.professionalRut;
            return c;
        });
    }

    console.log('Paciente anonimizado con éxito (PII eliminada).');
    return securePatient;
}

// Ejemplo de uso para el agente
const sample = {
    id: "pat_9988",
    rut: "19.882.334-K",
    fullName: "María Ignacia Soto",
    birthDate: "1992-05-15",
    gender: "Femenino",
    phone: "+56988776655",
    email: "m.soto@ejemplo.cl",
    medicalHistory: ["Asma", "Rinitis"],
    consultations: [
        { id: "c1", professionalName: "Dr. Arriagada", diagnosis: "Control Asma" }
    ]
};

const result = anonymizePatient(sample);
console.log(JSON.stringify(result, null, 2));
