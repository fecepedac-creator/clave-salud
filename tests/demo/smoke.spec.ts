import { test, expect } from "@playwright/test";

test.describe("Capa 1: Demo/UI Mode (Sin Auth Real)", () => {
  test("Dashboard Admin (Demo Mode)", async ({ page }) => {
    // 1. Acceder al dashboard de administración mediante el flag demo
    // Usamos el centro SaludMass (c_saludmass) que tiene datos mock en constants.ts
    await page.goto("/center/c_saludmass?demo=true&demo_role=admin");

    // 2. Verificar que se inyecta el Usuario Demo en la UI
    await expect(page.getByText("Usuario Demo (ADMIN)")).toBeVisible();

    // 3. Verificar que se ven las carpetas de gestión (Admin Tab Bar)
    // El componente AdminDashboard suele tener pestañas de Agenda, Pacientes, etc.
    await expect(page.locator("nav")).toContainText("Pacientes");
    await expect(page.locator("nav")).toContainText("Agenda");
  });

  test("Dashboard Doctor (Demo Mode)", async ({ page }) => {
    // 1. Acceder al dashboard de profesionales (Doctor)
    await page.goto("/pro/center/c_saludmass?demo=true&demo_role=doctor");

    // 2. Verificar perfil del doctor mock
    await expect(page.getByText("Usuario Demo (DOCTOR)")).toBeVisible();

    // 3. Verificar que se cargan pacientes mock (Juan Pérez está en constants.ts)
    // Se espera que aparezca en la lista de pacientes del día o búsqueda
    await expect(page.getByText("Juan Pérez")).toBeVisible();
  });

  test("Dashboard SuperAdmin (Demo Mode)", async ({ page }) => {
    // 1. Acceder al panel de SuperAdmin
    await page.goto("/superadmin?demo=true&demo_role=superadmin");

    // 2. Verificar que el sistema reconoce el rol de SuperAdmin
    await expect(page.getByText("Usuario Demo (SUPERADMIN)")).toBeVisible();

    // 3. Verificar que se listan centros médicos (SaludMass y Clínica Dental Pro)
    await expect(page.getByText("SaludMass Centro Médico")).toBeVisible();
    await expect(page.getByText("Clínica Dental Pro")).toBeVisible();
  });
});
