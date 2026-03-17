/**
 * TEST 5 — Admin: Export CSV compatible con Excel (es-CL)
 *
 * Flujo: ir a Tab Rendimiento → click "Bajar Consolidado"
 * → capturar el download → leer bytes → validar:
 *   - Filename: Produccion_{YYYY-MM}.csv  (o similar)
 *   - BOM UTF-8 al inicio (EF BB BF) — para Excel con caracteres especiales
 *   - Separador de campo: ";" (no ",")
 *   - Primera línea contiene "Profesional" (header existe)
 *   - Valores numéricos sin NaN ni "undefined"
 *
 * Precondición: Dataset seeded con al menos 1 profesional
 * con stats para TEST_YEAR_MONTH (SEED.DOCTOR_STATS).
 *
 * Anti-flake:
 *  - waitForEvent('download') antes del click (sin timeout)
 *  - fs.readFileSync en el path temporal del download
 *  - Sin waitForTimeout
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import { TEST, SEED } from "../fixtures/test-data";

test("T5 — Admin: Export CSV es BOM UTF-8, separador ';', header 'Profesional', sin NaN", async ({
  page,
}) => {
  // 1. Navegar directamente al dashboard del centro con flag
  await page.goto(`${TEST.BASE_URL}/center/${TEST.CENTER_ID}?agent_test=true`);

  const tabPerformance = page.locator('[data-testid="admin-tab-performance"]');
  await expect(tabPerformance).toBeVisible({ timeout: 45000 });

  // 2. Ir al Tab Rendimiento
  await tabPerformance.click();

  // Anti-flake: esperar hidratación dinámica
  await expect(page.locator('[data-testid="performance-loading-skeleton"]')).toBeHidden({
    timeout: 45000,
  });
  await expect(page.locator(`[data-testid="prof-name-${TEST.DOCTOR_ID}"]`)).toBeVisible({
    timeout: 15000,
  });

  // 3. Asegurar que el mes correcto está seleccionado
  await expect(page.locator('[data-testid="month-selector"]')).toBeVisible({
    timeout: 10000,
  });
  await page.fill('[data-testid="month-selector"]', TEST.YEAR_MONTH);
  // Disparar cambio (React controlled input)
  await page.locator('[data-testid="month-selector"]').dispatchEvent("change");

  // 4. Esperar que aparezcan datos en la tabla (al menos 1 fila de profesional)
  // El botón de export está disabled si profStats.length === 0
  await expect(page.locator('[data-testid="btn-export-csv"]')).toBeEnabled({
    timeout: 15000,
  });

  // 5. Capturar el download ANTES de hacer click (sin race condition)
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click('[data-testid="btn-export-csv"]'),
  ]);

  // ── Verificar filename ────────────────────────────────────────────────────
  const filename = download.suggestedFilename();
  expect(filename).toMatch(/Produccion.*\.csv$/i);

  // Verificar que el nombre incluye el año-mes
  const yearPart = TEST.YEAR_MONTH.split("-")[0];
  const monthPart = TEST.YEAR_MONTH.split("-")[1];
  expect(filename).toContain(yearPart);

  console.log(`📁 Filename: ${filename}`);

  // ── Leer el contenido binario del archivo ────────────────────────────────
  const filePath = await download.path();
  if (!filePath) throw new Error("download.path() returned null — descarga falló");

  const rawBytes = fs.readFileSync(filePath);
  const rawContent = rawBytes.toString("binary");

  // ── Verificar BOM UTF-8 ──────────────────────────────────────────────────
  // BOM = bytes 0xEF 0xBB 0xBF al inicio
  const hasBOM = rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf;
  expect(hasBOM).toBe(true); // CSV debe tener BOM para que Excel lo abra bien

  // Leer como UTF-8 removiendo el BOM si existe
  const content = hasBOM
    ? rawBytes.toString("utf8").substring(1) // quitar el BOM character (\uFEFF)
    : rawBytes.toString("utf8");

  console.log(`📄 Primeros 200 chars del CSV:\n${content.substring(0, 200)}`);

  // ── Verificar separador ";" ───────────────────────────────────────────────
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  expect(lines.length).toBeGreaterThanOrEqual(2); // header + al menos 1 fila de datos

  const headerLine = lines[0];
  expect(headerLine).toContain(";"); // Separador punto-y-coma (no coma)
  expect(headerLine).not.toMatch(/^[^;]+,[^;]+/); // Sin comas como separador

  // ── Verificar que el header tiene la columna "Profesional" ───────────────
  expect(headerLine).toMatch(/Profesional/i);

  // ── Verificar que los valores por línea no contienen "NaN" ni "undefined" ─
  for (let i = 1; i < lines.length; i++) {
    expect(lines[i]).not.toContain("NaN");
    expect(lines[i]).not.toContain("undefined");
    expect(lines[i]).not.toContain("null");
  }

  // ── Verificar que hay al menos 1 fila de datos con cifra numérica ─────────
  const dataLines = lines.slice(1);
  const hasNumericData = dataLines.some((line) => /\d+/.test(line));
  expect(hasNumericData).toBe(true);

  // ── Verificar que el monto seeded es correcto (si los datos son el seed) ──
  // Esto es un check de ejemplo, el contenido exacto depende del proveedor
  // de datos real. Solo verificamos que exista alguna cifra que coincida.
  const expectedAmount = SEED.DOCTOR_STATS.totalAmountBillable.toLocaleString("es-CL");
  // El monto puede estar escapado con comillas: "350.000" o 350000
  const contentNormalized = content.replace(/"/g, "").replace(/\./g, "");
  expect(contentNormalized).toContain(SEED.DOCTOR_STATS.totalAmountBillable.toString());

  // ── Verificar que valores están escapados con comillas dobles ─────────────
  // Los campos con posibles comas especiales deben venir con ""
  // Al menos el campo de nombre del profesional debe estar entre comillas
  expect(content).toContain('"'); // Hay al menos un valor escapado

  console.log(
    `✅ T5 — CSV válido: BOM=${hasBOM}, sep=";", header OK, ${dataLines.length} filas, sin NaN.`
  );
});
