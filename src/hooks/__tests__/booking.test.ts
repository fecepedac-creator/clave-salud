import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBooking } from "../../../hooks/useBooking";

const {
  mockIssuePublicAppointmentChallenge,
  mockHttpsCallable,
  mockGetFunctions,
} = vi.hoisted(() => ({
  mockIssuePublicAppointmentChallenge: vi.fn(),
  mockHttpsCallable: vi.fn(),
  mockGetFunctions: vi.fn(() => ({ app: "functions" })),
}));

vi.mock("firebase/functions", () => ({
  getFunctions: mockGetFunctions,
  httpsCallable: mockHttpsCallable,
}));

vi.mock("../../../firebase", () => ({
  auth: { currentUser: null },
  functions: { app: "functions" },
}));

vi.mock("../../../src/publicAppointmentChallenge", () => ({
  issuePublicAppointmentChallenge: mockIssuePublicAppointmentChallenge,
}));

describe("useBooking - seguridad flujo público", () => {
  const mockShowToast = vi.fn();
  const mockUpdateAppointment = vi.fn();
  const mockSetAppointments = vi.fn();
  const activeCenterId = "center_1";

  const mockAppointments = [
    {
      id: "apt_1",
      status: "available",
      date: "2026-03-20",
      time: "09:00",
      doctorId: "doc_1",
      active: true,
    },
  ];

  const mockDoctors = [{ id: "doc_1", fullName: "Dr. Test", visibleInBooking: true, active: true }];

  beforeEach(() => {
    vi.clearAllMocks();
    mockIssuePublicAppointmentChallenge.mockResolvedValue({
      challengeId: "challenge_1",
      challengeToken: "token_1",
      expiresAt: Date.now() + 60_000,
    });
  });

  it("solicita challenge y reserva por callable backend", async () => {
    const bookCallable = vi.fn().mockResolvedValue({
      data: {
        appointment: {
          id: "apt_1",
          status: "booked",
          patientName: "Paciente Test",
          patientRut: "12.345.678-5",
          patientPhone: "+56912345678",
          active: true,
        },
      },
    });
    mockHttpsCallable.mockReturnValue(bookCallable);

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
        rut: "12.345.678-5",
        phoneDigits: "12345678",
        email: "test@test.com",
      });
      result.current.setSelectedSlot({ date: "2026-03-20", time: "09:00", appointmentId: "apt_1" });
      result.current.setSelectedDoctorForBooking(mockDoctors[0] as any);
    });

    await act(async () => {
      await result.current.handleBookingConfirm();
    });

    expect(mockIssuePublicAppointmentChallenge).toHaveBeenCalledWith({
      centerId: activeCenterId,
      action: "book",
      rut: "12.345.678-5",
      phone: "+56912345678",
    });
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "bookPublicAppointment");
    expect(bookCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        centerId: activeCenterId,
        challengeId: "challenge_1",
        challengeToken: "token_1",
      })
    );
    expect(mockSetAppointments).toHaveBeenCalled();
  });

  it("solicita challenge para lookup y usa la callable endurecida", async () => {
    const lookupCallable = vi.fn().mockResolvedValue({
      data: {
        appointments: [{ id: "apt_booked_1", status: "booked" }],
      },
    });
    mockHttpsCallable.mockReturnValue(lookupCallable);

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
      result.current.setCancelRut("12.345.678-5");
      result.current.setCancelPhoneDigits("12345678");
    });

    await act(async () => {
      await result.current.handleLookupAppointments();
    });

    expect(mockIssuePublicAppointmentChallenge).toHaveBeenCalledWith({
      centerId: activeCenterId,
      action: "lookup",
      rut: "12.345.678-5",
      phone: "+56912345678",
    });
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "listPatientAppointments");
    expect(lookupCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        centerId: activeCenterId,
        challengeId: "challenge_1",
        challengeToken: "token_1",
      })
    );
  });

  it("solicita challenge para cancelación y llama la callable endurecida", async () => {
    const cancelCallable = vi.fn().mockResolvedValue({ data: { ok: true } });
    mockHttpsCallable.mockReturnValue(cancelCallable);

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
      result.current.setCancelRut("12.345.678-5");
      result.current.setCancelPhoneDigits("12345678");
    });

    await act(async () => {
      await result.current.cancelPatientAppointment({
        id: "apt_booked_1",
        status: "booked",
      } as any);
    });

    expect(mockIssuePublicAppointmentChallenge).toHaveBeenCalledWith({
      centerId: activeCenterId,
      action: "cancel",
      rut: "12.345.678-5",
      phone: "+56912345678",
    });
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "cancelPatientAppointment");
    expect(cancelCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        centerId: activeCenterId,
        appointmentId: "apt_booked_1",
        challengeId: "challenge_1",
        challengeToken: "token_1",
      })
    );
    expect(mockShowToast).toHaveBeenCalledWith("Hora cancelada y liberada correctamente.", "success");
  });
});
