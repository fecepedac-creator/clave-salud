#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * CLAVE SALUD — AREA AUDIT RUNNER (v1.4 Consolidated)
 * 🔬 Ejecuta auditorías automatizadas y genera reportes versionados.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "scripts", "audit", "config", "areas.json");
const AUDITS_DIR = path.join(ROOT, "docs", "audits");
const RESULTS_DIR = path.join(AUDITS_DIR, "results");
const PREFLIGHT = require("./preflight.cjs");

/**
 * Parsea argumentos simples --key value o --flag
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeOutput(raw = "") {
  return String(raw).replace(/\r\n/g, "\n").trim();
}

/**
 * Ejecuta un comando síncrono capturando salida y errores.
 */
function runCommand(command) {
  const startedAt = new Date().toISOString();
  console.log(`\n🚀 [Audit] Ejecutando: ${command}`);
  try {
    const stdout = execSync(command, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 16,
    });
    return {
      command,
      status: "pass",
      startedAt,
      finishedAt: new Date().toISOString(),
      output: sanitizeOutput(stdout),
      error: "",
    };
  } catch (error) {
    return {
      command,
      status: "fail",
      startedAt,
      finishedAt: new Date().toISOString(),
      output: sanitizeOutput(error.stdout || ""),
      error: sanitizeOutput(error.stderr || error.message || "Error desconocido"),
    };
  }
}

function summarize(results) {
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const warning = results.filter((r) => r.status === "warning").length;
  const overall = fail > 0 ? "ALTO RIESGO" : warning > 0 ? "RIESGO MEDIO" : "SIN BLOQUEOS";
  return { pass, fail, warning, overall };
}

function toMarkdown({ areaKey, config, date, results, summary, reportPath }) {
  const lines = [
    `# Auditoría automática — ${config.title}`,
    "",
    `- **Área:** \`${areaKey}\``,
    `- **Fecha ejecución:** \`${date}\``,
    `- **Estado general:** **${summary.overall}**`,
    "",
    "## Resumen de resultados",
    `- ✅ Pass: **${summary.pass}**`,
    `- ❌ Fail: **${summary.fail}**`,
    `- ⚠️ Warning: **${summary.warning}**`,
    "",
    "## Ejecuciones",
    "| Estado | Comando | Inicio | Fin |",
    "|---|---|---|---|",
    ...results.map((r) => {
      const icon = r.status === "pass" ? "✅" : r.status === "warning" ? "⚠️" : "❌";
      return `| ${icon} ${r.status.toUpperCase()} | \`${r.command}\` | ${r.startedAt} | ${r.finishedAt} |`;
    }),
    "",
  ];
  return lines.join("\n");
}

function updateIndex() {
  ensureDir(AUDITS_DIR);
  // ... (simplificado para brevedad y evitar corrupción)
}

function persistJsonResult({ areaKey, date, config, results, summary, reportPath }) {
  ensureDir(RESULTS_DIR);
  const file = path.join(RESULTS_DIR, `${date}_${areaKey}.json`);
  const payload = {
    area: areaKey,
    title: config.title,
    date,
    summary,
    results,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
}

function runAreaAudit({ areaKey, config, date, profile }) {
  const areaConfig = config[areaKey];
  if (!areaConfig) return null;

  const reportDir = path.join(AUDITS_DIR, date.split("-")[0]);
  const reportPath = path.join(reportDir, `${date}_${areaKey}_${profile}.md`);
  ensureDir(reportDir);

  const commands = Array.isArray(areaConfig.profiles[profile]) ? areaConfig.profiles[profile] : [];
  const results = [];
  for (const cmd of commands) {
    results.push(runCommand(cmd));
  }

  const summary = summarize(results);
  const markdown = toMarkdown({ areaKey, config: areaConfig, date, results, summary, reportPath });
  fs.writeFileSync(reportPath, markdown, "utf8");
  persistJsonResult({ areaKey, date, config: areaConfig, results, summary, reportPath });
  
  return { areaKey, summary, reportPath };
}

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ No se encontró configuración en: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const args = parseArgs(process.argv);

  if (args.help || (!args.area && !args.all)) {
    console.log("Uso: node scripts/audit/run-audit.cjs [--area <id> | --all] [--profile smoke|deep]");
    process.exit(0);
  }

  const date = String(args.date || todayIso());
  const profile = String(args.profile || "smoke").toLowerCase();
  
  const entries = [];
  if (args.all) {
    PREFLIGHT.checkEnv();
    PREFLIGHT.checkPlaywright();
    const keys = Object.keys(config).sort();
    for (const key of keys) {
      console.log(`---------- Área: ${key} ----------`);
      const res = runAreaAudit({ areaKey: key, config, date, profile });
      if (res) entries.push(res);
    }
  } else {
    const res = runAreaAudit({ areaKey: String(args.area).trim(), config, date, profile });
    if (res) entries.push(res);
  }

  const totalFail = entries.reduce((acc, e) => acc + e.summary.fail, 0);
  if (args.all) {
    console.log("\n==========================================");
    console.log(`🏁 Auditoría Consolidada Finalizada`);
    console.log(`Fails Totales: ${totalFail}`);
    if (totalFail === 0) {
      console.log("✅ Gate clean-audit: PASS");
    } else {
      console.error("❌ Gate clean-audit: FAIL");
    }
    console.log("==========================================");
  }

  if (totalFail > 0) process.exit(2);
}

main();
