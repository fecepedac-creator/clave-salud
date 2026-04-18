import * as functions from "firebase-functions";
import { z } from 'zod';

/**
 * Valida un objeto contra un esquema Zod de forma estricta.
 * @param schema Esquema Zod a validar
 * @param data Datos de entrada (payload)
 * @returns Los datos validados y tipados (con defaults aplicados)
 * @throws HttpsError con código 'invalid-argument' si la validación falla
 */
export function validateOrThrow<T>(schema: z.Schema<T>, data: any): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    // Formatear errores para que sean legibles en el frontend
    const errorDetails = result.error.issues
      .map((e) => `${e.path.join(".") || "root"}: ${e.message}`)
      .join("; ");
    
    console.warn(`[Zod Validation Failed]`, {
      errors: result.error.issues,
      receivedData: data
    });

    throw new functions.https.HttpsError(
      "invalid-argument",
      `Datos inválidos: ${errorDetails}`
    );
  }
  
  return result.data;
}
