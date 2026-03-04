/**
 * detect_suspicious_activity.js
 * Script de utilidad para la Skill AuditSuspicionEngine.
 * Analiza un conjunto de logs de acceso para detectar anomalías.
 */

const SUSPICION_LIMITS = {
    BATCH_ACCESS: 10,       // Máximo de fichas por minuto
    UNAUTHORIZED_CENTER: 1  // Cualquier intento fuera de su centro
};

function analyzeLogs(logs) {
    const alerts = [];
    const userAccessCount = {};

    logs.forEach(log => {
        // 1. Verificar acceso fuera de centro
        if (log.targetCenterId !== log.actorCenterId) {
            alerts.push({
                level: 'CRITICAL',
                actor: log.actorUid,
                reason: `Acceso a centro no autorizado: ${log.targetCenterId}`,
                timestamp: log.timestamp
            });
        }

        // 2. Conteo por actor para ráfagas masivas
        const minute = log.timestamp.substring(0, 16); // YYYY-MM-DDTHH:mm
        const key = `${log.actorUid}_${minute}`;
        userAccessCount[key] = (userAccessCount[key] || 0) + 1;

        if (userAccessCount[key] > SUSPICION_LIMITS.BATCH_ACCESS) {
            alerts.push({
                level: 'HIGH',
                actor: log.actorUid,
                reason: `Posible Data Scraping: >10 fichas en 1 min (${userAccessCount[key]})`,
                timestamp: log.timestamp
            });
        }
    });

    return alerts;
}

// Datos de prueba simulados
const logBurst = [
    { actorUid: 'pro_123', actorCenterId: 'A', targetCenterId: 'A', timestamp: '2026-02-25T23:30:00Z' },
    { actorUid: 'pro_123', actorCenterId: 'A', targetCenterId: 'B', timestamp: '2026-02-25T23:30:05Z' }, // SOSPECHOSO
    ...Array(11).fill(0).map((_, i) => ({
        actorUid: 'pro_999', actorCenterId: 'C', targetCenterId: 'C', timestamp: `2026-02-25T23:31:${i.toString().padStart(2, '0')}Z`
    })) // MASIVO
];

const foundAlerts = analyzeLogs(logBurst);

if (foundAlerts.length > 0) {
    console.log('--- DETECTOR DE SOSPECHA: ALERTAS ENCONTRADAS ---');
    foundAlerts.forEach(a => console.log(`[${a.level}] Actor: ${a.actor} -> ${a.reason}`));
} else {
    console.log('Actividad normal detectada.');
}
