import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export async function summarizeAnamnesis(
  rawText: string,
  centerId?: string,
  patientId?: string
): Promise<string> {
  try {
    const improveClinicalText = httpsCallable<
      { centerId?: string; patientId?: string; text: string; field: string },
      { ok: boolean; text: string }
    >(functions, "improveClinicalText");
    const improved = await improveClinicalText({
      centerId,
      patientId,
      text: rawText,
      field: "anamnesis",
    });
    return improved.data.text.trim();
  } catch (error) {
    console.error("Error summarizing anamnesis:", error);
    throw new Error("Error al procesar el resumen con IA.");
  }
}

export async function recordClinicalAiUsage(params: {
  centerId: string;
  patientId?: string;
  field: string;
  action: "accepted" | "discarded";
  inputLength: number;
  outputLength: number;
}): Promise<void> {
  const recordClinicalAiUsageCallable = httpsCallable<typeof params, { ok: boolean }>(
    functions,
    "recordClinicalAiUsage"
  );
  await recordClinicalAiUsageCallable(params);
}
