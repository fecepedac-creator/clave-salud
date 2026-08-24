import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const mode = process.argv[2];
const modes = {
  "release-smoke": {
    port: "5191",
    args: ["test", "--project=pilot-simulated"],
  },
  "clinical-emulator": {
    port: "5192",
    args: [
      "test",
      "tests/emulator/clinical-document-emulator-gate.spec.ts",
      "--project=emulator-gate",
    ],
  },
};

const selected = modes[mode];
if (!selected) {
  console.error("PLAYWRIGHT_RELEASE_GATE_DENIED: UNKNOWN_MODE");
  process.exit(2);
}

const requestedPort = String(process.env.CLAVESALUD_RELEASE_TEST_PORT || selected.port).trim();
if (!/^\d{4,5}$/.test(requestedPort)) {
  console.error("PLAYWRIGHT_RELEASE_GATE_DENIED: INVALID_PORT");
  process.exit(2);
}

const playwrightCli = resolve(repoRoot, "node_modules/playwright/cli.js");
const result = spawnSync(process.execPath, [playwrightCli, ...selected.args], {
  cwd: repoRoot,
  env: {
    ...process.env,
    PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${requestedPort}`,
    PLAYWRIGHT_FORCE_FRESH_SERVER: "1",
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(`PLAYWRIGHT_RELEASE_GATE_FAILED: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
