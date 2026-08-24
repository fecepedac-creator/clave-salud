import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadStagingWebEnvironment } from "./firebase-staging-web-config.mjs";
import { resolveStagingProject, validateStagingWebEnvironment } from "./staging-policy.mjs";
import { readFileSync } from "node:fs";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const firebaserc = JSON.parse(readFileSync(resolve(repoRoot, ".firebaserc"), "utf8"));
const projectId = resolveStagingProject(firebaserc);
if (!projectId) {
  console.error("STAGING_BUILD_DENIED: STAGING_ALIAS_NOT_CONFIGURED");
  process.exit(2);
}

let stagingEnvironment;
try {
  stagingEnvironment = loadStagingWebEnvironment({ repoRoot, projectId });
} catch (error) {
  console.error(`STAGING_BUILD_DENIED: ${error instanceof Error ? error.message : "WEB_CONFIG"}`);
  process.exit(2);
}

const validation = validateStagingWebEnvironment({
  env: stagingEnvironment,
  stagingProjectId: projectId,
});
if (!validation.ok) {
  console.error(`STAGING_BUILD_DENIED: ${validation.reason}`);
  process.exit(2);
}

const viteEntry = resolve(repoRoot, "node_modules", "vite", "bin", "vite.js");
const result = spawnSync(process.execPath, [viteEntry, "build", "--mode", "staging"], {
  cwd: repoRoot,
  env: { ...process.env, ...stagingEnvironment },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
