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

function runSetupPlaywright() {
  console.log("Instalando navegadores de Playwright...");
  const result = runCommand("npx playwright install");
  if (result.status === "pass") {
    console.log("✅ Playwright instalado correctamente.");
    return 0;
  }
  console.error("❌ Falló instalación de Playwright.");
  if (result.output) console.error(result.output);
  if (result.error) console.error(result.error);
  return 1;
}

function isPlaywrightCommand(command) {
  return /\bplaywright\s+test\b/.test(command);
}

let _playwrightAvailableCache = null;
function checkPlaywrightAvailability() {
  if (_playwrightAvailableCache) return _playwrightAvailableCache;
  try {
    execSync(
      'node -e "const { chromium } = require(\'playwright\'); (async()=>{ const b = await chromium.launch({headless:true}); await b.close(); })().catch(e=>{ console.error(e.message); process.exit(1); })"',
      {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 4,
      }
    );
    _playwrightAvailableCache = { ok: true, message: "Playwright browser disponible." };
  } catch (error) {
    const stderr = sanitizeOutput(error.stderr || "");
    const stdout = sanitizeOutput(error.stdout || "");
    const msg =
      stderr ||
      stdout ||
      "Playwright no disponible. Ejecuta `npx playwright install` para instalar navegadores.";
    _playwrightAvailableCache = { ok: false, message: msg };
  }
  return _playwrightAvailableCache;
}

function summarize(results) {
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const warning = results.filter((r) => r.status === "warning").length;
  const overall = fail > 0 ? "ALTO RIESGO" : warning > 0 ? "RIESGO MEDIO" : "SIN BLOQUEOS";
  return { pass, fail, warning, overall };
}

