/**
 * ClaveSalud — Playwright Shared Helpers
 *
 * Funciones reutilizables para evitar duplicación en specs.
 * Todas las esperas son determinísticas (sin waitForTimeout).
 */
import { type Page, expect } from "@playwright/test";
import { TEST, AUTH } from "./test-data";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ADMIN_STATE = path.join(__dirname, "../auth/.auth/admin.json");
export const DOCTOR_STATE = path.join(__dirname, "../auth/.auth/doctor.json");

// ─── Desactivar animaciones CSS en modo test ─────────────────────────────────
// Inyectar antes de que la página cargue cualquier recurso
export async function disableAnimations(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(style);
    // También deshabilitar onboarding para no bloquear formularios
    window.localStorage.setItem("cs_onboarding_complete", "true");
  });
}

// ─── Navegar al admin dashboard y esperar hidratación ───────────────────────
export async function goToAdminDashboard(page: Page) {
  await disableAnimations(page);
  await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}?agent_test=true`);
  // Señal determinística: tab bar visible = auth + routing OK
  await expect(page.locator('[data-testid="admin-tab-bar"]')).toBeVisible({
    timeout: 30000,
  });
}

// ─── Navegar al tab de Rendimiento Admin y esperar datos ────────────────────
export async function goToAdminPerformanceTab(page: Page) {
  await goToAdminDashboard(page);

  const tabPerformance = page.locator('[data-testid="admin-tab-performance"]');
  await expect(tabPerformance).toBeVisible({ timeout: 20000 });
  await tabPerformance.click();

  // Esperar que el skeleton de carga desaparezca
  await expect(page.locator('[data-testid="performance-loading-skeleton"]')).toBeHidden({
    timeout: 30000,
  });

  // Esperar que el profesional del seed aparezca en la tabla (hidratación completa)
  await expect(page.locator(`[data-testid="prof-name-${TEST.DOCTOR_ID}"]`)).toBeVisible({
    timeout: 20000,
  });
}

// ─── Cerrar mes (helper para T4 y otros) ────────────────────────────────────
export async function closeMonth(page: Page) {
  await goToAdminPerformanceTab(page);

  const badge = page.locator('[data-testid="month-status-badge"]');
  const text = await badge.innerText();
  if (text.trim() === "Mes Cerrado") return; // Ya cerrado, nada que hacer

  page.on("dialog", (d) => d.accept());
  await page.locator('[data-testid="btn-close-month"]').click();
  await expect(badge).toContainText("Mes Cerrado", { timeout: 15000 });
}

// ─── Reabrir mes (teardown de T3 y T4) ──────────────────────────────────────
export async function reopenMonth(page: Page) {
  await goToAdminPerformanceTab(page);

  const badge = page.locator('[data-testid="month-status-badge"]');
  const text = await badge.innerText();
  if (text.trim() === "Mes Abierto") return;

  page.on("dialog", (d) => d.accept());
  await page.locator('[data-testid="btn-reopen-month"]').click();
  await expect(badge).toContainText("Mes Abierto", { timeout: 15000 });
}

// ─── Navegar al Doctor Dashboard ────────────────────────────────────────────
export async function goToDoctorDashboard(page: Page) {
  await disableAnimations(page);
  await page.goto(`${TEST.BASE_URL}/pro/center/${TEST.CENTER_ID}?agent_test=true`);
  await expect(page.locator('[data-testid="doctor-tab-bar"]')).toBeVisible({
    timeout: 30000,
  });
}

// ─── Ir al tab de rendimiento del doctor ────────────────────────────────────
export async function goToDoctorPerformanceTab(page: Page) {
  await goToDoctorDashboard(page);
  const perfTab = page.locator('[data-testid="doctor-tab-performance"]');
  await expect(perfTab).toBeVisible({ timeout: 10000 });
  await perfTab.click();

  // Esperar que al menos un KPI sea visible
  await expect(page.locator('[data-testid="doctor-kpi-completed"]')).toBeVisible({
    timeout: 20000,
  });
}
