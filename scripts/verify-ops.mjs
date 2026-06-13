import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import admin from "firebase-admin";

const PROD_PROJECT = process.env.CLAVESALUD_PROJECT || "clavesalud-2";
const RECOVERY_PROJECT = process.env.CLAVESALUD_RECOVERY_PROJECT || "clave-salud-62998165-597b1";
const REGION = process.env.CLAVESALUD_REGION || "us-central1";
const BACKUP_BUCKET = process.env.CLAVESALUD_BACKUP_BUCKET || "clavesalud-2-firestore-backups";
const BACKUP_PREFIX = "backups/firestore";
const EXPECTED_BACKUP_JOB = "firestore-weekly-backup";
const EXPECTED_RETENTION_JOB = "firestore-weekly-backup-retention";

const results = [];

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
}

function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
}

function commandExists(command) {
  try {
    const probe = process.platform === "win32" ? "where.exe" : "which";
    execFileSync(probe, [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gcloudBin() {
  if (process.env.GCLOUD_BIN) return process.env.GCLOUD_BIN;
  if (commandExists("gcloud")) return "gcloud";
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const portable = join(
      process.env.LOCALAPPDATA,
      "GoogleCloudSDK",
      "google-cloud-sdk",
      "bin",
      "gcloud.cmd"
    );
    if (existsSync(portable)) return portable;
  }
  return "gcloud";
}

const GCLOUD = gcloudBin();

function run(command, args, options = {}) {
  if (process.platform === "win32" && /\.cmd$/i.test(command)) {
    return execFileSync("cmd.exe", ["/d", "/c", "call", command, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    }).trim();
  }

  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function runJson(command, args) {
  const out = run(command, [...args, "--format=json"]);
  return out ? JSON.parse(out) : null;
}

function read(path) {
  return readFileSync(path, "utf8");
}

async function checkLocalDocsAndCode() {
  const index = read("functions/src/index.ts");
  const backupRunbook = read("docs/operacion/RUNBOOK_BACKUPS.md");
  const recoveryRunbook = read("docs/operacion/RESPALDO_Y_RECUPERACION.md");
  const packageJson = JSON.parse(read("package.json"));

  if (/export const runMonthlyBackup/.test(index)) pass("backup function exists");
  else fail("backup function exists");

  if (/export const cleanupWeeklyBackups/.test(index)) pass("backup retention function exists");
  else fail("backup retention function exists");

  if (/ultimos 8 backups/i.test(backupRunbook) && /03:30/.test(backupRunbook)) {
    pass("backup runbook documents weekly retention");
  } else {
    fail("backup runbook documents weekly retention");
  }

  if (/Restauracion Controlada/i.test(recoveryRunbook) && /2026-06-12/.test(recoveryRunbook)) {
    pass("recovery runbook records restore test");
  } else {
    fail("recovery runbook records restore test");
  }

  if (packageJson.scripts?.["ops:verify"] === "node scripts/verify-ops.mjs") {
    pass("ops:verify npm script registered");
  } else {
    fail("ops:verify npm script registered");
  }
}

async function checkGcloudAuth() {
  try {
    const account = run(GCLOUD, ["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"]);
    if (account) pass("gcloud authenticated", account);
    else fail("gcloud authenticated", "No active account");
  } catch (error) {
    fail("gcloud authenticated", error.message);
  }
}

async function checkSchedulers() {
  try {
    const jobs = runJson(GCLOUD, [
      "scheduler",
      "jobs",
      "list",
      "--project",
      PROD_PROJECT,
      "--location",
      REGION,
    ]);
    const byId = new Map((jobs || []).map((job) => [String(job.name || "").split("/").pop(), job]));
    const backupJob = byId.get(EXPECTED_BACKUP_JOB);
    const retentionJob = byId.get(EXPECTED_RETENTION_JOB);

    if (
      backupJob?.state === "ENABLED" &&
      backupJob?.schedule === "30 3 * * 0" &&
      backupJob?.timeZone === "America/Santiago"
    ) {
      pass("weekly backup scheduler enabled");
    } else {
      fail("weekly backup scheduler enabled", JSON.stringify(backupJob || null));
    }

    if (
      retentionJob?.state === "ENABLED" &&
      retentionJob?.schedule === "15 4 * * 0" &&
      retentionJob?.timeZone === "America/Santiago"
    ) {
      pass("weekly retention scheduler enabled");
    } else {
      fail("weekly retention scheduler enabled", JSON.stringify(retentionJob || null));
    }
  } catch (error) {
    fail("scheduler checks", error.message);
  }
}

function functionEnvSummary(functionName) {
  return runJson(GCLOUD, [
    "functions",
    "describe",
    functionName,
    "--region",
    REGION,
    "--project",
    PROD_PROJECT,
  ]);
}

async function checkFunctionSecrets() {
  try {
    const backup = functionEnvSummary("runMonthlyBackup");
    const cleanup = functionEnvSummary("cleanupWeeklyBackups");
    const whatsapp = functionEnvSummary("whatsappWebhook");

    const backupSecrets = new Set((backup?.secretEnvironmentVariables || []).map((item) => item.key));
    const cleanupSecrets = new Set((cleanup?.secretEnvironmentVariables || []).map((item) => item.key));
    const whatsappSecrets = new Set((whatsapp?.secretEnvironmentVariables || []).map((item) => item.key));
    const whatsappEnv = new Set(Object.keys(whatsapp?.environmentVariables || {}));

    if (backupSecrets.has("BACKUP_TOKEN") && backupSecrets.has("BACKUP_BUCKET")) {
      pass("runMonthlyBackup uses backup secrets");
    } else {
      fail("runMonthlyBackup uses backup secrets");
    }

    if (cleanupSecrets.has("BACKUP_TOKEN") && cleanupSecrets.has("BACKUP_BUCKET")) {
      pass("cleanupWeeklyBackups uses backup secrets");
    } else {
      fail("cleanupWeeklyBackups uses backup secrets");
    }

    if (whatsappSecrets.has("WHATSAPP_TOKEN") && !whatsappEnv.has("WHATSAPP_TOKEN")) {
      pass("WHATSAPP_TOKEN deployed only as secret");
    } else {
      fail("WHATSAPP_TOKEN deployed only as secret");
    }
  } catch (error) {
    fail("function secret checks", error.message);
  }
}

async function checkBackups() {
  try {
    const out = run(GCLOUD, [
      "storage",
      "ls",
      "--recursive",
      `gs://${BACKUP_BUCKET}/${BACKUP_PREFIX}/`,
      "--project",
      PROD_PROJECT,
    ]);
    const manifests = out
      .split(/\r?\n/)
      .filter((line) => /\/manifest\.json$/.test(line) || /overall_export_metadata$/.test(line));
    const prefixes = new Set(
      manifests
        .map((line) => line.replace(`gs://${BACKUP_BUCKET}/`, "").split("/").slice(0, 4).join("/"))
        .filter((prefix) => /^backups\/firestore\/\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}_/.test(prefix))
    );

    if (prefixes.size > 0) pass("at least one weekly backup exists", `${prefixes.size} backup(s)`);
    else fail("at least one weekly backup exists");

    if (prefixes.size <= 8) pass("weekly backup retention within limit", `${prefixes.size}/8`);
    else fail("weekly backup retention within limit", `${prefixes.size}/8`);
  } catch (error) {
    fail("backup storage checks", error.message);
  }
}

function canonicalAccessRole(value) {
  const role = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["center_admin", "admin_centro", "center-admin", "admin"].includes(role)) return "center_admin";
  if (["administrative", "administrativo", "administrativa", "secretaria", "secretary"].includes(role)) {
    return "administrative";
  }
  if (["professional", "profesional", "doctor", "medico"].includes(role)) return "professional";
  if (["super_admin", "superadmin", "super-admin"].includes(role)) return "super_admin";
  return role || "professional";
}

function isBookableServiceResource(id, data) {
  const role = String(data?.role ?? data?.accessRole ?? data?.clinicalRole ?? "")
    .trim()
    .toLowerCase();
  const email = String(data?.email ?? "").trim().toLowerCase();
  return id.startsWith("svc_") || role === "servicio" || email.startsWith("svc_");
}

async function checkCanonicalRoles() {
  try {
    if (!admin.apps.length) admin.initializeApp({ projectId: PROD_PROJECT });
    const db = admin.firestore();
    const centers = await db.collection("centers").get();
    let inspected = 0;
    let skippedServices = 0;
    const pending = [];

    for (const center of centers.docs) {
      const staff = await center.ref.collection("staff").get();
      for (const member of staff.docs) {
        inspected += 1;
        const data = member.data();
        if (isBookableServiceResource(member.id, data)) {
          skippedServices += 1;
          continue;
        }
        const from = String(data.accessRole ?? data.role ?? "");
        const to = canonicalAccessRole(from);
        if (!(from === to && data.accessRole === to)) {
          pending.push({ centerId: center.id, staffUid: member.id, from, to });
        }
      }
    }

    if (pending.length === 0) {
      pass("staff roles are canonical", `${inspected} inspected, ${skippedServices} services skipped`);
    } else {
      fail("staff roles are canonical", `${pending.length} pending`);
    }
  } catch (error) {
    fail("staff role checks", error.message);
  }
}

async function checkRecoveryProject() {
  try {
    const dbInfo = runJson(GCLOUD, [
      "firestore",
      "databases",
      "describe",
      "--database=(default)",
      "--project",
      RECOVERY_PROJECT,
    ]);
    if (dbInfo?.locationId === "nam5" && dbInfo?.type === "FIRESTORE_NATIVE") {
      pass("recovery Firestore database exists", `${RECOVERY_PROJECT} ${dbInfo.locationId}`);
    } else {
      fail("recovery Firestore database exists", JSON.stringify(dbInfo || null));
    }
  } catch (error) {
    fail("recovery Firestore database exists", error.message);
  }
}

async function main() {
  await checkLocalDocsAndCode();
  await checkGcloudAuth();
  await checkSchedulers();
  await checkFunctionSecrets();
  await checkBackups();
  await checkCanonicalRoles();
  await checkRecoveryProject();

  const failed = results.filter((result) => !result.ok);
  for (const result of results) {
    const mark = result.ok ? "OK" : "FAIL";
    const detail = result.detail ? ` - ${result.detail}` : "";
    console.log(`${mark} ${result.name}${detail}`);
  }

  if (failed.length > 0) {
    console.error(`\nOps verification failed: ${failed.length} check(s).`);
    process.exit(1);
  }

  console.log(`\nOps verification passed: ${results.length} checks.`);
}

main().catch((error) => {
  console.error("Ops verification crashed:", error);
  process.exit(1);
});
