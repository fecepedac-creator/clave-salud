/**
 * scripts/audit/setup-audit.cjs
 * Script de inicialización para el entorno de auditoría Clave Salud.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function run(cmd, desc) {
  console.log(`\n🚀 ${desc}...`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
    console.log(`✅ ${desc} completado.`);
  } catch (err) {
    console.error(`❌ Error en: ${desc}`);
    process.exit(1);
  }
}

console.log("🛠️  Iniciando Setup de Auditoría (v3.5)");

// 1. Instalar dependencias si faltan
if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
  run('npm install', 'Instalando dependencias de Node');
}

// 2. Instalar navegadores Playwright
run('npx playwright install chromium', 'Instalando navegador Chromium (Playwright)');

// 3. Verificar .env.test
const envPath = path.join(ROOT, '.env.test');
if (!fs.existsSync(envPath)) {
  console.warn("⚠️  Aviso: .env.test no encontrado. Creando plantilla...");
  const template = `# Test Environment
VITE_BYPASS_MODE=true
VITE_TEST_ADMIN_ID=admin_test_id
VITE_TEST_DOCTOR_ID=doctor_test_id
VITE_TEST_CENTER_ID=c_eji2qv61
`;
  fs.writeFileSync(envPath, template, 'utf8');
}

// 4. Crear directorios de reportes
const reportsDir = path.join(ROOT, 'docs/audits/2026');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

console.log("\n✨ Setup finalizado. Ya puedes ejecutar: node scripts/audit/run-audit.cjs --area all");
