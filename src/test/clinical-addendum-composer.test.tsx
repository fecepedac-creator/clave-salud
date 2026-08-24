import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClinicalAddendumComposer } from "../../features/doctor/components/ClinicalAddendumComposer";

describe("adenda clínica de documento firmado", () => {
  it("no expone la acción a un rol sin capacidad", () => {
    render(<ClinicalAddendumComposer allowed={false} onAppend={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Agregar adenda/ })).not.toBeInTheDocument();
  });

  it("exige texto y confirmación antes de crear la adenda", async () => {
    const onAppend = vi.fn().mockResolvedValue(undefined);
    const confirmAppend = vi.fn().mockReturnValue(true);
    render(<ClinicalAddendumComposer allowed onAppend={onAppend} confirmAppend={confirmAppend} />);
    fireEvent.click(screen.getByRole("button", { name: /Agregar adenda/ }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar y firmar/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Escriba el contenido/);
    expect(confirmAppend).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Contenido de la adenda"), {
      target: { value: "  Aclaración clínica sintética.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar y firmar/ }));
    await waitFor(() => expect(onAppend).toHaveBeenCalledWith("Aclaración clínica sintética."));
    expect(confirmAppend).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent(/Adenda firmada/);
  });

  it("ante un fallo conserva el texto y declara que el original no cambió", async () => {
    const onAppend = vi.fn().mockRejectedValue(new Error("network"));
    render(<ClinicalAddendumComposer allowed onAppend={onAppend} confirmAppend={() => true} />);
    fireEvent.click(screen.getByRole("button", { name: /Agregar adenda/ }));
    fireEvent.change(screen.getByLabelText("Contenido de la adenda"), {
      target: { value: "Texto que debe conservarse" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar y firmar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/original no fue modificado/);
    expect(screen.getByLabelText("Contenido de la adenda")).toHaveValue(
      "Texto que debe conservarse"
    );
  });
});
