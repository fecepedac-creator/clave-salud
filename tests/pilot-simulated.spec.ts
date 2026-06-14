import { expect, test } from "@playwright/test";
import { disableAnimations } from "./fixtures/helpers";
import { TEST } from "./fixtures/test-data";

const centerId = TEST.CENTER_ID;

async function closeOnboardingIfPresent(page: import("@playwright/test").Page) {
  const closeTutorial = page.getByRole("button", { name: /cerrar tutorial|saltar tutorial/i });
  if (
    await closeTutorial
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)
  ) {
    await closeTutorial.first().click();
  }
}

test.describe("Pilot simulated user experience", () => {
  test.beforeEach(async ({ page }) => {
    await disableAnimations(page);
  });

  test("public center portal does not expose private dashboards", async ({ page }) => {
    await page.goto("/");
    await closeOnboardingIfPresent(page);

    const centerCard = page.locator('[data-testid^="center-card-"]').filter({
      hasText: /centro medico los andes/i,
    });
    await expect(centerCard.first()).toBeVisible({ timeout: 30000 });
    await centerCard.first().click();

    await expect(page.locator('[data-testid="view-container-center-portal"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole("heading", { name: /centro medico los andes/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /soy paciente/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /soy profesional/i })).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-bar"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="doctor-tab-bar"]')).not.toBeVisible();
  });

  test("simulated center admin reaches operational dashboard", async ({ page }) => {
    await page.goto(`/center/${centerId}?agent_test=true&demo_role=admin`);

    await expect(page.locator('[data-testid="admin-tab-bar"]')).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /centro de mando/i }).click();
    await expect(page.locator('[data-testid="admin-dashboard-metrics-section"]')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole("button", { name: /gesti.n de profesionales/i })).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-agenda"]')).toBeVisible();
  });

  test("simulated administrative role is limited to agenda operations", async ({ page }) => {
    await page.goto(`/center/${centerId}?agent_test=true&demo_role=administrative`);

    await expect(page.locator('[data-testid="admin-tab-bar"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="admin-tab-agenda"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /gesti.n de profesionales/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /seguridad|auditor.a/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /prestaciones|ex.menes/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^uso ia$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /campa.as ia/i })).toHaveCount(0);
  });

  test("simulated professional reaches clinical workspace without admin tabs", async ({ page }) => {
    await page.goto(`/pro/center/${centerId}?agent_test=true&demo_role=doctor`);

    await expect(page.locator('[data-testid="doctor-tab-bar"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="doctor-tab-patients"]')).toBeVisible();
    await expect(page.locator('[data-testid="doctor-tab-agenda"]')).toBeVisible();
    await expect(page.locator('[data-testid="doctor-tab-performance"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-bar"]')).not.toBeVisible();
  });

  test("simulated super admin reaches global dashboard", async ({ page }) => {
    await page.goto("/superadmin?demo=true&demo_role=superadmin");

    await expect(page.locator('[data-testid="superadmin-dashboard-root"]')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator('[data-testid="superadmin-main-content"]')).toBeVisible();
  });
});
