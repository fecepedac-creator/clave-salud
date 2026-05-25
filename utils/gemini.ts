import { GoogleGenerativeAI } from "@google/generative-ai";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

/**
 * Mejora la redacción clínica de notas libres para dejarlas listas para ficha.
 */
export async function summarizeAnamnesis(rawText: string, centerId?: string): Promise<string> {
  try {
    const improveClinicalText = httpsCallable<
      { centerId?: string; text: string; field: string },
      { ok: boolean; text: string }
    >(functions, "improveClinicalText");
    const improved = await improveClinicalText({
      centerId,
      text: rawText,
      field: "anamnesis",
    });
    return improved.data.text.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
Actúa como asistente de redacción clínica para una ficha médica electrónica en Chile.

Tu tarea es transformar notas libres escritas por un profesional de salud en una redacción clínica clara, breve, objetiva y útil para la ficha clínica.

DIRECTRICES:
1. No diagnostiques.
2. No inventes síntomas, signos, antecedentes, exámenes, tratamientos ni evolución.
3. No agregues datos que no estén explícitamente mencionados.
4. No cambies el sentido clínico de lo escrito por el profesional.
5. Conserva datos relevantes: tiempo de evolución, intensidad, localización, síntomas asociados, tratamientos usados, respuesta al tratamiento, antecedentes, alergias, contactos enfermos, factores de riesgo y signos de alarma si fueron mencionados.
6. Si un dato está poco claro, redacta de forma prudente: "refiere", "aparentemente", "según relato", solo cuando corresponda.
7. No uses Markdown, negritas, títulos decorativos ni viñetas largas.
8. Usa lenguaje clínico natural, no excesivamente rebuscado.
9. Mantén el texto en español clínico chileno.
10. El resultado debe poder pegarse directamente en el campo de anamnesis o evolución.

FORMATO DE SALIDA:
- Devuelve solo el texto clínico final, sin comentarios adicionales.
- Usa un párrafo breve si la nota es simple.
- Usa dos o tres párrafos si hay muchos datos.
- No uses encabezado "Ficha Clínica".
- No repitas la misma información en distintas secciones.
- No conviertas todo en lista salvo que el texto original venga muy desordenado.

SI CORRESPONDE A ANAMNESIS PRÓXIMA:
Redacta como enfermedad actual. Ejemplo de estilo:
"Paciente consulta por cuadro de ... de ... días de evolución, asociado a ... Refiere ... Ha utilizado ... sin mejoría. Señala antecedente de ..."

SI CORRESPONDE A EVOLUCIÓN CLÍNICA:
Redacta como evolución de control. Ejemplo de estilo:
"Paciente en control por ... Refiere evolución ... desde la última atención. Actualmente ... Se mantiene/ajusta ... según lo registrado."

DATOS FALTANTES:
Si faltan datos clínicos importantes, no los agregues al texto principal.
Al final, agrega una línea separada con el formato:
"Datos por precisar: ..."
Solo incluye esta línea si realmente faltan datos relevantes para completar la anamnesis o evolución.

TEXTO ORIGINAL:
"${rawText}"
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error summarizing anamnesis:", error);
    throw new Error("Error al procesar el resumen con IA.");
  }
}
