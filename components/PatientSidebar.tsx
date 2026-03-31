import React, { useState } from "react";
import { Patient, Attachment, Medication, Allergy, ExamProfile } from "../types";
import {
  MEDICAL_HISTORY_OPTIONS,
  SURGICAL_HISTORY_OPTIONS,
  LIVING_WITH_OPTIONS,
  MAULE_COMMUNES,
  COMMON_MEDICATIONS,
  INSURANCE_OPTIONS,
  INSURANCE_LEVELS,
  PUEBLOS_ORIGINARIOS,
  NACIONALIDADES,
} from "../constants";
import { generateId } from "../utils";
import {
  Users,
  Activity,
  Scissors,
  FileImage,
  Eye,
  File,
  Pill,
  X,
  AlertCircle,
} from "lucide-react";
import AutocompleteInput from "./AutocompleteInput";
import DrivePicker from "./DrivePicker";

interface PatientSidebarProps {
  selectedPatient: Patient;
  isEditingPatient: boolean;
  toggleEditPatient: () => void;
  handleEditPatientField: (field: keyof Patient, value: any) => void;
  onPreviewFile: (file: Attachment) => void;
  readOnly?: boolean;
}

const PatientSidebar: React.FC<PatientSidebarProps> = ({
  selectedPatient,
  isEditingPatient,
  toggleEditPatient,
  handleEditPatientField,
  onPreviewFile,
  readOnly = false,
}) => {
  // Local state for temporary inputs
  const [tempMedication, setTempMedication] = useState<Partial<Medication>>({
    name: "",
    dose: "",
    frequency: "",
  });
  const [tempAllergy, setTempAllergy] = useState("");
  const [customMedical, setCustomMedical] = useState("");
  const [customSurgical, setCustomSurgical] = useState("");
  const [customSocial, setCustomSocial] = useState("");

  // Safety accessors
  const livingWith = selectedPatient.livingWith || [];
  const medicalHistory = selectedPatient.medicalHistory || [];
  const surgicalHistory = selectedPatient.surgicalHistory || [];
  const medications = selectedPatient.medications || [];
  const allergies = selectedPatient.allergies || [];
  const attachments = selectedPatient.attachments || [];

  const handleAddSocial = (value: string) => {
    if (!value) return;
    if (!livingWith.includes(value)) {
      handleEditPatientField("livingWith", [...livingWith, value]);
    }
  };

  const handleAddHistory = (type: "medical" | "surgical", value: string) => {
    if (!value) return;
    const list = type === "medical" ? medicalHistory : surgicalHistory;
    const field = type === "medical" ? "medicalHistory" : "surgicalHistory";

    const normalValue = value.trim().toLowerCase();
    const alreadyExists = list.some((item) => {
      const label = typeof item === "string" ? item : item.display;
      return label.toLowerCase() === normalValue;
    });

    if (!alreadyExists) {
      handleEditPatientField(field, [
        ...list,
        { id: generateId(), code: "free-text", display: value.trim(), system: "custom" },
      ]);
    }
  };

  const toggleHistoryItem = (type: "medical" | "surgical", itemId: string) => {
    const list = type === "medical" ? medicalHistory : surgicalHistory;
    const field = type === "medical" ? "medicalHistory" : "surgicalHistory";
    const options = type === "medical" ? MEDICAL_HISTORY_OPTIONS : SURGICAL_HISTORY_OPTIONS;

    const isItemSelected = list.some((item) =>
      typeof item === "string" ? item === itemId : item.id === itemId
    );

    if (isItemSelected) {
      handleEditPatientField(
        field,
        list.filter((item) => (typeof item === "string" ? item !== itemId : item.id !== itemId))
      );
    } else {
      const option = options.find((o) => o.id === itemId);
      if (option) {
        handleEditPatientField(field, [
          ...list,
          {
            id: option.id,
            code: option.code,
            system: option.system || "http://snomed.info/sct",
            display: option.display,
          },
        ]);
      }
    }
  };

  const handleAddMedication = () => {
    if (!tempMedication.name) return;
    const newMed = {
      id: generateId(),
      name: tempMedication.name,
      dose: tempMedication.dose || "No especificado",
      frequency: tempMedication.frequency || "No especificado",
    };
    handleEditPatientField("medications", [...medications, newMed]);
    setTempMedication({ name: "", dose: "", frequency: "" });
  };

  const handleAddAllergy = () => {
    if (!tempAllergy) return;
    const newAllergy = {
      id: generateId(),
      substance: tempAllergy,
      reaction: "No especificado",
      severity: "Desconocida",
    };
    handleEditPatientField("allergies", [...allergies, newAllergy]);
    setTempAllergy("");
  };

  return (
    <aside className="lg:col-span-3 h-full overflow-y-auto bg-white border-r border-slate-200 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">
            Anamnesis Remota
          </h3>
          {selectedPatient.driveFileLink && (
            <a
              href={selectedPatient.driveFileLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full uppercase transition-all hover:bg-blue-100 w-fit"
            >
              <Eye className="w-3.5 h-3.5" /> Ver Documento Original
            </a>
          )}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Historial Clínico del Paciente
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={toggleEditPatient}
            className={`p-2.5 rounded-2xl border transition-all shadow-sm ${
              isEditingPatient
                ? "bg-slate-800 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Activity className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Antecedentes Médicos */}
      <div className="space-y-4">
        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <Activity className="w-4 h-4 text-emerald-600" /> Antecedentes Médicos
        </h4>

        {isEditingPatient && !readOnly ? (
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              {MEDICAL_HISTORY_OPTIONS.map((opt) => {
                const isSelected = medicalHistory.some((h) =>
                  typeof h === "string" ? h === opt.id : h.id === opt.id
                );
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleHistoryItem("medical", opt.id)}
                    className={`text-[10px] font-black p-2.5 rounded-xl border transition-all text-left uppercase ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-md transform scale-[1.02]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    {opt.display}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 p-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-emerald-500 bg-white font-medium"
                placeholder="Otro antecedente médico..."
                value={customMedical}
                onChange={(e) => setCustomMedical(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddHistory("medical", customMedical);
                    setCustomMedical("");
                  }
                }}
              />
              <button
                onClick={() => {
                  handleAddHistory("medical", customMedical);
                  setCustomMedical("");
                }}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {medicalHistory.map((h, idx) => {
              const id = typeof h === "string" ? h : h.id || h.code + idx;
              const label = typeof h === "string" ? h : h.display;
              return (
                <span
                  key={id}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[12px] font-black rounded-xl border border-emerald-100 uppercase tracking-tight"
                >
                  {label}
                </span>
              );
            })}
            {!medicalHistory.length && (
              <p className="text-xs text-slate-400 italic font-medium">
                Sin antecedentes registrados.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Antecedentes Quirúrgicos */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <Scissors className="w-4 h-4 text-blue-600" /> Antecedentes Quirúrgicos
        </h4>

        {isEditingPatient && !readOnly ? (
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              {SURGICAL_HISTORY_OPTIONS.map((opt) => {
                const isSelected = surgicalHistory.some((h) =>
                  typeof h === "string" ? h === opt.id : h.id === opt.id
                );
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleHistoryItem("surgical", opt.id)}
                    className={`text-[10px] font-black p-2.5 rounded-xl border transition-all text-left uppercase ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-700 shadow-md transform scale-[1.02]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {opt.display}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 p-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white font-medium"
                placeholder="Otra cirugía..."
                value={customSurgical}
                onChange={(e) => setCustomSurgical(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddHistory("surgical", customSurgical);
                    setCustomSurgical("");
                  }
                }}
              />
              <button
                onClick={() => {
                  handleAddHistory("surgical", customSurgical);
                  setCustomSurgical("");
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {surgicalHistory.map((h, idx) => {
              const id = typeof h === "string" ? h : h.id || h.code + idx;
              const label = typeof h === "string" ? h : h.display;
              return (
                <span
                  key={id}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[12px] font-black rounded-xl border border-blue-100 uppercase tracking-tight"
                >
                  {label}
                </span>
              );
            })}
            {!surgicalHistory.length && (
              <p className="text-xs text-slate-400 italic font-medium">Sin antecedentes.</p>
            )}
          </div>
        )}
      </div>

      {/* Alergias */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <AlertCircle className="w-4 h-4 text-orange-600" /> Alergias
        </h4>
        <div className="flex flex-wrap gap-2">
          {allergies.map((a) => (
            <span
              key={a.id}
              className="px-3 py-1.5 bg-orange-50 text-orange-700 text-[12px] font-black rounded-xl border border-orange-100 flex items-center gap-2 uppercase tracking-tight"
            >
              {a.substance}
              {isEditingPatient && !readOnly && (
                <button
                  onClick={() =>
                    handleEditPatientField(
                      "allergies",
                      allergies.filter((al) => al.id !== a.id)
                    )
                  }
                  className="text-orange-800 hover:bg-orange-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {!allergies.length && (
            <p className="text-xs text-slate-400 italic font-medium">Sin alergias.</p>
          )}
        </div>
        {isEditingPatient && !readOnly && (
          <div className="flex gap-2 mt-2">
            <input
              className="flex-1 p-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-orange-500 bg-slate-50 font-medium"
              placeholder="+ Nueva alergia..."
              value={tempAllergy}
              onChange={(e) => setTempAllergy(e.target.value)}
            />
            <button
              onClick={handleAddAllergy}
              className="bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-700 shadow-sm"
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* Hábitos */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <Activity className="w-4 h-4 text-slate-600" /> Hábitos
        </h4>

        {isEditingPatient && !readOnly ? (
          <div className="space-y-6 bg-slate-50 p-5 rounded-3xl border border-slate-100">
            {/* Tabaco */}
            <div className="space-y-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Tabaco
              </p>
              <div className="flex gap-2">
                {["No", "Si", "Suspendido"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleEditPatientField("smokingStatus", opt)}
                    className={`flex-1 text-xs font-bold py-2 rounded-xl border transition-all ${
                      selectedPatient.smokingStatus === opt
                        ? "bg-slate-800 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {selectedPatient.smokingStatus === "Si" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">IPA:</span>
                    <input
                      className="w-20 p-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-500 bg-white"
                      placeholder="Ej: 10"
                      value={selectedPatient.ipa || ""}
                      onChange={(e) => handleEditPatientField("ipa", e.target.value)}
                    />
                  </div>
                  <textarea
                    className="w-full p-3 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500 bg-white min-h-[60px]"
                    placeholder="Descripción (ej: 5 cig/día hace 20 años)..."
                    value={selectedPatient.smokingDetails || ""}
                    onChange={(e) => handleEditPatientField("smokingDetails", e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Alcohol */}
            <div className="space-y-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Alcohol
              </p>
              <div className="flex gap-2">
                {["No", "Si", "Suspendido"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleEditPatientField("alcoholStatus", opt)}
                    className={`flex-1 text-xs font-bold py-2 rounded-xl border transition-all ${
                      selectedPatient.alcoholStatus === opt
                        ? "bg-slate-800 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {selectedPatient.alcoholStatus === "Si" && (
                <textarea
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500 bg-white min-h-[60px]"
                  placeholder="Descripción de consumo (ej: Ocasional, fin de semana)..."
                  value={selectedPatient.alcoholDetails || ""}
                  onChange={(e) => handleEditPatientField("alcoholDetails", e.target.value)}
                />
              )}
            </div>

            {/* Drogas */}
            <div className="space-y-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Drogas
              </p>
              <div className="flex gap-2">
                {["No", "Si", "Suspendido"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleEditPatientField("drugUse", opt)}
                    className={`flex-1 text-xs font-bold py-2 rounded-xl border transition-all ${
                      selectedPatient.drugUse === opt
                        ? "bg-slate-800 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {selectedPatient.drugUse === "Si" && (
                <textarea
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500 bg-white min-h-[60px]"
                  placeholder="Especifique sustancia y frecuencia..."
                  value={selectedPatient.drugDetails || ""}
                  onChange={(e) => handleEditPatientField("drugDetails", e.target.value)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {/* Display Habits */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase">TABACO</span>
              <div className="flex flex-col items-end">
                <span
                  className={`text-[12px] font-black ${selectedPatient.smokingStatus === "Si" ? "text-red-600" : "text-slate-700"}`}
                >
                  {selectedPatient.smokingStatus || "No registrado"}{" "}
                  {selectedPatient.ipa ? `(IPA: ${selectedPatient.ipa})` : ""}
                </span>
                {selectedPatient.smokingDetails && (
                  <span className="text-[10px] text-slate-500 italic mt-0.5">
                    {selectedPatient.smokingDetails}
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase">ALCOHOL</span>
              <div className="flex flex-col items-end">
                <span
                  className={`text-[12px] font-black ${selectedPatient.alcoholStatus === "Si" ? "text-red-600" : "text-slate-700"}`}
                >
                  {selectedPatient.alcoholStatus || "No registrado"}
                </span>
                {selectedPatient.alcoholDetails && (
                  <span className="text-[10px] text-slate-500 italic mt-0.5">
                    {selectedPatient.alcoholDetails}
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase">DROGAS</span>
              <div className="flex flex-col items-end">
                <span
                  className={`text-[12px] font-black ${selectedPatient.drugUse === "Si" ? "text-purple-600" : "text-slate-700"}`}
                >
                  {selectedPatient.drugUse || "No registrado"}
                </span>
                {selectedPatient.drugDetails && (
                  <span className="text-[10px] text-slate-500 italic mt-0.5">
                    {selectedPatient.drugDetails}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fármacos */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <Pill className="w-4 h-4 text-blue-600" /> Fármacos en uso
        </h4>
        <ul className="space-y-2">
          {medications.map((m) => (
            <li
              key={m.id}
              className="text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100 relative group/med shadow-sm"
            >
              <span className="font-black text-slate-800 block text-sm uppercase">{m.name}</span>
              <span className="text-slate-500 text-xs font-bold uppercase tracking-tight">
                {m.dose} • {m.frequency}
              </span>
              {isEditingPatient && !readOnly && (
                <button
                  onClick={() =>
                    handleEditPatientField(
                      "medications",
                      medications.filter((med) => med.id !== m.id)
                    )
                  }
                  className="absolute top-3 right-3 text-slate-300 hover:text-red-500 p-1 bg-white rounded-full shadow-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
          {!medications.length && (
            <p className="text-xs text-slate-400 italic font-medium">No registra fármacos.</p>
          )}
        </ul>
        {isEditingPatient && !readOnly && (
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mt-2 space-y-3">
            <AutocompleteInput
              value={tempMedication.name || ""}
              onChange={(val) => setTempMedication({ ...tempMedication, name: val })}
              options={COMMON_MEDICATIONS}
              placeholder="Nombre Fármaco"
              className="w-full p-2.5 text-xs border border-blue-200 rounded-xl outline-none focus:border-blue-500 bg-white font-bold"
            />
            <div className="flex gap-2">
              <input
                className="w-1/2 p-2.5 text-xs border border-blue-200 rounded-xl bg-white font-bold"
                placeholder="Dosis"
                value={tempMedication.dose}
                onChange={(e) => setTempMedication({ ...tempMedication, dose: e.target.value })}
              />
              <input
                className="w-1/2 p-2.5 text-xs border border-blue-200 rounded-xl bg-white font-bold"
                placeholder="Frecuencia"
                value={tempMedication.frequency}
                onChange={(e) =>
                  setTempMedication({ ...tempMedication, frequency: e.target.value })
                }
              />
            </div>
            <button
              onClick={handleAddMedication}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-sm"
            >
              Agregar
            </button>
          </div>
        )}
      </div>

      {/* Social */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <Users className="w-4 h-4 text-slate-600" /> Antecedentes Sociales
        </h4>

        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Ocupación
              </span>
              {isEditingPatient && !readOnly ? (
                <input
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold"
                  value={selectedPatient.occupation || ""}
                  onChange={(e) => handleEditPatientField("occupation", e.target.value)}
                />
              ) : (
                <p className="text-[13px] font-bold text-slate-700">
                  {selectedPatient.occupation || "-"}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Teléfono
              </span>
              {isEditingPatient && !readOnly ? (
                <input
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold"
                  value={selectedPatient.phone || ""}
                  onChange={(e) => handleEditPatientField("phone", e.target.value)}
                />
              ) : (
                <p className="text-[13px] font-bold text-slate-700">
                  {selectedPatient.phone || "-"}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Dirección / Comuna
            </span>
            {isEditingPatient && !readOnly ? (
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="col-span-2 p-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold"
                  placeholder="Calle..."
                  value={selectedPatient.address || ""}
                  onChange={(e) => handleEditPatientField("address", e.target.value)}
                />
                <select
                  className="p-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold"
                  value={selectedPatient.commune || ""}
                  onChange={(e) => handleEditPatientField("commune", e.target.value)}
                >
                  <option value="">Comuna...</option>
                  {MAULE_COMMUNES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-[13px] font-bold text-slate-700">
                {selectedPatient.address}
                {selectedPatient.commune ? `, ${selectedPatient.commune}` : ""}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Vive Con
            </span>
            {isEditingPatient && !readOnly ? (
              <div className="space-y-2 mt-1">
                <div className="flex flex-wrap gap-1.5">
                  {LIVING_WITH_OPTIONS.filter((o) => o !== "Otro").map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleAddSocial(opt)}
                      className={`text-[10px] px-2 py-1 rounded-lg border font-bold transition-all ${livingWith.includes(opt) ? "bg-slate-800 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <input
                  className="w-full p-2 text-[11px] border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold"
                  placeholder="Otro..."
                  value={customSocial}
                  onChange={(e) => setCustomSocial(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddSocial(customSocial);
                      setCustomSocial("");
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {livingWith.map((person, idx) => (
                  <span
                    key={idx}
                    className="bg-slate-200 px-2 py-0.5 rounded text-[11px] font-black text-slate-700 uppercase"
                  >
                    {person}
                  </span>
                ))}
                {!livingWith.length && (
                  <span className="text-[11px] text-slate-400 italic">No especificado</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Mascotas
            </span>
            {isEditingPatient && !readOnly ? (
              <input
                className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold"
                placeholder="Ej: 2 perros..."
                value={selectedPatient.pets || ""}
                onChange={(e) => handleEditPatientField("pets", e.target.value)}
              />
            ) : (
              <p className="text-[13px] font-bold text-slate-700">
                {selectedPatient.pets || "Sin información"}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Nacionalidad
              </span>
              {isEditingPatient && !readOnly ? (
                <select
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold"
                  value={selectedPatient.nationality || "Chilena"}
                  onChange={(e) => handleEditPatientField("nationality", e.target.value)}
                >
                  {NACIONALIDADES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[13px] font-bold text-slate-700">
                  {selectedPatient.nationality}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Pueblo Originario
              </span>
              {isEditingPatient && !readOnly ? (
                <select
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold"
                  value={selectedPatient.ethnicity || "Ninguno"}
                  onChange={(e) => handleEditPatientField("ethnicity", e.target.value)}
                >
                  {PUEBLOS_ORIGINARIOS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[13px] font-bold text-slate-700">{selectedPatient.ethnicity}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Previsión
            </span>
            {isEditingPatient && !readOnly ? (
              <div className="space-y-2">
                <select
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold"
                  value={selectedPatient.insurance || ""}
                  onChange={(e) => {
                    handleEditPatientField("insurance", e.target.value);
                    if (e.target.value !== "FONASA") handleEditPatientField("insuranceLevel", "");
                  }}
                >
                  <option value="">Seleccione...</option>
                  {INSURANCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {selectedPatient.insurance === "FONASA" && (
                  <div className="flex gap-1.5">
                    {INSURANCE_LEVELS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleEditPatientField("insuranceLevel", level)}
                        className={`flex-1 py-1 px-2 text-[10px] font-black rounded-lg border transition-all ${selectedPatient.insuranceLevel === level ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-slate-500 border-slate-200"}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13px] font-bold text-slate-700 uppercase">
                {selectedPatient.insurance}{" "}
                {selectedPatient.insuranceLevel ? `(${selectedPatient.insuranceLevel})` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-100 pb-10">
        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <FileImage className="w-4 h-4 text-purple-600" /> Archivos y Exámenes
        </h4>
        {!readOnly && (
          <DrivePicker
            targetPatientId={selectedPatient.id}
            currentAttachments={attachments}
            clientId={import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID}
            apiKey={import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY}
          />
        )}
        <ul className="space-y-2 mt-4">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 group transition-all shadow-sm"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-slate-100 p-2 rounded-lg">
                  {att.type === "image" ? (
                    <FileImage className="w-4 h-4 text-purple-600" />
                  ) : (
                    <File className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-[13px] font-bold text-slate-700 w-32">
                    {att.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(att.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onPreviewFile(att)}
                className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <Eye className="w-5 h-5" />
              </button>
            </li>
          ))}
          {!attachments.length && (
            <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400 italic font-medium">No hay archivos.</p>
            </div>
          )}
        </ul>
      </div>
    </aside>
  );
};

export default PatientSidebar;
