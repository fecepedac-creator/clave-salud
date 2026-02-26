import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase
vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({
        currentUser: { uid: 'test_uid', email: 'test@test.com' },
    })),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        update: vi.fn(),
        commit: vi.fn(),
    })),
}));
