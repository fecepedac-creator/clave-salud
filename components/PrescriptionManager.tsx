import React, { useState } from "react";
import { ClinicalTemplate, Prescription, ProfessionalRole } from "../types";
import { generateId } from "../utils";
import { FilePlus, Copy, Plus, Printer, Trash, Zap, Sparkles, FileText } from "lucide-react";
import { COMMON_MEDICATIONS } from "../constants";
import AutocompleteInput from "./AutocompleteInput";

interface PrescriptionManagerProps {
  prescriptions: Prescription[];
  onAddPrescription: (doc: Prescription) => void;
  onRemovePrescription: (id: string) => void;
  onPrint: (docs: Prescription[]) => void;
  onOpenClinicalReport?: () => void;
  templates?: ClinicalTemplate[];
  role: ProfessionalRole; // Role is required to filter options
}

const PrescriptionManager: React.FC<PrescriptionManagerProps> = ({
  prescriptions,
  onAddPrescription,
  onRemovePrescription,
  onPrint,
  onOpenClinicalReport,
  templates,
  role,
}) => {
  // Authorization Logic
  const canPrescribe = ["Medico", "Odontologo", "Matrona"].includes(role);
  // Matrona cannot prescribe controlled drugs (Receta Retenida)
  const canPrescribeControlled = ["Medico", "Odontologo"].includes(role);

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

  const [currentPrescriptionText, setCurrentPrescriptionText] = useState("");
  const [quickAddValue, setQuickAddValue] = useState("");
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const handleAdd = () => {
    if (!currentPrescriptionText.trim()) return;

    const newDoc: Prescription = {
      id: generateId(),
      type: currentPrescriptionType,
      content: currentPrescriptionText,
      createdAt: new Date().toISOString(),
    };

    onAddPrescription(newDoc);

    // Reset
    setCurrentPrescriptionText("");
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
          {prescriptions && prescriptions.length > 1 && (
            <button
              type="button"
              onClick={() => onPrint(prescriptions)}
              className="bg-white text-amber-600 hover:bg-amber-100 border border-amber-200 px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 text-sm transition-colors"
            >
              <Copy className="w-4 h-4" /> Imprimir Todo (Lote)
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
          {canPrescribe && (
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
          )}

          {/* Template Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplateSelector(!showTemplateSelector)}
              className="h-[50px] px-4 bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-200 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" /> Plantillas
            </button>
            {showTemplateSelector && templates && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl z-20 overflow-hidden animate-fadeIn">
                <div className="p-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                  Seleccionar Plantilla
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleInsertTemplate(t)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 text-slate-700 border-b border-slate-50 last:border-0"
                    >
                      {t.title}
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <div className="p-4 text-sm text-slate-400 italic">
                      No hay plantillas configuradas.
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
          placeholder={
            canPrescribe
              ? "Escriba aquí los fármacos, indicaciones o el contenido del documento..."
              : "Escriba aquí las indicaciones, certificado o contenido..."
          }
          className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-400 outline-none resize-none h-48 text-lg text-slate-700 mb-4"
          value={currentPrescriptionText}
          onChange={(e) => setCurrentPrescriptionText(e.target.value)}
          spellCheck={true}
          lang="es"
        />
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
