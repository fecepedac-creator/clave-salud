import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const ignoredFiles = new Set([".env.example", ".env.production"]);
const ignoredPrefixes = [".firebase/"];
const findings = [];

const looksLikePlaceholder = (value) =>
  /^(?:tu_|your_|64_hex|<|process\.env|\$\{|configurar\b|example\b|replace\b)/i.test(
    value.trim()
  ) || /^[A-Za-z_$][A-Za-z0-9_$.[\]]*$/.test(value.trim());

for (const file of trackedFiles) {
  if (ignoredFiles.has(file) || ignoredPrefixes.some((prefix) => file.startsWith(prefix))) continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  content.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    if (/\bAIza[0-9A-Za-z_-]{20,}\b/.test(line)) {
      findings.push(`${file}:${lineNumber}: posible API key Google escrita en el repositorio`);
    }
    if (/\bCLAVE_SALUD_WHATSAPP_2026\b/.test(line)) {
      findings.push(`${file}:${lineNumber}: verify token heredado de WhatsApp`);
    }
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line)) {
      findings.push(`${file}:${lineNumber}: clave privada escrita en el repositorio`);
    }

    const assignment = line.match(
      /\b(?:GEMINI_API_KEY|ENCRYPTION_KEY|WHATSAPP_TOKEN|WA_VERIFY_TOKEN)\b\s*(?:=|:)\s*["'`]?([^"'`,;\s]+)/i
    );
    if (assignment && !looksLikePlaceholder(assignment[1])) {
      findings.push(`${file}:${lineNumber}: valor sensible escrito en el repositorio`);
    }
  });
}

if (findings.length > 0) {
  console.error("Se detectaron posibles secretos versionados:\n");
  console.error(findings.map((finding) => `- ${finding}`).join("\n"));
  process.exit(1);
}

console.log("Secret scan local: sin hallazgos.");
