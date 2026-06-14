import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

interface CaptionContext {
  type: "platform" | "center" | "professional";
  centerId?: string;
  centerName?: string;
  doctorName?: string;
  specialties?: string[];
  url: string;
}

export async function generateAICaption(idea: string, context: CaptionContext): Promise<string> {
  try {
    const generateMarketingCaption = httpsCallable<
      CaptionContext & { idea: string },
      { ok: boolean; text: string }
    >(functions, "generateMarketingCaption");
    const result = await generateMarketingCaption({ ...context, idea });
    return result.data.text.trim();
  } catch (error) {
    console.error("Error generating AI caption:", error);
    throw new Error("No se pudo conectar con la IA para generar el texto.");
  }
}
