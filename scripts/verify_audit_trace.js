/**
 * verify_audit_trace.js
 * Script de utilidad para la Skill LegalTrace_CL.
 * Verifica la existencia de registros de auditoría para un paciente específico.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// El agente usará sus credenciales de entorno para conectar
// Nota: En un entorno real de producción, se requiere serviceAccount.json
async function verifyAudit(patientId, centerId) {
    console.log(`Auditoría LegalTrace_CL para Paciente: ${patientId} en Centro: ${centerId}`);

    const db = getFirestore();
    const auditRef = db.collection('centers').doc(centerId).collection('auditLogs');

    const snapshot = await auditRef.where('patientId', '==', patientId)
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    if (snapshot.empty) {
        console.warn('ALERTA: No se encontraron trazas de auditoría para este paciente.');
        return;
    }

    console.log('Trazas de Auditoría encontradas:');
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- [${data.timestamp.toDate().toISOString()}] ${data.actorName} (${data.action}): ${data.details || 'Sin detalles'}`);
    });
}

// Ejemplo de uso controlado por el agente
const args = process.argv.slice(2);
if (args.length >= 2) {
    verifyAudit(args[0], args[1]).catch(console.error);
} else {
    console.log('Uso: node verify_audit_trace.js <patientId> <centerId>');
}
