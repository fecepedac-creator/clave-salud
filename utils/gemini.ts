import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

interface CaptionContext {
  type: "platform" | "center" | "professional";
  centerName?: string;
  doctorName?: string;
  specialties?: string[];
  url: string;
}

export async function generateAICaption(idea: string, context: CaptionContext): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
Actua como un Director Creativo Senior de una agencia de marketing digital especializada en Healthcare.
Tu mision es redactar un copy para redes sociales que sea elegante, confiable y profesional.

CONTEXTO DEL NEGOCIO:
- Marca/Entidad: ${context.doctorName || context.centerName || "ClaveSalud"}
- Categoria: ${
      context.type === "center"
        ? "Centro Medico"
        : context.type === "professional"
          ? "Profesional de salud"
          : "Gestion Clinica"
    }
${context.specialties ? `- Servicios: ${context.specialties.join(", ")}` : ""}
- Enlace de reserva: ${context.url}

IDEA A DESARROLLAR:
"${idea}"

DIRECTRICES:
1. Tono sofisticado, empatico y profesional.
2. Incluye gancho, cuerpo breve, cierre y llamado a reservar.
3. Usa saltos de linea y emojis con moderacion.
4. No menciones precios bajos; prioriza valor, confianza y calidad de atencion.
5. Usa 4 a 5 hashtags locales o del rubro.

Responde solo con el copy final.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating AI caption:", error);
    throw new Error("No se pudo conectar con la IA para generar el texto.");
  }
}
