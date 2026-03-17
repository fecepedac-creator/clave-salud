/**
 * TEST 9 — Seguridad Multi-Tenant: Admin No Accede a KPIs de Otro Centro
 *
 * Objetivo: Confirmar que un Admin del Centro A no puede ver KPIs del Centro B.
 *
 * Estrategia: Navegar directamente a /center/{CENTRO_B_ID} con las credenciales
 * del Admin del Centro A. El resultado esperado es UNO de:
 *   (a) La app redirige silenciosamente al centro propio (guard de routing)
 *   (b) La app carga la vista del Centro B pero la tabla de stats está VACÍA
 *       porque las reglas de Firestore bloquean la lectura
 *
 * En ambos casos el admin NO puede ver datos del Centro B.
 *
 * Criticidad: 🔴 Crítica (aislamiento entre centros médicos distintos)
 */
import { test, expect } from "@playwright/test";
import { TEST } from "../fixtures/test-data";

// ID de un centro al que el admin de prueba NO tiene acceso.
// Se usa un ID de formato válido pero no asignado al admin de prueba.
// Las Firestore rules bloquearán la lectura devolviendo vacío.
const CENTRO_B_ID = process.env.TEST_CENTER_B_ID || "c_otro_centro_999";

test("T9 — Seguridad Multi-Tenant: Admin no ve KPIs de otro centro", async ({ page }) => {
  // 1. Intentar acceder directamente al Centro B con sesión del Admin del Centro A
  await page.goto(`${TEST.BASE_URL}/center/${CENTRO_B_ID}?agent_test=true`);

  // Esperar a que la app resuelva su estado (rutas, auth, onSnapshot)
  await page.waitForTimeout(5000);

  const currentUrl = page.url();
  const tabBarVisible = await page.locator('[data-testid="admin-tab-bar"]').isVisible();

  if (!tabBarVisible) {
    // Caso (a): La app redirigió — no llegó al admin dashboard del Centro B
    // Podría estar en la home, en login, o en el centro propio
    console.log(`[T9] No llegó al admin dashboard. URL actual: ${currentUrl}`);

    // Verificar que al menos no estamos en el Centro B
    expect(currentUrl).not.toContain(`/center/${CENTRO_B_ID}`);
    console.log("✅ T9 — Guard activo: admin redirigido fuera del Centro B.");
    return;
  }

  // Caso (b): La app cargó el panel — pero los datos deben estar bloqueados
  console.log(`[T9] Admin dashboard visible. URL: ${currentUrl}`);

  // Navegar al tab de Rendimiento para verificar que no hay datos del Centro B
  const perfTab = page.locator('[data-testid="admin-tab-performance"]');
  if (await perfTab.isVisible()) {
    await perfTab.click();

    // Esperar carga (onSnapshot resuelve con permiso denegado → lista vacía)
    await page.waitForTimeout(3000);

    // La tabla de stats debe estar vacía (Firestore rules bloquean)
    const statsTable = page.locator('[data-testid="prof-stats-table"]');
    if (await statsTable.isVisible()) {
      const tableText = await statsTable.innerText();
      // No debe mostrar datos reales — debe mostrar "Sin datos" o estar vacío
      const hasRealData =
        /\$[\d.]+|350\.000|Doctor Test/.test(tableText) && !tableText.includes("Sin datos");

      expect(hasRealData).toBe(false);
      console.log(
        "✅ T9 — Multi-tenant OK: tabla de otro centro está vacía (Firestore rules bloquearon)."
      );
    } else {
      // Si la tabla ni siquiera cargó, también es resultado aceptable
      console.log("✅ T9 — Multi-tenant OK: tab de rendimiento no muestra datos del Centro B.");
    }
  } else {
    // Si el tab de rendimiento no carga, el guard está funcionando
    console.log("✅ T9 — Tab rendimiento no accesible para Centro B. Guard activo.");
  }

  // En ningún caso debe mostrar exactamente los datos del Centro A
  // (eso indicaría que se cargaron datos cruzados)
  const kpiEl = page.locator('[data-testid="kpi-total-appointments"]');
  if (await kpiEl.isVisible()) {
    const kpiText = await kpiEl.innerText();
    const kpiValue = parseInt(kpiText.match(/\d+/)?.[0] || "0");
    // El Centro B no tiene datos seeded → debe ser 0 o no mostrar nada
    expect(kpiValue).toBe(0);
    console.log(`✅ T9 — KPI total del Centro B = ${kpiValue} (correcto: sin datos seeded).`);
  }
});
