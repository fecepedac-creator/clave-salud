import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const db = admin.firestore();

// --- TYPES ---
interface AppointmentPayload {
    attendanceStatus: "completed" | "cancelled" | "no-show" | null;
    billable: boolean;
    amount: number | null;
}

// --- UTILIDADES ---

// Verifica permiso asumiendo que el token tiene el email o claim (se envia via context)

function getYearMonth(dateString?: string): string {
    if (!dateString) {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    // Asume date en formato "YYYY-MM-DD"
    return dateString.substring(0, 7);
}

// --- CALLABLE: ACTUALIZAR ASISTENCIA & COBROS ---

export const updateAppointmentAttendance = functions.https.onCall(async (data, context) => {
    // 1. Auth check
    const uid = context.auth?.uid;
    const isSuperAdmin = context.auth?.token?.super_admin === true || context.auth?.token?.superadmin === true;
    if (!uid && !isSuperAdmin) {
        throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    }

    const { centerId, appointmentId, payload } = data as { centerId: string, appointmentId: string, payload: AppointmentPayload };

    if (!centerId || !appointmentId || !payload) {
        throw new functions.https.HttpsError("invalid-argument", "Parámetros incompletos.");
    }

    // 2. Traer la cita actual
    const apptRef = db.collection("centers").doc(centerId).collection("appointments").doc(appointmentId);
    const apptSnap = await apptRef.get();

    if (!apptSnap.exists) {
        throw new functions.https.HttpsError("not-found", "La cita no existe.");
    }

    const apptData = apptSnap.data()!;
    const professionalId = apptData.doctorId || apptData.doctorUid || apptData.professionalId;
    const yearMonth = getYearMonth(apptData.date);

    // 3. Validar permisos: Admin del centro, o Profesional dueño, o SuperAdmin
    if (!isSuperAdmin) {
        const staffSnap = await db.collection("centers").doc(centerId).collection("staff").doc(uid!).get();
        if (!staffSnap.exists || staffSnap.data()?.active !== true) {
            throw new functions.https.HttpsError("permission-denied", "Acceso denegado al centro.");
        }
        const role = (staffSnap.data()?.accessRole || staffSnap.data()?.role || "").toLowerCase();
        const isCenterAdmin = role === "center_admin" || role === "admin";

        if (!isCenterAdmin && uid !== professionalId) {
            throw new functions.https.HttpsError("permission-denied", "Solo el administrador o el profesional asignado puede modificar esta cita.");
        }
    }

    // 4. Validar "Mes Cerrado"
    const closureRef = db.collection("centers").doc(centerId).collection("closures_month").doc(yearMonth);
    const closureSnap = await closureRef.get();
    if (closureSnap.exists && closureSnap.data()?.status === "closed") {
        throw new functions.https.HttpsError("failed-precondition", `El mes ${yearMonth} ya se encuentra cerrado. No se pueden modificar cobros ni estados de asistencia.`);
    }

    // 5. Proceder a actualizar
    const oldStatus = apptData.attendanceStatus;
    const oldBillable = apptData.billable;
    const oldAmount = apptData.amount;

    // Solo registrar en auditoría si en serio hay algo distinto
    const hasChanges = oldStatus !== payload.attendanceStatus ||
        oldBillable !== payload.billable ||
        oldAmount !== payload.amount;

    if (!hasChanges) {
        return { success: true, message: "Sin cambios." };
    }

    // Creamos un batch para Appointment + Audit
    const batch = db.batch();

    batch.update(apptRef, {
        attendanceStatus: payload.attendanceStatus !== undefined ? payload.attendanceStatus : null,
        billable: payload.billable ?? false,
        amount: payload.amount !== undefined ? payload.amount : null,
        attendanceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        attendanceUpdatedBy: uid
    });

    // Auditoría centralizada
    const auditRef = db.collection("centers").doc(centerId).collection("auditLogs").doc();
    batch.set(auditRef, {
        id: auditRef.id,
        centerId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actorUid: uid,
        action: "APPOINTMENT_ATTENDANCE_CHANGE",
        entityType: "appointment",
        entityId: appointmentId,
        patientId: apptData.patientId || null,
        details: `Cambiado a ${payload.attendanceStatus} (Billable: ${payload.billable}, $: ${payload.amount})`,
        metadata: {
            oldStatus, newStatus: payload.attendanceStatus,
            oldBillable, newBillable: payload.billable,
            oldAmount, newAmount: payload.amount
        }
    });

    await batch.commit();
    return { success: true, message: "Actualizado correctamente." };
});

// --- TRIGGER: AGREGADOS MENSUALES ---

export const onAppointmentChanged_Performance = functions.firestore
    .document("centers/{centerId}/appointments/{appointmentId}")
    .onWrite(async (change, context) => {
        const centerId = context.params.centerId;

        if (!change.before.exists && !change.after.exists) return; // Weird state

        const before = change.before.data() || {};
        const after = change.after.data() || {};

        const oldDateString = before.date;
        const oldYearMonth = oldDateString ? getYearMonth(oldDateString) : null;
        const oldProfessionalId = before.doctorId || before.doctorUid || before.professionalId || null;

        const newDateString = after.date;
        const newYearMonth = newDateString ? getYearMonth(newDateString) : null;
        const newProfessionalId = after.doctorId || after.doctorUid || after.professionalId || null;

        const isNew = !change.before.exists;
        const hardDeleted = change.before.exists && !change.after.exists;

        const statusChanged = before.attendanceStatus !== after.attendanceStatus;
        const billableChanged = before.billable !== after.billable;
        const amountChanged = before.amount !== after.amount;
        const bookingStatusChanged = before.status !== after.status;
        const professionalChanged = oldProfessionalId !== newProfessionalId;
        const dateChanged = oldYearMonth !== newYearMonth;

        if (!isNew && !statusChanged && !billableChanged && !amountChanged && !bookingStatusChanged && !hardDeleted && !professionalChanged && !dateChanged) {
            return; // No performance impact
        }

        // --- VALIDAR CERRADO DE MESES ---
        const closedMonths = new Set<string>();
        if (oldYearMonth) {
            const oldClosureSnap = await db.collection("centers").doc(centerId).collection("closures_month").doc(oldYearMonth).get();
            if (oldClosureSnap.exists && oldClosureSnap.data()?.status === "closed") {
                closedMonths.add(oldYearMonth);
            }
        }
        if (newYearMonth && newYearMonth !== oldYearMonth) {
            const newClosureSnap = await db.collection("centers").doc(centerId).collection("closures_month").doc(newYearMonth).get();
            if (newClosureSnap.exists && newClosureSnap.data()?.status === "closed") {
                closedMonths.add(newYearMonth);
            }
        }

        if (closedMonths.size > 0) {
            // Block update and register audit log
            const auditRef = db.collection("centers").doc(centerId).collection("auditLogs").doc();
            await auditRef.set({
                id: auditRef.id,
                centerId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                actorUid: "system", // Trigger execution
                action: "CLOSED_MONTH_UPDATE_BLOCKED",
                entityType: "appointment",
                entityId: context.params.appointmentId,
                details: `Intento de modificar stats en meses cerrados: ${Array.from(closedMonths).join(", ")}`,
                metadata: {
                    oldYearMonth, newYearMonth, professionalChanged, dateChanged
                }
            });
            return; // Block execution
        }

        // --- CÁLCULO DE DELTAS ---
        interface Deltas {
            totalAppointments: number;
            completed: number;
            noShow: number;
            cancelled: number;
            billableCount: number;
            totalAmountBillable: number;
        }

        const buildZeroDeltas = (): Deltas => ({
            totalAppointments: 0,
            completed: 0,
            noShow: 0,
            cancelled: 0,
            billableCount: 0,
            totalAmountBillable: 0
        });

        const oldDeltas = buildZeroDeltas();
        const newDeltas = buildZeroDeltas();

        // 1. Restar el estado "Before"
        if (change.before.exists) {
            if (before.status === "booked") oldDeltas.totalAppointments -= 1;
            if (before.attendanceStatus === "completed") oldDeltas.completed -= 1;
            if (before.attendanceStatus === "no-show") oldDeltas.noShow -= 1;
            if (before.attendanceStatus === "cancelled") oldDeltas.cancelled -= 1;
            if (before.attendanceStatus === "completed" && before.billable) {
                oldDeltas.billableCount -= 1;
                oldDeltas.totalAmountBillable -= (Number(before.amount) || 0);
            }
        }

        // 2. Sumar el estado "After"
        if (change.after.exists) {
            if (after.status === "booked") newDeltas.totalAppointments += 1;
            if (after.attendanceStatus === "completed") newDeltas.completed += 1;
            if (after.attendanceStatus === "no-show") newDeltas.noShow += 1;
            if (after.attendanceStatus === "cancelled") newDeltas.cancelled += 1;
            if (after.attendanceStatus === "completed" && after.billable) {
                newDeltas.billableCount += 1;
                newDeltas.totalAmountBillable += (Number(after.amount) || 0);
            }
        }

        const centerUpdates = new Map<string, Deltas>(); // key: yearMonth
        const profUpdates = new Map<string, Deltas>();   // key: yearMonth|profId

        const accumulateMap = (map: Map<string, Deltas>, key: string, deltas: Deltas) => {
            if (!map.has(key)) map.set(key, buildZeroDeltas());
            const target = map.get(key)!;
            target.totalAppointments += deltas.totalAppointments;
            target.completed += deltas.completed;
            target.noShow += deltas.noShow;
            target.cancelled += deltas.cancelled;
            target.billableCount += deltas.billableCount;
            target.totalAmountBillable += deltas.totalAmountBillable;
        };

        if (change.before.exists && oldYearMonth) {
            accumulateMap(centerUpdates, oldYearMonth, oldDeltas);
            if (oldProfessionalId) accumulateMap(profUpdates, `${oldYearMonth}|${oldProfessionalId}`, oldDeltas);
        }

        if (change.after.exists && newYearMonth) {
            accumulateMap(centerUpdates, newYearMonth, newDeltas);
            if (newProfessionalId) accumulateMap(profUpdates, `${newYearMonth}|${newProfessionalId}`, newDeltas);
        }

        const dbBatch = db.batch();

        for (const [ym, d] of centerUpdates.entries()) {
            if (Object.values(d).every(v => v === 0)) continue;
            let updateObject: any = { lastUpdated: admin.firestore.FieldValue.serverTimestamp() };
            for (const [k, v] of Object.entries(d)) {
                if (v !== 0) updateObject[k] = admin.firestore.FieldValue.increment(v as number);
            }
            const ref = db.collection("centers").doc(centerId).collection("stats_center_month").doc(ym);
            dbBatch.set(ref, { id: ym, centerId, yearMonth: ym, ...updateObject }, { merge: true });
        }

        for (const [key, d] of profUpdates.entries()) {
            if (Object.values(d).every(v => v === 0)) continue;
            const [ym, profId] = key.split("|");
            let updateObject: any = { lastUpdated: admin.firestore.FieldValue.serverTimestamp() };
            for (const [k, v] of Object.entries(d)) {
                if (v !== 0) updateObject[k] = admin.firestore.FieldValue.increment(v as number);
            }
            const profKey = `${profId}_${ym}`;
            const ref = db.collection("centers").doc(centerId).collection("stats_professional_month").doc(profKey);
            dbBatch.set(ref, { id: profKey, centerId, doctorId: profId, yearMonth: ym, ...updateObject }, { merge: true });
        }

        await dbBatch.commit();
        console.log(`Re-calculated stats for ${centerId} - Appointment: ${context.params.appointmentId}`);
    });

// --- CALLABLE: RECOMPUTE MONTH STATS ---

export const recomputeMonthStats = functions.https.onCall(async (data, context) => {
    // 1. Auth check
    const uid = context.auth?.uid;
    const isSuperAdmin = context.auth?.token?.super_admin === true || context.auth?.token?.superadmin === true;
    if (!uid && !isSuperAdmin) {
        throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    }

    const { centerId, yearMonth } = data as { centerId: string, yearMonth: string };
    if (!centerId || !yearMonth) {
        throw new functions.https.HttpsError("invalid-argument", "centerId y yearMonth son requeridos.");
    }

    // 2. Center Admin & Closures Check
    if (!isSuperAdmin) {
        const staffSnap = await db.collection("centers").doc(centerId).collection("staff").doc(uid!).get();
        if (!staffSnap.exists || staffSnap.data()?.active !== true) {
            throw new functions.https.HttpsError("permission-denied", "Acceso denegado al centro.");
        }
        const role = (staffSnap.data()?.accessRole || staffSnap.data()?.role || "").toLowerCase();
        if (role !== "center_admin" && role !== "admin") {
            throw new functions.https.HttpsError("permission-denied", "Solo administradores pueden recalcular el mes entero.");
        }
    }

    const closureSnap = await db.collection("centers").doc(centerId).collection("closures_month").doc(yearMonth).get();
    if (!isSuperAdmin && closureSnap.exists && closureSnap.data()?.status === "closed") {
        throw new functions.https.HttpsError("failed-precondition", `El mes ${yearMonth} ya se encuentra cerrado.`);
    }

    // 3. Obtener todas las citas del mes
    const [year, month] = yearMonth.split("-");
    const startDateStr = `${yearMonth}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDateStr = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    const apptsSnap = await db.collection("centers").doc(centerId).collection("appointments")
        .where("date", ">=", startDateStr)
        .where("date", "<=", endDateStr)
        .get();

    // 4. Instanciar contadores en 0
    let centerTotals = { totalAppointments: 0, completed: 0, noShow: 0, cancelled: 0, billableCount: 0, totalAmountBillable: 0 };
    let profTotals: Record<string, typeof centerTotals> = {};

    apptsSnap.forEach(doc => {
        const a = doc.data();
        // Soft delete ignore
        if (!a.status) return;

        const profId = a.doctorId || a.doctorUid || a.professionalId;
        if (!profId) return; // ignore appointments without a bound professional

        if (!profTotals[profId]) {
            profTotals[profId] = { totalAppointments: 0, completed: 0, noShow: 0, cancelled: 0, billableCount: 0, totalAmountBillable: 0 };
        }

        // Apply tallies
        if (a.status === "booked") {
            centerTotals.totalAppointments++;
            profTotals[profId].totalAppointments++;
        }
        if (a.attendanceStatus === "completed") {
            centerTotals.completed++;
            profTotals[profId].completed++;
        }
        if (a.attendanceStatus === "no-show") {
            centerTotals.noShow++;
            profTotals[profId].noShow++;
        }
        if (a.attendanceStatus === "cancelled") {
            centerTotals.cancelled++;
            profTotals[profId].cancelled++;
        }
        if (a.attendanceStatus === "completed" && a.billable) {
            centerTotals.billableCount++;
            profTotals[profId].billableCount++;
            centerTotals.totalAmountBillable += (Number(a.amount) || 0);
            profTotals[profId].totalAmountBillable += (Number(a.amount) || 0);
        }
    });

    // 5. Commit Batch Update
    const batch = db.batch();
    const commonMerge = {
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    // Center Update
    const centerStatsRef = db.collection("centers").doc(centerId).collection("stats_center_month").doc(yearMonth);
    batch.set(centerStatsRef, {
        id: yearMonth,
        centerId,
        yearMonth,
        ...centerTotals,
        ...commonMerge
    }, { merge: true });

    // Professionals Updates
    for (const [profId, stats] of Object.entries(profTotals)) {
        const pKey = `${profId}_${yearMonth}`;
        const pRef = db.collection("centers").doc(centerId).collection("stats_professional_month").doc(pKey);
        batch.set(pRef, {
            id: pKey,
            centerId,
            doctorId: profId, // standardized standard
            yearMonth,
            ...stats,
            ...commonMerge
        }, { merge: true });
    }

    await batch.commit();

    return {
        success: true,
        message: `Mes ${yearMonth} recalculado. Se incluyeron ${apptsSnap.size} citas. Docs actualizados: ${Object.keys(profTotals).length + 1}`
    };
});

// --- CALLABLE: CLOSE / OPEN MONTH ---

export const closeMonth = functions.https.onCall(async (data, context) => {
    // 1. Auth check
    const uid = context.auth?.uid;
    const isSuperAdmin = context.auth?.token?.super_admin === true || context.auth?.token?.superadmin === true;
    if (!uid && !isSuperAdmin) {
        throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    }

    const { centerId, yearMonth } = data as { centerId: string, yearMonth: string };
    if (!centerId || !yearMonth) {
        throw new functions.https.HttpsError("invalid-argument", "centerId y yearMonth son requeridos.");
    }

    // 2. Center Admin Check (if not SuperAdmin)
    if (!isSuperAdmin) {
        const staffSnap = await db.collection("centers").doc(centerId).collection("staff").doc(uid!).get();
        if (!staffSnap.exists || staffSnap.data()?.active !== true) {
            throw new functions.https.HttpsError("permission-denied", "Acceso denegado al centro.");
        }
        const role = (staffSnap.data()?.accessRole || staffSnap.data()?.role || "").toLowerCase();
        if (role !== "center_admin" && role !== "admin") {
            throw new functions.https.HttpsError("permission-denied", "Solo administradores pueden cerrar el mes.");
        }
    }

    const closureRef = db.collection("centers").doc(centerId).collection("closures_month").doc(yearMonth);
    await closureRef.set({
        id: yearMonth,
        centerId,
        yearMonth,
        status: "closed",
        closedAt: admin.firestore.FieldValue.serverTimestamp(),
        closedBy: uid
    });

    return { success: true, message: "Mes cerrado con éxito." };
});

export const reopenMonth = functions.https.onCall(async (data, context) => {
    // Same auth
    const uid = context.auth?.uid;
    const isSuperAdmin = context.auth?.token?.super_admin === true || context.auth?.token?.superadmin === true;
    if (!uid && !isSuperAdmin) {
        throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    }

    const { centerId, yearMonth } = data as { centerId: string, yearMonth: string };
    if (!centerId || !yearMonth) {
        throw new functions.https.HttpsError("invalid-argument", "centerId y yearMonth son requeridos.");
    }

    if (!isSuperAdmin) {
        const staffSnap = await db.collection("centers").doc(centerId).collection("staff").doc(uid!).get();
        if (!staffSnap.exists || staffSnap.data()?.active !== true) {
            throw new functions.https.HttpsError("permission-denied", "Acceso denegado al centro.");
        }
        const role = (staffSnap.data()?.accessRole || staffSnap.data()?.role || "").toLowerCase();
        if (role !== "center_admin" && role !== "admin") {
            throw new functions.https.HttpsError("permission-denied", "Solo administradores pueden reabrir el mes.");
        }
    }

    const closureRef = db.collection("centers").doc(centerId).collection("closures_month").doc(yearMonth);
    await closureRef.set({
        id: yearMonth,
        centerId,
        yearMonth,
        status: "open",
        reopenedAt: admin.firestore.FieldValue.serverTimestamp(),
        reopenedBy: uid
    });

    return { success: true, message: "Mes reabierto con éxito." };
});
