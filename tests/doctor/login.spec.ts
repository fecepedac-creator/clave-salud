/**
 * TEST 6 — Doctor: Login y Acceso a Dashboard (Smoke Test)
 *
 * Verifica que un médico puede autenticarse y ver su dashboard.
 * Usa el storageState guardado por auth.setup.ts (doctor.json).
 *
 * Criticidad: 🔴 Crítica (bloqueante para T7 y T8)
 */
import { test, expect } from "@playwright/test";
import { goToDoctorDashboard } from "../fixtures/helpers";

test("T6 — Doctor: login y acceso a dashboard médico", async ({ page }) => {
  // La sesión ya está activa via storageState (doctor.json del setup)
  await goToDoctorDashboard(page);

  // 1. El tab de rendimiento debe ser visible (módulo clave)
  await expect(page.locator('[data-testid="doctor-tab-performance"]')).toBeVisible({
    timeout: 10000,
  });

  // 2. No debe haber redirección al login (sesión válida)
  expect(page.url()).not.toContain("/accesoprofesionales");
  expect(page.url()).not.toContain("/acceso-admin");

  // 3. No debe haber errores de JS críticos en el body
  await expect(page.locator("body")).not.toContainText("Uncaught");

  console.log("✅ T6 — Login de Doctor exitoso. Dashboard visible.");
});
