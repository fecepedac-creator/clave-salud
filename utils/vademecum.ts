import { Patient, Allergy } from "../types";
import vademecumIspRaw from "../constants/vademecum_isp.json";

export interface VademecumItem {
  id: string;
  activePrinciple: string;
  brandName: string;
  presentation: string;
  strength: string;
  form: string;
  route: string;
  prescriptionRequired: boolean;
  controlled: boolean;
  source: string;
  lastUpdated: string;
  registryId?: string;
  laboratory?: string;
  sourceUrl?: string;
}

export interface VademecumDrug {
  brandName: string;
  activePrinciple: string;
  bioequivalent: string;
}

export interface ClinicalAlert {
  type: "interaction" | "allergy" | "contraindication" | "bioequivalent" | "duplication";
  severity: "info" | "warning" | "error"; // info=azul, warning=amarillo, error=rojo (crítico)
  title: string;
  message: string;
}

export const PRESCRIBING_ROLES = ["MEDICO", "ODONTOLOGO", "MATRONA"];
export const CONTROLLED_PRESCRIBING_ROLES = ["MEDICO", "ODONTOLOGO"];
export const PRESCRIPTION_TYPES = ["Receta Médica", "Receta Retenida"];

export const normalizeClinicalRole = (role?: string | null): string =>
  String(role || "").trim().toUpperCase();

export const canRoleIssuePrescription = (role?: string | null): boolean =>
  PRESCRIBING_ROLES.includes(normalizeClinicalRole(role));

export const canRoleIssueControlledPrescription = (role?: string | null): boolean =>
  CONTROLLED_PRESCRIBING_ROLES.includes(normalizeClinicalRole(role));

export const isPrescriptionDocumentType = (type?: string | null): boolean =>
  PRESCRIPTION_TYPES.includes(String(type || ""));

export const isControlledPrescriptionType = (type?: string | null): boolean =>
  String(type || "") === "Receta Retenida";

// Chilean brand names to bioequivalent mapping
export const BRAND_TO_BIOEQUIVALENTS: VademecumDrug[] = [
  { brandName: "Apronax", activePrinciple: "Naproxeno", bioequivalent: "Naproxeno Genérico (ISP)" },
  { brandName: "Lipitor", activePrinciple: "Atorvastatina", bioequivalent: "Atorvastatina Genérica (ISP)" },
  { brandName: "Gliax", activePrinciple: "Linagliptina", bioequivalent: "Linagliptica Genérica (ISP)" },
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
export const cleanStr = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .trim();

export const CL_VADEMECUM: VademecumItem[] = vademecumIspRaw as VademecumItem[];

// Memoized flat indices for 0ms lookup speeds
export const activePrinciplesIndex = new Map<string, VademecumItem[]>();
export const brandNamesIndex = new Map<string, VademecumItem[]>();

// Populate indices
CL_VADEMECUM.forEach((item) => {
  const princKey = cleanStr(item.activePrinciple);
  if (!activePrinciplesIndex.has(princKey)) {
    activePrinciplesIndex.set(princKey, []);
  }
  activePrinciplesIndex.get(princKey)!.push(item);

  const brandKey = cleanStr(item.brandName);
  if (!brandNamesIndex.has(brandKey)) {
    brandNamesIndex.set(brandKey, []);
  }
  brandNamesIndex.get(brandKey)!.push(item);
});

export function getDrugSuggestions(partial: string): VademecumItem[] {
  if (!partial || partial.length < 3) return [];
  
  let cleanPartial = cleanStr(partial);
  
  // Normalizaciones y correcciones fuzzy específicas
  if (cleanPartial.includes("glifozina")) {
    cleanPartial = cleanPartial.replace("glifozina", "gliflozina");
  }
  if (cleanPartial.includes("dapaglifozina")) {
    cleanPartial = cleanPartial.replace("dapaglifozina", "dapagliflozina");
  }
  if (cleanPartial.includes("empaglifozina")) {
    cleanPartial = cleanPartial.replace("empaglifozina", "empagliflozina");
  }
  if (cleanPartial.includes("parecetamol")) {
    cleanPartial = cleanPartial.replace("parecetamol", "paracetamol");
  }
  if (cleanPartial.includes("valsartan")) {
    cleanPartial = cleanPartial.replace("valsartan", "valsartan");
  }
  
  const scoredItems: { item: VademecumItem; score: number }[] = [];
  const tokens = cleanPartial.split(/\s+/).filter(Boolean);
  
  CL_VADEMECUM.forEach((item) => {
    const princClean = cleanStr(item.activePrinciple);
    const brandClean = cleanStr(item.brandName);
    const presentationClean = cleanStr(item.presentation);
    
    let score = 0;
    
    // Si hay múltiples tokens (ej: "valsartan amlodipino")
    if (tokens.length > 1) {
      const matchesAllTokens = tokens.every(token => presentationClean.includes(token));
      if (matchesAllTokens) {
        score = 50;
        const matchesPrincTokens = tokens.every(token => princClean.includes(token));
        if (matchesPrincTokens) {
          score = 90;
        }
      }
    } else {
      // Un solo token
      if (princClean === cleanPartial) {
        score = 100;
      } else if (princClean.startsWith(cleanPartial)) {
        score = 80;
      } else if (brandClean.startsWith(cleanPartial)) {
        score = 70;
      } else if (princClean.includes(cleanPartial)) {
        score = 50;
      } else if (brandClean.includes(cleanPartial)) {
        score = 40;
      } else if (presentationClean.includes(cleanPartial)) {
        score = 30;
      }
    }
    
    if (score > 0) {
      scoredItems.push({ item, score });
    }
  });
  
  // Ordenar por puntaje descendente
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Si tienen igual puntaje, dar prioridad a local (presets)
    if (a.item.source !== b.item.source) {
      return a.item.source === "local" ? -1 : 1;
    }
    return a.item.presentation.localeCompare(b.item.presentation);
  });
  
  return scoredItems.map(si => si.item);
}

