#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * CLAVE SALUD — AREA AUDIT RUNNER (v1.3 Optimized)
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
  // Limpiar caracteres de control y normalizar saltos de línea
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
      maxBuffer: 1024 * 1024 * 16, // 16MB buffer para logs extensos
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

/**
 * Genera el cuerpo del reporte en Markdown
 */
function toMarkdown({ areaKey, config, date, results, summary, reportPath }) {
  const lines = [
    `# Auditoría automática — ${config.title}`,
    "",
    `- **Área:** \`${areaKey}\``,
    `- **Fecha ejecución:** \`${date}\``,
    `- **Generado por:** \`scripts/audit/run-audit.cjs\``,
    `- **Estado general:** **${summary.overall}**`,
    "",
    "## Resumen de resultados",
    "",
    `- ✅ Pass: **${summary.pass}**`,
    `- ❌ Fail: **${summary.fail}**`,
    `- ⚠️ Warning: **${summary.warning}**`,
    "",
    "## Alcance del área",
    "",
    config.description,
    "",
    "### Puntos de foco",
    ...(config.focus || []).map((item) => `- ${item}`),
    "",
    "### Evidencia revisada",
    ...(config.evidenceFiles || []).map((file) => `- \`${file}\``),
    "",
    "## Ejecuciones",
    "",
    "| Estado | Comando | Inicio | Fin |",
    "|---|---|---|---|",
    ...results.map((r) => {
      const icon = r.status === "pass" ? "✅" : r.status === "warning" ? "⚠️" : "❌";
      return `| ${icon} ${r.status.toUpperCase()} | \`${r.command}\` | ${r.startedAt} | ${r.finishedAt} |`;
    }),
    "",
    "## Detalle de salida",
    "",
  ];

  for (const r of results) {
    const icon = r.status === "pass" ? "✅" : r.status === "warning" ? "⚠️" : "❌";
    lines.push(`### ${icon} ${r.command}`);
    lines.push("");

    if (r.output) {
      lines.push("```text");
      // Límite de 20,000 para no truncar resultados de tests complejos
      lines.push(
        r.output.length > 20000
          ? r.output.slice(0, 20000) + "\n\n[... Salida truncada por longitud ...]"
          : r.output
      );
      lines.push("```");
    } else {
      lines.push("_Sin salida estándar._");
    }

    if (r.error) {
      lines.push("\n**Error/Stderr:**\n");
      lines.push("```text");
      lines.push(r.error.slice(0, 10000));
      lines.push("```");
    }
    lines.push("");
  }

  lines.push("## Hallazgos manuales (Post-Auditoría)");
  lines.push("\n- [ ] H-001 (Pendiente)");
  lines.push("- [ ] H-002 (Pendiente)");
  lines.push("");
  lines.push(`- **Reporte:** \`${path.relative(ROOT, reportPath)}\``);
  lines.push(`- **Timestamp:** \`${new Date().toISOString()}\``);

  return lines.join("\n");
}

function updateIndex() {
  ensureDir(AUDITS_DIR);
  const areaFiles = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "README.md" || entry.name === "TEMPLATE.md") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const rel = path.relative(AUDITS_DIR, full).replace(/\\/g, "/");
        if (rel.startsWith("results/")) continue;
        areaFiles.push(rel);
      }
    }
  }

  walk(AUDITS_DIR);
  areaFiles.sort((a, b) => b.localeCompare(a));

  const lines = [
    "# 📑 Índice de Auditorías",
    "",
    "Generado automáticamente por el corredor de auditoría.",
    "",
    "| Reporte | Fecha Modificación |",
    "|---|---|",
    ...areaFiles.map((rel) => {
      const full = path.join(AUDITS_DIR, rel);
      const stat = fs.statSync(full);
      return `| [${rel}](${rel}) | ${stat.mtime.toISOString()} |`;
    }),
    ""
  ];

  fs.writeFileSync(path.join(AUDITS_DIR, "README.md"), lines.join("\n"), "utf8");
}

function persistJsonResult({ areaKey, date, config, results, summary, reportPath }) {
  ensureDir(RESULTS_DIR);
  const file = path.join(RESULTS_DIR, `${date}_${areaKey}.json`);
  const payload = {
    area: areaKey,
    title: config.title,
    date,
    generatedAt: new Date().toISOString(),
    summary,
    reportPath: path.relative(ROOT, reportPath).replace(/\\/g, "/"),
    results,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
}

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ No se encontró configuración en: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const args = parseArgs(process.argv);

  if (args.help || !args.area) {
    console.log("Uso: node scripts/audit/run-audit.cjs --area <superadmin|admin-center|doctor-dashboard|whatsapp|...> [--profile smoke|deep] [--date YYYY-MM-DD]");
    process.exit(0);
  }

  const areaKey = String(args.area).trim();
  const areaConfig = config[areaKey];
  if (!areaConfig) {
    console.error(`❌ Área desconocida: ${areaKey}. Verifique config/areas.json`);
    process.exit(1);
  }

  const date = String(args.date || todayIso());
  const profile = String(args.profile || "smoke").toLowerCase();
  const year = date.split("-")[0];
  const reportDir = path.join(AUDITS_DIR, year);
  const reportPath = path.join(reportDir, `${date}_${areaKey}_${profile}.md`);

  ensureDir(reportDir);

  // PREFLIGHT CHECK antes de lanzar tests
  console.log(`\n🛠️  [Audit] Perfil seleccionado: ${profile.toUpperCase()}`);
  PREFLIGHT.checkEnv();
  
  const requiresPW = areaConfig.profiles[profile].some(cmd => cmd.includes("playwright"));
  if (requiresPW) {
    const envOk = PREFLIGHT.checkEnv();
    const pwOk = PREFLIGHT.checkPlaywright();

    if (!envOk || !pwOk) {
      console.error("❌ Abortando auditoría por falta de navegador o entorno.");
      process.exit(1);
    }
  }

  const commands = Array.isArray(areaConfig.profiles[profile]) ? areaConfig.profiles[profile] : [];
  const results = [];

  for (const cmd of commands) {
    results.push(runCommand(cmd));
  }

  const summary = summarize(results);
  const markdown = toMarkdown({ areaKey, config: areaConfig, date, results, summary, reportPath });

  fs.writeFileSync(reportPath, markdown, "utf8");
  persistJsonResult({ areaKey, date, config: areaConfig, results, summary, reportPath });
  updateIndex();

  console.log(`\n✅ Auditoría finalizada: ${path.relative(ROOT, reportPath)}`);
  console.log("Resumen:", summary);

  if (summary.fail > 0) process.exit(2);
}

main();
