/**
 * verify_tenant_isolation.js
 * Script de utilidad para la Skill MultiTenantIsolationGuard.
 * Verifica que todos los registros en colecciones críticas tengan un centerId válido.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Este script será ejecutado por el agente para asegurar la integridad de los datos
async function auditIsolation(collectionName) {
    console.log(`Auditoría de Aislamiento para la colección: ${collectionName}`);

    const db = getFirestore();
    const snapshot = await db.collection(collectionName).get();

    let orphans = 0;
    snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.centerId) {
            console.warn(`[REGISTRO HUÉRFANO DETECTADO] ID: ${doc.id} en ${collectionName}`);
            orphans++;
        }
    });

    if (orphans === 0) {
        console.log(`ÉXITO: Todos los registros en ${collectionName} están correctamente segregados por centerId.`);
    } else {
        console.error(`ERROR: Se encontraron ${orphans} registros sin centerId en ${collectionName}.`);
    }
}

// Ejemplo de uso para el agente
const args = process.argv.slice(2);
if (args.length >= 1) {
    auditIsolation(args[0]).catch(console.error);
} else {
    console.log('Uso: node verify_tenant_isolation.js <collectionName>');
}