function buildFindings(results) {
  let index = 1;
  return results
    .filter((r) => r.status !== "pass")
    .map((r) => {
      const id = `H-${String(index).padStart(3, "0")}`;
      index += 1;
      const severity = r.status === "fail" ? "ALTA" : "MEDIA";
      const reason =
        r.status === "fail"
          ? "Comando falló durante la auditoría."
          : "Comando quedó en warning por precondiciones o entorno.";
      const recommendation =
        isPlaywrightCommand(r.command) || /playwright/i.test(r.error)
          ? "Instalar navegadores y re-ejecutar E2E: `npx playwright install`."
          : "Revisar logs de stderr/stdout y corregir causa raíz antes de re-ejecutar.";
      return { id, severity, command: r.command, reason, recommendation };
    });
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

  lines.push("## Hallazgos detectados automáticamente");
  lines.push("");
  const findings = buildFindings(results);
  if (findings.length === 0) {
    lines.push("- ✅ Sin hallazgos automáticos.");
  } else {
    for (const finding of findings) {
      lines.push(`- [ ] **${finding.id}** (${finding.severity})`);
      lines.push(`  - Comando: \`${finding.command}\``);
      lines.push(`  - Motivo: ${finding.reason}`);
      lines.push(`  - Recomendación: ${finding.recommendation}`);
    }
  }
  lines.push("");

  lines.push("## Hallazgos manuales posteriores");
  lines.push("");
  lines.push("> Completar con revisión funcional/seguridad específica del área.");
  lines.push("");
  lines.push("- [ ] M-001");
  lines.push("- [ ] M-002");
  lines.push("- [ ] M-003");
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
  lines.push("## Ejecución rápida");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run audit:setup:e2e");
  lines.push("npm run audit:all");
  lines.push("npm run audit:run -- --all --profile smoke");
  lines.push("npm run audit:run -- --all --profile deep");
  lines.push("npm run audit:all:strict");
  lines.push("```");
  lines.push("");
  lines.push("## Checklist Playwright para ejecución real");
  lines.push("");
  lines.push("1. `npx playwright install`");
  lines.push("2. Configurar `.env.test` con credenciales y IDs");
  lines.push("3. Ejecutar `npx playwright test --project=setup`");
  lines.push("4. Validar smoke:");
  lines.push("   - `npx playwright test tests/admin/login.spec.ts --project=admin-tests`");
  lines.push("   - `npx playwright test tests/doctor/login.spec.ts --project=doctor-tests`");
  lines.push("");
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

function writeConsolidatedReport({ date, entries, dryRun }) {
  const year = date.slice(0, 4);
  const reportDir = path.join(AUDITS_DIR, year);
  ensureDir(reportDir);
  const reportPath = path.join(reportDir, `${date}_multiagente_consolidado.md`);
  const jsonPath = path.join(RESULTS_DIR, `${date}_multiagente_consolidado.json`);

  const totals = entries.reduce(
    (acc, e) => {
      acc.pass += e.summary.pass;
      acc.fail += e.summary.fail;
      acc.warning += e.summary.warning;
      return acc;
    },
    { pass: 0, fail: 0, warning: 0 }
  );
  const overall =
    totals.fail > 0 ? "ALTO RIESGO" : totals.warning > 0 ? "RIESGO MEDIO" : "SIN BLOQUEOS";

  const lines = [];
  lines.push("# Auditoría multiagente consolidada");
  lines.push("");
  lines.push(`- **Fecha:** \`${date}\``);
  lines.push(`- **Modo:** \`${dryRun ? "dry-run" : "normal"}\``);
  lines.push(`- **Áreas ejecutadas:** **${entries.length}**`);
  lines.push(`- **Estado general:** **${overall}**`);
  lines.push("");
  lines.push("## Totales");
  lines.push("");
  lines.push(`- ✅ Pass: **${totals.pass}**`);
  lines.push(`- ❌ Fail: **${totals.fail}**`);
  lines.push(`- ⚠️ Warning: **${totals.warning}**`);
  lines.push("");
  lines.push("## Resumen por área");
  lines.push("");
  lines.push("| Área | Estado | Pass | Fail | Warning | Reporte |");
  lines.push("|---|---|---:|---:|---:|---|");
  for (const entry of entries) {
    const icon =
      entry.summary.fail > 0 ? "❌" : entry.summary.warning > 0 ? "⚠️" : "✅";
    lines.push(
      `| \`${entry.area}\` | ${icon} ${entry.summary.overall} | ${entry.summary.pass} | ${entry.summary.fail} | ${entry.summary.warning} | [ver](${entry.relativeReportPath}) |`
    );
  }
  lines.push("");

  const gate = {
    name: "clean-audit",
    rule: "fail == 0 && warning == 0",
    passed: totals.fail === 0 && totals.warning === 0,
  };
  lines.push("## Criterio de salida (gate)");
  lines.push("");
  lines.push(`- **Regla:** \`${gate.rule}\``);
  lines.push(`- **Resultado:** **${gate.passed ? "PASS" : "FAIL"}**`);
  lines.push("");

  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  ensureDir(RESULTS_DIR);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        date,
        generatedAt: new Date().toISOString(),
        dryRun: Boolean(dryRun),
        overall,
        totals,
        gate,
        areas: entries.map((e) => ({
          area: e.area,
          title: e.title,
          summary: e.summary,
          reportPath: e.relativeReportPath,
        })),
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    reportPath,
    jsonPath,
    summary: { ...totals, overall, gate },
  };
}

function printHelp(config) {
  const keys = Object.keys(config).sort();
  console.log("Uso:");
  console.log(
    "  node scripts/audit/run-audit.cjs --area <area> [--date YYYY-MM-DD] [--dry-run] [--all] [--profile smoke|deep|all] [--require-playwright] [--enforce-clean]"
  );
  console.log("  node scripts/audit/run-audit.cjs --setup-playwright");
  console.log("");
  console.log("Áreas disponibles:");
  for (const key of keys) {
    console.log(`  - ${key}`);
  }
}

