import { expect, test } from "@playwright/test";
import { TEST } from "./fixtures/test-data";

const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 },
];

for (const viewport of viewports) {
  test(`center admin can configure every clinical profession on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/center/${TEST.CENTER_ID}?agent_test=true&demo_role=admin`);

    await page.locator('[data-testid="admin-tab-professionals"]').click();
    const profession = page.getByLabel("Profesión clínica");
    await expect(profession).toBeVisible();
    const values = await profession
      .locator("option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(values).toEqual(
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

    await page.getByLabel("Tipo de acceso del miembro").selectOption("center_admin");
    await expect(profession).not.toBeVisible();
    await expect(page.getByText("Leer ficha clínica", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Gestionar equipo", { exact: true })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test(`agenda resources remain operational and non-clinical on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/center/${TEST.CENTER_ID}?agent_test=true&demo_role=admin`);

    await page.locator('[data-testid="admin-tab-services"]').click();
    await expect(page.getByRole("heading", { name: "Recursos de agenda" })).toBeVisible();
    await expect(page.getByText(/sin crear cuentas de usuario ni acceso cl.nico/i)).toBeVisible();
    await page.getByRole("button", { name: "Crear recurso" }).click();
    const resourceType = page.getByLabel("Tipo");
    await expect(resourceType).toBeVisible();
    const resourceTypes = await resourceType
      .locator("option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(resourceTypes).toEqual(["service", "room", "equipment"]);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
