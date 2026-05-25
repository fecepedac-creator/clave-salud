#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_SCENARIOS = path.join(__dirname, "scenarios.json");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "tmp", "whatsapp-identity");
const DEFAULT_AGENT_MODULE = path.join(ROOT, "functions", "lib", "whatsapp.js");

const args = parseArgs(process.argv.slice(2));
const scenariosPath = path.resolve(args.scenarios || DEFAULT_SCENARIOS);
const mode = args.mode || "local";
const outputDir = path.resolve(args.output || path.join(DEFAULT_OUTPUT_DIR, mode));

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, "functions", ".env"));
if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
}

main().catch((error) => {
  console.error("[identity-runner] Error:", error.message);
  process.exitCode = 1;
});

async function main() {
  const scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf8"));
  if (!Array.isArray(scenarios) || scenarios.length < 30 || scenarios.length > 50) {
    throw new Error("Expected scenarios.json to contain 30 to 50 scenarios.");
  }

  if (mode === "agent") {
    await validateGeminiKey();
  }

  ensureDir(outputDir);
  ensureDir(path.join(outputDir, "transcripts"));

  const results = [];
  for (const scenario of scenarios) {
    const transcript = await runScenario(scenario, mode);
    const evaluation = evaluateTranscript(scenario, transcript);
    const result = {
      id: scenario.id,
      scenario: scenario.scenario,
      passed: evaluation.failures.length === 0,
      ...evaluation,
      transcript,
    };
    results.push(result);
    fs.writeFileSync(
      path.join(outputDir, "transcripts", `${scenario.id}.json`),
      JSON.stringify({ scenario, transcript, evaluation }, null, 2)
    );
  }

  const summary = summarize(results);
  fs.writeFileSync(path.join(outputDir, "identity_eval_results.json"), JSON.stringify({ summary, results }, null, 2));
  fs.writeFileSync(path.join(outputDir, "identity_eval_results.csv"), toCsv(results));
  fs.writeFileSync(path.join(outputDir, "identity_eval_summary.md"), toMarkdown(summary, results, mode));

  printSummary(summary, outputDir, mode);
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

async function runScenario(scenario, selectedMode) {
  if (selectedMode === "local") {
    return runLocalScenario(scenario);
  }

  if (selectedMode === "webhook") {
    return runWebhookScenario(scenario);
  }

  if (selectedMode === "agent") {
    return runAgentScenario(scenario);
  }

  throw new Error(`Unknown mode "${selectedMode}". Use --mode=local, --mode=agent or --mode=webhook.`);
}

function runLocalScenario(scenario) {
  const transcript = [];
  for (const message of scenario.messages) {
    transcript.push({ role: "patient", text: message });
  }
  transcript.push({ role: "bot", text: localBotResponse(scenario) });
  return transcript;
}

async function runWebhookScenario() {
  const url = process.env.IDENTITY_WEBHOOK_URL;
  if (!url) {
    throw new Error("Webhook mode requires IDENTITY_WEBHOOK_URL. Use Firebase emulator or a controlled test endpoint.");
  }
  throw new Error(
    "Webhook mode is scaffolded but not enabled yet. The production processor currently depends on Meta webhook shape, signature, async worker behavior and Firestore state."
  );
}

async function runAgentScenario(scenario) {
  const modulePath = path.resolve(args.agentModule || process.env.IDENTITY_AGENT_MODULE || DEFAULT_AGENT_MODULE);
  if (!fs.existsSync(modulePath)) {
    throw new Error(`Agent module not found at ${modulePath}. Run "npm --prefix functions run build" first.`);
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Agent mode requires GEMINI_API_KEY so the real Gemini-backed processor can run.");
  }

  const mod = await import(pathToFileUrl(modulePath));
  if (typeof mod.runWhatsappIdentityHarness !== "function") {
    throw new Error(`Module ${modulePath} does not export runWhatsappIdentityHarness.`);
  }

  return mod.runWhatsappIdentityHarness({
    messages: scenario.messages,
    center: {
      id: process.env.IDENTITY_CENTER_ID || "identity_test_center",
      name: process.env.IDENTITY_CENTER_NAME || "Centro Medico Los Andes",
      businessHours: process.env.IDENTITY_CENTER_HOURS || "Lunes a Viernes, 08:00 a 18:00",
    },
    staff: loadAgentStaffFixture(),
    phoneNumberId: process.env.IDENTITY_PHONE_NUMBER_ID || "identity_test_phone_number",
    to: `569${String(scenario.id || "0").replace(/\D/g, "").padStart(8, "0").slice(-8)}`,
    contactName: `PACIENTE_${String(scenario.id || "0").replace(/\D/g, "").padStart(3, "0")}`,
  });
}

async function validateGeminiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Agent mode requires GEMINI_API_KEY so the real Gemini-backed processor can run.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
  });

  if (!response.ok) {
    let reason = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      reason = body?.error?.message || reason;
    } catch (e) {}
    throw new Error(`Gemini preflight failed: ${reason}`);
  }
}

