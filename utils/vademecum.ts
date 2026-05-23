import { Patient, Allergy } from "../types";

export interface VademecumDrug {
  brandName: string;
  activePrinciple: string;
  bioequivalent: string;
}

export interface ClinicalAlert {
  type: "interaction" | "allergy" | "contraindication" | "bioequivalent";
  severity: "info" | "warning" | "error"; // warning=media/alta, error=crítica
  title: string;
  message: string;
}

// Chilean brand names to bioequivalent mapping
export const BRAND_TO_BIOEQUIVALENTS: VademecumDrug[] = [
  { brandName: "Apronax", activePrinciple: "Naproxeno", bioequivalent: "Naproxeno Genérico (ISP)" },
  { brandName: "Lipitor", activePrinciple: "Atorvastatina", bioequivalent: "Atorvastatina Genérica (ISP)" },
  { brandName: "Gliax", activePrinciple: "Linagliptina", bioequivalent: "Linagliptina Genérica (ISP)" },
  { brandName: "Trayenta", activePrinciple: "Linagliptina", bioequivalent: "Linagliptina Genérica (ISP)" },
  { brandName: "Eurocor", activePrinciple: "Bisoprolol", bioequivalent: "Bisoprolol Genérico (ISP)" },
  { brandName: "Concor", activePrinciple: "Bisoprolol", bioequivalent: "Bisoprolol Genérico (ISP)" },
  { brandName: "Viadil", activePrinciple: "Pargeverina", bioequivalent: "Pargeverina Genérica (ISP)" },
  { brandName: "Tafirol", activePrinciple: "Paracetamol", bioequivalent: "Paracetamol Genérico (ISP)" },
  { brandName: "Glafornil", activePrinciple: "Metformina", bioequivalent: "Metformina Genérica (ISP)" },
  { brandName: "Plavix", activePrinciple: "Clopidogrel", bioequivalent: "Clopidogrel Genérico (ISP)" },
  { brandName: "Aspirina", activePrinciple: "Ácido Acetilsalicílico", bioequivalent: "Ácido Acetilsalicílico Genérico (ISP)" },
];

// Helper to normalize strings for comparison
const cleanStr = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .trim();

