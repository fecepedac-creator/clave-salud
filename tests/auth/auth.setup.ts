/**
 * ClaveSalud — Playwright Auth Setup
 *
 * Ejecuta PRIMERO antes de todos los tests.
 * Genera storageState (cookies + localStorage de Firebase Auth)
 * para cada rol, evitando re-login en cada test.
 *
 * Ejecución: npx playwright test --project=setup
 */
import { test as setup, expect } from "@playwright/test";
import { AUTH, TEST } from "../fixtures/test-data";
import { disableAnimations } from "../fixtures/helpers";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_STATE = path.join(__dirname, ".auth/admin.json");
const DOCTOR_STATE = path.join(__dirname, ".auth/doctor.json");

// ─── Admin de Centro ────────────────────────────────────────────────────────────────────────────────────

setup("Admin: generar sesión", async ({ page }) => {
  await disableAnimations(page);

  // Ir directo a la ruta de login administrativo con flag de test
  await page.goto(`${TEST.BASE_URL}/acceso-admin?agent_test=true`);

  // DIAGNÓSTICO: Loguear URL y captura antes de fallar
  console.log('DEBUG: Current URL before login check:', page.url());
  await page.screenshot({ path: 'test-results/debug-admin-login-start.png' });

  // Esperar formulario de login visible
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 20000 });

  await page.fill('input[type="email"]', AUTH.ADMIN.email);
  await page.fill('input[type="password"]', AUTH.ADMIN.password);

  // Botón de login — texto exacto en la app: "Ingresar"
  await page.getByRole("button", { name: /^Ingresar$/i }).click();

  // Señal determinista: admin-tab-bar visible = auth completada + session en IndexedDB
  await expect(page.locator('[data-testid="admin-tab-bar"]')).toBeVisible({
    timeout: 30000,
  });

  // Esperar que Firebase termine de escribir el token en IndexedDB
  // (señal: el tab de performance carga sin redirigir al login)
  await expect(page.locator('[data-testid="admin-tab-performance"]')).toBeVisible({
    timeout: 15000,
  });

  await page.context().storageState({ path: ADMIN_STATE });
  console.log("✅ Admin storageState guardado en", ADMIN_STATE);
});

// ─── Doctor / Staff ────────────────────────────────────────────────────────────────────────────────────

setup("Doctor: generar sesión", async ({ page }) => {
  await disableAnimations(page);

  // /accesoprofesionales muestra directamente el login de doctor
  await page.goto(`${TEST.BASE_URL}/accesoprofesionales?agent_test=true`);

  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 20000 });

  await page.fill('input[type="email"]', AUTH.DOCTOR.email);
  await page.fill('input[type="password"]', AUTH.DOCTOR.password);
  await page.getByRole("button", { name: /^Ingresar$/i }).click();

  // Señal determinista: doctor-tab-bar visible = auth completada
  await expect(page.locator('[data-testid="doctor-tab-bar"]')).toBeVisible({
    timeout: 30000,
  });

  // Esperar que el tab de rendimiento cargue (confirma IndexedDB persistido)
  await expect(page.locator('[data-testid="doctor-tab-performance"]')).toBeVisible({
    timeout: 15000,
  });

  await page.context().storageState({ path: DOCTOR_STATE });
  console.log("✅ Doctor storageState guardado en", DOCTOR_STATE);
});
