/**
 * TEST 7 — Doctor: Ver "Mi Rendimiento" (DoctorPerformanceTab)
 * TEST 8 — Seguridad Multi-Tenant: Doctor A no ve stats de Doctor B
 *
 * T7: Confirma que el doctor ve sus KPIs propios y la tabla de citas.
 * T8: Verifica que el KPI "completadas" muestra el valor del Doctor A (7),
 *     no el del Doctor B — garantiza aislamiento multi-tenant en la UI.
 *
 * Criticidad: 🔴 Crítica (T8 = seguridad de datos entre profesionales)
 */
import { test, expect } from "@playwright/test";
import { TEST, SEED } from "../fixtures/test-data";
import { goToDoctorPerformanceTab } from "../fixtures/helpers";

test.beforeEach(async ({ page }) => {
  await goToDoctorPerformanceTab(page);
});

// ─── TEST 7 ───────────────────────────────────────────────────────────────────

test("T7 — Doctor: Tab Rendimiento carga KPIs propios", async ({ page }) => {
  // Seleccionar mes del seed si hay selector de mes
  const monthInput = page.locator('input[type="month"]').first();
  if (await monthInput.isVisible()) {
    await monthInput.fill(TEST.YEAR_MONTH);
    // Señal determinística: esperar que el KPI se actualice
    await expect(page.locator('[data-testid="doctor-kpi-completed"]')).toBeVisible({
      timeout: 15000,
    });
  }

  // 1. KPI de citas completadas debe ser numérico
  const kpiCompleted = page.locator('[data-testid="doctor-kpi-completed"]');
  const completedText = await kpiCompleted.innerText();
  expect(completedText).toMatch(/\d+/);

  // 2. KPI de recaudación debe ser numérico/monetario
  const kpiRevenue = page.locator('[data-testid="doctor-kpi-revenue"]');
  await expect(kpiRevenue).toBeVisible({ timeout: 10000 });
  const revenueText = await kpiRevenue.innerText();
  expect(revenueText).toMatch(/[\d$]/);

  // 3. No debe mostrar NaN en ningún KPI visible
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("NaN");

  console.log(
    `✅ T7 — Tab Rendimiento Doctor cargado. Completadas: ${completedText.trim()}, Recaudación: ${revenueText.trim()}`
  );
});

// ─── TEST 8 ───────────────────────────────────────────────────────────────────

test("T8 — Seguridad Multi-Tenant: Doctor solo ve sus propias stats", async ({ page }) => {
  // Seleccionar el mes seeded
  const monthInput = page.locator('input[type="month"]').first();
  if (await monthInput.isVisible()) {
    await monthInput.fill(TEST.YEAR_MONTH);
    await expect(page.locator('[data-testid="doctor-kpi-completed"]')).toBeVisible({
      timeout: 15000,
    });
  }

  // Extraer el número del KPI de completadas del Doctor A (seeded = 7)
  const kpiCompleted = page.locator('[data-testid="doctor-kpi-completed"]');
  const kpiText = await kpiCompleted.innerText();
  const match = kpiText.match(/\d+/);
  const displayedValue = match ? parseInt(match[0]) : -1;

  // El valor debe ser el del Doctor A (7), NO el del Doctor B (4)
  // Si un refactor inyecta el doctorId incorrecto → verá 4 del Doctor B → falla
  expect(displayedValue).toBe(SEED.DOCTOR_STATS.completed); // 7

  // Verificar que el nombre no corresponde al admin
  const headerOrName = page
    .locator("h1, h2, h3")
    .filter({ hasText: /Doctor|Dr\.|Bienvenido/i })
    .first();
  if (await headerOrName.isVisible()) {
    const headerText = await headerOrName.innerText();
    expect(headerText).not.toContain("Admin");
  }

  console.log(
    `✅ T8 — Multi-tenant OK. Doctor A ve ${displayedValue} completadas (esperado: ${SEED.DOCTOR_STATS.completed}). Sin fuga de datos.`
  );
});
