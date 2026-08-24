import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseEnvText,
  validateReleaseContext,
  validateStagingTarget,
  validateStagingWebEnvironment,
} from "./staging-policy.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const config = (staging, defaultProject = "clavesalud-2") => ({
  projects: { default: defaultProject, ...(staging ? { staging } : {}) },
});

const validStagingEnv = (overrides = {}) => ({
  VITE_FIREBASE_API_KEY: "fake-staging-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "clavesalud-staging-test.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "clavesalud-staging-test",
  VITE_FIREBASE_STORAGE_BUCKET: "clavesalud-staging-test.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789012",
  VITE_FIREBASE_APP_ID: "1:123456789012:web:0000000000000000000000",
  VITE_PUBLIC_APP_URL: "https://clavesalud-staging-test.web.app",
  VITE_ENABLE_ADVANCED_WHATSAPP: "false",
  VITE_ENABLE_AI_USAGE: "false",
  VITE_ENABLE_CAMPAIGNS: "false",
  VITE_ENABLE_MARKETING: "false",
  VITE_ENABLE_MANUAL_CLINICAL_BACKUP: "false",
  VITE_ENABLE_BROWSER_CLINICAL_MIGRATION: "false",
  VITE_ENABLE_AGENDA_OPERATIONS_V2: "false",
  ...overrides,
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
  assert.deepEqual(validateReleaseContext({ branch: "codex/release-integration-af", dirty: "" }), {
    ok: true,
    branch: "codex/release-integration-af",
  });
});

test("parses comments and quoted staging environment values", () => {
  assert.deepEqual(
    parseEnvText("# staging only\nKEY=value\nDOUBLE=\"two words\"\nSINGLE='three words'\n"),
    { KEY: "value", DOUBLE: "two words", SINGLE: "three words" }
  );
});

test("requires every staging Firebase web key", () => {
  const env = validStagingEnv();
  delete env.VITE_FIREBASE_APP_ID;
  assert.deepEqual(
    validateStagingWebEnvironment({ env, stagingProjectId: "clavesalud-staging-test" }),
    { ok: false, reason: "STAGING_WEB_ENV_INCOMPLETE", missing: ["VITE_FIREBASE_APP_ID"] }
  );
});

test("blocks the production project in the staging web environment", () => {
  const result = validateStagingWebEnvironment({
    env: validStagingEnv({ VITE_FIREBASE_PROJECT_ID: "clavesalud-2" }),
    stagingProjectId: "clavesalud-2",
  });
  assert.equal(result.reason, "STAGING_WEB_ENV_POINTS_TO_PRODUCTION");
});

test("blocks a web project that differs from the staging alias", () => {
  const result = validateStagingWebEnvironment({
    env: validStagingEnv(),
    stagingProjectId: "different-staging-project",
  });
  assert.equal(result.reason, "STAGING_WEB_ENV_PROJECT_MISMATCH");
});

test("blocks a public application URL outside the staging project", () => {
  assert.equal(
    validateStagingWebEnvironment({
      env: validStagingEnv({ VITE_PUBLIC_APP_URL: "https://clavesalud-2.web.app" }),
      stagingProjectId: "clavesalud-staging-test",
    }).reason,
    "STAGING_PUBLIC_APP_URL_PROJECT_MISMATCH"
  );
});

test("blocks placeholder staging values", () => {
  const result = validateStagingWebEnvironment({
    env: validStagingEnv({ VITE_FIREBASE_API_KEY: "replace_with_staging_api_key" }),
    stagingProjectId: "clavesalud-staging-test",
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "STAGING_WEB_ENV_HAS_PLACEHOLDERS",
    key: "VITE_FIREBASE_API_KEY",
  });
});

test("requires risky integrations to start explicitly disabled", () => {
  const enabled = validateStagingWebEnvironment({
    env: validStagingEnv({ VITE_ENABLE_MARKETING: "true" }),
    stagingProjectId: "clavesalud-staging-test",
  });
  assert.equal(enabled.reason, "STAGING_RISK_FLAG_MUST_START_DISABLED");
  assert.equal(enabled.key, "VITE_ENABLE_MARKETING");

  const missing = validStagingEnv();
  delete missing.VITE_ENABLE_AI_USAGE;
  assert.equal(
    validateStagingWebEnvironment({
      env: missing,
      stagingProjectId: "clavesalud-staging-test",
    }).reason,
    "STAGING_RISK_FLAG_MUST_START_DISABLED"
  );
});

test("allows a complete isolated staging web environment", () => {
  assert.deepEqual(
    validateStagingWebEnvironment({
      env: validStagingEnv(),
      stagingProjectId: "clavesalud-staging-test",
    }),
    { ok: true, projectId: "clavesalud-staging-test" }
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

  assert.equal(packageJson.scripts["build:staging"], "node scripts/release/build-staging.mjs");
  assert.match(packageJson.scripts["release:staging:hosting"], /npm run build:staging/);
});

test("staging build loads Firebase web config without persisting it", () => {
  const runner = readFileSync(resolve(repoRoot, "scripts/release/build-staging.mjs"), "utf8");
  const loader = readFileSync(
    resolve(repoRoot, "scripts/release/firebase-staging-web-config.mjs"),
    "utf8"
  );
  assert.match(runner, /loadStagingWebEnvironment/);
  assert.match(runner, /env: \{ \.\.\.process\.env, \.\.\.stagingEnvironment \}/);
  assert.match(loader, /apps:sdkconfig/);
  assert.doesNotMatch(loader, /writeFile|appendFile|\.env\.staging\.local/);
});

test("release browser gates always request a fresh isolated server", () => {
  const runner = readFileSync(resolve(repoRoot, "scripts/release/run-playwright-gate.mjs"), "utf8");
  assert.match(runner, /PLAYWRIGHT_FORCE_FRESH_SERVER: "1"/);
  assert.match(runner, /PLAYWRIGHT_BASE_URL: `http:\/\/127\.0\.0\.1:\$\{requestedPort\}`/);
  assert.match(runner, /--project=pilot-simulated/);
  assert.match(runner, /--project=emulator-gate/);
});
