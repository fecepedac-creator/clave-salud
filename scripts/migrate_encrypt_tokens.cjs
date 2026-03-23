/**
 * Script de migración: Cifra los Access Tokens de Meta almacenados en Firestore.
 *
 * USO (PowerShell):
 *   $env:ENCRYPTION_KEY = "0c0c88ba0b07cacbd6b8daf9e5a51c2eaadf1510736d9e284859773cf6e1d9a2"
 *   node scripts/migrate_encrypt_tokens.cjs
 *
 * SEGURIDAD:
 *   - Solo modifica whatsappConfig.accessToken por centro.
 *   - Salta tokens ya cifrados (detectados por formato "ivHex:cipherHex").
 *   - Hace backup en whatsappConfig._accessToken_backup_plain antes de cifrar.
 */

"use strict";
const admin = require("firebase-admin");
const crypto = require("crypto");

const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY || "";
const ALGO = "aes-256-cbc";
const IV_LENGTH = 16;

if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
  console.error(
    "❌ ENCRYPTION_KEY no configurada o inválida (debe tener 64 hex chars).\n" +
    '   $env:ENCRYPTION_KEY = "tu_clave_64_hex"'
  );
  process.exit(1);
}

const KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");

function isAlreadyEncrypted(value) {
  if (!value || typeof value !== "string") return false;
  const parts = value.split(":");
  return parts.length >= 2 && /^[0-9a-f]{32}$/i.test(parts[0]);
}

function encryptValue(plainText) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + enc.toString("hex");
}

// Inicializar Firebase Admin con ADC
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

async function main() {
  console.log("🔐 Iniciando migración de cifrado de tokens de Meta...\n");

  const centersSnap = await db.collection("centers").get();
  let total = 0, encrypted = 0, skipped = 0, errors = 0;

  for (const doc of centersSnap.docs) {
    total++;
    const data = doc.data();
    const accessToken = data?.whatsappConfig?.accessToken;

    if (!accessToken) {
      console.log(`  ⏭  ${doc.id} — Sin accessToken, se omite.`);
      skipped++;
      continue;
    }

    if (isAlreadyEncrypted(accessToken)) {
      console.log(`  ✅  ${doc.id} — Token ya cifrado, se omite.`);
      skipped++;
      continue;
    }

    try {
      const encryptedToken = encryptValue(accessToken);
      await doc.ref.update({
        "whatsappConfig.accessToken": encryptedToken,
        "whatsappConfig._accessToken_backup_plain": accessToken,
        "whatsappConfig._encryptedAt": new Date().toISOString(),
      });
      console.log(`  🔒  ${doc.id} — Token cifrado exitosamente.`);
      encrypted++;
    } catch (err) {
      console.error(`  ❌  ${doc.id} — Error:`, err.message);
      errors++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊  Total: ${total} | Cifrados: ${encrypted} | Omitidos: ${skipped} | Errores: ${errors}`);

  if (encrypted > 0) {
    console.log(`\n⚠️  Guarda la ENCRYPTION_KEY en un lugar seguro (LastPass, 1Password, etc).`);
    console.log(`   Sin ella los tokens no pueden descifrarse.`);
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
