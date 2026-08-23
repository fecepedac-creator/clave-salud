import { expect, test } from "@playwright/test";
import { TEST } from "./fixtures/test-data";

const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`agenda administrativa conserva su navegación en ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/center/${TEST.CENTER_ID}?agent_test=true&demo_role=admin`);

    const agendaTab = page.locator('[data-testid="admin-tab-agenda"]');
    await expect(agendaTab).toBeVisible({ timeout: 30000 });
    await agendaTab.click();
    await expect(page.locator('[data-testid="select-agenda-prof"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configurar Bloques" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar Configuración" })).toBeVisible();

    const hasPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasPageOverflow).toBe(false);
  });
}
