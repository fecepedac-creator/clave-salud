import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assertions = [
  [
    "pilot flags default off",
    read("config/pilot.ts"),
    /manualClinicalBackup: envFlag\("VITE_ENABLE_MANUAL_CLINICAL_BACKUP"\)/,
  ],
  [
    "browser migration disabled",
    read("components/MigrationModal.tsx"),
    /importacion JSON desde navegador esta deshabilitada/i,
  ],
  ["atomic invite callable", read("functions/src/index.ts"), /export const acceptInviteAtomic/],
  [
    "pending invite reconciliation",
    read("functions/src/index.ts"),
    /export const acceptPendingInvites/,
  ],
  [
    "canonical role migration",
    read("functions/src/index.ts"),
    /export const migrateCanonicalStaffRoles/,
  ],
  ["staff deactivation callable", read("functions/src/index.ts"), /export const deactivateStaff/],
  [
    "client profile creation closed",
    read("firestore.rules"),
    /allow create: if false; \/\/ Solo Cloud Functions durante onboarding/,
  ],
  [
    "client invite writes closed",
    read("firestore.rules"),
    /allow create: if false; \/\/ Solo Cloud Functions[\s\S]*allow update: if false; \/\/ Solo Cloud Functions/,
  ],
  ["closed month guard", read("firestore.rules"), /monthIsOpen\(request\.resource\.data\.date\)/],
  ["clinical role guard", read("firestore.rules"), /hasClinicalRole\(centerId\)/],
  ["server backup", read("functions/src/index.ts"), /export const runMonthlyBackup/],
  [
    "recovery runbook",
    read("docs/operacion/RESPALDO_Y_RECUPERACION.md"),
    /Restauracion controlada/,
  ],
];

const failed = assertions.filter(([, content, pattern]) => !pattern.test(content));
if (failed.length) {
  console.error("Controles comerciales faltantes:");
  failed.forEach(([name]) => console.error(`- ${name}`));
  process.exit(1);
}

console.log(`Preparacion comercial: ${assertions.length} controles verificados.`);
