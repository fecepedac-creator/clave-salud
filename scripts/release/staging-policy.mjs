export const OFFICIAL_PRODUCTION_PROJECTS = Object.freeze(["clavesalud-2"]);

const REQUIRED_STAGING_WEB_KEYS = Object.freeze([
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_PUBLIC_APP_URL",
]);

const INITIAL_DISABLED_FLAGS = Object.freeze([
  "VITE_ENABLE_ADVANCED_WHATSAPP",
  "VITE_ENABLE_AI_USAGE",
  "VITE_ENABLE_CAMPAIGNS",
  "VITE_ENABLE_MARKETING",
  "VITE_ENABLE_MANUAL_CLINICAL_BACKUP",
  "VITE_ENABLE_BROWSER_CLINICAL_MIGRATION",
  "VITE_ENABLE_AGENDA_OPERATIONS_V2",
]);

const normalize = (value) => (typeof value === "string" ? value.trim() : "");

export function resolveStagingProject(firebaserc) {
  const projects = firebaserc?.projects;
  if (!projects || typeof projects !== "object" || Array.isArray(projects)) return "";
  return normalize(projects.staging);
}

export function validateStagingTarget({
  firebaserc,
  requestedTarget,
  productionProjectIds = OFFICIAL_PRODUCTION_PROJECTS,
}) {
  const target = normalize(requestedTarget);
  const stagingProjectId = resolveStagingProject(firebaserc);
  const defaultProjectId = normalize(firebaserc?.projects?.default);
  const forbiddenAliases = new Set(["default", "prod", "production"]);
  const forbiddenProjectIds = new Set(
    [...productionProjectIds, defaultProjectId].map(normalize).filter(Boolean)
  );

  if (!target) {
    return { ok: false, reason: "STAGING_TARGET_REQUIRED" };
  }
  if (!stagingProjectId) {
    return { ok: false, reason: "STAGING_ALIAS_NOT_CONFIGURED" };
  }
  if (forbiddenAliases.has(target.toLowerCase())) {
    return { ok: false, reason: "PRODUCTION_ALIAS_FORBIDDEN" };
  }
  if (forbiddenProjectIds.has(stagingProjectId)) {
    return { ok: false, reason: "STAGING_POINTS_TO_PRODUCTION" };
  }
  if (forbiddenProjectIds.has(target)) {
    return { ok: false, reason: "PRODUCTION_PROJECT_FORBIDDEN" };
  }
  if (target !== "staging" && target !== stagingProjectId) {
    return { ok: false, reason: "TARGET_NOT_MAPPED_TO_STAGING" };
  }

  return { ok: true, alias: "staging", projectId: stagingProjectId };
}

export function validateReleaseContext({ branch, dirty }) {
  const normalizedBranch = normalize(branch);
  if (!normalizedBranch.startsWith("codex/release-integration-")) {
    return { ok: false, reason: "RELEASE_BRANCH_REQUIRED" };
  }
  if (normalize(dirty)) {
    return { ok: false, reason: "CLEAN_WORKTREE_REQUIRED" };
  }
  return { ok: true, branch: normalizedBranch };
}

export function parseEnvText(text) {
  const values = {};
  String(text || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) return;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    });
  return values;
}

export function validateStagingWebEnvironment({
  env,
  stagingProjectId,
  productionProjectIds = OFFICIAL_PRODUCTION_PROJECTS,
}) {
  const missing = REQUIRED_STAGING_WEB_KEYS.filter((key) => !normalize(env?.[key]));
  if (missing.length) {
    return { ok: false, reason: "STAGING_WEB_ENV_INCOMPLETE", missing };
  }

  const configuredProjectId = normalize(env.VITE_FIREBASE_PROJECT_ID);
  if ([...productionProjectIds].map(normalize).includes(configuredProjectId)) {
    return { ok: false, reason: "STAGING_WEB_ENV_POINTS_TO_PRODUCTION" };
  }
  if (configuredProjectId !== normalize(stagingProjectId)) {
    return { ok: false, reason: "STAGING_WEB_ENV_PROJECT_MISMATCH" };
  }

  let publicAppUrl;
  try {
    publicAppUrl = new URL(normalize(env.VITE_PUBLIC_APP_URL));
  } catch {
    return { ok: false, reason: "STAGING_PUBLIC_APP_URL_INVALID" };
  }
  const allowedPublicHosts = new Set([
    `${configuredProjectId}.web.app`,
    `${configuredProjectId}.firebaseapp.com`,
  ]);
  if (publicAppUrl.protocol !== "https:" || !allowedPublicHosts.has(publicAppUrl.hostname)) {
    return { ok: false, reason: "STAGING_PUBLIC_APP_URL_PROJECT_MISMATCH" };
  }

  const placeholderKey = REQUIRED_STAGING_WEB_KEYS.find((key) =>
    /^(replace_|your_|tu_|<)/i.test(normalize(env[key]))
  );
  if (placeholderKey) {
    return { ok: false, reason: "STAGING_WEB_ENV_HAS_PLACEHOLDERS", key: placeholderKey };
  }

  const enabledFlag = INITIAL_DISABLED_FLAGS.find(
    (key) => normalize(env?.[key]).toLowerCase() !== "false"
  );
  if (enabledFlag) {
    return { ok: false, reason: "STAGING_RISK_FLAG_MUST_START_DISABLED", key: enabledFlag };
  }

  return { ok: true, projectId: configuredProjectId };
}
