/**
 * map_to_fhir_patient.js
 * Script de utilidad para la Skill FHIR_Bridge_CL.
 * Transforma un paciente de Clave Salud al estándar HL7 FHIR Core-CL.
 */

function mapLocalToFhir(localPatient) {
    const fhirPatient = {
        resourceType: "Patient",
        id: localPatient.id,
        identifier: [
            {
                use: "official",
                system: "http://registrocivil.cl/run",
                value: localPatient.rut
            }
        ],
        active: localPatient.active !== false,
        name: [
            {
                use: "official",
                text: localPatient.fullName
            }
        ],
        gender: localPatient.gender === "Masculino" ? "male" : localPatient.gender === "Femenino" ? "female" : "other",
        birthDate: localPatient.birthDate,
        telecom: [],
        address: []
    };

    if (localPatient.phone) {
        fhirPatient.telecom.push({ system: "phone", value: localPatient.phone, use: "mobile" });
    }

    if (localPatient.email) {
        fhirPatient.telecom.push({ system: "email", value: localPatient.email });
    }

    // Extensiones Core-CL (Ejemplo de estructura)
    fhirPatient.extension = [
        {
            url: "http://hl7chile.cl/fhir/ig/clcore/StructureDefinition/IdContacto",
            valueString: "Contacto de Emergencia No Definido"
        }
    ];

    return fhirPatient;
}

// Ejemplo de uso para el agente
const samplePatient = {
    id: "test-123",
    rut: "12345678-9",
    fullName: "Juan Pérez",
    gender: "Masculino",
    birthDate: "1985-10-20",
    phone: "+56912345678",
    active: true
};

console.log(JSON.stringify(mapLocalToFhir(samplePatient), null, 2));
