import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateReleaseContext,
  validateStagingTarget,
  validateStagingWebEnvironment,
} from "./staging-policy.mjs";
import { loadStagingWebEnvironment } from "./firebase-staging-web-config.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const readText = (file) => readFileSync(resolve(repoRoot, file), "utf8");
const git = (...args) =>
  execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const requestedTarget = (() => {
  const index = process.argv.indexOf("--project");
  return index >= 0 ? process.argv[index + 1] : "";
})();

let firebaserc;
try {
  firebaserc = JSON.parse(readText(".firebaserc"));
} catch {
  console.error("STAGING_PREFLIGHT_DENIED: FIREBASERC_INVALID");
  process.exit(2);
}

const target = validateStagingTarget({ firebaserc, requestedTarget });
if (!target.ok) {
  console.error(`STAGING_PREFLIGHT_DENIED: ${target.reason}`);
  process.exit(2);
}

let stagingWebEnv;
try {
  stagingWebEnv = loadStagingWebEnvironment({
    repoRoot,
    projectId: target.projectId,
  });
} catch {
  console.error("STAGING_PREFLIGHT_DENIED: STAGING_WEB_CONFIG_UNAVAILABLE");
  process.exit(2);
}
const webEnvironment = validateStagingWebEnvironment({
  env: stagingWebEnv,
  stagingProjectId: target.projectId,
});
if (!webEnvironment.ok) {
  console.error(`STAGING_PREFLIGHT_DENIED: ${webEnvironment.reason}`);
  process.exit(2);
}

const branch = git("branch", "--show-current");
const commit = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain");
const releaseContext = validateReleaseContext({ branch, dirty });

if (!releaseContext.ok) {
  console.error(`STAGING_PREFLIGHT_DENIED: ${releaseContext.reason}`);
  process.exit(2);
}

console.log(
  JSON.stringify({
    ok: true,
    environment: "staging",
    firebaseAlias: target.alias,
    firebaseProjectId: target.projectId,
    webProjectAligned: true,
    branch: releaseContext.branch,
    commit,
  })
);