function resolveCommandsForProfile(areaConfig, profile) {
  const commandSets = areaConfig.commandSets;
  if (!commandSets) return Array.isArray(areaConfig.commands) ? areaConfig.commands : [];
  if (profile === "smoke") return commandSets.smoke || [];
  if (profile === "deep") return commandSets.deep || commandSets.smoke || [];
  if (profile === "all") {
    const merged = [...(commandSets.smoke || []), ...(commandSets.deep || [])];
    return [...new Set(merged)];
  }
  return commandSets.deep || commandSets.smoke || [];
}

function executeArea({ areaKey, areaConfig, date, dryRun, profile, requirePlaywright }) {
  const year = date.slice(0, 4);
  const reportDir = path.join(AUDITS_DIR, year);
  const reportPath = path.join(reportDir, `${date}_${areaKey}.md`);

  ensureDir(reportDir);

  const commands = resolveCommandsForProfile(areaConfig, profile);
  const results = [];

  if (dryRun) {
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
      if (isPlaywrightCommand(command)) {
        const preflight = checkPlaywrightAvailability();
        if (!preflight.ok) {
          const warningOrFail = requirePlaywright ? "fail" : "warning";
          const output = requirePlaywright
            ? "Playwright preflight falló y --require-playwright está activo."
            : "Playwright preflight falló. Se omite ejecución E2E para evitar falso negativo de entorno.";
          results.push({
            command,
            status: warningOrFail,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            output,
            error: `${preflight.message}\nSugerencia: npx playwright install`,
          });
          continue;
        }
      }
      console.log(`→ [${areaKey}] Ejecutando: ${command}`);
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

  return {
    area: areaKey,
    title: areaConfig.title,
    summary,
    reportPath,
    relativeReportPath: path.relative(AUDITS_DIR, reportPath).replace(/\\/g, "/"),
  };
}

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`No se encontró config: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const args = parseArgs(process.argv);

  if (args["setup-playwright"]) {
    process.exitCode = runSetupPlaywright();
    return;
  }

  if (args.help || (!args.area && !args.all)) {
    printHelp(config);
    process.exit(args.help ? 0 : 1);
  }
  const date = String(args.date || todayIso());
  const dryRun = Boolean(args["dry-run"]);
  const requirePlaywright = Boolean(args["require-playwright"]);
  const enforceClean = Boolean(args["enforce-clean"]);
  const profile = String(args.profile || "all").trim().toLowerCase();
  if (!["smoke", "deep", "all"].includes(profile)) {
    console.error("Perfil inválido. Usa --profile smoke|deep|all");
    process.exit(1);
  }

  if (args.all) {
    const keys = Object.keys(config).sort();
    const entries = [];
    for (const key of keys) {
      entries.push(
        executeArea({
          areaKey: key,
          areaConfig: config[key],
          date,
          dryRun,
          profile,
          requirePlaywright,
        })
      );
    }
    const consolidated = writeConsolidatedReport({ date, entries, dryRun });
    updateIndex();
    console.log("\nReporte consolidado:", path.relative(ROOT, consolidated.reportPath));
    console.log("Resumen consolidado:", consolidated.summary);
    if (consolidated.summary.fail > 0) process.exitCode = 2;
    if (enforceClean && !consolidated.summary.gate.passed) {
      console.error("Gate clean-audit en FAIL (se esperaban 0 fail y 0 warning).");
      process.exitCode = 3;
    }
    return;
  }

  const areaKey = String(args.area).trim();
  const areaConfig = config[areaKey];
  if (!areaConfig) {
    console.error(`Área inválida: ${areaKey}`);
    printHelp(config);
    process.exit(1);
  }

  const entry = executeArea({
    areaKey,
    areaConfig,
    date,
    dryRun,
    profile,
    requirePlaywright,
  });
  updateIndex();

  console.log("\nReporte generado:", path.relative(ROOT, entry.reportPath));
  console.log("Resumen:", entry.summary);

  if (entry.summary.fail > 0) process.exitCode = 2;
}

main();
