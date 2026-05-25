import React, { useState, useMemo } from "react";
import {
  Activity,
  FileText,
  X,
  ChevronDown,
  Edit,
  Plus,
  Pin,
  Calendar,
  Save,
  ExternalLink,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  ClinicalAiField,
  ClinicalAiResult,
  improveClinicalText,
  recordClinicalAiUsage,
} from "../../../utils/clinicalAi";
import {
  Consultation,
  Patient,
  RoleId,
  SnomedConcept,
  ExamProfile,
  ClinicalTemplate,
  Doctor,
} from "../../../types";
import { COMMON_DIAGNOSES } from "../../../constants";
import PSCVForm from "../../../components/PSCVForm";
import VitalsForm from "../../../components/VitalsForm";
import Odontogram from "../../../components/Odontogram";
import Podogram from "../../../components/Podogram";
import { ExamSheetsSection } from "../../../components/ExamSheetsSection";
import AutocompleteInput from "../../../components/AutocompleteInput";
import PrescriptionManager from "../../../components/PrescriptionManager";

interface ProfessionalConsultationFormProps {
  newConsultation: Partial<Consultation>;
  setNewConsultation: React.Dispatch<React.SetStateAction<Partial<Consultation>>>;
  role: RoleId;
  selectedPatient: Patient;
  selectedPatientConsultations: Consultation[];
  allExamOptions: string[];
  moduleGuards: Record<string, boolean>;
  currentUser?: Doctor;
  myExamProfiles: ExamProfile[];
  myTemplates: ClinicalTemplate[];
  diagnoses: SnomedConcept[];
  addDiagnosis?: (d: string | SnomedConcept) => void;
  removeDiagnosis?: (d: SnomedConcept) => void;
  pinDiagnosis?: (d: SnomedConcept) => void;
  handleVitalsChange: (field: string, value: any) => void;
  handleExamChange: (field: string, value: any) => void;
  handleCreateConsultation: () => Promise<Patient | null>;
  setIsPrintModalOpen: (s: boolean) => void;
  setDocsToPrint: (docs: any[]) => void;
  setIsClinicalReportOpen: (s: boolean) => void;
  setIsExamOrderModalOpen: (s: boolean) => void;
  setIsCreatingConsultation: (s: boolean) => void;
  hasActiveCenter: boolean;
}

type AiSuggestionState = ClinicalAiResult & {
  field: ClinicalAiField;
  original: string;
};

