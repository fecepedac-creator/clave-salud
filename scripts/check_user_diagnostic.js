
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Assuming we have service account info somewhere or can use default credentials
// For this environment, let's try to find if there's a service account JSON.
// If not, we might have to rely on the user.

async function checkUser() {
    try {
        // This is a guess on the service account path if it exists
        // If not, this script will fail, and I'll know I can't query admin-style.
        const serviceAccount = JSON.parse(fs.readFileSync('serviceAccount.json', 'utf8'));

        initializeApp({
            credential: cert(serviceAccount)
        });

        const db = getFirestore();
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', 'dr.felipecepeda@gmail.com').get();

        if (snapshot.empty) {
            console.log('No matching user found in users collection.');
            return;
        }

        snapshot.forEach(doc => {
            console.log('User ID:', doc.id);
            console.log('Data:', JSON.stringify(doc.data(), null, 2));
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkUser();
