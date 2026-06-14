import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export type ClinicalAiField = "anamnesis" | "physicalExam" | "indications";

export interface ClinicalAiResult {
  text: string;
  warnings: string[];
  promptId?: string;
  promptVersion?: string;
}

export async function improveClinicalText(params: {
  rawText: string;
  field: ClinicalAiField;
  centerId?: string;
  patientId?: string;
  role?: string;
}): Promise<ClinicalAiResult> {
  try {
    const improveClinicalTextCallable = httpsCallable<
      { centerId?: string; patientId?: string; text: string; field: string; role?: string },
      {
        ok: boolean;
        text: string;
        warnings?: string[];
        promptId?: string;
        promptVersion?: string;
      }
    >(functions, "improveClinicalText");
    const improved = await improveClinicalTextCallable({
      centerId: params.centerId,
      patientId: params.patientId,
      text: params.rawText,
      field: params.field,
      role: params.role,
    });
    return {
      text: improved.data.text.trim(),
      warnings: improved.data.warnings || [],
      promptId: improved.data.promptId,
      promptVersion: improved.data.promptVersion,
    };
  } catch (error) {
    console.error("Error improving clinical text:", error);
    throw new Error("Error al procesar el texto con IA.");
  }
}

export async function summarizeAnamnesis(
  rawText: string,
  centerId?: string,
  patientId?: string,
  role?: string
): Promise<ClinicalAiResult> {
  return improveClinicalText({ rawText, centerId, patientId, role, field: "anamnesis" });
}

export async function recordClinicalAiUsage(params: {
  centerId: string;
  patientId?: string;
  field: ClinicalAiField;
  action: "accepted" | "discarded";
  inputLength: number;
  outputLength: number;
  editedOutputLength?: number;
  warningCount?: number;
  promptId?: string;
  promptVersion?: string;
}): Promise<void> {
  const recordClinicalAiUsageCallable = httpsCallable<typeof params, { ok: boolean }>(
    functions,
    "recordClinicalAiUsage"
  );
  await recordClinicalAiUsageCallable(params);
}
