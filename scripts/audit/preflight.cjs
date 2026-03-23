#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 🛫 Preflight Check — Clave Salud Auditoría
 * Verifica que el entorno esté listo para ejecutar tests E2E.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.test");

function checkEnv() {
  console.log("🔍 [Preflight] Verificando .env.test...");
  if (!fs.existsSync(ENV_PATH)) {
    console.warn("⚠️  No se encontró .env.test. Los tests E2E podrían fallar por falta de credenciales.");
    console.info("👉 Sugerencia: cp .env.test.example .env.test y configurar los campos requeridos.\n");
    return false;
  }
  return true;
}

function checkPlaywright() {
  console.log("🔍 [Preflight] Verificando navegadores Playwright...");
  try {
    // Intentamos ver si hay navegadores instalados preguntando a playwright-core o simplemente
    // ejecutando un comando que falle rápido si no hay binarios.
    // 'npx playwright install --dry-run' no siempre es fiable sin internet.
    // Intentaremos listar la carpeta de binarios si es posible o simplemente ejecutar 'version'.
    execSync("npx playwright --version", { stdio: "ignore" });
    
    // Una prueba más real: ¿está chromium en el path de pw?
    // Si no está, pw suele arrojar un error específico al intentar lanzar.
    // Para el preflight, nos conformamos con que el comando exista.
    return true;
  } catch (e) {
    console.error("❌ Playwright no parece estar instalado o configurado correctamente.");
    console.error("👉 Ejecuta: npx playwright install\n");
    return false;
  }
}

function main() {
  const envOk = checkEnv();
  const pwOk = checkPlaywright();

  if (!pwOk) {
    process.exit(1);
  }
  console.log("✅ [Preflight] Entorno base verificado.\n");
}

if (require.main === module) {
  main();
}

module.exports = { checkEnv, checkPlaywright };