function localBotResponse(scenario) {
  const expected = scenario.expected || {};
  const parts = ["Entiendo su solicitud."]; 

  if (expected.mustMentionCenter || scenario.scenario === "tenant_correcto") {
    parts.push("Usted esta comunicandose con Centro Medico Los Andes.");
  }

  if (expected.mustMention?.includes("131")) {
    parts.push("Por los sintomas que menciona, llame al 131 (SAMU) o acuda a urgencias.");
  }

  if (expected.mustNotDiagnose || expected.mustNotRecommendMedication) {
    parts.push("Como asistente virtual no puedo dar diagnosticos ni recomendaciones medicas.");
  }

  if (expected.mustAskFor?.includes("professional_or_service")) {
    parts.push("Indiqueme que profesional o servicio necesita.");
  }
  if (expected.mustAskFor?.includes("date_or_time")) {
    parts.push("Indiqueme fecha y hora preferida para revisar disponibilidad real.");
  }
  if (expected.mustAskFor?.includes("patient_name")) {
    parts.push("Tambien necesito el nombre completo del paciente.");
  }
  if (expected.mustAskFor?.includes("rut") || expected.mustMention?.includes("RUT")) {
    parts.push("Por favor envie el RUT con guion para validar los datos.");
  }

  if (expected.mustRequireExplicitConfirmation) {
    parts.push("Antes de reservar, le mostrare un resumen y necesitare su confirmacion explicita.");
  }

  if (expected.mustValidateData) {
    parts.push("Validare los datos completos antes de ejecutar cualquier cambio.");
  }

  if (expected.mustTriggerHandoff || expected.mustMentionSecretary) {
    parts.push("Derivare su solicitud a secretaria para seguimiento.");
  }

  if (expected.mustNotInventOperationalData) {
    parts.push("No inventare datos operacionales; revisare la informacion disponible o lo derivare a secretaria.");
  }

  if (expected.mustUseRealAvailability) {
    parts.push("Solo ofrecere horarios respaldados por la agenda disponible.");
  }

  if (expected.mustOfferNextStep) {
    parts.push("Puedo ayudarle a agendar, revisar alternativas o derivarlo a secretaria.");
  }

  if (expected.mustNotConfirmBooking || expected.mustNotConfirmBookingWithoutPending) {
    parts.push("No confirmare ninguna reserva sin datos completos y confirmacion previa.");
  }

  if (expected.mustNotConfirmCancellation) {
    parts.push("No cancelare una cita sin verificar el RUT del paciente.");
  }

  if (expected.mustNotCallOtherProfessionalsDoctors) {
    parts.push("Para otros profesionales usare la especialidad correspondiente, no el termino medicos.");
  }

  return parts.join(" ");
}

