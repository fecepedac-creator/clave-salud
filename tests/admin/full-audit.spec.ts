import { test, expect } from "@playwright/test";
import { TEST, AUTH } from "../fixtures/test-data";

/**
 * ClaveSalud — E2E Audit Suite
 *
 * Este archivo implementa los casos de prueba solicitados para validación
 * de integridad y operación de mercado.
 */

test.describe("Core Authentication & Dashboards", () => {
  test("E2E-01: Login Admin + dashboard", async ({ page }) => {
    await page.goto(`${TEST.BASE_URL}/acceso-admin?agent_test=true`);
    await page.fill('input[type="email"]', AUTH.ADMIN.email);
    await page.fill('input[type="password"]', AUTH.ADMIN.password);
    await page.click('button:has-text("Ingresar")');
    await expect(page.locator('[data-testid="admin-tab-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-performance"]')).toBeVisible();
  });

  test("E2E-02: Login Profesional + dashboard", async ({ page }) => {
    await page.goto(`${TEST.BASE_URL}/accesoprofesionales?agent_test=true`);
    await page.fill('input[type="email"]', AUTH.DOCTOR.email);
    await page.fill('input[type="password"]', AUTH.DOCTOR.password);
    await page.getByRole("button", { name: /^Ingresar$/i }).click();
    await expect(page.locator('[data-testid="doctor-tab-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="doctor-tab-agenda"]')).toBeVisible();
  });

  test("E2E-20: Responsividad crítica (Mobile Drawer)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto(`${TEST.BASE_URL}/superadmin?agent_test=true`);
    const toggle = page.locator('[data-testid="superadmin-drawer-toggle"]');
    if ((await toggle.count()) > 0) {
      await toggle.click();
      await expect(page.locator('[data-testid="superadmin-sidebar-drawer"]')).toBeVisible();
    }
  });
});

test.describe("No Session Tests", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("E2E-05: Ruta directa sin sesión", async ({ page }) => {
    await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}`);
    // Debería mostrar el portal público o pedir login, no el dashboard admin
    await expect(page.locator('[data-testid="admin-tab-bar"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="view-container-center-portal"]')).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe("Multi-tenant Security", () => {
  test("E2E-03: Multi-tenant Admin (Access Block)", async ({ page }) => {
    // Escenario: Admin del Centro A intenta acceder al ID del Centro B
    const CENTER_B_ID = "c_non_existent_or_other";
    await page.goto(`${TEST.BASE_URL}/acceso-admin?agent_test=true`);
    await page.fill('input[type="email"]', AUTH.ADMIN.email);
    await page.fill('input[type="password"]', AUTH.ADMIN.password);
    await page.click('button:has-text("Ingresar")');

    await page.goto(`${TEST.BASE_URL}/center/${CENTER_B_ID}`);
    // Debería redirigir o mostrar "Sin Acceso"
    await expect(page.locator("text=/No tienes acceso|Sin centros/")).toBeVisible();
  });
});

test.describe("Agenda & Clinical Operations", () => {
  test("E2E-07: Agenda Admin: ver horas", async ({ page }) => {
    // Asumiendo sesión admin activa (un test real usaría storageState)
    await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}?agent_test=true`);
    await page.click('[data-testid="admin-tab-agenda"]');
    await expect(page.locator('[data-testid="agenda-calendar-container"]')).toBeVisible();
    // Seleccionar profesional y verificar slots
    const profSelect = page.locator("select").first();
    if ((await profSelect.count()) > 0) {
      await profSelect.selectOption({ index: 1 });
      await expect(page.locator('button:has-text("09:00")')).toBeVisible();
    }
  });

  test("E2E-11: Reserva pública exitosa", async ({ page }) => {
    await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}?agent_test=true`);
    await page.click('button:has-text("Reserva de Horas")');
    await page.click('button:has-text("Podología")');
    await page.locator('button:has-text("Test A")').first().click();
    const hour = page
      .locator('button:has-text("09:00"), button:has-text("10:00"), button:has-text("11:00")')
      .first();
    await expect(hour).toBeVisible();
    await hour.click();
    await page.fill('input[placeholder*="RUT"]', "12345678-5");
    await page.fill('input[placeholder*="Teléfono"]', "+56912341234");
    await page.click('button:has-text("Confirmar")');
    await expect(page.locator("text=/confirmada/i")).toBeVisible();
  });
});
