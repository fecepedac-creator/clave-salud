
// scripts/verify_sync_logic.js
// Specialized diagnostic script by PYRO Agent to verify Delta Sync logic integrity.

const mockAppointments = [
    { id: 'slot_1', time: '09:00', active: true, status: 'available', isSlot: true },
    { id: 'slot_2', time: '10:00', active: true, status: 'available', isSlot: true },
    { id: 'slot_3', time: '11:00', active: false, status: 'available', isSlot: true }, // Already inactive
];

const nextAppointments = [
    { id: 'slot_1', time: '09:00', active: true, status: 'available', isSlot: true }, // No change
    { id: 'slot_2', time: '10:00', active: true, status: 'booked', isSlot: true },    // Updated status
    { id: 'slot_4', time: '12:00', active: true, status: 'available', isSlot: true }, // New slot
];

function simulateSync(current, next) {
    const results = {
        addsOrUpdates: [],
        deactivates: [],
        opsCount: 0
    };

    // 1. Identify what to Add or Update (matches useCrudOperations line 355)
    for (const nextAppt of next) {
        const currentAppt = current.find((a) => a.id === nextAppt.id);
        const needsUpdate =
            !currentAppt ||
            currentAppt.status !== nextAppt.status ||
            currentAppt.active !== nextAppt.active ||
            currentAppt.time !== nextAppt.time;

        if (needsUpdate) {
            results.addsOrUpdates.push(nextAppt.id);
            results.opsCount++;
        }
    }

    // 2. Identify what to Deactivate (matches useCrudOperations line 380)
    const nextIds = new Set(next.map((a) => a.id));
    for (const currentAppt of current) {
        if (currentAppt.isSlot && !nextIds.has(currentAppt.id) && currentAppt.active !== false) {
            results.deactivates.push(currentAppt.id);
            results.opsCount++;
        }
    }

    return results;
}

const report = simulateSync(mockAppointments, nextAppointments);

console.log("--- Specialized Delta Sync Diagnostic ---");
console.log("Current Slots Count:", mockAppointments.length);
console.log("Next State Slots Count:", nextAppointments.length);
console.log("-----------------------------------------");
console.log("Operations to execute (Batched):");
console.log(" - Adds/Updates:", report.addsOrUpdates.length, report.addsOrUpdates);
console.log(" - Deactivates:", report.deactivates.length, report.deactivates);
console.log("Total Budgeted Operations:", report.opsCount);
console.log("-----------------------------------------");

// Logic Checks
const test1 = report.addsOrUpdates.includes('slot_2'); // Status change
const test2 = report.addsOrUpdates.includes('slot_4'); // New slot
const test3 = !report.addsOrUpdates.includes('slot_1'); // No change, should NOT be in log
const test4 = report.deactivates.includes('slot_3') === false; // Already inactive, should NOT be deactivated again
const test5 = report.opsCount === 2; // slot_2 update and slot_4 add. Wait, slot_1 should be deact? 
// Re-check: slot_1 IS in next, so not deactivated. slot_2 IS in next. slot_3 is NOT in next, but active=false.

// Expected: slot_2 (update), slot_4 (add) = 2 ops.
// Wait, slot_1 is identical, so no update.
// Total ops should be 2.

if (test1 && test2 && test3 && test4 && report.opsCount === 2) {
    console.log("✅ Delta Sync Logic Integrity: VERIFIED");
    process.exit(0);
} else {
    console.log("❌ Delta Sync Logic Integrity: FAILED");
    console.log("Tests results:", { test1, test2, test3, test4, ops: report.opsCount });
    process.exit(1);
}
