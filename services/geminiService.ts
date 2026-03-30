import { GoogleGenerativeAI } from "@google/generative-ai";
import { Patient } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Convierte un Blob a base64 para enviarlo a Gemini
 */
export async function fileToGenerativePart(
  blob: Blob
): Promise<{ inlineData: { data: string; mimeType: string } }> {
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // Quitar prefijo data:mime/type;base64,
    };
    reader.readAsDataURL(blob);
  });

  return {
    inlineData: {
      data: base64Data,
      mimeType: blob.type,
    },
  };
}

/**
 * Extrae datos clínicos de un texto o archivo usando Gemini 1.5 Flash
 */
export async function extractPatientData(
  input: string | { inlineData: { data: string; mimeType: string } },
  fileName: string
): Promise<Partial<Patient> | null> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
    Analiza este documento clínico (${fileName}) y extrae la información del paciente en formato JSON estricto.
    Enfócate EXCLUSIVAMENTE en:
    1. Datos Personales: Nombre completo, RUT, Fecha de Nacimiento (ISO), Género.
    2. Antecedentes (Anamnesis Remota): Mórbidos (médicos), Quirúrgicos, Alergias, Medicamentos actuales.
    3. Hábitos: Tabaco (IPA si existe), Alcohol, Drogas.
    4. Otros: Mascotas, Ocupación.

    No extraigas el historial de consultas individuales.
    
    Devuelve un objeto JSON con esta estructura exacta:
    {
      "fullName": "...",
      "rut": "...",
      "birthDate": "YYYY-MM-DD",
      "gender": "Masculino/Femenino/Otro",
      "occupation": "...",
      "medicalHistory": ["Enfermedad 1", "Enfermedad 2"],
      "surgicalHistory": ["Cirugía 1"],
      "allergies": [
        {"substance": "Sustancia", "reaction": "Reacción"}
      ],
      "medications": [
        {"name": "Fármaco", "dose": "...", "frequency": "..."}
      ],
      "smokingStatus": "No fumador/Fumador/Ex fumador",
      "ipa": 0,
      "alcoholStatus": "Abstemio/Social/Frecuente",
      "drugUse": "No/Sí",
      "pets": "..."
    }

    Si un dato no existe, deja el campo como null o array vacío.
    Documento:
    `;

    const result = await model.generateContent([prompt, typeof input === "string" ? input : input]);
    const response = result.response;
    const jsonText = response.text();
    console.log("Gemini Raw JSON:", jsonText);

    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error extracting patient data with Gemini:", error);
    return null;
  }
}