export function findControlledDrugMatches(text: string): VademecumItem[] {
  if (!text || !text.trim()) return [];

  const cleanText = cleanStr(text);
  const matches: VademecumItem[] = [];
  const seen = new Set<string>();

  CL_VADEMECUM.forEach((item) => {
    if (!item.controlled) return;

    const principle = cleanStr(item.activePrinciple);
    const brand = cleanStr(item.brandName);
    const presentation = cleanStr(item.presentation);
    const hasPrinciple = principle.length > 2 && cleanText.includes(principle);
    const hasBrand = brand.length > 2 && brand !== "generico" && cleanText.includes(brand);
    const hasPresentation = presentation.length > 2 && cleanText.includes(presentation);

    if (hasPrinciple || hasBrand || hasPresentation) {
      const key = `${principle}|${brand}`;
      if (!seen.has(key)) {
        matches.push(item);
        seen.add(key);
      }
    }
  });

  return matches;
}

export function hasControlledDrug(text: string): boolean {
  return findControlledDrugMatches(text).length > 0;
}

export const auditPrescription = (
  text: string,
  patient?: Patient,
  currentDiagnosis?: string,
  prescriptionType?: string
): ClinicalAlert[] => {
  const alerts: ClinicalAlert[] = [];
  if (!text || !text.trim()) return alerts;

  const cleanText = cleanStr(text);
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  const controlledMatches = findControlledDrugMatches(text);
  if (controlledMatches.length > 0 && !isControlledPrescriptionType(prescriptionType)) {
    const names = controlledMatches
      .slice(0, 4)
      .map((item) => item.activePrinciple)
      .join(", ");
    alerts.push({
      type: "contraindication",
      severity: "error",
      title: "Tipo de Receta Incompatible",
      message: `Se detectó medicamento potencialmente controlado (${names}). Debe emitirse como Receta Retenida y por profesional autorizado.`,
    });
  } else if (controlledMatches.length > 0) {
    alerts.push({
      type: "contraindication",
      severity: "warning",
      title: "Medicamento Controlado",
      message: "Verifique normativa vigente, identidad del paciente, tipo de receta, indicación y firma antes de emitir.",
    });
  }

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

  // 4. Drug-Diagnosis Contraindications
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

  // 5. Therapeutic Duplications (Same Active Principle or Same Drug Class)
  const UNIQUE_PRINCIPLES = Array.from(new Set(CL_VADEMECUM.map(item => cleanStr(item.activePrinciple))));
  
  // Find which active principles are in each line to check for duplication (literal or mapped from brand)
  const linePrinciples = lines.map(line => {
    const principlesFound = new Set<string>();
    
    // Check direct active principle
    UNIQUE_PRINCIPLES.forEach(princ => {
      if (line.includes(princ)) {
        principlesFound.add(princ);
      }
    });
    
    // Check brand name to map to active principle
    CL_VADEMECUM.forEach(item => {
      const brandClean = cleanStr(item.brandName);
      if (brandClean !== "generico" && line.includes(brandClean)) {
        principlesFound.add(cleanStr(item.activePrinciple));
      }
    });
    
    return Array.from(principlesFound);
  });

  const activePrincipleCounts: Record<string, number> = {};
  linePrinciples.forEach(principles => {
    principles.forEach(p => {
      activePrincipleCounts[p] = (activePrincipleCounts[p] || 0) + 1;
    });
  });

  Object.entries(activePrincipleCounts).forEach(([princ, count]) => {
    if (count > 1) {
      alerts.push({
        type: "duplication",
        severity: "error",
        title: `Duplicidad Terapéutica`,
        message: `El principio activo "${princ.toUpperCase()}" está prescrito más de una vez en esta receta. Verifique que no se trate de una duplicación involuntaria.`,
      });
    }
  });

  // NSAID Class Duplication
  const foundNsaids = nsaidsList.filter(nsaid => {
    return lines.some(line => line.includes(nsaid));
  });
  if (foundNsaids.length > 1) {
    alerts.push({
      type: "duplication",
      severity: "warning",
      title: `Duplicidad de Clase (AINEs)`,
      message: `Se detectó la prescripción simultánea de múltiples AINEs (${foundNsaids.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(" y ")}). Esto eleva exponencialmente el riesgo de efectos adversos gastrointestinales y renales.`,
    });
  }

  // ARA-II / IECA Class Duplication
  const foundRaasDrugs = raasInhibitors.filter(raas => {
    return lines.some(line => line.includes(raas));
  });
  if (foundRaasDrugs.length > 1) {
    alerts.push({
      type: "duplication",
      severity: "warning",
      title: `Duplicidad de Clase (ARA-II / IECA)`,
      message: `Se detectó el uso simultáneo de múltiples bloqueadores del sistema renina-angiotensina (${foundRaasDrugs.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(" y ")}). No se recomienda la terapia dual.`,
    });
  }

  return alerts;
};

