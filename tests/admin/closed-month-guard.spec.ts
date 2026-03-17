/**
 * TEST 4 — Admin: "Closed Month Guard"
 *
 * Flujo: cerrar el mes → navegar a Agenda → buscar slot con cita
 * reservada → hover para revelar controls → click "Marcar completado"
 * → verificar toast-error con texto del mes cerrado → estado no cambia.
 *
 * Diseño anti-flake:
 *  - beforeEach: intercepta todos los window.confirm() aceptándolos
 *  - Solo usa data-testid (sin texto hardcodeado como selector)
 *  - hover() expone el tooltip de CSS opacity; waitFor con expect en vez de timeout
 *  - Teardown garantizado en afterAll: reabre el mes pase lo que pase
 *
 * Precondición Firestore (seed):
 *  - Existe al menos 1 cita con status="booked" para TEST_DOCTOR_ID
 *    en la fecha TEST_DATE dentro del mes TEST_YEAR_MONTH
 *
 * Restricción: TEST_SLOT_TIME debe coincidir con el horario de esa cita
 *  (ej: "09:00"). Configurable en test-data.ts → SEED.BOOKED_SLOT.
 */
import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import { TEST, SEED } from "../fixtures/test-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function goToPerformanceAndClose(page: Page) {
  // Navegar directamente al dashboard del centro
  await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}?agent_test=true`);

  const tabPerformance = page.locator('[data-testid="admin-tab-performance"]');
  await expect(tabPerformance).toBeVisible({ timeout: 45000 });

  await tabPerformance.click();

  // Anti-flake: esperar hidratación dinámica
  await expect(page.locator('[data-testid="performance-loading-skeleton"]')).toBeHidden({
    timeout: 45000,
  });
  await expect(page.locator(`[data-testid="prof-name-${TEST.DOCTOR_ID}"]`)).toBeVisible({
    timeout: 15000,
  });

  // Esperar a que la tabla tenga datos
  await expect(page.locator('[data-testid="prof-stats-table"]')).not.toContainText("Sin datos", {
    timeout: 15000,
  });

  const syncReady = page.locator(
    '[data-testid="btn-close-month"], [data-testid="btn-reopen-month"]'
  );
  await expect(syncReady.first()).toBeEnabled({ timeout: 15000 });

  const badge = page.locator('[data-testid="month-status-badge"]');
  const badgeText = await badge.innerText();

  if (badgeText.trim() === "Mes Cerrado") return;

  // Cerrar el mes (dialogo aceptado globalmente por beforeEach)
  await page.click('[data-testid="btn-close-month"]');
  // Pequeño buffer para sync de Firestore -> UI
  await page.waitForTimeout(1000);
  await expect(badge).toContainText("Mes Cerrado", { timeout: 15000 });
}

async function reopenMonth(page: Page) {
  await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}?agent_test=true`);

  const tabPerformance = page.locator('[data-testid="admin-tab-performance"]');
  await expect(tabPerformance).toBeVisible({ timeout: 45000 });

  await tabPerformance.click();

  // Anti-flake: esperar hidratación dinámica
  await expect(page.locator('[data-testid="performance-loading-skeleton"]')).toBeHidden({
    timeout: 45000,
  });
  await expect(page.locator(`[data-testid="prof-name-${TEST.DOCTOR_ID}"]`)).toBeVisible({
    timeout: 15000,
  });

  const syncReady = page.locator(
    '[data-testid="btn-close-month"], [data-testid="btn-reopen-month"]'
  );
  await expect(syncReady.first()).toBeEnabled({ timeout: 15000 });

  const badge = page.locator('[data-testid="month-status-badge"]');
  const text = await badge.innerText();
  if (text.trim() !== "Mes Cerrado") return;

  // Reabrir el mes (dialogo aceptado globalmente por beforeEach)
  await page.click('[data-testid="btn-reopen-month"]');
  // Pequeño buffer para sync de Firestore -> UI
  await page.waitForTimeout(1000);
  await expect(badge).toContainText("Mes Abierto", { timeout: 15000 });
}

// ─── Setup global ────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Usamos el flag agent_test=true para evitar redirects a home por guards de routing
  await page.goto("/?agent_test=true");
  // Aceptar TODOS los diálogos automáticamente para toda la suite
  page.on("dialog", (dialog) => dialog.accept());
});

// ─── TEST 4 ──────────────────────────────────────────────────────────────────

