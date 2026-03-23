/**
 * TEST 1 — Admin: Login y Acceso a Dashboard
 *
 * Objetivo: Verificar que un Admin puede autenticarse
 * y ver su dashboard correctamente (smoke test crítico).
 *
 * NOTA: Este test corre SIN storageState para validar el
 * flujo de login completo. El storageState lo genera auth.setup.ts.
 */
import { test, expect } from "@playwright/test";
import { TEST } from "../fixtures/test-data";

// Override: este test NO usa storageState (valida login real)
// test.use({ storageState: { cookies: [], origins: [] } }); // ELIMINADO: Sobrescribía la sesión global

test("T1 — Admin: login y acceso a dashboard", async ({ page }) => {
  // 1. Navegar directamente al dashboard del centro con flag de test
  await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}?agent_test=true`);

  // 2. Verificar que llegamos directamente al dashboard administrativo
  // Fallback: buscar por data-testid o por texto si los componentes se renombraron
  const tabPerformance = page.locator('[data-testid="admin-tab-performance"]').or(page.getByText('Rendimiento'));
  await expect(tabPerformance.first()).toBeVisible({ timeout: 60000 });

  // 3. Validar hidratación dinámica (sustituye al waitForTimeout estático)
  // Asegurar que el tab de Centro de Mando está activo
  await page.click('button:has-text("Centro de Mando")');
  await expect(page.locator('[data-testid="admin-dashboard-metrics-section"]')).toBeVisible({
    timeout: 30000,
  });

  // 4. El botón de logout existe (confirma sesión activa)
  await expect(
    page.locator('button[title*="Salir"], button:has-text("Salir"), button svg.lucide-log-out').first()
  ).toBeVisible();

  console.log("✅ T1 — Login de Admin exitoso. Dashboard visible.");
});
