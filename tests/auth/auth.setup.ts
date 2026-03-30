/**
 * ClaveSalud — Playwright Auth Setup
 *
 * Ejecuta PRIMERO antes de todos los tests.
 * Genera storageState (cookies + localStorage de Firebase Auth)
 * para cada rol, evitando re-login en cada test.
 *
 * Ejecución: npx playwright test --project=setup
 */
import { test as setup, expect, Page } from "@playwright/test";
import { AUTH, TEST } from "../fixtures/test-data";
import { disableAnimations } from "../fixtures/helpers";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_STATE = path.join(__dirname, ".auth/admin.json");
const DOCTOR_STATE = path.join(__dirname, ".auth/doctor.json");

/**
 * Bridge para capturar la sesión de Firebase (IndexedDB) y pasarla a LocalStorage
 * para que Playwright storageState pueda guardarla.
 */
async function bridgeFirebaseSession(page: Page) {
  await page.evaluate(async () => {
    const dbName = "firebaseLocalStorageDb";
    const storeName = "firebaseLocalStorage";
    return new Promise((resolve) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          console.warn("DEBUG: IndexedDB store not found:", storeName);
          return resolve(false);
        }
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const items = getAllRequest.result;
          console.log(`DEBUG: IndexedDB found ${items.length} items`);
          items.forEach((item: any) => {
            console.log(`DEBUG: Hydrating localStorage key: ${item.f_key}`);
            localStorage.setItem(item.f_key, JSON.stringify(item.f_value));
          });
          resolve(items.length > 0);
        };
      };
      request.onerror = () => {
        console.error("DEBUG: Error opening IndexedDB");
        resolve(false);
      };
    });
  });
}

// ─── Admin de Centro ────────────────────────────────────────────────────────────────────────────────────

setup("Admin: generar sesión", async ({ page }) => {
  await disableAnimations(page);

  // Ir directo a la ruta de login administrativo con flag de test
  await page.goto(`${TEST.BASE_URL}/acceso-admin?agent_test=true`);

  // DIAGNÓSTICO: Loguear URL y captura antes de fallar
  console.log("DEBUG: [Auth Setup Admin] URL inicial:", page.url());

  // 2. Intentar Login o detectar si el bypass ya nos metió al dashboard
  const dashboardMarker = page
    .locator('[data-testid="admin-tab-bar"]')
    .or(page.getByText("Centro de Mando"))
    .or(page.getByText("Rendimiento"));
  const loginForm = page.locator('input[type="email"]');

  // Esperar a que aparezca uno de los dos
  await Promise.race([
    dashboardMarker
      .first()
      .waitFor({ state: "visible", timeout: 30000 })
      .catch(() => {}),
    loginForm.waitFor({ state: "visible", timeout: 30000 }).catch(() => {}),
  ]);

  if (await dashboardMarker.first().isVisible()) {
    console.log("DEBUG: Ya estamos en el Dashboard (Bypass activado)");
  } else {
    console.log("DEBUG: Procesando formulario de login");
    await loginForm.fill(AUTH.ADMIN.email);
    await page.fill('input[type="password"]', AUTH.ADMIN.password);

    const fastLoginBtn = page.getByRole("button", { name: /Ingreso Rápido/i });
    if (await fastLoginBtn.isVisible()) {
      console.log("DEBUG: Usando Ingreso Rápido (Master Mode)");
      await fastLoginBtn.click();
    } else {
      console.log("DEBUG: Usando Login normal (Email/Password)");
      await page.getByRole("button", { name: /^Ingresar$/i }).click();
    }
  }

  // Señal determinista: dashboard visible
  console.log("DEBUG: Esperando Dashboard (Admin)...");
  const adminDashboardMarker = page
    .locator('[data-testid="admin-tab-bar"]')
    .or(page.getByText("Centro de Mando"))
    .or(page.getByText("Rendimiento"));
  await expect(adminDashboardMarker.first()).toBeVisible({ timeout: 60000 });

  // Capturar sesión
  await bridgeFirebaseSession(page);

  await page.context().storageState({ path: ADMIN_STATE });
  console.log("✅ Admin storageState guardado en", ADMIN_STATE);
});

// ─── Doctor / Staff ────────────────────────────────────────────────────────────────────────────────────

setup("Doctor: generar sesión", async ({ page }) => {
  await disableAnimations(page);

  // /accesoprofesionales muestra directamente el login de doctor
  await page.goto(`${TEST.BASE_URL}/accesoprofesionales?agent_test=true`);

  console.log("DEBUG: [Auth Setup Doctor] URL inicial:", page.url());

  // 2. Intentar Login o detectar si el bypass ya nos metió al dashboard
  const doctorDashboardMarker = page
    .locator('[data-testid="doctor-tab-bar"]')
    .or(page.getByText("Mi Agenda"))
    .or(page.getByText("Pacientes"));
  const loginFormDoctor = page.locator('input[type="email"]');

  // Esperar a que aparezca uno de los dos
  await Promise.race([
    doctorDashboardMarker
      .first()
      .waitFor({ state: "visible", timeout: 30000 })
      .catch(() => {}),
    loginFormDoctor.waitFor({ state: "visible", timeout: 30000 }).catch(() => {}),
  ]);

  if (await doctorDashboardMarker.first().isVisible()) {
    console.log("DEBUG: Ya estamos en el Dashboard de Doctor (Bypass activado)");
  } else {
    console.log("DEBUG: Procesando formulario de login (Doctor)");
    await loginFormDoctor.fill(AUTH.DOCTOR.email);
    await page.fill('input[type="password"]', AUTH.DOCTOR.password);

    const fastLoginBtn = page.getByRole("button", { name: /Ingreso Rápido/i });
    if (await fastLoginBtn.isVisible()) {
      console.log("DEBUG: Usando Ingreso Rápido (Master Mode)");
      await fastLoginBtn.click();
    } else {
      console.log("DEBUG: Usando Login normal (Email/Password)");
      await page.getByRole("button", { name: /^Ingresar$/i }).click();
    }
  }

  // Señal determinista: dashboard visible
  console.log("DEBUG: Esperando Dashboard (Doctor)...");
  await expect(doctorDashboardMarker.first()).toBeVisible({ timeout: 60000 });

  // Capturar sesión
  await bridgeFirebaseSession(page);

  await page.context().storageState({ path: DOCTOR_STATE });
  console.log("✅ Doctor storageState guardado en", DOCTOR_STATE);
});