export const auditPrescription = (
  text: string,
  patient?: Patient,
  currentDiagnosis?: string
): ClinicalAlert[] => {
  const alerts: ClinicalAlert[] = [];
  if (!text || !text.trim()) return alerts;

  const cleanText = cleanStr(text);

  // 1. Check for brand name drugs to suggest bioequivalents
  BRAND_TO_BIOEQUIVALENTS.forEach((item) => {
    const regex = new RegExp(`\\b${cleanStr(item.brandName)}\\b`, "i");
    if (regex.test(cleanText)) {
      alerts.push({
        type: "bioequivalent",
        severity: "info",
        title: `Bioequivalente Sugerido (Ley de Fármacos)`,
        message: `Para "${item.brandName}" (${item.activePrinciple}), puede prescribir: ${item.bioequivalent} para disminuir costos del paciente.`,
      });
    }
  });

  // 2. Drug-Allergy Interactions
  if (patient?.allergies && patient.allergies.length > 0) {
    patient.allergies.forEach((allergy) => {
      const substance = cleanStr(allergy.substance);
      if (!substance) return;

      // Penicillin allergy
      if (
        substance.includes("penicilina") ||
        substance.includes("amoxicilina") ||
        substance.includes("ampicilina")
      ) {
        if (cleanText.includes("amoxicilina") || cleanText.includes("ampicilina") || cleanText.includes("penicilina")) {
          alerts.push({
            type: "allergy",
            severity: "error",
            title: `Alerta Crítica de Alergia`,
            message: `El paciente registra una alergia activa a: "${allergy.substance}". Evite prescribir Amoxicilina, Ampicilina o derivados penicilínicos.`,
          });
        }
      }

      // NSAID allergy
      if (
        substance.includes("aine") ||
        substance.includes("nside") ||
        substance.includes("ibuprofeno") ||
        substance.includes("aspirina") ||
        substance.includes("ketorolaco")
      ) {
        const nsaids = ["ibuprofeno", "ketorolaco", "naproxeno", "aspirina", "diclofenaco", "ketoprofeno", "meloxicam", "celecoxib"];
        const foundNsaid = nsaids.find((n) => cleanText.includes(n));
        if (foundNsaid) {
          alerts.push({
            type: "allergy",
            severity: "error",
            title: `Alerta Crítica de Alergia`,
            message: `El paciente registra una alergia activa a AINEs/analgésicos: "${allergy.substance}". Evite el uso de ${foundNsaid.charAt(0).toUpperCase() + foundNsaid.slice(1)} u otros AINEs.`,
          });
        }
      }

      // Generic match
      if (substance.length > 3 && cleanText.includes(substance)) {
        // Prevent duplicate alerts if already added by specific rule
        if (!alerts.some((a) => a.type === "allergy" && a.message.includes(allergy.substance))) {
          alerts.push({
            type: "allergy",
            severity: "error",
            title: `Alerta de Alergia Detectada`,
            message: `El medicamento coincide o se relaciona con la alergia registrada: "${allergy.substance}" (${allergy.reaction || "reacción no especificada"}).`,
          });
        }
      }
    });
  }

  // 3. Drug-Drug Interactions (within the current prescription)
  // Check Sildenafil + Nitrates
  const hasSildenafil = cleanText.includes("sildenafil") || cleanText.includes("viagra");
  const hasNitrate =
    cleanText.includes("isosorbida") ||
    cleanText.includes("nitroglicerina") ||
    cleanText.includes("isordil") ||
    cleanText.includes("mononitrato");
  if (hasSildenafil && hasNitrate) {
    alerts.push({
      type: "interaction",
      severity: "error",
      title: `Interacción Crítica Potencialmente Mortal`,
      message: `La combinación de Sildenafil con Nitratos (isosorbida, nitroglicerina) causa vasodilatación severa e hipotensión potencialmente fatal. Contraindicación absoluta.`,
    });
  }

  // Check Tramadol + SSRI antidepressants
  const hasTramadol = cleanText.includes("tramadol");
  const ssris = ["sertralina", "fluoxetina", "escitalopram", "citalopram", "paroxetina", "amitriptilina", "duloxetina", "venlafaxina"];
  const foundSsri = ssris.find((s) => cleanText.includes(s));
  if (hasTramadol && foundSsri) {
    alerts.push({
      type: "interaction",
      severity: "warning",
      title: `Interacción de Severidad Alta`,
      message: `El uso de Tramadol junto con ${foundSsri.charAt(0).toUpperCase() + foundSsri.slice(1)} aumenta el riesgo de Síndrome Serotoninérgico. Monitoree rigurosamente o use analgésico alternativo.`,
    });
  }

  // Check NSAID + Oral Anticoagulants
  const nsaidsList = ["ibuprofeno", "ketorolaco", "naproxeno", "aspirina", "diclofenaco", "ketoprofeno", "meloxicam"];
  const anticoagulants = ["warfarina", "acenocumarol", "neosintrom", "rivaroxaban", "apixaban", "dabigatran"];
  const foundNsaid = nsaidsList.find((n) => cleanText.includes(n));
  const foundAnticoag = anticoagulants.find((a) => cleanText.includes(a));
  if (foundNsaid && foundAnticoag) {
    alerts.push({
      type: "interaction",
      severity: "warning",
      title: `Interacción de Severidad Alta`,
      message: `La combinación de ${foundNsaid.charAt(0).toUpperCase() + foundNsaid.slice(1)} con anticoagulantes (${foundAnticoag.charAt(0).toUpperCase() + foundAnticoag.slice(1)}) eleva drásticamente el riesgo de hemorragia digestiva alta.`,
    });
  }

  // Check NSAID + ACE inhibitors/ARBs
  const raasInhibitors = ["losartan", "enalapril", "captopril", "valsartan", "candesartan", "lisinopril"];
  const foundRaas = raasInhibitors.find((r) => cleanText.includes(r));
  if (foundNsaid && foundRaas) {
    alerts.push({
      type: "interaction",
      severity: "warning",
      title: `Interacción de Severidad Moderada`,
      message: `La combinación de ${foundNsaid.charAt(0).toUpperCase() + foundNsaid.slice(1)} con ${foundRaas.charAt(0).toUpperCase() + foundRaas.slice(1)} reduce el efecto hipotensor y aumenta el riesgo de insuficiencia renal aguda (especialmente en pacientes ancianos o deshidratados).`,
    });
  }

  // 4. Drug-Diagnosis Contraindications (based on patient's medical history or current diagnosis)
  const patientHistories = patient?.medicalHistory
    ? patient.medicalHistory.map((h) => (typeof h === "string" ? cleanStr(h) : cleanStr(h.display)))
    : [];
  const activeDiagClean = currentDiagnosis ? cleanStr(currentDiagnosis) : "";

  const isRenalPatient =
    patientHistories.some((h) => h.includes("renal") || h.includes("erc") || h.includes("nefropatia")) ||
    activeDiagClean.includes("renal") ||
    activeDiagClean.includes("erc");
  const isHeartFailurePatient =
    patientHistories.some((h) => h.includes("insuficiencia cardiaca") || h.includes("icc") || h.includes("corazon")) ||
    activeDiagClean.includes("insuficiencia cardiaca") ||
    activeDiagClean.includes("icc");

  if (foundNsaid && (isRenalPatient || isHeartFailurePatient)) {
    const reason = isRenalPatient && isHeartFailurePatient
      ? "Enfermedad Renal e Insuficiencia Cardíaca"
      : isRenalPatient
      ? "Enfermedad Renal Crónica"
      : "Insuficiencia Cardíaca";

    alerts.push({
      type: "contraindication",
      severity: "warning",
      title: `Contraindicación Relativa Detectada`,
      message: `Los AINEs (${foundNsaid.charAt(0).toUpperCase() + foundNsaid.slice(1)}) deben evitarse en pacientes con ${reason} debido a retención de sodio, hiperkalemia y nefropatía inducida por fármacos.`,
    });
  }

  return alerts;
};
