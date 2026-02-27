import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Trigger de Auditoría Inmutable para Registros de Pacientes.
 * Reacciona a cualquier escritura en la colección de pacientes y genera 
 * un log de auditoría forzoso en el servidor.
 */
export const onPatientWriteAudit = functions.firestore
    .onDocumentWritten("centers/{centerId}/patients/{patientId}", async (event) => {
        const { centerId, patientId } = event.params;
        const before = event.data?.before.data() || {};
        const after = event.data?.after.data() || {};

        // Si el documento fue eliminado
        if (!event.data?.after.exists) {
            await logAudit(centerId, "DELETE", "patient", patientId, before, null);
            return;
        }

        // Si el documento fue creado
        if (!event.data?.before.exists) {
            await logAudit(centerId, "CREATE", "patient", patientId, null, after);
            return;
        }

        // Si fue una actualización, comparamos campos sensibles si es necesario
        // o simplemente registramos el evento.
        await logAudit(centerId, "UPDATE", "patient", patientId, before, after);
    });

/**
 * Función auxiliar para persistir el log de auditoría.
 */
async function logAudit(
    centerId: string,
    action: string,
    entityType: string,
    entityId: string,
    before: any,
    after: any
) {
    const auditLogRef = db.collection("centers").doc(centerId).collection("auditLogs").doc();

    // Determinamos quién hizo el cambio si el cliente envió la metadata
    const actorUid = after?.lastUpdatedByUid || before?.lastUpdatedByUid || "system_trigger";
    const actorName = after?.lastUpdatedByName || before?.lastUpdatedByName || "Trigger Automático";

    const auditLogData = {
        type: "ACTION",
        action: action,
        entityType: entityType,
        entityId: entityId,
        actorUid: actorUid,
        actorName: actorName,
        resourceType: entityType,
        resourcePath: `centers/${centerId}/patients/${entityId}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
            source: "cloud_function_trigger",
            // Opcional: registrar solo los campos que cambiaron para ahorrar espacio
            changes: action === "UPDATE" ? getDifference(before, after) : null
        }
    };

    await auditLogRef.set(auditLogData);
    console.log(`[Audit] ${action} on ${entityType}/${entityId} registered via Trigger.`);
}

function getDifference(obj1: any, obj2: any) {
    const diff: any = {};
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    for (const key of allKeys) {
        if (key === "updatedAt" || key === "lastUpdatedByUid" || key === "lastUpdatedByName") continue;
        if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
            diff[key] = {
                from: obj1[key] === undefined ? null : obj1[key],
                to: obj2[key] === undefined ? null : obj2[key]
            };
        }
    }
    return Object.keys(diff).length > 0 ? diff : null;
}
