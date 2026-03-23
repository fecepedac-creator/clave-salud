import { test, expect } from "@playwright/test";
import { TEST, AUTH } from "../fixtures/test-data";

/**
 * SuperAdmin Audit Suite
 *
 * Valida que un usuario con privilegios de superadmin tenga acceso al dashboard global y pueda ver
 * información sensible (ej. auditoría) en diferentes centros.
 */

test.describe("SuperAdmin Access & Multi-tenant Visibility", () => {
  // Si tu app requiere login especial o parámetros, los configuramos aquí.
  // Usamos agent_test=true para bypasear guards que asuman Firebase local de cierta manera,
  // o ?master_access=true si tu app usa esa bandera localmente para forzar rol.

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
    // Limpiar rastro de versiones o roles anteriores para evitar saltos de ruta
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("E2E-SA-01: Acceso al dashboard SuperAdmin", async ({ page }) => {
    await page.goto(`${TEST.BASE_URL}/superadmin?agent_test=true&demo_role=superadmin`);

    // Debe ser visible el dashboard de superadmin
    // Tras la refactorización, "Visión General" es el H1 principal
    await expect(page.getByRole("heading", { name: /Visión General/i })).toBeVisible({
      timeout: 15000,
    });
    
    // "Centros Activos" está dentro de un MetricCard como H3
    await expect(page.getByRole("heading", { name: /Centros Activos/i })).toBeVisible();
    await expect(page.getByText("SuperAdmin", { exact: false }).first()).toBeVisible();
  });

  test("E2E-SA-02: SuperAdmin puede alternar entre centros en Preview", async ({ page }) => {
    await page.goto(`${TEST.BASE_URL}/superadmin?agent_test=true&demo_role=superadmin`);
    await expect(page.locator('[data-testid="superadmin-dashboard-root"]')).toBeVisible();

    // 1. Usar el selector de centro para preview
    // En SuperAdminDashboard.tsx los selects están en la pestaña General (por defecto)
    const selects = page.locator("select");
    await expect(selects.first()).toBeVisible({ timeout: 10000 });

    // Seleccionamos el primer centro disponible y un rol
    await selects.nth(1).selectOption({ index: 1 }); // Selecciona el primer centro de la lista (no el placeholder)
    await selects.nth(2).selectOption("ADMINISTRATIVO"); // Ej: Admin de centro

    // 3. Click activo preview
    await page.getByRole("button", { name: /Activar preview/i }).click();

    // 4. Esperar a que la página cambie y muestre el modo auditoría
    // El TestBanner muestra "Modo Auditoría Activo" (usamos first() porque puede haber más de una instancia por banners responsive)
    await expect(page.getByText("Modo Auditoría Activo").first()).toBeVisible({ timeout: 15000 });

    // 5. Salir del preview para volver a superadmin
    const btnExit = page.getByRole("button", { name: /Salir de Preview/i });
    await expect(btnExit).toBeVisible({ timeout: 15000 });
    await btnExit.click();

    // Debe volver al dashboard superadmin main screen
    await expect(page.locator('[data-testid="superadmin-dashboard-root"]')).toBeVisible({
      timeout: 15000,
    });
  });

  test("E2E-SA-03: Visibilidad del Log de Auditoría Global (Opcional)", async ({ page }) => {
    await page.goto(`${TEST.BASE_URL}/superadmin?agent_test=true&demo_role=superadmin`);

    // Si hay una pestaña de Auditoría en superadmin
    const tabAudit = page.getByRole("button", { name: "Auditoría de seguridad" }).first();
    if ((await tabAudit.count()) > 0) {
      await tabAudit.click();
      // Verificar componente AuditLogViewer
      await expect(page.getByText("Registro de accesos y cambios críticos")).toBeVisible();
    }
  });
});
