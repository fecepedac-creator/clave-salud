import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializar Gemini API (Usando la key de pruebas del entorno)
// Nota: En producción, esto debería inyectarse vía variables de entorno (VITE_GEMINI_API_KEY)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyB9hFPZRyWLnV4yZR7wjK_KSj04O9Tmf6E";
const genAI = new GoogleGenerativeAI(API_KEY);

interface CaptionContext {
    type: 'platform' | 'center' | 'professional';
    centerName?: string;
    doctorName?: string;
    specialties?: string[];
    url: string;
}

export async function generateAICaption(idea: string, context: CaptionContext): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
Actúa como un experto Community Manager especializado en marketing para el sector salud.
Tu tarea es redactar un "caption" (texto para redes sociales) atractivo, profesional y empático.

CONTEXTO DEL NEGOCIO:
- Tipo de cuenta: ${context.type === 'center' ? 'Centro Médico' : context.type === 'professional' ? 'Profesional de la Salud' : 'Plataforma de Salud Emprendedora'}
- Nombre: ${context.doctorName || context.centerName || 'ClaveSalud'}
${context.specialties ? `- Especialidades: ${context.specialties.join(', ')}` : ''}
- URL de Agendamiento (Debe ir en el llamado a la acción): ${context.url}

IDEA/PROPÓSITO CENTRAL A COMUNICAR:
"${idea}"

INSTRUCCIONES:
1. Escribe un copy persuasivo, amigable y que conecte emocionalmente con los pacientes.
2. Utiliza emojis con moderación y estrategia.
3. Incluye un claro Llamado a la Acción (Call to Action) invitando a agendar en la URL compartida.
4. Añade hashtags relevantes (máximo 5).
5. Estructura el texto con saltos de línea para facilitar la lectura.
6. NO escribas como robot, usa un tono natural, cercano pero ético (evita promesas médicas exageradas).

Responde ÚNICAMENTE con el texto final listo para copiar y pegar en Instagram o Facebook.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Error generating AI caption:", error);
        throw new Error("No se pudo conectar con la IA para generar el texto. Intenta de nuevo más tarde.");
    }
}