export const ProfessionalConsultationForm: React.FC<ProfessionalConsultationFormProps> = ({
  newConsultation,
  setNewConsultation,
  role,
  selectedPatient,
  _onUpdatePatient,
  setSelectedPatient,
  selectedPatientConsultations,
  allExamOptions,
  moduleGuards,
  currentUser,
  myExamProfiles,
  myTemplates,
  diagnoses,
  addDiagnosis,
  removeDiagnosis,
  pinDiagnosis,
  handleVitalsChange,
  handleExamChange,
  handleCreateConsultation,
  setIsPrintModalOpen,
  setDocsToPrint,
  setIsClinicalReportOpen,
  setIsExamOrderModalOpen,
  setIsCreatingConsultation,
  hasActiveCenter,
}) => {
  const [expandedSection, setExpandedSection] = useState<string>("anamnesis");
  const [showLicenciaOptions, setShowLicenciaOptions] = useState(false);
  const [summarizingField, setSummarizingField] = useState<ClinicalAiField | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Partial<Record<ClinicalAiField, AiSuggestionState>>>({});

  const centerIdForAi =
    selectedPatient.centerId || selectedPatient.accessControl?.centerIds?.[0] || "";

  const auditClinicalAiUsage = async (
    suggestion: AiSuggestionState,
    action: "accepted" | "discarded",
    editedOutput?: string
  ) => {
    if (!centerIdForAi) return;
    try {
      await recordClinicalAiUsage({
        centerId: centerIdForAi,
        patientId: selectedPatient.id,
        field: suggestion.field,
        action,
        inputLength: suggestion.original.length,
        outputLength: suggestion.text.length,
        editedOutputLength: editedOutput?.length || suggestion.text.length,
        warningCount: suggestion.warnings.length,
        promptId: suggestion.promptId,
        promptVersion: suggestion.promptVersion,
      });
    } catch (error) {
      console.warn("No se pudo registrar auditoria de uso IA clinica:", error);
    }
  };

  const requestAiSuggestion = async (field: ClinicalAiField, rawText?: string) => {
    const originalText = (rawText || "").trim();
    if (!originalText || summarizingField) return;
    setSummarizingField(field);
    try {
      const result = await improveClinicalText({
        rawText: originalText,
        field,
        centerId: centerIdForAi,
        patientId: selectedPatient.id,
        role,
      });
      setAiSuggestions((prev) => ({
        ...prev,
        [field]: { ...result, field, original: originalText },
      }));
    } catch (error) {
      console.error("Error improving clinical text:", error);
      alert(
        "Error del Asistente de IA: " + 
        (error instanceof Error ? error.message : "No se pudo conectar con la IA de Gemini. Por favor verifica tu API Key.")
      );
    } finally {
      setSummarizingField(null);
    }
  };

  const acceptAiSuggestion = async (field: ClinicalAiField) => {
    const suggestion = aiSuggestions[field];
    if (!suggestion) return;
    await auditClinicalAiUsage(suggestion, "accepted", suggestion.text);
    setNewConsultation((prev) => {
      const aiClinicalUsage = {
        ...((prev as any).aiClinicalUsage || {}),
        [field]: {
          acceptedAt: new Date().toISOString(),
          inputLength: suggestion.original.length,
          outputLength: suggestion.text.length,
          warningCount: suggestion.warnings.length,
          promptId: suggestion.promptId,
          promptVersion: suggestion.promptVersion,
        },
      };
      if (field === "anamnesis") return { ...prev, anamnesis: suggestion.text, aiClinicalUsage };
      if (field === "physicalExam") {
        return { ...prev, physicalExam: suggestion.text, aiClinicalUsage };
      }
      return { ...prev, nextControlReason: suggestion.text, aiClinicalUsage };
    });
    setAiSuggestions((prev) => ({ ...prev, [field]: undefined }));
  };

  const discardAiSuggestion = async (field: ClinicalAiField) => {
    const suggestion = aiSuggestions[field];
    if (suggestion) await auditClinicalAiUsage(suggestion, "discarded");
    setAiSuggestions((prev) => ({ ...prev, [field]: undefined }));
  };

  const renderAiSuggestion = (field: ClinicalAiField) => {
    const suggestion = aiSuggestions[field];
    if (!suggestion) return null;
    return (
      <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-indigo-700">
              Sugerencia IA para revisar
            </p>
            <p className="text-xs text-slate-500">
              La ficha no cambia hasta que acepte esta redaccion.
            </p>
          </div>
          <button
            type="button"
            onClick={() => discardAiSuggestion(field)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"
            title="Descartar sugerencia"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {suggestion.warnings.length > 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Revisar posibles datos agregados
            </div>
            <p>Terminos a verificar: {suggestion.warnings.join(", ")}</p>
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {suggestion.text}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => acceptAiSuggestion(field)}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
          >
            Aceptar redaccion
          </button>
          <button
            type="button"
            onClick={() => discardAiSuggestion(field)}
            className="px-3 py-2 rounded-lg bg-white text-slate-600 text-xs font-bold border border-slate-200 hover:bg-slate-50"
          >
            Descartar
          </button>
        </div>
      </div>
    );
  };

  const toggleSection = (section: string) =>
    setExpandedSection((prev) => (prev === section ? prev : section));

  const canSeeVitals = [
    "MEDICO",
    "ENFERMERA",
    "KINESIOLOGO",
    "MATRONA",
    "NUTRICIONISTA",
    "PREPARADOR_FISICO",
  ].includes(role);
  const canPrescribeDrugs = ["MEDICO", "ODONTOLOGO", "MATRONA"].includes(role);
  const canIssueLicense = ["MEDICO", "ODONTOLOGO"].includes(role);
  const isDentist = role === "ODONTOLOGO";
  const isPsych = role === "PSICOLOGO";
  const isPodo = role === "PODOLOGO";

  const labels = useMemo(() => {
    switch (role) {
      case "PODOLOGO":
        return {
          reason: "Motivo de Atención Podológica",
          anamnesis: "Anamnesis y Antecedentes (Calzado, Hábitos)",
          physical: "Examen Físico de Pies y Miembros Inferiores",
          diagnosis: "Diagnóstico Podológico / Hallazgos",
        };
      case "ASISTENTE_SOCIAL":
        return {
          reason: "Motivo de Intervención Social",
          anamnesis: "Antecedentes Familiares y Redes de Apoyo",
          physical: "Evaluación Socio-Económica / Vivienda",
          diagnosis: "Diagnóstico Social e Informe de Situación",
        };
      case "PREPARADOR_FISICO":
        return {
          reason: "Objetivo de Entrenamiento / Consulta",
          anamnesis: "Antecedentes Deportivos y Fitness (Lesiones)",
          physical: "Evaluación de Condición Física (Tests)",
          diagnosis: "Diagnóstico Funcional y Planificación",
        };
      case "QUIMICO_FARMACEUTICO":
        return {
          reason: "Motivo de Seguimiento Farmacoterapéutico",
          anamnesis: "Conciliación de Medicamentos / Reacciones",
          physical: "Seguimiento de Resultados y Adherencia",
          diagnosis: "Problemas Relacionados con Medicamentos (PRM)",
        };
      case "TECNOLOGO_MEDICO":
        return {
          reason: "Motivo de Examen / Procedimiento",
          anamnesis: "Antecedentes Clínicos Relevantes",
          physical: "Condiciones Propias del Procedimiento Técnico",
          diagnosis: "Impresión Técnica (Hallazgos)",
        };
      case "NUTRICIONISTA":
        return {
          reason: "Motivo de Consulta Nutricional",
          anamnesis: "Anamnesis Alimentaria y Hábitos",
          physical: "Evaluación Antropométrica (Cintura, Hip, Pliegues)",
          diagnosis: "Diagnóstico Nutricional Integrado (DNI)",
        };
      case "PSICOLOGO":
        return {
          reason: "Motivo de Consulta / Relato",
          anamnesis: "Desarrollo de la Sesión / Evolución",
          physical: "",
          diagnosis: "Hipótesis Diagnóstica / Foco Terapéutico",
        };
      case "ENFERMERA":
      case "TENS":
        return {
          reason: "Motivo de Atención / Procedimiento",
          anamnesis: "Antecedentes y Observaciones",
          physical: "Evaluación de Enfermería / Estado General",
          diagnosis: "Diagnóstico Enfermero / Procedimiento Realizado",
        };
      case "MATRONA":
        return {
          reason: "Motivo de Consulta Gineco-Obstétrica",
          anamnesis: "Anamnesis y Antecedentes (AGO)",
          physical: "Examen Físico Segmentario",
          diagnosis: "Diagnóstico / Hipótesis",
        };
      case "FONOAUDIOLOGO":
      case "TERAPEUTA_OCUPACIONAL":
        return {
          reason: "Motivo de Consulta / Derivación",
          anamnesis: "Evaluación Clínica / Anamnesis",
          physical: "Observaciones de Desempeño / Pruebas",
          diagnosis: "Hipótesis Diagnóstica (CID/CIF)",
        };
      default:
        return {
          reason: "Motivo de Consulta",
          anamnesis: "Anamnesis Próxima",
          physical: "Examen Físico",
          diagnosis: "Diagnóstico / Hipótesis",
        };
    }
  }, [role]);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 animate-slideUp">
      <div className="bg-slate-800 text-white px-8 py-5 flex justify-between items-center rounded-t-2xl">
        <h3 className="font-bold text-xl flex items-center gap-2">
          {newConsultation.consultationType === "pscv" ? (
            <>
              <Activity className="w-6 h-6 text-emerald-400" /> Control Cardiovascular (PSCV)
            </>
          ) : (
            <>
              <FileText className="w-6 h-6 text-primary-400" /> Nueva Atención ({role})
            </>
          )}
        </h3>
        <button
          onClick={() => setIsCreatingConsultation(false)}
          className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-0 overflow-hidden">
        {newConsultation.consultationType === "pscv" ? (
          <div className="p-8 md:p-10 space-y-10 border-b border-slate-100">
            <PSCVForm
              newConsultation={newConsultation}
              onChange={handleVitalsChange}
              onExamChange={handleExamChange}
              consultationHistory={selectedPatientConsultations}
              patientBirthDate={selectedPatient.birthDate}
              patientGender={selectedPatient.gender}
              examOptions={allExamOptions}
              role={role}
            />
          </div>
        ) : (
          <div className="p-8 md:p-10 space-y-10 border-b border-slate-100">
            {/* 1. Motivo y Anamnesis */}
            <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden animate-fadeIn">
              <button
                onClick={() => toggleSection("anamnesis")}
                className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" /> {labels.reason} y{" "}
                  {labels.anamnesis.split(" ")[0]}
                </h4>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${expandedSection === "anamnesis" ? "rotate-180" : ""}`}
                />
              </button>
              {expandedSection === "anamnesis" && (
                <div className="p-5 md:p-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
                  <div className="col-span-full">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {labels.reason}
                    </label>
                    <input
                      value={newConsultation.reason || ""}
                      onChange={(e) =>
                        setNewConsultation((prev) => ({
                          ...prev,
                          reason: e.target.value,
                        }))
                      }
                      className="w-full p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-medium text-lg text-slate-800"
                      placeholder="¿Cuál es el motivo principal de la consulta?"
                    />
                  </div>
                  <div className="col-span-full">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-slate-700">
                        {labels.anamnesis}
                      </label>
                      <button
                        onClick={() => requestAiSuggestion("anamnesis", newConsultation.anamnesis)}
                        disabled={summarizingField !== null || !newConsultation.anamnesis}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                        title="Mejorar redacción clínica con IA"
                      >
                        {summarizingField === "anamnesis" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Asistente IA
                      </button>
                    </div>
                    <textarea
                      value={newConsultation.anamnesis || ""}
                      onChange={(e) => {
                        setAiSuggestions((prev) => ({ ...prev, anamnesis: undefined }));
                        setNewConsultation((prev) => ({
                          ...prev,
                          anamnesis: e.target.value,
                        }));
                      }}
                      spellCheck={true}
                      className="w-full p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none resize-none h-40 text-base leading-relaxed text-slate-700"
                      placeholder="Detalle clínico e historial de la enfermedad actual..."
                    />
                    {renderAiSuggestion("anamnesis")}
                  </div>
                  {labels.physical && (
                    <div className="col-span-full">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-bold text-slate-700">
                          {labels.physical}
                        </label>
                        <button
                          onClick={() =>
                            requestAiSuggestion("physicalExam", newConsultation.physicalExam)
                          }
                          disabled={summarizingField !== null || !newConsultation.physicalExam}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                          title="Mejorar redaccion de examen fisico con IA"
                        >
                          {summarizingField === "physicalExam" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Asistente IA
                        </button>
                      </div>
                      <textarea
                        value={newConsultation.physicalExam || ""}
                        onChange={(e) => {
                          setAiSuggestions((prev) => ({ ...prev, physicalExam: undefined }));
                          setNewConsultation((prev) => ({
                            ...prev,
                            physicalExam: e.target.value,
                          }));
                        }}
                        spellCheck={true}
                        className="w-full p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none resize-none h-40 text-base leading-relaxed text-slate-700"
                        placeholder="Hallazgos físicos..."
                      />
                      {renderAiSuggestion("physicalExam")}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Evaluación Médica (Vitals, Odontograma, Exams) */}
            <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden animate-fadeIn">
              <button
                onClick={() => toggleSection("medical")}
                className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-500" />
                  Evaluación Médica (Exámenes y Signos Vitales)
                </h4>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${expandedSection === "medical" ? "rotate-180" : ""}`}
                />
              </button>
              {expandedSection === "medical" && (
                <div className="p-5 md:p-8 border-t border-slate-100 space-y-8 bg-white">
                  {canSeeVitals && !moduleGuards.vitals && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm">
                      Módulo de Signos Vitales deshabilitado.
                    </div>
                  )}
                  {canSeeVitals && moduleGuards.vitals && (
                    <VitalsForm
                      newConsultation={newConsultation}
                      onChange={handleVitalsChange}
                      onExamChange={handleExamChange}
                      consultationHistory={selectedPatientConsultations}
                      activeExams={selectedPatient.activeExams || []}
                      patientBirthDate={selectedPatient.birthDate}
                      patientGender={selectedPatient.gender}
                      examOptions={allExamOptions}
                      role={role}
                      anthropometryEnabled={moduleGuards.vitals}
                    />
                  )}
                  {isDentist && !moduleGuards.dental && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm">
                      Módulo de Odontograma deshabilitado.
                    </div>
                  )}
                  {isDentist && moduleGuards.dental && (
                    <Odontogram
                      value={newConsultation.dentalMap || []}
                      onChange={(val) =>
                        setNewConsultation((prev) => ({ ...prev, dentalMap: val }))
                      }
                    />
                  )}
                  {isPodo && (
                    <Podogram
                      value={newConsultation.podogram || []}
                      onChange={(val) => {
                        setNewConsultation((prev) => ({ ...prev, podogram: val }));
                      }}
                    />
                  )}
                  {moduleGuards.exams && (
                    <div className="pt-4 border-t border-slate-200">
                      <ExamSheetsSection
                        examSheets={newConsultation.examSheets || []}
                        onChange={(sheets) =>
                          setNewConsultation((prev) => ({ ...prev, examSheets: sheets }))
                        }
                        examOptions={allExamOptions}
                        availableProfiles={
                          currentUser?.savedExamProfiles?.length
                            ? currentUser.savedExamProfiles
                            : myExamProfiles
                        }
                        consultationHistory={selectedPatientConsultations}
                        legacyExams={newConsultation.exams}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Diagnóstico e Indicaciones */}
            <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden animate-fadeIn">
              <button
                onClick={() => toggleSection("diagnosis")}
                className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-emerald-500" /> Diagnóstico, Recetas e Indicaciones
                </h4>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${expandedSection === "diagnosis" ? "rotate-180" : ""}`}
                />
              </button>
              {expandedSection === "diagnosis" && (
                <div className="p-5 md:p-8 border-t border-slate-100 space-y-6 bg-white">
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {labels.diagnosis}
                    </label>
                    <div className="flex gap-2">
                      <AutocompleteInput
                        value={newConsultation.diagnosis || ""}
                        onChange={(val) =>
                          setNewConsultation((prev) => ({ ...prev, diagnosis: val }))
                        }
                        onSelect={(opt) => {
                          if (addDiagnosis) {
                            addDiagnosis(opt);
                            setNewConsultation((prev) => ({ ...prev, diagnosis: "" }));
                          }
                        }}
                        options={COMMON_DIAGNOSES}
                        className="flex-1 p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-lg text-slate-800"
                        placeholder="Buscar diagnóstico o escribir texto libre..."
                      />
                      <button
                        onClick={() => {
                          if (newConsultation.diagnosis && addDiagnosis) {
                            addDiagnosis(newConsultation.diagnosis);
                            setNewConsultation((prev) => ({ ...prev, diagnosis: "" }));
                          }
                        }}
                        className="px-6 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2"
                        title="Agregar a la lista"
                      >
                        <Plus className="w-5 h-5" /> Agregar
                      </button>
                    </div>

                    {/* Compact List of Diagnoses */}
                    {diagnoses.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {diagnoses.map((d, idx) => (
                          <div
                            key={d.code + idx}
                            className="flex items-center gap-2 bg-slate-100 pl-4 pr-2 py-2 rounded-full border border-slate-200 group hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-700 group-hover:text-emerald-700 leading-tight">
                                {d.display}
                              </span>
                              {d.code && d.code !== "free-text" && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  SCT: {d.code}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => pinDiagnosis?.(d)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-full transition-colors"
                                title="Fijar en Antecedentes Morbidos"
                              >
                                <Pin className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeDiagnosis?.(d)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                title="Eliminar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div
                    className={
                      canPrescribeDrugs ? "" : "bg-slate-50 p-6 rounded-2xl border border-slate-200"
                    }
                  >
                    {!canPrescribeDrugs && (
                      <p className="text-sm font-bold text-slate-400 uppercase mb-4">
                        Indicaciones y Certificados
                      </p>
                    )}
                    {moduleGuards.prescriptions ? (
                      <>
                        <PrescriptionManager
                          prescriptions={newConsultation.prescriptions || []}
                          onAddPrescription={(doc) =>
                            setNewConsultation((prev) => ({
                              ...prev,
                              prescriptions: [...(prev.prescriptions || []), doc],
                            }))
                          }
                          onRemovePrescription={(id) =>
                            setNewConsultation((prev) => ({
                              ...prev,
                              prescriptions: prev.prescriptions?.filter((p) => p.id !== id),
                            }))
                          }
                          onPrint={(docs) => {
                            setDocsToPrint(docs);
                            setIsPrintModalOpen(true);
                          }}
                          onOpenClinicalReport={() => setIsClinicalReportOpen(true)}
                          onOpenExamOrders={() => setIsExamOrderModalOpen(true)}
                          templates={myTemplates}
                          role={role}
                          currentDiagnosis={newConsultation.diagnosis}
                          currentUser={currentUser}
                          patient={selectedPatient}
                        />
                        {!canPrescribeDrugs && (
                          <p className="text-xs text-slate-400 mt-2 italic">
                            * Su perfil no permite emitir recetas de medicamentos, solo indicaciones
                            y certificados.
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm">
                        Módulo de Indicaciones/Recetas deshabilitado.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Próximo Control */}
            <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden animate-fadeIn">
              <button
                onClick={() => toggleSection("control")}
                className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" /> Plan y Próximo Control
                </h4>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${expandedSection === "control" ? "rotate-180" : ""}`}
                />
              </button>
              {expandedSection === "control" && (
                <div className="p-5 md:p-8 border-t border-slate-100 bg-amber-50/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label
                        htmlFor="nextControlDate"
                        className="block text-sm font-bold text-slate-700 mb-2"
                      >
                        Fecha Estimada
                      </label>
                      <input
                        id="nextControlDate"
                        type="date"
                        value={newConsultation.nextControlDate || ""}
                        onChange={(e) =>
                          setNewConsultation((prev) => ({
                            ...prev,
                            nextControlDate: e.target.value,
                          }))
                        }
                        className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-500 bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label
                          htmlFor="nextControlReason"
                          className="block text-sm font-bold text-slate-700"
                        >
                          Indicaciones / Requisitos
                        </label>
                        <button
                          onClick={() =>
                            requestAiSuggestion("indications", newConsultation.nextControlReason)
                          }
                          disabled={summarizingField !== null || !newConsultation.nextControlReason}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                          title="Mejorar redaccion de indicaciones con IA"
                        >
                          {summarizingField === "indications" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Asistente IA
                        </button>
                      </div>
                      <input
                        id="nextControlReason"
                        placeholder="Ej: Traer radiografía..."
                        value={newConsultation.nextControlReason || ""}
                        onChange={(e) => {
                          setAiSuggestions((prev) => ({ ...prev, indications: undefined }));
                          setNewConsultation((prev) => ({
                            ...prev,
                            nextControlReason: e.target.value,
                          }));
                        }}
                        className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-500 bg-white"
                      />
                      {renderAiSuggestion("indications")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Bar (Common for both PSCV and Morbidity) */}
        <div className="p-8 md:p-10 bg-slate-50 flex justify-end items-center gap-4 relative">
          {canIssueLicense && (
            <div className="relative">
              <button
                onClick={() => setShowLicenciaOptions(!showLicenciaOptions)}
                className="text-primary-600 font-bold text-lg hover:bg-primary-50 px-6 py-3 rounded-xl transition-colors border border-primary-200"
              >
                Emitir Licencia Médica
              </button>
              {showLicenciaOptions && (
                <div className="absolute bottom-full right-0 mb-2 bg-white border border-slate-200 shadow-xl rounded-xl p-4 w-72 animate-fadeIn z-20">
                  <a
                    href="https://wlme.medipass.cl"
                    target="_blank"
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-slate-700 font-medium"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" /> Medipass
                  </a>
                  <a
                    href="https://www.licencia.cl"
                    target="_blank"
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-slate-700 font-medium"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" /> I-Med
                  </a>
                </div>
              )}
            </div>
          )}
          <button
            data-testid="btn-finalizar-consulta"
            onClick={async () => {
              const updatedPatient = await handleCreateConsultation();
              if (updatedPatient) setSelectedPatient(updatedPatient);
            }}
            disabled={!hasActiveCenter}
            className={`px-10 py-5 rounded-2xl font-bold transition-all flex items-center gap-3 text-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-xl ${
              newConsultation.consultationType === "pscv"
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 text-white"
                : "bg-primary-600 hover:bg-primary-700 shadow-primary-200 text-white"
            }`}
          >
            <Save className="w-7 h-7" />{" "}
            {newConsultation.consultationType === "pscv"
              ? "Finalizar Control PSCV"
              : "Guardar Atención"}
          </button>
        </div>
      </div>
    </div>
  );
};
