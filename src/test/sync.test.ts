import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrudOperations } from '../../hooks/useCrudOperations';
import * as firestore from 'firebase/firestore';

// Mock our own firebase module
vi.mock('../../firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test_uid' } },
}));

// Helper to mock firestore functions
vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual('firebase/firestore');
    return {
        ...actual,
        doc: vi.fn(),
        writeBatch: vi.fn(),
        serverTimestamp: vi.fn(() => 'mock-timestamp'),
    };
});

describe('useCrudOperations - syncAppointments Delta Sync', () => {
    const showToast = vi.fn();
    const activeCenterId = 'center_1';
    const mockAppointments = [
        { id: 'slot_1', time: '09:00', active: true, status: 'available', isSlot: true },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should only update slots that have changed', async () => {
        const mockBatch = {
            set: vi.fn(),
            update: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(firestore.writeBatch).mockReturnValue(mockBatch as any);
        vi.mocked(firestore.doc).mockReturnValue({} as any);

        const { result } = renderHook(() =>
            useCrudOperations(activeCenterId, mockAppointments as any, showToast)
        );

        const nextAppointments = [
            { id: 'slot_1', time: '09:00', active: true, status: 'booked', isSlot: true }, // Changed status
            { id: 'slot_2', time: '10:00', active: true, status: 'available', isSlot: true }, // New slot
        ];

        const setIsSyncing = vi.fn();
        await result.current.syncAppointments(nextAppointments as any, setIsSyncing);

        // Should call set for slot_1 (update) and slot_2 (add)
        expect(mockBatch.set).toHaveBeenCalledTimes(2);
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
        expect(setIsSyncing).toHaveBeenCalledWith(true);
        expect(setIsSyncing).toHaveBeenCalledWith(false);
    });

    it('should deactivate slots not present in nextAppointments', async () => {
        const mockBatch = {
            set: vi.fn(),
            update: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(firestore.writeBatch).mockReturnValue(mockBatch as any);
        vi.mocked(firestore.doc).mockReturnValue({} as any);

        const { result } = renderHook(() =>
            useCrudOperations(activeCenterId, mockAppointments as any, showToast)
        );

        const nextAppointments: any[] = []; // Empty, should deactivate slot_1

        await result.current.syncAppointments(nextAppointments, vi.fn());

        // Should call update for deactivate
        expect(mockBatch.update).toHaveBeenCalledTimes(1);
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
});
