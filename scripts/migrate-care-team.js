/**
 * MIGRATION SCRIPT: Backfill careTeamUids for Patients
 * 
 * This script iterates through all patients, looks at their consultations, 
 * and populates the 'careTeamUids' field with the UIDs of the professionals 
 * who attended them.
 * 
 * Usage:
 * 1. Ensure you have firebase-admin installed: npm install firebase-admin
 * 2. Run with Node: node scripts/migrate-care-team.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
    console.log('--- Starting Migration: Care Team Backfill ---');

    const patientsRef = db.collection('patients');
    const snapshot = await patientsRef.get();

    if (snapshot.empty) {
        console.log('No patients found.');
        return;
    }

    console.log(`Found ${snapshot.size} patients. Processing...`);

    let count = 0;
    for (const doc of snapshot.docs) {
        const patientData = doc.data();
        const patientId = doc.id;

        // Get consultations for this patient
        const consultationsRef = db.collection('patients').doc(patientId).collection('consultations');
        const consultSnapshot = await consultationsRef.get();

        const professionalIds = new Set(patientData.careTeamUids || []);
        const allowedUids = new Set(patientData.accessControl?.allowedUids || []);
        const centerIds = new Set(patientData.accessControl?.centerIds || []);

        // Also include owner
        if (patientData.ownerUid) {
            professionalIds.add(patientData.ownerUid);
            allowedUids.add(patientData.ownerUid);
        }

        consultSnapshot.forEach(cDoc => {
            const cData = cDoc.data();
            if (cData.professionalId) {
                professionalIds.add(cData.professionalId);
                allowedUids.add(cData.professionalId);
            }
            if (cData.centerId) {
                centerIds.add(cData.centerId);
            }
        });

        const careTeamUids = Array.from(professionalIds);
        const finalAllowedUids = Array.from(allowedUids);
        const finalCenterIds = Array.from(centerIds);

        // Update patient document
        await patientsRef.doc(patientId).update({
            careTeamUids: careTeamUids,
            'accessControl.allowedUids': finalAllowedUids,
            'accessControl.centerIds': finalCenterIds,
            lastUpdated: new Date().toISOString()
        });

        count++;
        if (count % 10 === 0) {
            console.log(`Processed ${count}/${snapshot.size} patients...`);
        }
    }

    console.log(`--- Migration Finished: ${count} patients updated ---`);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
