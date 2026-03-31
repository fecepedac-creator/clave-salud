type PlainRecord = Record<string, any>;

export interface PatientConsistencyIssue {
  code: string;
  severity: "warning" | "critical";
  detail: string;
}

export interface PatientConsistencyResult {
  patientId: string;
  status: "ok" | "warning" | "critical";
  issues: PatientConsistencyIssue[];
  rootConsultationCount: number;
  legacyConsultationCount: number;
  legacyEmbeddedConsultationCount: number;
}

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const pushIssue = (
  issues: PatientConsistencyIssue[],
  code: string,
  severity: "warning" | "critical",
  detail: string
) => {
  issues.push({ code, severity, detail });
};

export function comparePatientConsistency(params: {
  patientId: string;
  centerId: string;
  rootPatient?: PlainRecord | null;
  legacyPatient?: PlainRecord | null;
  rootConsultations?: PlainRecord[];
  legacyConsultations?: PlainRecord[];
}): PatientConsistencyResult {
  const {
    patientId,
    centerId,
    rootPatient,
    legacyPatient,
    rootConsultations = [],
    legacyConsultations = [],
  } = params;

  const issues: PatientConsistencyIssue[] = [];
  const legacyEmbeddedConsultationCount = Array.isArray(legacyPatient?.consultations)
    ? legacyPatient.consultations.length
    : 0;

  if (!legacyPatient && rootPatient) {
    pushIssue(
      issues,
      "LEGACY_MISSING",
      "warning",
      "Existe paciente root sin documento legacy en centers/{centerId}/patients."
    );
  }

  if (legacyPatient && !rootPatient) {
    pushIssue(
      issues,
      "ROOT_MISSING",
      "critical",
      "Existe paciente legacy sin documento root canónico."
    );
  }

  if (rootPatient && legacyPatient) {
    const rootCenters = Array.isArray(rootPatient.accessControl?.centerIds)
      ? rootPatient.accessControl.centerIds.map((value: unknown) => normalizeString(value))
      : [];

    if (!rootCenters.includes(centerId)) {
      pushIssue(
        issues,
        "CENTER_ACCESS_MISSING",
        "critical",
        "El paciente root no incluye el centerId en accessControl.centerIds."
      );
    }

    const fieldsToCompare: Array<keyof PlainRecord> = ["rut", "fullName", "birthDate", "phone"];
    for (const field of fieldsToCompare) {
      const rootValue = normalizeString(rootPatient[field]);
      const legacyValue = normalizeString(legacyPatient[field]);
      if (rootValue !== legacyValue) {
        pushIssue(
          issues,
          `FIELD_MISMATCH_${String(field).toUpperCase()}`,
          "warning",
          `Diferencia en ${String(field)}: root="${rootValue}" legacy="${legacyValue}".`
        );
      }
    }
  }

  if (rootConsultations.length !== legacyConsultations.length) {
    pushIssue(
      issues,
      "CONSULTATION_COUNT_MISMATCH",
      "critical",
      `Cantidad de consultations distinta: root=${rootConsultations.length} legacy=${legacyConsultations.length}.`
    );
  }

  if (legacyEmbeddedConsultationCount > 0 && legacyEmbeddedConsultationCount !== legacyConsultations.length) {
    pushIssue(
      issues,
      "LEGACY_EMBEDDED_COUNT_MISMATCH",
      "warning",
      `La lista embebida legacy consultations=${legacyEmbeddedConsultationCount} no coincide con la colección legacy consultations=${legacyConsultations.length}.`
    );
  }

  const rootConsultationIds = new Set(
    rootConsultations.map((consultation) => normalizeString(consultation.id)).filter(Boolean)
  );
  const legacyConsultationIds = new Set(
    legacyConsultations.map((consultation) => normalizeString(consultation.id)).filter(Boolean)
  );

  for (const legacyConsultationId of legacyConsultationIds) {
    if (!rootConsultationIds.has(legacyConsultationId)) {
      pushIssue(
        issues,
        "ROOT_CONSULTATION_MISSING",
        "critical",
        `Falta consultation root con id=${legacyConsultationId}.`
      );
    }
  }

  for (const rootConsultationId of rootConsultationIds) {
    if (!legacyConsultationIds.has(rootConsultationId)) {
      pushIssue(
        issues,
        "LEGACY_CONSULTATION_MISSING",
        "warning",
        `Falta consultation legacy con id=${rootConsultationId}.`
      );
    }
  }

  const status = issues.some((issue) => issue.severity === "critical")
    ? "critical"
    : issues.length > 0
      ? "warning"
      : "ok";

  return {
    patientId,
    status,
    issues,
    rootConsultationCount: rootConsultations.length,
    legacyConsultationCount: legacyConsultations.length,
    legacyEmbeddedConsultationCount,
  };
}
