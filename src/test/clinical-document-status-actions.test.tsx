import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClinicalDocumentStatusActions } from "../../features/doctor/components/ClinicalDocumentStatusActions";

describe("estado y acciones del documento clínico", () => {
  it("separa guardar borrador de la firma explícita", () => {
    const onSaveDraft = vi.fn();
    const onSign = vi.fn();
    render(
      <ClinicalDocumentStatusActions status="draft" onSaveDraft={onSaveDraft} onSign={onSign} />
    );
    expect(screen.getByText("Borrador")).toBeVisible();
    fireEvent.click(screen.getByTestId("btn-guardar-borrador"));
    expect(onSaveDraft).toHaveBeenCalledOnce();
    expect(onSign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("btn-firmar-atencion"));
    expect(onSign).toHaveBeenCalledOnce();
  });

  it("un documento firmado no ofrece edición ni una segunda firma", () => {
    render(
      <ClinicalDocumentStatusActions status="signed" onSaveDraft={vi.fn()} onSign={vi.fn()} />
    );
    expect(screen.getByText("Firmado")).toBeVisible();
    expect(screen.getByText(/Documento bloqueado/)).toBeVisible();
    expect(screen.queryByTestId("btn-guardar-borrador")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-firmar-atencion")).not.toBeInTheDocument();
  });

  it("bloquea ambas acciones mientras existe una operación en curso", () => {
    render(
      <ClinicalDocumentStatusActions status="draft" busy onSaveDraft={vi.fn()} onSign={vi.fn()} />
    );
    expect(screen.getByTestId("btn-guardar-borrador")).toBeDisabled();
    expect(screen.getByTestId("btn-firmar-atencion")).toBeDisabled();
  });
});
