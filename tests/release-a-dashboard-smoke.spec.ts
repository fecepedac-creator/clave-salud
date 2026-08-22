import { expect, test, type Page } from "@playwright/test";
import { TEST } from "./fixtures/test-data";

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("clavesalud_onboarding_completed", "true");
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      )
    )
    .toBe(true);
}

for (const viewport of VIEWPORTS) {
  test.describe(`Release A dashboard smoke - ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page }) => {
      await preparePage(page);
    });

    test("professional dashboard keeps the clinical workspace available", async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", error => pageErrors.push(error.message));

      await page.goto(`/pro/center/${TEST.CENTER_ID}?agent_test=true&demo_role=doctor`);

      await expect(page.locator('[data-testid="doctor-tab-bar"]')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText("Panel clínico · Médico", { exact: true })).toBeVisible();
      await expect(page.locator('[data-testid="doctor-tab-patients"]')).toBeVisible();
      await expect(page.locator('[data-testid="doctor-tab-agenda"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(pageErrors).toEqual([]);
    });

    test("center admin keeps its operational navigation", async ({ page }) => {
      await page.goto(`/center/${TEST.CENTER_ID}?agent_test=true&demo_role=admin`);

      await expect(page.locator('[data-testid="admin-tab-bar"]')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('[data-testid="admin-tab-agenda"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test("super admin keeps the governance workspace available", async ({ page }) => {
      await page.goto("/superadmin?agent_test=true&demo_role=superadmin");

      await expect(page.locator('[data-testid="superadmin-dashboard-root"]')).toBeVisible({
        timeout: 30000,
      });
      await expect(page.locator('[data-testid="superadmin-main-content"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}
