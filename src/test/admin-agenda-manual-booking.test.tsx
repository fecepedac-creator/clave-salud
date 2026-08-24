import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpsCallable } from "firebase/functions";
import { AdminAgenda } from "../../features/admin/components/AdminAgenda";
import { Appointment, Doctor } from "../../types";

vi.mock("../../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "admin-test" } },
  functions: {},
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "timestamp"),
  where: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  Timestamp: { now: vi.fn() },
}));

describe("AdminAgenda reserva manual", () => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-18`;
  const doctor = {
    id: "doctor-1",
    centerId: "center-1",
    rut: "10.000.000-1",
    fullName: "Profesional Uno",
    role: "MEDICO",
    specialty: "Medicina General",
    email: "profesional@example.com",
    active: true,
    agendaConfig: { slotDuration: 20, startTime: "16:00", endTime: "17:00" },
  } as Doctor;
  const availableSlot: Appointment = {
    id: "slot-1600",
    centerId: "center-1",
    doctorId: doctor.id,
    doctorUid: doctor.id,
    date,
    time: "16:00",
    status: "available",
    patientName: "",
    patientRut: "",
    active: true,
  };

  beforeEach(() => vi.clearAllMocks());

  const renderAgenda = (
    agendaAppointments: Appointment[] = [availableSlot],
    openManualBooking = true
  ) => {
    const onUpdateAppointments = vi.fn();
    const onUpdatePatients = vi.fn();
    const showToast = vi.fn();

    render(
      <AdminAgenda
        centerId="center-1"
        resolvedCenterId="center-1"
        doctors={[doctor]}
        appointments={agendaAppointments}
        onUpdateAppointments={onUpdateAppointments}
        patients={[]}
        hasActiveCenter
        onLogActivity={vi.fn()}
        ROLE_LABELS={{ MEDICO: "Médico" }}
        upsertStaffAndPublic={vi.fn(async () => undefined)}
        medicalServices={[]}
        showToast={showToast}
        activeCenter={{ id: "center-1", name: "Centro Uno" }}
        onUpdatePatients={onUpdatePatients}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "18" }));
    if (openManualBooking) {
      fireEvent.click(screen.getByRole("button", { name: "Agendar paciente 16:00" }));
    }
    return { onUpdateAppointments, onUpdatePatients, showToast };
  };

  it("mantiene la acción de cerrar bloque y agrega reserva explícita con continuidad", () => {
    renderAgenda();
    expect(screen.getByRole("button", { name: /16:00.*Abierto/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agendamiento Manual" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar y finalizar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar y continuar" })).toBeInTheDocument();
  });

  it("reserva mediante la callable, limpia el paciente y conserva la agenda", async () => {
    const callable = vi.fn(async () => ({ data: { success: true } }));
    vi.mocked(httpsCallable).mockReturnValue(callable as any);
    const { onUpdateAppointments, onUpdatePatients, showToast } = renderAgenda();

    fireEvent.change(screen.getByLabelText("Nombre completo del paciente"), {
      target: { value: "Paciente Dos" },
    });
    fireEvent.change(screen.getByLabelText("RUT del paciente"), {
      target: { value: "11.111.111-1" },
    });
    fireEvent.change(screen.getByLabelText("Teléfono del paciente"), {
      target: { value: "+56911111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agendar y continuar" }));

    await waitFor(() => expect(callable).toHaveBeenCalledTimes(1));
    expect(httpsCallable).toHaveBeenCalledWith({}, "bookAdministrativeAppointment");
    expect(onUpdateAppointments).toHaveBeenCalledTimes(1);
    expect(onUpdatePatients).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      "Cita agendada. Selecciona otro cupo para continuar.",
      "success"
    );
    expect(screen.queryByRole("heading", { name: "Agendamiento Manual" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agendar paciente 16:00" }));
    expect(screen.getByLabelText("Nombre completo del paciente")).toHaveValue("");
    expect(screen.getByLabelText("RUT del paciente")).toHaveValue("");
  });

  it("registra llegada mediante un comando operativo sin tocar cobros", async () => {
    const callable = vi.fn(async () => ({ data: { success: true, idempotent: false } }));
    vi.mocked(httpsCallable).mockReturnValue(callable as any);
    const bookedSlot: Appointment = {
      ...availableSlot,
      status: "booked",
      patientId: "patient-1",
      patientName: "Paciente Uno",
      patientRut: "22.222.222-2",
      billable: true,
      amount: 25000,
    };
    const { onUpdateAppointments } = renderAgenda([bookedSlot], false);

    fireEvent.click(screen.getByRole("button", { name: "Marcar llegada 16:00" }));
    await waitFor(() => expect(callable).toHaveBeenCalledTimes(1));

    expect(httpsCallable).toHaveBeenCalledWith({}, "updateAppointmentArrival");
    expect(callable).toHaveBeenCalledWith(
      expect.objectContaining({
        centerId: "center-1",
        appointmentId: bookedSlot.id,
        arrived: true,
      })
    );
    const updated = onUpdateAppointments.mock.calls[0][0] as Appointment[];
    expect(updated[0]).toMatchObject({
      id: bookedSlot.id,
      arrivalStatus: "arrived",
      billable: true,
      amount: 25000,
    });
  });

  it("conserva la solicitud y exige motivo cuando el backend autoriza una excepción", async () => {
    const callable = vi
      .fn()
      .mockResolvedValueOnce({ data: { success: false, error: "OVERRIDE_REQUIRED" } })
      .mockResolvedValueOnce({ data: { success: true, idempotent: false } });
    vi.mocked(httpsCallable).mockReturnValue(callable as any);
    const { onUpdateAppointments } = renderAgenda();

    fireEvent.change(screen.getByLabelText("Nombre completo del paciente"), {
      target: { value: "Paciente Excepción" },
    });
    fireEvent.change(screen.getByLabelText("RUT del paciente"), {
      target: { value: "11.111.111-1" },
    });
    fireEvent.change(screen.getByLabelText("Teléfono del paciente"), {
      target: { value: "+56911111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agendar y finalizar" }));

    const reason = await screen.findByLabelText("Motivo de excepción de agenda");
    expect(screen.getByRole("button", { name: "Agendar y finalizar" })).toBeDisabled();
    fireEvent.change(reason, { target: { value: "Autorizado por coordinación del centro" } });
    fireEvent.click(screen.getByRole("button", { name: "Agendar y finalizar" }));

    await waitFor(() => expect(onUpdateAppointments).toHaveBeenCalledTimes(1));
    expect(callable).toHaveBeenCalledTimes(2);
    expect(callable.mock.calls[1][0]).toMatchObject({
      idempotencyKey: callable.mock.calls[0][0].idempotencyKey,
      override: { reason: "Autorizado por coordinación del centro" },
    });
  });
});
