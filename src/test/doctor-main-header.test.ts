import { describe, expect, it } from "vitest";
import { getProfessionalPanelLabel } from "../../features/doctor/components/DoctorMainHeader";

describe("encabezado del dashboard profesional", () => {
  it.each([
    ["MEDICO", "Médico"],
    ["KINESIOLOGO", "Kinesiólogo"],
    ["PSICOLOGO", "Psicólogo"],
    ["NUTRICIONISTA", "Nutricionista"],
    ["FONOAUDIOLOGO", "Fonoaudiólogo"],
    ["TERAPEUTA_OCUPACIONAL", "Terapeuta ocupacional"],
  ])("identifica %s como %s", (role, expected) => {
    expect(getProfessionalPanelLabel(role)).toBe(expected);
  });

  it("usa una etiqueta clínica neutral para roles desconocidos", () => {
    expect(getProfessionalPanelLabel("ROL_FUTURO")).toBe("Profesional de salud");
  });
});
