#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "scripts", "audit", "config", "areas.json");
const AUDITS_DIR = path.join(ROOT, "docs", "audits");
const RESULTS_DIR = path.join(AUDITS_DIR, "results");

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

function runCommand(command) {
  const startedAt = new Date().toISOString();
  try {
    const stdout = execSync(command, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
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
      error: sanitizeOutput(error.stderr || error.message || "Error no capturado"),
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
  const lines = [];
  lines.push(`# Auditoría automática — ${config.title}`);
  lines.push("");
  lines.push(`- **Área:** \`${areaKey}\``);
  lines.push(`- **Fecha ejecución:** \`${date}\``);
  lines.push(`- **Generado por:** \`scripts/audit/run-audit.cjs\``);
  lines.push(`- **Estado general:** **${summary.overall}**`);
  lines.push("");

  lines.push("## Resumen de resultados");
  lines.push("");
  lines.push(`- ✅ Pass: **${summary.pass}**`);
  lines.push(`- ❌ Fail: **${summary.fail}**`);
  lines.push(`- ⚠️ Warning: **${summary.warning}**`);
  lines.push("");

  lines.push("## Alcance recomendado del área");
  lines.push("");
  lines.push(config.description);
  lines.push("");
  lines.push("### Puntos de foco");
  for (const item of config.focus || []) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("### Evidencia de código a revisar");
  for (const file of config.evidenceFiles || []) {
    lines.push(`- \`${file}\``);
  }
  lines.push("");

  lines.push("## Ejecuciones automáticas");
  lines.push("");
  lines.push("| Estado | Comando | Inicio | Fin |");
  lines.push("|---|---|---|---|");
  for (const r of results) {
    const icon = r.status === "pass" ? "✅" : r.status === "warning" ? "⚠️" : "❌";
    lines.push(`| ${icon} ${r.status.toUpperCase()} | \`${r.command}\` | ${r.startedAt} | ${r.finishedAt} |`);
  }
  lines.push("");

  lines.push("## Evidencia de salida");
  lines.push("");
  for (const r of results) {
    const icon = r.status === "pass" ? "✅" : r.status === "warning" ? "⚠️" : "❌";
    lines.push(`### ${icon} ${r.command}`);
    lines.push("");
    if (r.output) {
      lines.push("```text");
      lines.push(r.output.slice(0, 8000));
      lines.push("```");
    } else {
      lines.push("_Sin salida estándar._");
    }

    if (r.error) {
      lines.push("");
      lines.push("**stderr/error**");
      lines.push("");
      lines.push("```text");
      lines.push(r.error.slice(0, 8000));
      lines.push("```");
    }
    lines.push("");
  }

  lines.push("## Hallazgos manuales posteriores");
  lines.push("");
  lines.push("> Esta sección puede ser completada automáticamente en futuras iteraciones con reglas estáticas/dinámicas.");
  lines.push("");
  lines.push("- [ ] H-001");
  lines.push("- [ ] H-002");
  lines.push("- [ ] H-003");
  lines.push("");

  lines.push("## Metadata de archivo");
  lines.push("");
  lines.push(`- **Ruta del reporte:** \`${path.relative(ROOT, reportPath)}\``);
  lines.push(`- **Timestamp generado:** \`${new Date().toISOString()}\``);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function updateIndex() {
  ensureDir(AUDITS_DIR);
  const areaFiles = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "README.md" || entry.name === "TEMPLATE_AUDITORIA_AREA.md") continue;
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

  const lines = [];
  lines.push("# Índice de Auditorías");
  lines.push("");
  lines.push("Este índice se actualiza automáticamente con cada ejecución de `run-audit.cjs`.");
  lines.push("");
  lines.push("| Archivo | Última actualización (UTC) |");
  lines.push("|---|---|");
  for (const rel of areaFiles) {
    const full = path.join(AUDITS_DIR, rel);
    const stat = fs.statSync(full);
    lines.push(`| [${rel}](${rel}) | ${stat.mtime.toISOString()} |`);
  }
  lines.push("");

  fs.writeFileSync(path.join(AUDITS_DIR, "README.md"), `${lines.join("\n")}\n`, "utf8");
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

function printHelp(config) {
  const keys = Object.keys(config).sort();
  console.log("Uso:");
  console.log("  node scripts/audit/run-audit.cjs --area <area> [--date YYYY-MM-DD] [--dry-run]");
  console.log("");
  console.log("Áreas disponibles:");
  for (const key of keys) {
    console.log(`  - ${key}`);
  }
}

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`No se encontró config: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const args = parseArgs(process.argv);

  if (args.help || !args.area) {
    printHelp(config);
    process.exit(args.help ? 0 : 1);
  }

  const areaKey = String(args.area).trim();
  const areaConfig = config[areaKey];
  if (!areaConfig) {
    console.error(`Área inválida: ${areaKey}`);
    printHelp(config);
    process.exit(1);
  }

  const date = String(args.date || todayIso());
  const year = date.slice(0, 4);
  const reportDir = path.join(AUDITS_DIR, year);
  const reportPath = path.join(reportDir, `${date}_${areaKey}.md`);

  ensureDir(reportDir);

  const commands = Array.isArray(areaConfig.commands) ? areaConfig.commands : [];
  const results = [];

  if (args["dry-run"]) {
    for (const command of commands) {
      results.push({
        command,
        status: "warning",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        output: "Ejecución omitida por --dry-run.",
        error: "",
      });
    }
  } else {
    for (const command of commands) {
      console.log(`→ Ejecutando: ${command}`);
      results.push(runCommand(command));
    }
  }

  const summary = summarize(results);
  const markdown = toMarkdown({
    areaKey,
    config: areaConfig,
    date,
    results,
    summary,
    reportPath,
  });

  fs.writeFileSync(reportPath, markdown, "utf8");
  persistJsonResult({ areaKey, date, config: areaConfig, results, summary, reportPath });
  updateIndex();

  console.log("\nReporte generado:", path.relative(ROOT, reportPath));
  console.log("Resumen:", summary);

  if (summary.fail > 0) {
    process.exitCode = 2;
  }
}

main();
