import React, { useState, useEffect, useMemo, useRef } from "react";
import { ClinicalTemplate, Prescription, ProfessionalRole, Doctor, Patient } from "../types";
import {
  generateId,
  auditPrescription,
  canRoleIssueControlledPrescription,
  canRoleIssuePrescription,
  getDrugSuggestions,
  hasControlledDrug,
  isControlledPrescriptionType,
  isPrescriptionDocumentType,
  VademecumItem,
  getPosologyTemplate,
} from "../utils";
import { signDocument } from "../utils/signature";
import {
  FilePlus,
  Copy,
  Plus,
  Printer,
  Trash,
  Zap,
  Sparkles,
  FileText,
  CheckSquare,
  AlertTriangle,
  ShieldAlert,
  Info,
} from "lucide-react";
import { COMMON_MEDICATIONS } from "../constants";
import { DEFAULT_CLINICAL_TEMPLATES } from "../constants/clinicalTemplates";
import AutocompleteInput from "./AutocompleteInput";

interface PrescriptionManagerProps {
  prescriptions: Prescription[];
  onAddPrescription: (doc: Prescription) => void;
  onRemovePrescription: (id: string) => void;
  onPrint: (docs: Prescription[]) => void;
  onOpenClinicalReport?: () => void;
  onOpenExamOrders?: () => void;
  templates?: ClinicalTemplate[];
  role: ProfessionalRole; // Role is required to filter options
  currentDiagnosis?: string;
  currentUser?: Doctor;
  patient?: Patient;
}