export const getPosologyTemplate = (item: VademecumItem): string => {
  const formClean = item.form.toLowerCase();
  const routeClean = item.route.toLowerCase();
  
  if (formClean.includes("comprimido") || formClean.includes("tableta")) {
    return ": Tomar ___ comprimido(s) cada ___ horas por ___ días.";
  }
  if (formClean.includes("capsula") || formClean.includes("cápsula")) {
    return ": Tomar ___ cápsula(s) cada ___ horas por ___ días.";
  }
  if (formClean.includes("gotas")) {
    return ": Tomar ___ gota(s) cada ___ horas por ___ días.";
  }
  if (
    formClean.includes("jarabe") || 
    formClean.includes("suspension") || 
    formClean.includes("suspensión") || 
    formClean.includes("solucion oral") || 
    formClean.includes("solución oral")
  ) {
    return ": Tomar ___ ml cada ___ horas por ___ días.";
  }
  if (
    formClean.includes("aerosol") || 
    formClean.includes("inhalador") || 
    formClean.includes("puff")
  ) {
    return ": ___ puff(s) cada ___ horas por ___ días.";
  }
  if (
    routeClean === "topica" || 
    routeClean === "tópica" ||
    formClean.includes("crema") || 
    formClean.includes("unguento") || 
    formClean.includes("ungüento") || 
    formClean.includes("gel") || 
    formClean.includes("pomada")
  ) {
    return ": Aplicar una capa delgada cada ___ horas por ___ días en ___.";
  }
  if (
    routeClean === "inyectable" || 
    formClean.includes("ampolla") || 
    formClean.includes("solucion inyectable") || 
    formClean.includes("solución inyectable")
  ) {
    return ": Administrar ___ por vía ___ cada ___ horas/días por ___ días.";
  }
  // Default fallback
  return ": Tomar ___ cada ___ horas por ___ días.";
};
