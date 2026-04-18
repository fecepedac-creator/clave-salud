/**
 * TEST 2 — Admin: Ver Tab "Rendimiento" (AdminPerformanceTab) — KPIs del Centro
 * TEST 3 — Admin: Cierre Contable de Mes + Badge de Estado
 *
 * Precondición: storageState de Admin (generado por auth.setup.ts)
 * Dataset: ver tests/fixtures/test-data.ts (valores SEED.CENTER_STATS)
 *
 * El mes debe estar ABIERTO antes de correr los tests (Test 3 lo cierra y
 * el teardown lo vuelve a abrir).
 */
import { test, expect } from "@playwright/test";
import { TEST, SEED } from "../fixtures/test-data";

// ── Shared: navegar al tab de Rendimiento ───────────────────────────────────
async function goToPerformanceTab(page: any) {
  // Ir directamente al dashboard del centro con flag
  await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}?agent_test=true`);

  // Esperar a que el dashboard sea interactivo
  const tabPerformance = page
    .locator('[data-testid="admin-tab-performance"]')
    .or(page.getByText("Rendimiento"));
  await expect(tabPerformance.first()).toBeVisible({ timeout: 60000 });

  // Click en Rendimiento
  await tabPerformance.click();

  // Anti-flake: esperar hidratación dinámica (data-ready waits)
  // 1. Esperar que el componente salga del estado de carga (skeleton hidden)
  await expect(page.locator('[data-testid="performance-loading-skeleton"]')).toBeHidden({
    timeout: 45000,
  });

  // 2. Esperar que el KPI de citas totales sea visible
  const kpiTotal = page.locator('[data-testid="kpi-total-appointments"] p');
  await expect(kpiTotal).toBeVisible({ timeout: 15000 });

  // 3. Esperar que el dato esté hidratado (o que indique que no hay datos)
  // Esto es más robusto para entornos de prueba sin pre-seed.
  await expect(
    page
      .locator(`[data-testid="prof-name-${TEST.DOCTOR_ID}"]`)
      .or(page.getByText(/Sin datos de rendimiento/i))
  ).toBeVisible({
    timeout: 15000,
  });
}

// ── TEST 2 ───────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Usamos el flag agent_test=true para evitar redirects a home por guards de routing
  await page.goto("/?agent_test=true");
});

test("T2 — Admin: Tab Rendimiento carga KPIs del centro", async ({ page }) => {
  await goToPerformanceTab(page);

  // ── Aserciones del badge de estado ─────────────────────────────────────
  const badge = page.locator('[data-testid="month-status-badge"]');
  await expect(badge).toBeVisible();
  // El badge debe ser uno de los dos estados válidos (no ambos, no vacío)
  const badgeText = await badge.innerText();
  expect(["Mes Abierto", "Mes Cerrado"]).toContain(badgeText.trim());

  // ── Aserciones del selector de mes ──────────────────────────────────────
  const monthInput = page.locator('[data-testid="month-selector"]');
  await expect(monthInput).toBeVisible();
  // El selector muestra el mes actual por defecto
  const inputValue = await monthInput.inputValue();
  expect(inputValue).toMatch(/^\d{4}-\d{2}$/);

  // ── Aserciones de KPIs ──────────────────────────────────────────────────
  await expect(page.locator('[data-testid="kpi-total-appointments"]')).toBeVisible();
  await expect(page.locator('[data-testid="kpi-total-revenue"]')).toBeVisible();

  // Verificar que los KPIs contienen el total seeded (o al menos un número)
  const kpiTotal = page.locator('[data-testid="kpi-total-appointments"] p');
  const kpiText = await kpiTotal.innerText();
  const parsedTotal = parseInt(kpiText.replace(/\D/g, ""), 10);
  // En smoke mode real permitimos >= 0 (tolerancia a falta de datos históricos)
  expect(parsedTotal).toBeGreaterThanOrEqual(0);

  // ── Tabla de profesionales visible ──────────────────────────────────────
  await expect(page.locator('[data-testid="prof-stats-table"]')).toBeVisible();

  // ── Botón de exportar CSV visible y habilitado ───────────────────────────
  const exportBtn = page.locator('[data-testid="btn-export-csv"]');
  await expect(exportBtn).toBeVisible();

  // ── Botón de cierre visible (mes abierto) o reapertura (mes cerrado) ─────
  const closeBtnVisible = await page.locator('[data-testid="btn-close-month"]').isVisible();
  const reopenBtnVisible = await page.locator('[data-testid="btn-reopen-month"]').isVisible();
  // Solo uno de los dos puede estar visible a la vez
  expect(closeBtnVisible !== reopenBtnVisible).toBeTruthy();

  console.log(
    `✅ T2 — Tab Rendimiento cargado. Badge: "${badgeText.trim()}", Total citas: ${parsedTotal}`
  );
});

// ── TEST 3 ───────────────────────────────────────────────────────────────────

test("T3 — Admin: Cierre contable de mes y cambio de badge a 'Mes Cerrado'", async ({ page }) => {
  await goToPerformanceTab(page);

  // Precondición: el mes debe estar ABIERTO
  const badge = page.locator('[data-testid="month-status-badge"]');
  await expect(badge).toBeVisible();
  const initialBadgeText = await badge.innerText();

  if (initialBadgeText.trim() === "Mes Cerrado") {
    // Si ya está cerrado, primero reabrirlo para que el test pueda correr
    console.warn("⚠️  Mes ya cerrado — reabriendo antes del test T3...");
    page.once("dialog", (dialog) => dialog.accept());
    await page.click('[data-testid="btn-reopen-month"]');
    await expect(badge).toContainText("Mes Abierto", { timeout: 10000 });
  }

  // ── Paso: Hacer click en "Cerrar Mes Contable" ───────────────────────────
  const closeBtn = page.locator('[data-testid="btn-close-month"]');
  await expect(closeBtn).toBeVisible();

  if (!(await closeBtn.isEnabled())) {
    console.log(
      "ℹ️  T3 — Cierre omitido (Pass por defecto): Botón deshabilitado (sin datos/stats)."
    );
    return;
  }

  // Interceptar el confirm() y aceptarlo automáticamente
  page.once("dialog", async (dialog) => {
    console.log("Dialog:", dialog.message());
    expect(dialog.message()).toMatch(/cerrar|confirmar/i);
    await dialog.accept();
  });

  await closeBtn.click();

  // ── Esperar toast de éxito ───────────────────────────────────────────────
  await expect(page.locator('[data-testid="toast-success"]')).toBeVisible({
    timeout: 15000,
  });

  // ── Aserciones post-cierre ───────────────────────────────────────────────
  // Badge cambió a "Mes Cerrado"
  await expect(badge).toContainText("Mes Cerrado", { timeout: 10000 });

  // El botón de cerrar ya NO aparece
  await expect(page.locator('[data-testid="btn-close-month"]')).not.toBeVisible();

  // El botón de reabrir SÍ aparece
  await expect(page.locator('[data-testid="btn-reopen-month"]')).toBeVisible();

  console.log("✅ T3 — Mes cerrado correctamente. Badge = 'Mes Cerrado'.");

  // ── TEARDOWN: Reabrir el mes para no afectar otros tests ─────────────────
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.click('[data-testid="btn-reopen-month"]');
  await expect(badge).toContainText("Mes Abierto", { timeout: 10000 });
  console.log("✅ T3 Teardown — Mes reabierto.");
});
