import { SignatureData } from "../types";

/**
 * Genera un hash SHA-256 del contenido del documento para asegurar su integridad.
 * Utiliza Web Crypto API para máxima compatibilidad y seguridad.
 */
export async function generateIntegrityHash(content: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Genera un código de verificación único y corto (8 caracteres).
 * Este código se utiliza para la validación externa via QR.
 */
export function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Firma digitalmente un documento clínico asociando el hash de contenido con la identidad del profesional.
 */
export async function signDocument(
  content: string,
  professionalName: string,
  professionalRut: string
): Promise<SignatureData> {
  // Mezclamos el contenido con el RUT del profesional para un sellado único
  const hash = await generateIntegrityHash(content + professionalRut);
  const verificationCode = generateVerificationCode();

  return {
    hash,
    signedAt: new Date().toISOString(),
    professionalName,
    professionalRut,
    verificationCode,
  };
}
