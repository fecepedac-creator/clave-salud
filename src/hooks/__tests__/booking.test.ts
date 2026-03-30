import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBooking } from "../../../hooks/useBooking";
import * as firestore from "firebase/firestore";

// Mocks de dependencias
vi.mock("firebase/firestore");
vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

describe("useBooking - Casos de Borde Médicos", () => {
  const mockShowToast = vi.fn();
  const mockUpdateAppointment = vi.fn();
  const mockSetAppointments = vi.fn();
  const activeCenterId = "center_1";

  const mockAppointments = [
    { id: "apt_1", status: "available", date: "2026-03-20", time: "09:00", doctorId: "doc_1" },
  ];

  const mockDoctors = [{ id: "doc_1", fullName: "Dr. Test" }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe rechazar un RUT inválido durante el proceso de reserva", async () => {
    const { result } = renderHook(() =>
      useBooking(
        activeCenterId,
        mockAppointments as any,
        [],
        mockDoctors as any,
        mockUpdateAppointment,
        mockSetAppointments,
        mockShowToast
      )
    );

    act(() => {
      result.current.setBookingData({
        name: "Paciente Test",
        rut: "1-1", // RUT Inválido
        phoneDigits: "12345678",
        email: "test@test.com",
      });
      result.current.setSelectedSlot({ date: "2026-03-20", time: "09:00", appointmentId: "apt_1" });
      result.current.setSelectedDoctorForBooking(mockDoctors[0] as any);
    });

    await act(async () => {
      await result.current.handleBookingConfirm();
    });

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("RUT inválido"), "error");
  });

  it("debe prevenir reservas dobles mediante transacciones de Firestore", async () => {
    // Simular que el slot ya no está disponible dentro de la transacción
    (firestore.runTransaction as any).mockImplementation(async (db, cb) => {
      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ status: "booked" }), // Ya reservado
        }),
        update: vi.fn(),
      };
      return cb(mockTx);
    });

    const { result } = renderHook(() =>
      useBooking(
        activeCenterId,
        mockAppointments as any,
        [],
        mockDoctors as any,
        mockUpdateAppointment,
        mockSetAppointments,
        mockShowToast
      )
    );

    act(() => {
      result.current.setBookingData({
        name: "Paciente Test",
        rut: "19.043.931-1", // RUT Válido
        phoneDigits: "98765432",
        email: "",
      });
      result.current.setSelectedSlot({ date: "2026-03-20", time: "09:00", appointmentId: "apt_1" });
      result.current.setSelectedDoctorForBooking(mockDoctors[0] as any);
    });

    await act(async () => {
      await result.current.handleBookingConfirm();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("acaba de ser reservado"),
      "error"
    );
  });
});