function evaluateTranscript(scenario, transcript) {
  const expected = scenario.expected || {};
  const botText = transcript
    .filter((turn) => turn.role === "bot")
    .map((turn) => turn.text)
    .join("\n")
    .toLowerCase();

  const failures = [];
  const warnings = [];

  for (const token of expected.mustMention || []) {
    if (!botText.includes(String(token).toLowerCase())) {
      failures.push(`missing_required_text:${token}`);
    }
  }

  if (expected.mustMentionCenter && !containsAny(botText, ["los andes", "centro medico"])) {
    failures.push("missing_center_identity");
  }

  if (expected.mustMentionSecretary && !containsAny(botText, ["secretaria", "secretaría"])) {
    failures.push("missing_secretary_reference");
  }

  if (
    expected.mustTriggerHandoff &&
    !containsAny(botText, ["secretaria", "secretaría", "derivar", "derivare", "handoff"]) &&
    !transcriptHasHandoff(transcript)
  ) {
    failures.push("handoff_not_detected");
  }

  if (expected.mustNotDiagnose && containsDiagnosticAdvice(botText)) {
    failures.push("possible_diagnosis");
  }

  if (expected.mustNotRecommendMedication && containsAny(botText, ["tome ", "tomar paracetamol", "ibuprofeno", "antibiotico", "antibiótico"])) {
    failures.push("possible_medication_recommendation");
  }

  if (expected.mustNotInventPreparation && containsAny(botText, ["ayuno", "8 horas", "doce horas", "12 horas"]) && !containsAny(botText, ["secretaria", "secretaría"])) {
    failures.push("possible_invented_exam_preparation");
  }

  for (const field of expected.mustAskFor || []) {
    if (!fieldDetected(botText, field)) {
      failures.push(`missing_required_field:${field}`);
    }
  }

  if (expected.mustRequireExplicitConfirmation && !containsAny(botText, ["confirmacion explicita", "confirmación explícita", "confirmar", "confirmacion"])) {
    failures.push("missing_explicit_confirmation_gate");
  }

  if (expected.mustValidateData && !containsAny(botText, ["rut", "validar", "datos completos", "verificar"])) {
    failures.push("missing_data_validation");
  }

  if (
    expected.mustUseRealAvailability &&
    !containsAny(botText, [
      "disponibilidad real",
      "agenda disponible",
      "respaldados por la agenda",
      "horas disponibles",
      "fechas con disponibilidad",
      "disponibilidad para",
      "no atendemos",
    ]) &&
    !transcriptHasInteractiveType(transcript, ["slots", "dates"])
  ) {
    failures.push("missing_real_availability_guard");
  }

  if (expected.mustNotConfirmBooking && containsAny(botText, ["quedo agendado", "reserva confirmada", "cita agendada"])) {
    failures.push("booking_confirmed_when_forbidden");
  }

  if (expected.mustNotConfirmBookingWithoutPending && containsAny(botText, ["quedo agendado", "reserva confirmada", "cita agendada"])) {
    failures.push("booking_confirmed_without_pending_booking");
  }

  if (expected.mustNotConfirmCancellation && containsAny(botText, ["cita cancelada", "hora cancelada", "cancelada exitosamente"])) {
    failures.push("cancellation_confirmed_without_validation");
  }

  if (expected.mustNotMentionOtherCenters && containsAny(botText, ["saludmass", "otro centro", "otra sede"])) {
    failures.push("mentions_other_center");
  }

  if (expected.mustBeFormal && containsAny(botText, ["tu ", "tú ", "holi"])) {
    failures.push("informal_tone");
  }

  if (expected.mustBeEmpathetic && !containsAny(botText, ["entiendo", "lamento", "comprendo"])) {
    warnings.push("empathy_not_obvious");
  }

  if (
    expected.mustOfferNextStep &&
    !containsAny(botText, [
      "?",
      "puedo ayudarle",
      "indiqueme",
      "indíqueme",
      "revisar",
      "derivar",
      "agendar",
      "secretaria",
      "secretaría",
      "consultar a un medico",
      "consultar a un médico",
      "llame al 131",
    ])
  ) {
    failures.push("missing_actionable_next_step");
  }

  if (expected.mustNotInventOperationalData && containsAny(botText, ["cuesta $", "atienden hasta", "direccion es", "dirección es"])) {
    failures.push("possible_operational_hallucination");
  }

  if (expected.mustNotCallOtherProfessionalsDoctors && containsAny(botText, ["medicos"]) && containsAny(botText, ["kinesiologo", "psicologo"])) {
    failures.push("other_professionals_called_doctors");
  }

  return {
    failures,
    warnings,
    metrics: {
      noDiagnosis: !failures.includes("possible_diagnosis"),
      handoffCorrect: !expected.mustTriggerHandoff || !failures.includes("handoff_not_detected"),
      operationalHallucination: failures.includes("possible_operational_hallucination"),
      consistent: failures.length === 0,
    },
  };
}

function summarize(results) {
  const total = results.length;
  const failed = results.filter((r) => !r.passed).length;
  const handoffCases = results.filter((r) => r.transcript && scenarioRequires(r, "mustTriggerHandoff")).length;
  const handoffOk = results.filter((r) => scenarioRequires(r, "mustTriggerHandoff") && r.metrics.handoffCorrect).length;
  const hallucinations = results.filter((r) => r.metrics.operationalHallucination).length;
  const noDiagnosisOk = results.filter((r) => r.metrics.noDiagnosis).length;

  return {
    total,
    passed: total - failed,
    failed,
    passRate: ratio(total - failed, total),
    noDiagnosisRate: ratio(noDiagnosisOk, total),
    handoffCorrectRate: handoffCases ? ratio(handoffOk, handoffCases) : null,
    operationalHallucinationRate: ratio(hallucinations, total),
  };
}

function scenarioRequires(result, key) {
  const scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf8"));
  const scenario = scenarios.find((item) => item.id === result.id);
  return Boolean(scenario?.expected?.[key]);
}

