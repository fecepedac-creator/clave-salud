/**
 * Genera un hash SHA-256 para una cadena de texto.
 */
export async function generateHash(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Genera un código de verificación corto y aleatorio.
 */
export function generateVerificationCode(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Crea la estructura de firma para un documento clínico.
 */
export async function signDocument(
  content: string,
  professionalName: string,
  professionalRut: string
) {
  const timestamp = new Date().toISOString();
  const rawString = `${content}|${professionalName}|${professionalRut}|${timestamp}`;
  const hash = await generateHash(rawString);
  const verificationCode = generateVerificationCode(8);

  return {
    hash: hash.substring(0, 32), // truncated for UI
    signedAt: timestamp,
    professionalName,
    professionalRut,
    verificationCode,
  };
}
