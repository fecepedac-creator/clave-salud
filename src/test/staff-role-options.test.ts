import { describe, expect, it } from "vitest";
import { ROLE_CATALOG } from "../../constants";
import { getCreatableClinicalRoleOptions } from "../../features/admin/utils/staffRoleOptions";

describe("center staff role options", () => {
  it("offers every clinical profession regardless of the center legacy allowlist", () => {
    const labels = Object.fromEntries(ROLE_CATALOG.map((role) => [role.id, role.label]));
    const ids = getCreatableClinicalRoleOptions(labels).map((option) => option.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "MEDICO",
        "ENFERMERA",
        "TENS",
        "NUTRICIONISTA",
        "PSICOLOGO",
        "KINESIOLOGO",
        "TERAPEUTA_OCUPACIONAL",
        "FONOAUDIOLOGO",
        "PODOLOGO",
        "TECNOLOGO_MEDICO",
        "ASISTENTE_SOCIAL",
        "PREPARADOR_FISICO",
        "MATRONA",
        "ODONTOLOGO",
        "QUIMICO_FARMACEUTICO",
      ])
    );
    expect(ids).not.toContain("SERVICIO");
    expect(ids).not.toContain("ADMIN_CENTRO");
    expect(ids).not.toContain("ADMINISTRATIVO");
  });
});
