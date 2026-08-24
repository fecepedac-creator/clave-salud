import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgendaPolicyManager from "../AgendaPolicyManager";

const callable = vi.fn();

vi.mock("../../firebase", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_functions: unknown, name: string) => (payload: unknown) =>
    callable(name, payload),
}));

describe("AgendaPolicyManager", () => {
  beforeEach(() => {
    callable.mockReset();
    callable.mockImplementation(async (name: string, payload: { policy?: unknown }) => {
      if (name === "getAgendaPolicy") {
        return {
          data: {
            centerId: "center-a",
            locationId: "default",
            slotDurationMinutes: 30,
            requirePatientContact: true,
            allowPublicCancellation: true,
            cancellationWindowHours: 24,
            allowInternalOutsideHours: false,
            appointmentConflictMode: "block",
            resourceConflictMode: "block",
            revision: 1,
          },
        };
      }
      if (name === "previewAgendaPolicyImpact") {
        return { data: { futureReservations: 3, changedFields: ["appointmentConflictMode"] } };
      }
      return { data: { ...(payload.policy as object), revision: 2 } };
    });
  });

  it("previews impact before saving an audited policy", async () => {
    render(<AgendaPolicyManager centerId="center-a" />);

    await screen.findByText("Políticas de agenda");
    expect(screen.getByLabelText("Exigir teléfono o correo al reservar")).toBeChecked();
    fireEvent.change(screen.getByLabelText("Conflictos de agenda"), {
      target: { value: "require_override" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar impacto" }));

    await screen.findByText(/Vista previa: 3 reservas futuras/);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y guardar" }));

    await screen.findByText("Política guardada y auditada.");
    const updateCall = callable.mock.calls.find(([name]) => name === "updateAgendaPolicy");
    expect(updateCall?.[1]).toMatchObject({
      centerId: "center-a",
      locationId: "default",
      policy: { appointmentConflictMode: "require_override" },
    });
    expect(updateCall?.[1]).toHaveProperty("requestId");
  });

  it("does not expose mutation while loading", () => {
    callable.mockReturnValue(new Promise(() => undefined));
    render(<AgendaPolicyManager centerId="center-a" />);
    expect(screen.queryByRole("button", { name: "Revisar impacto" })).not.toBeInTheDocument();
  });
});
