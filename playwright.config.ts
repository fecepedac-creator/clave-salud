import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga variables de .env.test (si existe) para ejecución local
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

const IS_CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Firebase listeners necesitan estabilidad secuencial
  workers: 1,           // Forzar ejecución secuencial para evitar colisiones en Firestore
  retries: IS_CI ? 1 : 0, // 1 retry en CI, 0 en local para diagnóstico rápido

  // Timeouts globales
  timeout: 60000,         // Tiempo máximo por test
  expect: {
    timeout: 10000,       // Tiempo máximo por aserción
  },

  reporter: IS_CI
    ? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["html", { outputFolder: "playwright-report", open: "never" }], ["line"]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5175",
    trace: "on-first-retry",       // Genera trace solo en el primer reintento
    screenshot: "only-on-failure", // Captura solo en fallo
    video: "retain-on-failure",    // Video solo en fallo
    actionTimeout: 15000,           // Timeout por acción (click, fill, etc.)
    navigationTimeout: 30000,       // Timeout por navegación
    locale: "es-CL",               // Evitar diferencias de formato de fecha
    // Desactivar notificaciones y geolocalización para evitar popups
    permissions: ["clipboard-read", "clipboard-write"],
  },

  projects: [
    // 1. Setup — corre primero y genera los storageState
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },

    // 2. Tests DEMO (No dependen de login)
    {
      name: "demo-tests",
      testDir: "./tests/demo",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },

    // 3. Tests de Admin (usa storageState del Admin)
    {
      name: "admin-tests",
      testDir: "./tests/admin",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "tests/auth/.auth/admin.json"),
        viewport: { width: 1280, height: 800 },
      },
    },

    // 3. Tests de Doctor
    {
      name: "doctor-tests",
      testDir: "./tests/doctor",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "tests/auth/.auth/doctor.json"),
        viewport: { width: 1280, height: 800 },
      },
    },
  ],

  // Auto-inicia el dev server si no está corriendo
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5175",
    reuseExistingServer: !IS_CI, // En CI siempre levantar servidor fresco
    timeout: 120000,
  },
});
