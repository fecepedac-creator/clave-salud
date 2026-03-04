/**
 * validate_telemed_session.js
 * Script de utilidad para la Skill TelemedProtocolAssistant.
 * Verifica el cumplimiento de los requisitos mínimos según NCh3442.
 */

function validateTelemedSession(consultation) {
    const requirements = {
        consentReceived: !!consultation.telemedConsent,
        identityVerified: !!consultation.identityConfirmed,
        privacyConfirmed: !!consultation.isPrivateEnvironment,
        remoteLabel: consultation.title?.includes('[TELEMEDICINA]') || consultation.isRemote === true
    };

    const missing = Object.keys(requirements).filter(req => !requirements[req]);

    return {
        isValid: missing.length === 0,
        missingItems: missing,
        recommendations: missing.map(item => {
            switch (item) {
                case 'consentReceived': return 'Capturar consentimiento informado electrónico.';
                case 'identityVerified': return 'Registrar confirmación de identidad (RUT/Foto).';
                case 'privacyConfirmed': return 'Confirmar entorno privado en la sesión.';
                case 'remoteLabel': return 'Etiquetar la consulta como actividad de telemedicina.';
                default: return 'Actualizar registro normativo.';
            }
        })
    };
}

// Ejemplo de prueba
const dummyConsultation = {
    title: 'Consulta General',
    telemedConsent: true,
    isRemote: true
    // Faltan identidad y entorno
};

const result = validateTelemedSession(dummyConsultation);

if (!result.isValid) {
    console.log('--- REVISIÓN DE PROTOCOLO NCh3442 (INCUMPLE) ---');
    result.recommendations.forEach(rec => console.log(`- ${rec}`));
} else {
    console.log('Sesión de Telemedicina cumple con los estándares mínimos.');
}
