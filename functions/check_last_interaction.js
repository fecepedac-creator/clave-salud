
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'clavesalud-2'
    });
}

const db = admin.firestore();

async function checkRecentInteraction() {
    console.log('--- Buscando conversaciones recientes ---');
    const snapshot = await db.collection('conversations')
        .orderBy('updatedAt', 'desc')
        .limit(3)
        .get();

    if (snapshot.empty) {
        console.log('No se encontraron conversaciones.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\nID: ${doc.id}`);
        console.log(`Última actualización: ${data.updatedAt?.toDate()}`);
        console.log(`Estado: ${data.flowState}`);
        console.log(`Paciente: ${data.patientName || 'Desconocido'}`);
        
        console.log('Historial reciente (últimos 4 mensajes):');
        const history = data.history || [];
        history.slice(-4).forEach(h => {
            console.log(`  [${h.role}] ${h.text}`);
        });

        if (data.agentLog && data.agentLog.length > 0) {
            console.log('Logs del Agente (último evento):');
            const lastLog = data.agentLog[data.agentLog.length - 1];
            console.log(`  Acción: ${lastLog.action}`);
            console.log(`  Resultado: ${JSON.stringify(lastLog.result)}`);
        }
    });
}

checkRecentInteraction().catch(console.error);