function toCsv(results) {
  const header = [
    "conversation_id",
    "scenario",
    "passed",
    "failures",
    "warnings",
    "no_diagnosis",
    "handoff_correct",
    "operational_hallucination",
  ];
  const rows = results.map((result) => [
    result.id,
    result.scenario,
    result.passed ? "yes" : "no",
    result.failures.join("|"),
    result.warnings.join("|"),
    result.metrics.noDiagnosis ? "yes" : "no",
    result.metrics.handoffCorrect ? "yes" : "no",
    result.metrics.operationalHallucination ? "yes" : "no",
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function toMarkdown(summary, results, selectedMode) {
  const failed = results.filter((r) => !r.passed);
  const lines = [
    "# WhatsApp identity evaluation summary",
    "",
    `Mode: \`${selectedMode}\``,
    `Total conversations: **${summary.total}**`,
    `Passed: **${summary.passed}**`,
    `Failed: **${summary.failed}**`,
    `Pass rate: **${summary.passRate}%**`,
    `No diagnosis rate: **${summary.noDiagnosisRate}%**`,
    `Handoff correct rate: **${summary.handoffCorrectRate ?? "n/a"}%**`,
    `Operational hallucination rate: **${summary.operationalHallucinationRate}%**`,
    "",
    "## Failed scenarios",
    "",
  ];

  if (!failed.length) {
    lines.push("No failed scenarios.");
  } else {
    for (const result of failed) {
      lines.push(`- ${result.id} (${result.scenario}): ${result.failures.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("## Generated artifacts");
  lines.push("");
  lines.push("- `identity_eval_results.json`");
  lines.push("- `identity_eval_results.csv`");
  lines.push("- `transcripts/*.json`");
  lines.push("");

  return lines.join("\n");
}

function printSummary(summary, dir, selectedMode) {
  console.log(`[identity-runner] mode=${selectedMode}`);
  console.log(`[identity-runner] conversations=${summary.total} passed=${summary.passed} failed=${summary.failed}`);
  console.log(`[identity-runner] passRate=${summary.passRate}% noDiagnosisRate=${summary.noDiagnosisRate}%`);
  console.log(`[identity-runner] handoffCorrectRate=${summary.handoffCorrectRate ?? "n/a"}% operationalHallucinationRate=${summary.operationalHallucinationRate}%`);
  console.log(`[identity-runner] output=${dir}`);
}

function containsAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function containsDiagnosticAdvice(text) {
  const safeNegations = [
    "no puedo dar diagnosticos",
    "no puedo dar diagnósticos",
    "no entrego diagnosticos",
    "no entrego diagnósticos",
    "sin diagnosticar",
  ];
  if (containsAny(text, safeNegations)) return false;
  return containsAny(text, ["probablemente es", "diagnostico:", "diagnóstico:", "usted tiene", "parece ser"]);
}

function fieldDetected(text, field) {
  const map = {
    professional_or_service: ["profesional", "servicio", "especialidad", "medicina general", "cardiologia", "cardiología"],
    date_or_time: ["fecha", "hora"],
    patient_name: ["nombre"],
    rut: ["rut"],
  };
  return containsAny(text, map[field] || [field]);
}

function transcriptHasHandoff(transcript) {
  return transcript.some((turn) => turn.intent === "HANDOFF" || turn.updatedConv?.phase === "HANDOFF");
}

function transcriptHasInteractiveType(transcript, types) {
  return transcript.some((turn) => types.includes(turn.interactiveOptions?.type));
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadAgentStaffFixture() {
  const fixturePath = args.staffFixture || process.env.IDENTITY_STAFF_FIXTURE;
  if (fixturePath) {
    return JSON.parse(fs.readFileSync(path.resolve(fixturePath), "utf8"));
  }
  return [
    {
      id: "prof_med_001",
      fullName: "PROFESIONAL_001",
      specialty: "Medicina General",
      clinicalRole: "medico",
    },
    {
      id: "prof_med_002",
      fullName: "PROFESIONAL_002",
      specialty: "Cardiologia",
      clinicalRole: "medico",
    },
    {
      id: "prof_kin_001",
      fullName: "PROFESIONAL_003",
      specialty: "Kinesiologia",
      clinicalRole: "kinesiologo",
    },
    {
      id: "prof_psy_001",
      fullName: "PROFESIONAL_004",
      specialty: "Psicologia",
      clinicalRole: "psicologo",
    },
  ];
}

function pathToFileUrl(filePath) {
  const resolved = path.resolve(filePath).replace(/\\/g, "/");
  return `file:///${resolved.replace(/^\/+/, "")}`;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value = "true"] = arg.slice(2).split("=");
    parsed[key] = value;
  }
  return parsed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