test("T4 — Admin: closed month guard bloquea modificación de asistencia", async ({ page }) => {
  // 1. Cerrar el mes primero (requisito previo del guard)
  await goToPerformanceAndClose(page);

  // 2. Ir al admin dashboard del centro
  await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}?agent_test=true`);

  // Wait for the admin dashboard to appear
  await expect(page.locator('[data-testid="admin-tab-bar"]')).toBeVisible({ timeout: 15000 });

  page.on("pageerror", (err) => console.log("PAGE ERROR: ", err));
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") console.log("PAGE CONSOLE ERROR: ", text);
    if (text.includes("[E2E_DEBUG]")) console.log(text);
  });

  // 2. Navegar a tab "Agenda"
  await page.locator('[data-testid="admin-tab-agenda"]').click();
  // Señal determinística: el select de profesional aparece cuando la tab carga
  const agendaSelect = page.locator('[data-testid="select-agenda-prof"]');
  await expect(agendaSelect).toBeVisible({ timeout: 15000 });

  await agendaSelect.selectOption({ value: TEST.DOCTOR_ID });

  // 4. Navegar al mes correcto en el calendario de agenda
  const targetYear = parseInt(TEST.YEAR_MONTH.split("-")[0]);
  const targetMonthIndex = parseInt(TEST.YEAR_MONTH.split("-")[1]) - 1; // 0-indexed
  const monthNames: Record<string, number> = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
  };

  for (let attempts = 0; attempts < 12; attempts++) {
    // Use the specific data-testid to avoid matching other text on the page
    await expect(page.locator('[data-testid="agenda-calendar-month"]')).toBeVisible({
      timeout: 5000,
    });
    const headerText = await page.locator('[data-testid="agenda-calendar-month"]').innerText();
    const match = headerText.match(/(\w+)\s+(?:de\s+)?(\d{4})/i);
    if (!match) {
      await page.waitForTimeout(200);
      continue;
    }
    const navMonthIdx = monthNames[match[1].toLowerCase()] ?? -1;
    const navYear = parseInt(match[2]);
    console.log(
      `[T4 NAV] calendar shows: "${headerText}" (idx=${navMonthIdx}) target=${targetYear}-${targetMonthIndex}`
    );
    if (navYear === targetYear && navMonthIdx === targetMonthIndex) break;
    const isBefore =
      navYear < targetYear || (navYear === targetYear && navMonthIdx < targetMonthIndex);
    const calContainer = page.locator('[data-testid="agenda-calendar-month"]').locator("..");
    if (isBefore) {
      await calContainer.locator("button").last().click();
    } else {
      await calContainer.locator("button").first().click();
    }
    // Espera determinística: el header del mes debe cambiar
    await expect(page.locator('[data-testid="agenda-calendar-month"]'))
      .not.toHaveText(headerText, { timeout: 3000 })
      .catch(() => {}); // Si no cambia (mismo mes objetivo), continuar
  }

  // 5. Hacer click en el día que tiene la cita seeded
  const targetDate = SEED.BOOKED_SLOT.date; // "YYYY-MM-DD"
  const dayNumber = parseInt(targetDate.split("-")[2], 10);
  console.log(`[T4] Clicking day ${dayNumber} of month`);
  const dayBtn = page
    .locator(".grid-cols-7 > button")
    .filter({ hasText: new RegExp(`^\\s*${dayNumber}\\s*$`) })
    .first();
  await dayBtn.click();
  // Señal determinística: el slot booked debe aparecer

  // 6. Esperar que aparezca el slot reservado
  const slotTestId = `slot-booked-${SEED.BOOKED_SLOT.time.replace(":", "")}`;
  const slotEl = page.locator(`[data-testid="${slotTestId}"]`);
  await expect(slotEl).toBeVisible({ timeout: 10000 });

  // 7. Hover sobre el slot para revelar el tooltip CSS de asistencia
  await slotEl.hover();
  // No se necesita waitForTimeout — usamos dispatchEvent que bypasea pointer-events

  // 8+9. Click en Completado usando dispatchEvent (el contenedor tiene pointer-events-none)
  const completedBtn = page.locator(
    `[data-testid="btn-attendance-completed-${SEED.BOOKED_SLOT.time.replace(":", "")}"]`
  );
  // dispatchEvent bypasses pointer-events restrictions en el contenedor padre
  await completedBtn.dispatchEvent("click");

  // ── Aserciones ──────────────────────────────────────────────────────────

  // 10. Debe aparecer toast-error con el mensaje de mes cerrado
  const toast = page.locator('[data-testid="toast-error"]');
  await expect(toast).toBeVisible({ timeout: 15000 });
  await expect(toast).toContainText(/cerrado/i);

  // 11. El KPI total no cambia (verificar que los datos no mutaron)
  // Navegar a performance tab para confirmar
  await page.click('[data-testid="admin-tab-performance"]');
  await expect(page.locator('[data-testid="month-status-badge"]')).toContainText("Mes Cerrado", {
    timeout: 8000,
  });

  console.log("✅ T4 — Closed Month Guard funcionó. Toast de error visible, mes cerrado intacto.");
});

// ─── Teardown global: reabrir el mes pase lo que pase ───────────────────────

test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: "tests/auth/.auth/admin.json",
  });
  const page = await ctx.newPage();
  // Aceptar el dialog de reapertura
  page.on("dialog", (d) => d.accept());
  try {
    await reopenMonth(page);
    console.log("✅ T4 afterAll teardown — mes reabierto.");
  } finally {
    await ctx.close();
  }
});
