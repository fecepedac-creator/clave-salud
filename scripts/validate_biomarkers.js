/**
 * validate_biomarkers.js
 * Script de utilidad para la Skill BioMarkerGuardian.
 * Evalúa resultados contra umbrales críticos del MINSAL Chile.
 */

const THRESHOLDS = {
    hba1c: { max: 9.0, unit: '%', label: 'Hemoglobina Glicosilada', ref: 'GES Diabetes Tipo 2' },
    systolic: { max: 140, unit: 'mmHg', label: 'Presión Sistólica', ref: 'Guía HTA MINSAL' },
    diastolic: { max: 90, unit: 'mmHg', label: 'Presión Diastólica', ref: 'Guía HTA MINSAL' },
    creatinine: { max: 1.2, unit: 'mg/dL', label: 'Creatinina Sérica', ref: 'Protocolo ERC' }
};

function validateBiomarkers(data) {
    const alerts = [];

    if (data.hba1c && data.hba1c > THRESHOLDS.hba1c.max) {
        alerts.push({
            level: 'CRITICAL',
            message: `${THRESHOLDS.hba1c.label} elevada: ${data.hba1c}${THRESHOLDS.hba1c.unit}`,
            source: THRESHOLDS.hba1c.ref
        });
    }

    if (data.systolic && data.systolic >= THRESHOLDS.systolic.max) {
        alerts.push({
            level: 'WARNING',
            message: `${THRESHOLDS.systolic.label} elevada: ${data.systolic}${THRESHOLDS.systolic.unit}`,
            source: THRESHOLDS.systolic.ref
        });
    }

    return alerts;
}

// Ejemplo de uso para el agente
const examData = { hba1c: 10.2, systolic: 151, diastolic: 95 };
const currentAlerts = validateBiomarkers(examData);

if (currentAlerts.length > 0) {
    console.log('--- ALERTAS CLÍNICAS DETECTADAS ---');
    currentAlerts.forEach(a => console.log(`[${a.level}] ${a.message} (Ref: ${a.source})`));
} else {
    console.log('No se detectaron valores críticos.');
}
