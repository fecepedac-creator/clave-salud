import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateReleaseContext, validateStagingTarget } from "./staging-policy.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const config = (staging, defaultProject = "clavesalud-2") => ({
  projects: { default: defaultProject, ...(staging ? { staging } : {}) },
});

test("blocks when staging is not configured", () => {
  assert.deepEqual(validateStagingTarget({ firebaserc: config(), requestedTarget: "staging" }), {
    ok: false,
    reason: "STAGING_ALIAS_NOT_CONFIGURED",
  });
});

test("blocks staging when it points to the official production project", () => {
  assert.deepEqual(
    validateStagingTarget({ firebaserc: config("clavesalud-2"), requestedTarget: "staging" }),
    { ok: false, reason: "STAGING_POINTS_TO_PRODUCTION" }
  );
});

test("blocks production aliases and project ids", () => {
  assert.equal(
    validateStagingTarget({ firebaserc: config("clavesalud-staging"), requestedTarget: "default" })
      .reason,
    "PRODUCTION_ALIAS_FORBIDDEN"
  );
  assert.equal(
    validateStagingTarget({
      firebaserc: config("clavesalud-staging"),
      requestedTarget: "clavesalud-2",
    }).reason,
    "PRODUCTION_PROJECT_FORBIDDEN"
  );
});

test("blocks an unmapped project even when it is not production", () => {
  assert.equal(
    validateStagingTarget({
      firebaserc: config("clavesalud-staging"),
      requestedTarget: "another-project",
    }).reason,
    "TARGET_NOT_MAPPED_TO_STAGING"
  );
});

test("allows only the staging alias or its mapped non-production project", () => {
  const byAlias = validateStagingTarget({
    firebaserc: config("clavesalud-staging"),
    requestedTarget: "staging",
  });
  const byProject = validateStagingTarget({
    firebaserc: config("clavesalud-staging"),
    requestedTarget: "clavesalud-staging",
  });

  assert.deepEqual(byAlias, {
    ok: true,
    alias: "staging",
    projectId: "clavesalud-staging",
  });
  assert.deepEqual(byProject, byAlias);
});

test("requires the integrated release branch", () => {
  assert.deepEqual(validateReleaseContext({ branch: "main", dirty: "" }), {
    ok: false,
    reason: "RELEASE_BRANCH_REQUIRED",
  });
});

test("requires a clean worktree", () => {
  assert.deepEqual(
    validateReleaseContext({ branch: "codex/release-integration-af", dirty: " M App.tsx" }),
    { ok: false, reason: "CLEAN_WORKTREE_REQUIRED" }
  );
});

test("allows a clean integrated release branch", () => {
  assert.deepEqual(
    validateReleaseContext({ branch: "codex/release-integration-af", dirty: "" }),
    { ok: true, branch: "codex/release-integration-af" }
  );
});

test("all staging deploy commands fail through preflight and pin the staging alias", () => {
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  const deployScripts = [
    packageJson.scripts["release:staging:hosting"],
    packageJson.scripts["release:staging:rules"],
    packageJson.scripts["release:staging:functions"],
  ];

  deployScripts.forEach((script) => {
    assert.match(script, /^npm run release:staging:preflight && /);
    assert.match(script, /firebase deploy /);
    assert.match(script, /--project staging$/);
    assert.doesNotMatch(script, /--project (default|prod|production|clavesalud-2)/);
  });
});
