import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Patient, Prescription } from "../../types";
import PrintPreviewModal from "../PrintPreviewModal";
import { ToastProvider } from "../Toast";

const logAuditEventRequired = vi.fn();

vi.mock("../../hooks/useAuditLog", () => ({
  logAuditEventRequired: (...args: unknown[]) => logAuditEventRequired(...args),
}));

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "") },
}));

const patient = {
  id: "patient-a",
  centerId: "center-a",
  fullName: "Paciente Uno",
  rut: "12.345.678-9",
  birthDate: "1990-01-01",
  gender: "Femenino",
  medicalHistory: [],
  surgicalHistory: [],
  smokingStatus: "No fumador",
  alcoholStatus: "No consumo",
  medications: [],
  allergies: [],
  consultations: [],
  attachments: [],
  lastUpdated: "2026-08-23T12:00:00.000Z",
} as Patient;

const prescription: Prescription = {
  id: "prescription-a",
  type: "Indicaciones",
  content: "Contenido clínico",
  createdAt: "2026-08-23T12:00:00.000Z",
};

describe("PrintPreviewModal required audit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    logAuditEventRequired.mockReset();
    logAuditEventRequired.mockRejectedValue(new Error("AUDIT_UNAVAILABLE"));
  });

  it("does not print when audit persistence fails", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(
      <ToastProvider>
        <PrintPreviewModal
          isOpen
          onClose={vi.fn()}
          docs={[prescription]}
          doctorName="Dra. Paula Test"
          selectedPatient={patient}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));

    await waitFor(() => expect(logAuditEventRequired).toHaveBeenCalledTimes(1));
    expect(print).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/La impresión no se realizó porque no pudo registrarse la auditoría/i)
    ).toBeInTheDocument();
  });
});
