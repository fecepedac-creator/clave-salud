import { test, expect } from "@playwright/test";

test("Depuración: Listar todos los centros activos en producción", async ({ page }) => {
  console.log("Navegando a la home de producción...");
  await page.goto("https://clavesalud-2.web.app/", { waitUntil: 'networkidle' });

  console.log("Esperando carga de centros...");
  await page.waitForTimeout(10000);

  // Intentar encontrar todos los centros
  const centers = await page.locator('.bg-white.rounded-3xl.shadow-sm h3').allTextContents();
  console.log("CENTROS ENCONTRADOS:", centers);

  // Tomar screenshot de la home
  await page.screenshot({ path: "debug_home_centers.png", fullPage: true });

  if (centers.length === 0) {
    console.log("No se encontraron centros. Verificando estado del body...");
    const html = await page.content();
    console.log("HTML inicial (primeros 500 chars):", html.substring(0, 500));
  }
});
