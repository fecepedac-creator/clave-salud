/**
 * Script de migración: Cifra los Access Tokens de Meta almacenados en Firestore.
 * 
 * USO:
 *   $env:ENCRYPTION_KEY = "TU_CLAVE_DE_64_HEX_CHARS"
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "ruta/a/serviceAccount.json"
 *   node scripts/migrate_encrypt_tokens.js
 * 
 * SEGURIDAD:
 *   - Solo modifica el campo `whatsappConfig.accessToken` de cada centro.
 *   - Si el token ya tiene formato "ivHex:ciphertextHex", lo salta (ya fue cifrado).
 *   - Hace un backup del valor original en `whatsappConfig._accessToken_backup_plain` antes de cifrar.
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");

// ── Configuración ──────────────────────────────────────────────────
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY || "";
const ALGO = "aes-256-cbc";
const IV_LENGTH = 16;

if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
  console.error(
    "❌ ENCRYPTION_KEY env var no configurada o no tiene 64 caracteres hex.\n" +
    "   Exportarla antes de ejecutar este script:\n" +
    '   $env:ENCRYPTION_KEY = "tu_clave_de_64_hex"'
  );
  process.exit(1);
}

const KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");

function isAlreadyEncrypted(value) {
  // El formato cifrado es "ivHex:ciphertextHex"; el texto plano no contiene ":"
  // excepto los tokens de Meta que SÍ pueden contener ":" como parte de su payload JWT.
  // Distinguimos por longitud del IV (32 hex = 16 bytes):
  if (!value || typeof value !== "string") return false;
  const parts = value.split(":");
  if (parts.length < 2) return false;
  // Si el primer segmento mide exactamente 32 hex chars → asumimos cifrado
  return /^[0-9a-f]{32}$/i.test(parts[0]);
}

function encryptToken(plainText) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + enc.toString("hex");
}

// ── Inicializar Firebase Admin ─────────────────────────────────────
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath) {
  initializeApp({ credential: cert(require(credPath)) });
} else {
  // Usar Application Default Credentials (gcloud auth application-default login)
  initializeApp();
}

const db = getFirestore();

// ── Script principal ───────────────────────────────────────────────
async function main() {
  console.log("🔐 Iniciando migración de cifrado de tokens de Meta...\n");

  const centersSnap = await db.collection("centers").get();
  let total = 0, encrypted = 0, skipped = 0, errors = 0;

  for (const doc of centersSnap.docs) {
    total++;
    const data = doc.data();
    const accessToken = data?.whatsappConfig?.accessToken;

    if (!accessToken) {
      console.log(`  ⏭  ${doc.id} — Sin whatsappConfig.accessToken, se omite.`);
      skipped++;
      continue;
    }

    if (isAlreadyEncrypted(accessToken)) {
      console.log(`  ✅  ${doc.id} — Token ya cifrado, se omite.`);
      skipped++;
      continue;
    }

    try {
      const encryptedToken = encryptToken(accessToken);
      await doc.ref.update({
        "whatsappConfig.accessToken": encryptedToken,
        // Backup del original en campo oculto (solo para rollback de emergencia)
        "whatsappConfig._accessToken_backup_plain": accessToken,
        "whatsappConfig._encryptedAt": new Date().toISOString(),
      });
      console.log(`  🔒  ${doc.id} — Token cifrado exitosamente.`);
      encrypted++;
    } catch (err) {
      console.error(`  ❌  ${doc.id} — Error cifrando:`, err.message);
      errors++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Resultado:`);
  console.log(`   Total centros:   ${total}`);
  console.log(`   Cifrados:        ${encrypted}`);
  console.log(`   Omitidos:        ${skipped}`);
  console.log(`   Errores:         ${errors}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (encrypted > 0) {
    console.log(`\n⚠️  IMPORTANTE: Guarda la ENCRYPTION_KEY en un lugar seguro.`);
    console.log(`   Sin ella, los tokens NO pueden ser descifrados.`);
    console.log(`   Si pierdes la key, deberás re-generar los tokens desde Meta.`);
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
