/**
 * check_consent_validity.js
 * Script de utilidad para la Skill PatientConsentManager.
 * Valida permisos específicos contra el estado del paciente.
 */

function checkConsent(patient, type) {
    const consents = patient.consents || {};
    const consent = consents[type];

    if (!consent) {
        return { authorized: false, reason: `No se encontró registro de consentimiento para: ${type}` };
    }

    if (consent.status !== 'active') {
        return { authorized: false, reason: `El consentimiento para ${type} está ${consent.status}` };
    }

    // Verificar expiración si aplica
    if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
        return { authorized: false, reason: `El consentimiento para ${type} ha expirado.` };
    }

    return { authorized: true, timestamp: consent.updatedAt };
}

// Escenario de prueba: Derecho al Olvido (Ley 21.656)
function isEligibleForRightToForget(patient) {
    if (!patient.medicalHistory?.includes('Cancer')) return false;

    const yearsSinceTreatment = patient.yearsSinceCancerClear || 0;
    return yearsSinceTreatment >= 5;
}

// Datos de prueba
const patientData = {
    fullName: "Juan Pérez",
    medicalHistory: ['Cancer', 'HTA'],
    yearsSinceCancerClear: 6,
    consents: {
        telemed: { status: 'active', updatedAt: '2026-01-01' },
        interop: { status: 'revoked', updatedAt: '2026-02-15' }
    }
};

console.log('--- VERIFICACIÓN DE CONSENTIMIENTOS ---');
console.log('Telemedicina:', checkConsent(patientData, 'telemed'));
console.log('Interoperabilidad:', checkConsent(patientData, 'interop'));
console.log('Aplica Derecho al Olvido:', isEligibleForRightToForget(patientData) ? 'SÍ' : 'NO');
