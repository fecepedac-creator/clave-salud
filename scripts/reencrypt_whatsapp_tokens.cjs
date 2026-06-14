"use strict";

/**
 * Re-encrypts WhatsApp Meta access tokens after ENCRYPTION_KEY rotation.
 *
 * Usage:
 *   $env:OLD_ENCRYPTION_KEY = "<current 64 hex chars>"
 *   $env:NEW_ENCRYPTION_KEY = "<new 64 hex chars>"
 *   $env:GOOGLE_CLOUD_PROJECT = "clavesalud-2"
 *   node scripts/reencrypt_whatsapp_tokens.cjs          # dry-run
 *   node scripts/reencrypt_whatsapp_tokens.cjs --apply  # writes changes
 *
 * Safety:
 *   - Dry-run is the default.
 *   - Secret values are never printed.
 *   - No plaintext backup is written to Firestore.
 *   - Encrypted tokens are decrypted with OLD_ENCRYPTION_KEY and re-encrypted
 *     with NEW_ENCRYPTION_KEY.
 *   - Legacy plaintext tokens are encrypted with NEW_ENCRYPTION_KEY.
 */

const admin = require("firebase-admin");
const crypto = require("crypto");

const ALGO = "aes-256-cbc";
const IV_LENGTH = 16;
const APPLY = process.argv.includes("--apply");
const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  "clavesalud-2";

function readKey(name) {
  const value = String(process.env[name] || "").trim();
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${name} must be a 64-character hex string.`);
  }
  return Buffer.from(value, "hex");
}

const OLD_KEY = readKey("OLD_ENCRYPTION_KEY");
const NEW_KEY = readKey("NEW_ENCRYPTION_KEY");

function isEncrypted(value) {
  if (!value || typeof value !== "string") return false;
  const [ivHex, encryptedHex] = value.split(":");
  return /^[0-9a-f]{32}$/i.test(ivHex || "") && /^[0-9a-f]+$/i.test(encryptedHex || "");
}

function decryptValue(storedValue) {
  const [ivHex, encryptedHex] = storedValue.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, OLD_KEY, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function encryptValue(plainText) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, NEW_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function safeCenterLabel(doc) {
  const name = String(doc.get("name") || doc.get("nombre") || "").trim();
  return name ? `${doc.id} (${name})` : doc.id;
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

async function main() {
  console.log(`Re-encrypting WhatsApp tokens for project ${PROJECT_ID}`);
  console.log(APPLY ? "Mode: APPLY" : "Mode: DRY-RUN");

  const centersSnap = await db.collection("centers").get();
  let total = 0;
  let missing = 0;
  let legacyPlaintext = 0;
  let encrypted = 0;
  let wouldUpdate = 0;
  let updated = 0;
  let errors = 0;

  for (const doc of centersSnap.docs) {
    total++;
    const label = safeCenterLabel(doc);
    const accessToken = doc.get("whatsappConfig.accessToken");

    if (!accessToken || typeof accessToken !== "string") {
      missing++;
      console.log(`SKIP ${label}: no whatsappConfig.accessToken`);
      continue;
    }

    try {
      const plainText = isEncrypted(accessToken) ? decryptValue(accessToken) : accessToken;
      if (isEncrypted(accessToken)) {
        encrypted++;
      } else {
        legacyPlaintext++;
      }

      const reencrypted = encryptValue(plainText);
      wouldUpdate++;

      if (APPLY) {
        await doc.ref.update({
          "whatsappConfig.accessToken": reencrypted,
          "whatsappConfig._reencryptedAt": admin.firestore.FieldValue.serverTimestamp(),
          "whatsappConfig._encryptionVersion": "aes-256-cbc:v2",
        });
        updated++;
        console.log(`UPDATE ${label}: token re-encrypted`);
      } else {
        console.log(`DRY-RUN ${label}: token can be re-encrypted`);
      }
    } catch (error) {
      errors++;
      console.error(`ERROR ${label}: ${error.message}`);
    }
  }

  console.log("");
  console.log(`Total centers: ${total}`);
  console.log(`Missing token: ${missing}`);
  console.log(`Encrypted with old key: ${encrypted}`);
  console.log(`Legacy plaintext: ${legacyPlaintext}`);
  console.log(`Would update: ${wouldUpdate}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);

  if (!APPLY) {
    console.log("");
    console.log("Dry-run only. Re-run with --apply to write changes.");
  }

  if (errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
