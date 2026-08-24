import { execFileSync } from "node:child_process";
const firebaseInvocation =
  process.platform === "win32"
    ? {
        executable: process.env.ComSpec || "cmd.exe",
        prefix: ["/d", "/s", "/c", "firebase"],
      }
    : { executable: "firebase", prefix: [] };

const parseFirebaseJson = (output) => {
  const text = String(output || "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("FIREBASE_CLI_JSON_INVALID");
  return JSON.parse(text.slice(start, end + 1));
};

const runFirebaseJson = (args, cwd) =>
  parseFirebaseJson(
    execFileSync(firebaseInvocation.executable, [...firebaseInvocation.prefix, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  );

export function loadStagingWebEnvironment({ repoRoot, projectId }) {
  const appsResponse = runFirebaseJson(
    ["apps:list", "WEB", "--project", projectId, "--json"],
    repoRoot
  );
  const apps = Array.isArray(appsResponse.result)
    ? appsResponse.result
    : appsResponse.result?.apps || [];
  const activeApps = apps.filter((app) => app?.state !== "DELETED");
  if (activeApps.length !== 1) throw new Error("STAGING_WEB_APP_COUNT_INVALID");

  const configResponse = runFirebaseJson(
    ["apps:sdkconfig", "WEB", activeApps[0].appId, "--project", projectId, "--json"],
    repoRoot
  );
  const config = configResponse.result?.sdkConfig || configResponse.result || {};

  return {
    VITE_FIREBASE_API_KEY: String(config.apiKey || ""),
    VITE_FIREBASE_AUTH_DOMAIN: String(config.authDomain || ""),
    VITE_FIREBASE_PROJECT_ID: String(config.projectId || ""),
    VITE_FIREBASE_STORAGE_BUCKET: String(config.storageBucket || ""),
    VITE_FIREBASE_MESSAGING_SENDER_ID: String(config.messagingSenderId || ""),
    VITE_FIREBASE_APP_ID: String(config.appId || ""),
    VITE_PUBLIC_APP_URL: `https://${projectId}.web.app`,
    VITE_ENABLE_ADVANCED_WHATSAPP: "false",
    VITE_ENABLE_AI_USAGE: "false",
    VITE_ENABLE_CAMPAIGNS: "false",
    VITE_ENABLE_MARKETING: "false",
    VITE_ENABLE_MANUAL_CLINICAL_BACKUP: "false",
    VITE_ENABLE_BROWSER_CLINICAL_MIGRATION: "false",
    VITE_ENABLE_AGENDA_OPERATIONS_V2: "false",
  };
}
