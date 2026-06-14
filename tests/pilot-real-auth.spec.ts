import { expect, type Page, test } from "@playwright/test";
import { disableAnimations } from "./fixtures/helpers";
import { AUTH } from "./fixtures/test-data";

function requireCredential(value: string, name: string) {
  if (!value) throw new Error(`${name} is required in .env.test`);
}

async function fillEmailPasswordLogin(page: Page, email: string, password: string) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /^Ingresar$/i }).click();
}

async function chooseCenterIfNeeded(page: Page) {
  const selectCenter = page.getByRole("heading", { name: /selecciona un centro/i });
  if (!(await selectCenter.isVisible({ timeout: 5000 }).catch(() => false))) return;

  const centerButton = page.getByRole("button").filter({ hasText: /los andes|centro/i }).first();
  await expect(centerButton).toBeVisible({ timeout: 15000 });
  await centerButton.click();
}

test.describe("Pilot real auth smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await disableAnimations(page);
  });

  test("test center admin can sign in with email and password", async ({ page }) => {
    requireCredential(AUTH.ADMIN.email, "ADMIN_EMAIL");
    requireCredential(AUTH.ADMIN.password, "ADMIN_PASSWORD");

    await page.goto("/acceso-admin");
    await fillEmailPasswordLogin(page, AUTH.ADMIN.email, AUTH.ADMIN.password);
    await chooseCenterIfNeeded(page);

    await expect(page.locator('[data-testid="admin-tab-bar"]')).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole("button", { name: /centro de mando/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /configurar agenda/i })).toBeVisible();
    await expect(page.locator('[data-testid="doctor-tab-bar"]')).not.toBeVisible();
  });

  test("test professional can sign in with email and password", async ({ page }) => {
    requireCredential(AUTH.DOCTOR.email, "DOCTOR_EMAIL");
    requireCredential(AUTH.DOCTOR.password, "DOCTOR_PASSWORD");

    await page.goto("/accesoprofesionales");
    await fillEmailPasswordLogin(page, AUTH.DOCTOR.email, AUTH.DOCTOR.password);
    await chooseCenterIfNeeded(page);

    await expect(page.locator('[data-testid="doctor-tab-bar"]')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('[data-testid="doctor-tab-patients"]')).toBeVisible();
    await expect(page.locator('[data-testid="doctor-tab-agenda"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-bar"]')).not.toBeVisible();
  });
});
