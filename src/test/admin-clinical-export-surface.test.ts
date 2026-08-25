// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("administrative clinical-data surfaces", () => {
  it("does not expose client-side clinical backup, restore, or migration controls", () => {
    const dashboard = readFileSync("components/AdminDashboard.tsx", "utf8");
    const professionalManagement = readFileSync(
      "features/admin/components/ProfessionalManagement.tsx",
      "utf8"
    );

    expect(dashboard).not.toContain("backup-clinica.json");
    expect(dashboard).not.toContain("handleRestoreBackup");
    expect(dashboard).not.toContain("MigrationModal");
    expect(dashboard).not.toContain("Restaurar");
    expect(professionalManagement).not.toContain("Migración de Fichas");
    expect(professionalManagement).not.toContain("Importa fichas clínicas desde JSON");
  });
});
