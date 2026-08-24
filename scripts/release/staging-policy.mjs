export const OFFICIAL_PRODUCTION_PROJECTS = Object.freeze(["clavesalud-2"]);

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
