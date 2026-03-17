import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializar Gemini API (Usando la key de pruebas del entorno)
// Nota: En producción, esto debería inyectarse vía variables de entorno (VITE_GEMINI_API_KEY)
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Actúa como un Director Creativo Senior de una agencia de marketing digital de lujo especializada en Healthcare. 
Tu misión es redactar un "Copy" (texto para redes sociales) que sea IRRESISTIBLE, elegante y que transmita CONFIANZA absoluta.

CONTEXTO DEL NEGOCIO:
- Marca/Entidad: ${context.doctorName || context.centerName || "ClaveSalud"}
- Categoría: ${context.type === "center" ? "Centro Médico de Excelencia" : context.type === "professional" ? "Especialista en Salud" : "Innovación en Gestión Clínica"}
${context.specialties ? `- Portfolio de Servicios: ${context.specialties.join(", ")}` : ""}
- Enlace Estrellado (Call To Action): ${context.url}

IDEA CREATIVA A DESARROLLAR:
"${idea}"

DIRECTRICES ESTRATÉGICAS:
1. TONO: Sofisticado, empático y profesional. No uses clichés médicos genéricos.
2. ESTRUCTURA: 
   - Un Gancho (Hook) potente que detenga el scroll.
   - Un cuerpo que resuelva un punto de dolor o despierte un deseo de bienestar.
   - Un Cierre con Autoridad.
3. ESTÉTICA VISUAL: Utiliza saltos de línea elegantes y micro-emojis (✨, 🏥, 🩺) con mucha clase.
4. CALL TO ACTION: Debe ser directo pero elegante, invitando a la reserva mediante el enlace.
5. HASHTAGS: Usa una mezcla de 4-5 etiquetas premium y locales.
6. NO menciones precios bajos; prioriza el VALOR y la CALIDAD de vida.

Responde ÚNICAMENTE con el copy final listo para brillar en Instagram, Facebook o LinkedIn. Sin introducciones ni comentarios del asistente.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating AI caption:", error);
    throw new Error(
      "No se pudo conectar con la IA para generar el texto. Intenta de nuevo más tarde."
    );
  }
}
