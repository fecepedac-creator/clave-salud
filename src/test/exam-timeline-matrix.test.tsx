import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExamTimelineMatrix } from "../../components/ExamTimelineMatrix";

const renderSection = () => {
  const onChange = vi.fn();
  render(
    <ExamTimelineMatrix
      examSheets={[
        {
          id: "sheet-1",
          date: "2026-08-25",
          exams: {},
          source: "patient_provided",
        },
      ]}
      onChange={onChange}
      examOptions={[
        { id: "hba1c", label: "Hemoglobina glicosilada", unit: "%", category: "metabÃ³lico" },
        { id: "creatinine", label: "Creatinina", unit: "mg/dL", category: "renal" },
      ]}
      availableProfiles={[]}
      consultationHistory={[]}
    />
  );
  fireEvent.click(screen.getByText(/ExÃ¡menes de Seguimiento/i));
  const sheetHeader = screen.getByDisplayValue("2026-08-25").parentElement?.parentElement;
  if (!sheetHeader) throw new Error("No se encontrÃ³ el encabezado de la planilla.");
  fireEvent.click(sheetHeader);
  return onChange;
};

describe("ingreso de exÃ¡menes de seguimiento", () => {
  it("permite buscar y agregar un examen de catÃ¡logo sin recorrer una lista larga", () => {
    const onChange = renderSection();
    fireEvent.change(screen.getByPlaceholderText(/Buscar examen para aÃ±adir fila/i), {
      target: { value: "creat" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Creatinina/ }));
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ exams: { creatinine: "" } }),
    ]);
  });

  it("conserva nombre y procedencia al registrar un examen aportado por el paciente", () => {
    const onChange = renderSection();
    fireEvent.change(screen.getByPlaceholderText(/Examen no listado/i), {
      target: { value: "Vitamina D total" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar fila" }));
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        exams: { "manual:vitamina-d-total": "" },
        customExamLabels: { "manual:vitamina-d-total": "Vitamina D total" },
        source: "patient_provided",
      }),
    ]);
  });

  it("muestra como mÃ¡ximo cuatro fechas y permite avanzar a las siguientes", () => {
    render(
      <ExamTimelineMatrix
        examSheets={Array.from({ length: 5 }, (_, index) => ({
          id: `sheet-${index + 1}`,
          date: `2026-0${index + 1}-01`,
          exams: { creatinine: String(index + 1) },
        }))}
        onChange={vi.fn()}
        examOptions={[{ id: "creatinine", label: "Creatinina", unit: "mg/dL", category: "renal" }]}
        availableProfiles={[]}
        consultationHistory={[]}
      />
    );
    fireEvent.click(screen.getByText(/ExÃ¡menes de seguimiento/i));
    expect(screen.getAllByLabelText(/Fecha de exÃ¡menes/)).toHaveLength(4);
    expect(screen.getByText(/Mostrando fechas 1â€“4 de 5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Siguientes/ }));
    expect(screen.getByText(/Mostrando fechas 2â€“5 de 5/)).toBeInTheDocument();
  });
});
