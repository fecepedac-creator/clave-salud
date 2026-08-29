import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultationHistory from "../ConsultationHistory";
import type { Consultation } from "../../types";

vi.mock("../../firebase", () => ({
  auth: { currentUser: { uid: "doctor-a" } },
  functions: {},
}));
vi.mock("firebase/functions", () => ({
  httpsCallable: () => async () => ({ data: { corrections: [] } }),
}));
vi.mock("../../hooks/useAuditLog", () => ({
  logAccessSafe: vi.fn(),
  useAuditLog: () => ({ logAccess: vi.fn() }),
}));

describe("ConsultationHistory physical exam", () => {
  it("shows the recorded physical exam when a consultation is expanded", async () => {
    const consultation = {
      id: "consultation-a",
      date: "2026-08-29T12:00:00.000Z",
      reason: "Dolor abdominal",
      anamnesis: "Tres días de evolución.",
      physicalExam: "Abdomen blando, depresible y sin signos peritoneales.",
      diagnosis: "Dolor abdominal en estudio",
      professionalName: "Dra. Ejemplo",
      prescriptions: [],
    } as Consultation;

    render(
      <ConsultationHistory
        consultations={[consultation]}
        centerId="center-a"
        patientId="patient-a"
        onPrint={vi.fn()}
        onOpen={vi.fn()}
        onSendEmail={vi.fn()}
      />
    );

    expect(screen.queryByText("Examen físico")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Dolor abdominal"));
    });
    expect(screen.getByText("Examen físico")).toBeInTheDocument();
    expect(
      screen.getByText("Abdomen blando, depresible y sin signos peritoneales.")
    ).toBeInTheDocument();
  });
});