const PrescriptionManager: React.FC<PrescriptionManagerProps> = ({
  prescriptions,
  onAddPrescription,
  onRemovePrescription,
  onPrint,
  onOpenClinicalReport,
  onOpenExamOrders,
  templates,
  role: roleRaw,
  currentDiagnosis,
  currentUser,
  patient,
}) => {
  const role: ProfessionalRole = String(roleRaw || "").toUpperCase() as any;

  // Authorization Logic
  // Authorization Logic
  const canPrescribe = canRoleIssuePrescription(role);
  // Matrona cannot prescribe controlled drugs (Receta Retenida)
  const canPrescribeControlled = canRoleIssueControlledPrescription(role);

  // Define available types with restrictions
  const allDocTypes = [
    { value: "Receta Médica", label: "Receta Médica (Estándar)", restricted: true },
    {
      value: "Receta Retenida",
      label: "Receta Retenida (Controlados)",
      restricted: true,
      controlled: true,
    },
    { value: "Solicitud de Examen", label: "Solicitud de Examen", restricted: true },
    { value: "Interconsulta", label: "Interconsulta", restricted: false },
    { value: "Certificado", label: "Certificado", restricted: false },
    { value: "Indicaciones", label: "Indicaciones Generales", restricted: false },
  ];

  const availableOptions = allDocTypes.filter((t) => {
    if (!t.restricted) return true; // Always available types
    if (canPrescribe) {
      if (t.controlled && !canPrescribeControlled) return false; // Filter out controlled for Matrona
      return true;
    }
    return false;
  });

  // Initial state needs to be valid for the role
  const [currentPrescriptionType, setCurrentPrescriptionType] = useState<Prescription["type"]>(
    (canPrescribe ? "Receta Médica" : "Indicaciones") as any
  );

  // Combine user templates with system certificates (System Indications are hidden/opt-in now)
  const allTemplates = useMemo(() => {
    // 1. Filter System Templates by Role (if specified)
    const roleFilteredSystem = (DEFAULT_CLINICAL_TEMPLATES || []).filter(
      (t) => !t.roles || t.roles.includes(role) || role === "MEDICO" // Medico sees all for now or specific ones
    );

    const systemCertificates = roleFilteredSystem.filter((t) => t.category === "certificate");
    // User templates include their own created ones AND imported system indications
    const combined = [...systemCertificates, ...(templates || [])];

    // Filter based on document type
    if (currentPrescriptionType === "Certificado") {
      return combined.filter((t) => t.category === "certificate");
    } else {
      // For Indications, Recetas, etc., show indications or uncategorized
      const filtered = combined.filter((t) => t.category === "indication" || !t.category);
      // Final safety: filter by role AGAIN for the combined list
      return filtered.filter((t) => !t.roles || t.roles.includes(role));
    }
  }, [templates, currentPrescriptionType, role]);

  const [currentPrescriptionText, setCurrentPrescriptionText] = useState("");
  const [activeSuggestions, setActiveSuggestions] = useState<VademecumItem[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number>(-1);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [wordRange, setWordRange] = useState<{ start: number; end: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visibleSuggestions = useMemo(() => {
    return showAllSuggestions ? activeSuggestions : activeSuggestions.slice(0, 8);
  }, [activeSuggestions, showAllSuggestions]);

  const handleTextChange = (text: string, cursorPosition: number) => {
    setCurrentPrescriptionText(text);
    
    if (cursorPosition === 0) {
      setActiveSuggestions([]);
      setSelectedSuggestionIdx(-1);
      setShowAllSuggestions(false);
      setWordRange(null);
      return;
    }

    // Encontrar límites de la palabra en la posición del cursor
    let start = cursorPosition;
    while (start > 0 && !/\s|,/.test(text[start - 1])) {
      start--;
    }
    let end = cursorPosition;
    while (end < text.length && !/\s|,/.test(text[end])) {
      end++;
    }

    const partialWord = text.substring(start, end);
    if (partialWord.length >= 3) {
      const matches = getDrugSuggestions(partialWord);
      setActiveSuggestions(matches);
      setSelectedSuggestionIdx(matches.length > 0 ? 0 : -1);
      setShowAllSuggestions(false);
      setWordRange({ start, end });
    } else {
      setActiveSuggestions([]);
      setSelectedSuggestionIdx(-1);
      setShowAllSuggestions(false);
      setWordRange(null);
    }
  };

  const handleSelectSuggestion = (item: VademecumItem, cleanOnly: boolean) => {
    if (!wordRange || !textareaRef.current) return;
    
    const drugName = item.presentation;
    const posology = cleanOnly ? "" : getPosologyTemplate(item);

    const text = currentPrescriptionText;
    const newText = 
      text.substring(0, wordRange.start) + 
      drugName + posology + 
      text.substring(wordRange.end);
      
    setCurrentPrescriptionText(newText);
    if (item.controlled && canPrescribeControlled && !isControlledPrescriptionType(currentPrescriptionType)) {
      setCurrentPrescriptionType("Receta Retenida" as any);
    }
    setActiveSuggestions([]);
    setSelectedSuggestionIdx(-1);
    setShowAllSuggestions(false);
    setWordRange(null);
    
    // Calcular posición para resaltar los primeros guiones bajos "___"
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        if (!cleanOnly) {
          const targetOffset = posology.indexOf("___");
          if (targetOffset !== -1) {
            const newCursorPos = wordRange.start + drugName.length + targetOffset;
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos + 3);
          }
        } else {
          const newCursorPos = wordRange.start + drugName.length;
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (activeSuggestions.length > 0) {
      const visibleCount = visibleSuggestions.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev + 1) % visibleCount);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev - 1 + visibleCount) % visibleCount);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedSuggestionIdx >= 0 && selectedSuggestionIdx < visibleCount) {
          handleSelectSuggestion(visibleSuggestions[selectedSuggestionIdx], false);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setActiveSuggestions([]);
        setSelectedSuggestionIdx(-1);
        setShowAllSuggestions(false);
      }
    }
  };

  const clinicalAlerts = useMemo(() => {
    return auditPrescription(currentPrescriptionText, patient, currentDiagnosis, currentPrescriptionType);
  }, [currentPrescriptionText, patient, currentDiagnosis, currentPrescriptionType]);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [pendingExamsMetadata, setPendingExamsMetadata] = useState<string[]>([]);

  // Lógica de filtrado y sugerencia inteligente de plantillas
  const filteredTemplates = useMemo(() => {
    if (!templateSearchTerm.trim() && !currentDiagnosis) return allTemplates;

    const normalizedDiag = (currentDiagnosis || "").toLowerCase();
    const normalizedSearch = templateSearchTerm.toLowerCase();

    return [...allTemplates]
      .map((t) => {
        let score = 0;
        const normalizedTitle = t.title.toLowerCase();
        const normalizedContent = t.content.toLowerCase();

        // 1. Coincidencia con búsqueda de texto (Alta prioridad)
        if (templateSearchTerm.trim()) {
          if (normalizedTitle.includes(normalizedSearch)) score += 100;
          if (normalizedContent.includes(normalizedSearch)) score += 30;
        }

        // 2. Coincidencia con diagnóstico actual (Inteligencia Clínica)
        if (currentDiagnosis) {
          // Dividir diagnóstico en palabras clave para búsqueda parcial
          const diagKeywords = normalizedDiag.split(" ").filter((k) => k.length > 3);
          diagKeywords.forEach((kw) => {
            if (normalizedTitle.includes(kw)) score += 50;
            if (normalizedContent.includes(kw)) score += 15;
          });

          // Coincidencia exacta de palabras clave del diagnóstico en el título
          if (normalizedTitle.includes(normalizedDiag)) score += 80;
        }

        return { ...t, score };
      })
      .filter((t) => !templateSearchTerm.trim() || t.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [allTemplates, templateSearchTerm, currentDiagnosis]);

  // Parse current text to find already listed exams could be complex, so we just append for now or start fresh.
  // Ideally, we might parse lines, but for simplicity, we treat the text area as the source of truth.

  // Auto-fill logic for Interconsulta
  useEffect(() => {
    if (currentPrescriptionType === "Interconsulta" && !currentPrescriptionText) {
      const diagnosisText = currentDiagnosis ? currentDiagnosis : "[DIAGNÓSTICO]";
      const autoText = `Estimado colega, favor evaluar al paciente suscrito con sospecha diagnóstica de ${diagnosisText}.\n\nSe adjuntan antecedentes clínicos relevantes:\n- `;
      setCurrentPrescriptionText(autoText);
    }
  }, [currentPrescriptionType, currentDiagnosis]);

  const handleAdd = async () => {
    if (!currentPrescriptionText.trim()) return;

    if (isPrescriptionDocumentType(currentPrescriptionType) && !canPrescribe) {
      alert(`Su rol (${role}) no está autorizado para emitir recetas.`);
      return;
    }

    if (isControlledPrescriptionType(currentPrescriptionType) && !canPrescribeControlled) {
      alert(`Su rol (${role}) no está autorizado para emitir Receta Retenida.`);
      return;
    }

    if (hasControlledDrug(currentPrescriptionText) && !isControlledPrescriptionType(currentPrescriptionType)) {
      alert("Se detectó un medicamento potencialmente controlado. Debe emitirse como Receta Retenida por profesional autorizado.");
      return;
    }

    const signature = (currentUser && patient) 
      ? await signDocument(currentPrescriptionText, currentUser.fullName, currentUser.rut || currentUser.id) 
      : undefined;

    const newDoc: Prescription = {
      id: generateId(),
      type: currentPrescriptionType,
      content: currentPrescriptionText,
      createdAt: new Date().toISOString(),
      signature,
      metadata:
        pendingExamsMetadata.length > 0 ? { selectedExams: pendingExamsMetadata } : undefined,
    };

    onAddPrescription(newDoc);

    // Reset
    setCurrentPrescriptionText("");
    setPendingExamsMetadata([]);
    // Reset type to default valid type
    setCurrentPrescriptionType((canPrescribe ? "Receta Médica" : "Indicaciones") as any);
  };

  const handleQuickInsert = (value: string) => {
    if (!value) return;
    // Append to text with a newline
    const prefix = currentPrescriptionText ? "\n" : "";
    setCurrentPrescriptionText((prev) => prev + prefix + value);
    setQuickAddValue("");
  };

  const handleInsertTemplate = (template: ClinicalTemplate) => {
    setCurrentPrescriptionText(template.content);
    setShowTemplateSelector(false);
  };

  return (
    <div className="bg-amber-50 p-8 rounded-3xl border border-amber-200">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-amber-900 font-bold text-lg uppercase tracking-wider flex items-center gap-2">
          <FilePlus className="w-5 h-5" /> Documentos Clínicos
        </h4>
        <div className="flex items-center gap-2">
          {onOpenClinicalReport && (
            <button
              type="button"
              onClick={onOpenClinicalReport}
              className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 text-sm transition-colors"
            >
              <FileText className="w-4 h-4" /> Informe Clínico
            </button>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm mb-6 relative">
        <div className="flex flex-col md:flex-row gap-4 mb-4 items-start">
          <select
            className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 font-bold text-slate-700 outline-none focus:border-amber-500 h-[50px] md:w-1/3"
            value={currentPrescriptionType}
            onChange={(e: any) => setCurrentPrescriptionType(e.target.value)}
          >
            {availableOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Quick Insert Helper */}
          {canPrescribe ? (
            <div className="flex-1 w-full relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <AutocompleteInput
                value={quickAddValue}
                onChange={setQuickAddValue}
                onSelect={handleQuickInsert}
                options={COMMON_MEDICATIONS}
                placeholder="Inserción rápida de fármaco..."
                className="w-full pl-10 pr-4 py-3 border border-amber-200 rounded-lg text-sm bg-amber-50/30 focus:bg-white focus:border-amber-400 outline-none transition-colors h-[50px]"
              />
            </div>
          ) : (
            <div className="flex-1 w-full flex items-center">
              <button
                type="button"
                onClick={() =>
                  handleQuickInsert(
                    "Nota: Seguir indicaciones farmacológicas indicadas por su médico tratante."
                  )
                }
                className="h-[50px] w-full px-4 bg-slate-100 text-slate-500 font-bold rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                title="Insertar recordatorio farmacológico estándar"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-slate-400" />
                  <span>Insertar: "Seguir indicaciones médicas..."</span>
                </div>
              </button>
            </div>
          )}

          {/* Template Button */}
          <div className="relative flex gap-2">
            {currentPrescriptionType === "Solicitud de Examen" && onOpenExamOrders && (
              <button
                type="button"
                onClick={() => onOpenExamOrders()}
                className="h-[50px] px-4 bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 hover:bg-emerald-200 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <CheckSquare className="w-4 h-4" /> Configurar Órdenes de Exámenes
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowTemplateSelector(!showTemplateSelector)}
              className="h-[50px] px-4 bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-200 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" /> Plantillas
            </button>
            {showTemplateSelector && allTemplates && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 shadow-2xl rounded-2xl z-20 overflow-hidden animate-fadeIn backdrop-blur-sm bg-white/95">
                <div className="p-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                      Buscar Plantilla
                    </span>
                    <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                  </div>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ej: Lumbago, Gripe..."
                    value={templateSearchTerm}
                    onChange={(e) => setTemplateSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-400 outline-none transition-all shadow-inner"
                  />
                  {currentDiagnosis && !templateSearchTerm && (
                    <div className="mt-2 text-[10px] text-indigo-600 font-medium flex items-center gap-1">
                      <Zap className="w-2 h-2" /> Sugerencias para: {currentDiagnosis}
                    </div>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {filteredTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleInsertTemplate(t)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 text-slate-700 border-b border-slate-50 last:border-0 group transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold group-hover:text-indigo-600 truncate">
                          {t.title}
                        </span>
                        {(t as any).score > 50 && !templateSearchTerm && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">
                            RECOMENDADO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {t.content.substring(0, 40)}...
                      </p>
                    </button>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <div className="p-6 text-center">
                      <p className="text-sm text-slate-400 italic">No se encontraron plantillas.</p>
                      <button
                        onClick={() => setTemplateSearchTerm("")}
                        className="text-xs text-indigo-600 font-bold mt-2 hover:underline"
                      >
                        Ver todas
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {showTemplateSelector && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowTemplateSelector(false)}
              ></div>
            )}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          placeholder={
            canPrescribe
              ? "Escriba aquí los fármacos, indicaciones o el contenido del documento..."
              : "Escriba aquí las indicaciones, certificado o contenido..."
          }
          className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-400 outline-none resize-none h-48 text-lg text-slate-700 mb-4"
          value={currentPrescriptionText}
          onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => {
            if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key) && activeSuggestions.length > 0) {
              return;
            }
            handleTextChange((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart);
          }}
          onSelect={(e) => handleTextChange((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
          spellCheck={true}
          lang="es"
        />

        {/* Autocomplete Suggestions */}
        {activeSuggestions.length > 0 && (
          <div className="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-md max-h-[400px] overflow-y-auto custom-scrollbar animate-fadeIn animate-duration-150">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Resultados del Vademécum ({activeSuggestions.length}):
              </p>
              <span className="text-[10px] text-slate-400 font-medium">
                Use ↑↓ para navegar y Enter para insertar con posología
              </span>
            </div>
            <div className="space-y-2">
              {visibleSuggestions.map((item, idx) => {
                const isHighlighted = idx === selectedSuggestionIdx;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-xl border transition-all ${
                      isHighlighted
                        ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-100"
                        : "bg-white border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm text-slate-800 truncate">
                          {item.presentation}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.source === "local" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {item.source === "local" ? "Local" : "ISP"}
                        </span>
                        {item.controlled && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            Controlado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                        <span>Principio: <strong>{item.activePrinciple}</strong></span>
                        <span className="text-slate-300 hidden sm:inline">|</span>
                        <span>Forma: <strong>{item.form}</strong></span>
                        <span className="text-slate-300 hidden sm:inline">|</span>
                        <span>Vía: <strong>{item.route}</strong></span>
                      </p>
                    </div>
                    <div className="flex gap-2 mt-2 sm:mt-0 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(item, true)}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-205 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-all active:scale-95"
                      >
                        Solo Fármaco
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(item, false)}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all active:scale-95 shadow-sm"
                      >
                        Con Posología
                      </button>
                    </div>
                  </div>
                );
              })}
              {activeSuggestions.length > 8 && !showAllSuggestions && (
                <button
                  type="button"
                  onClick={() => setShowAllSuggestions(true)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors mt-2 text-center"
                >
                  Ver más sugerencias... ({activeSuggestions.length - 8} más)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Auditor Alerts Container */}
        {clinicalAlerts.length > 0 && (
          <div className="mb-4 space-y-2 animate-fadeIn">
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-500 font-medium italic">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong>Descargo Clínico:</strong> Estas alertas son un apoyo operacional y no reemplazan el criterio clínico del profesional tratante.
              </span>
            </div>
            {clinicalAlerts.map((alert, idx) => {
              let bg = "bg-blue-50/70 border-blue-200 text-blue-800";
              let icon = <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />;
              
              if (alert.severity === "error") {
                bg = "bg-red-50/70 border-red-200 text-red-800";
                icon = <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />;
              } else if (alert.severity === "warning") {
                bg = "bg-amber-50/70 border-amber-200 text-amber-800";
                icon = <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />;
              }

              return (
                <div
                  key={idx}
                  className={`p-3.5 border rounded-xl flex items-start gap-3 text-sm font-medium transition-all ${bg}`}
                >
                  {icon}
                  <div>
                    <strong className="block font-bold text-xs uppercase tracking-wider mb-0.5">{alert.title}</strong>
                    <span className="text-xs leading-relaxed">{alert.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!currentPrescriptionText.trim()}
            className="bg-amber-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-amber-600 shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" /> Agregar Documento
          </button>
        </div>
      </div>

      {/* List of Added Documents */}
      {prescriptions && prescriptions.length > 0 ? (
        <div className="space-y-3">
          {prescriptions.length > 1 && (
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => onPrint(prescriptions)}
                className="bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 text-sm transition-colors"
              >
                <Printer className="w-4 h-4" /> Imprimir Todo ({prescriptions.length})
              </button>
            </div>
          )}
          {prescriptions.map((doc) => (
            <div
              key={doc.id}
              className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex justify-between items-start gap-4"
            >
              <div className="flex-1">
                <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded mb-2 uppercase">
                  {doc.type}
                </span>
                <p className="text-slate-700 whitespace-pre-wrap font-medium">{doc.content}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onPrint([doc])}
                  className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center gap-1 font-bold text-sm"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => onRemovePrescription(doc.id)}
                  className="text-red-400 hover:bg-red-50 p-2 rounded-lg transition-colors"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-amber-800/50 italic">No hay documentos generados.</p>
      )}
    </div>
  );
};

export default PrescriptionManager;
