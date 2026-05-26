import React, { useState } from "react";
import { Patient, Attachment, Medication, Allergy, ExamProfile, ExamDefinition, SnomedConcept } from "../types";
import {
  MAULE_COMMUNES,
  COMMON_MEDICATIONS,
} from "../constants";
import { generateId, maskPhone } from "../utils";
import {
  Users,
  Activity,
  Scissors,
  FileImage,
  Plus,
  Eye,
  File,
  Pill,
  X,
  AlertCircle,
  TrendingUp,
  CheckCircle,
  Layers,
  Heart,
  Home,
  Briefcase,
  MapPin,
  Phone,
} from "lucide-react";
import AutocompleteInput from "./AutocompleteInput";

const BTN_MEDICAL_HISTORY = [
  { id: "HTA", display: "HTA", code: "38341003" },
  { id: "DM1", display: "DM-1", code: "46635009" },
  { id: "DM2", display: "DM-2", code: "44054006" },
  { id: "DLP", display: "Dislipidemia", code: "370992007" },
  { id: "HIPO", display: "Hipotiroidismo", code: "40930008" },
  { id: "HIPER", display: "Hipertiroidismo", code: "34486009" },
  { id: "EPOC", display: "EPOC", code: "13645005" },
  { id: "ASMA", display: "ASMA", code: "195967001" },
  { id: "ARTROSIS", display: "Artrosis", code: "396275006" },
  { id: "OBESIDAD", display: "Obesidad", code: "414916001" },
];

const BTN_SURGICAL_HISTORY = [
  { id: "APP", display: "Apendicetomía", code: "80146002" },
  { id: "CCY", display: "Colecistectomía", code: "38102005" },
  { id: "TX", display: "Tiroidectomía", code: "77465005" },
  { id: "HYST", display: "Histerectomía", code: "236886002" },
  { id: "CES", display: "Cesárea", code: "200147004" },
];

const LIVING_WITH_BTN_OPTIONS = [
  "Sola",
  "Pareja",
  "Hijos",
  "Padres",
  "Otros familiares"
];

interface PatientSidebarProps {
  selectedPatient: Patient;
  isPiiMasked: boolean;
  isEditingPatient: boolean;
  toggleEditPatient: () => void;
  handleEditPatientField: (field: keyof Patient, value: any) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPreviewFile: (file: Attachment) => void;
  readOnly?: boolean;
  availableProfiles?: ExamProfile[];
  examOptions?: ExamDefinition[];
}

const PatientSidebar: React.FC<PatientSidebarProps> = ({
  selectedPatient,
  isPiiMasked,
  isEditingPatient,
  toggleEditPatient,
  handleEditPatientField,
  onFileUpload,
  onPreviewFile,
  readOnly = false,
  availableProfiles = [],
  examOptions = [],
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

  // Safety accessors & fallbacks
  const medicalHistory = selectedPatient.medicalHistory || [];
  const surgicalHistory = selectedPatient.surgicalHistory || [];
  const medications = selectedPatient.medications || [];
  const allergies = selectedPatient.allergies || [];
  const attachments = selectedPatient.attachments || [];
  const activeExams = selectedPatient.activeExams || [];
  const livingWith = selectedPatient.livingWith || [];

  // Resolving status fields with backward compatibility
  const hasAllergies = selectedPatient.hasAllergies || (allergies.length > 0 ? "Si" : undefined);

  const hasTobacco =
    selectedPatient.hasTobacco ||
    (selectedPatient.smokingStatus === "Fumador actual" ||
    selectedPatient.smokingStatus === "Ex fumador"
      ? "Si"
      : selectedPatient.smokingStatus === "No fumador"
        ? "No"
        : undefined);
  const tobaccoAmount = selectedPatient.tobaccoAmount || 
    (selectedPatient.cigarettesPerDay ? `${selectedPatient.cigarettesPerDay} cig/día` : "");

  const hasAlcohol = selectedPatient.hasAlcohol || 
    (selectedPatient.alcoholStatus === "Frecuente" || selectedPatient.alcoholStatus === "Ocasional" ? "Si" : 
     selectedPatient.alcoholStatus === "No consumo" ? "No" : undefined);
  const alcoholAmount = selectedPatient.alcoholAmount || 
    (selectedPatient.alcoholFrequency ? selectedPatient.alcoholFrequency : "");

  const hasDrugs = selectedPatient.hasDrugs || selectedPatient.drugUse;
  const drugDetails = selectedPatient.drugDetails || "";
  const pets = selectedPatient.pets || "";

  // Functions for medical history
  const isMedicalSelected = (item: typeof BTN_MEDICAL_HISTORY[0]) => {
    return medicalHistory.some((x) => {
      if (typeof x === "string") {
        return x.toLowerCase() === item.display.toLowerCase() || x === item.id;
      }
      return x.code === item.code;
    });
  };

  const toggleMedicalItem = (item: typeof BTN_MEDICAL_HISTORY[0]) => {
    const isSelected = isMedicalSelected(item);
    if (isSelected) {
      handleEditPatientField(
        "medicalHistory",
        medicalHistory.filter((x) => {
          if (typeof x === "string") {
            return x.toLowerCase() !== item.display.toLowerCase() && x !== item.id;
          }
          return x.code !== item.code;
        })
      );
    } else {
      handleEditPatientField("medicalHistory", [
        ...medicalHistory,
        {
          id: item.id,
          code: item.code,
          system: "http://snomed.info/sct",
          display: item.display,
        },
      ]);
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
        { code: "free-text", display: value.trim(), system: null },
      ]);
    }
  };

  // Functions for surgical history
  const isSurgicalSelected = (item: typeof BTN_SURGICAL_HISTORY[0]) => {
    return surgicalHistory.some((x) => {
      if (typeof x === "string") {
        return x.toLowerCase() === item.display.toLowerCase() || x === item.id;
      }
      return x.code === item.code;
    });
  };

  const toggleSurgicalItem = (item: typeof BTN_SURGICAL_HISTORY[0]) => {
    const isSelected = isSurgicalSelected(item);
    if (isSelected) {
      handleEditPatientField(
        "surgicalHistory",
        surgicalHistory.filter((x) => {
          if (typeof x === "string") {
            return x.toLowerCase() !== item.display.toLowerCase() && x !== item.id;
          }
          return x.code !== item.code;
        })
      );
    } else {
      handleEditPatientField("surgicalHistory", [
        ...surgicalHistory,
        {
          id: item.id,
          code: item.code,
          system: "http://snomed.info/sct",
          display: item.display,
        },
      ]);
    }
  };

  const customMedicalItems = medicalHistory.filter((x) => {
    const display = typeof x === "string" ? x : x.display;
    const code = typeof x === "string" ? "" : x.code;
    return !BTN_MEDICAL_HISTORY.some(
      (btn) => btn.code === code || btn.display.toLowerCase() === display.toLowerCase()
    );
  });

  const customSurgicalItems = surgicalHistory.filter((x) => {
    const display = typeof x === "string" ? x : x.display;
    const code = typeof x === "string" ? "" : x.code;
    return !BTN_SURGICAL_HISTORY.some(
      (btn) => btn.code === code || btn.display.toLowerCase() === display.toLowerCase()
    );
  });

  // Allergies
  const handleSetHasAllergies = (val: "Si" | "No") => {
    handleEditPatientField("hasAllergies", val);
    if (val === "No") {
      handleEditPatientField("allergies", []);
    }
  };

  const handleAddAllergy = () => {
    if (!tempAllergy) return;
    const newAllergy: Allergy = {
      id: generateId(),
      type: "Otro",
      substance: tempAllergy.trim(),
      reaction: "",
    };
    handleEditPatientField("allergies", [...allergies, newAllergy]);
    setTempAllergy("");
  };

  // Habits
  const handleSetHasTobacco = (val: "Si" | "No") => {
    handleEditPatientField("hasTobacco", val);
    // Sync with legacy smokingStatus for compatibility
    if (val === "No") {
      handleEditPatientField("smokingStatus", "No fumador");
      handleEditPatientField("tobaccoAmount", "");
      handleEditPatientField("cigarettesPerDay", 0);
    } else {
      handleEditPatientField("smokingStatus", "Fumador actual");
    }
  };

  const handleSetHasAlcohol = (val: "Si" | "No") => {
    handleEditPatientField("hasAlcohol", val);
    // Sync with legacy alcoholStatus
    if (val === "No") {
      handleEditPatientField("alcoholStatus", "No consumo");
      handleEditPatientField("alcoholAmount", "");
      handleEditPatientField("alcoholFrequency", undefined);
    } else {
      handleEditPatientField("alcoholStatus", "Ocasional");
    }
  };

  const handleSetHasDrugs = (val: "Si" | "No") => {
    handleEditPatientField("hasDrugs", val);
    handleEditPatientField("drugUse", val);
    if (val === "No") {
      handleEditPatientField("drugDetails", "");
    }
  };

  // Social
  const toggleSocialBtn = (value: string) => {
    if (livingWith.includes(value)) {
      handleEditPatientField("livingWith", livingWith.filter((x) => x !== value));
    } else {
      handleEditPatientField("livingWith", [...livingWith, value]);
    }
  };

  const handleAddSocial = (value: string) => {
    if (!value) return;
    if (!livingWith.includes(value)) {
      handleEditPatientField("livingWith", [...livingWith, value]);
    }
  };

  // Medications
  const handleAddMedication = () => {
    if (!tempMedication.name) return;
    const newMed: Medication = {
      id: generateId(),
      name: tempMedication.name,
      dose: tempMedication.dose || "",
      frequency: tempMedication.frequency || "",
    };
    handleEditPatientField("medications", [...medications, newMed]);
    setTempMedication({ name: "", dose: "", frequency: "" });
  };

  // Vitals & Exams
  const toggleActiveExam = (examId: string) => {
    if (activeExams.includes(examId)) {
      handleEditPatientField(
        "activeExams",
        activeExams.filter((id) => id !== examId)
      );
    } else {
      handleEditPatientField("activeExams", [...activeExams, examId]);
    }
  };

  const applyProfile = (profileId: string) => {
    const profile = availableProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    const mergedExams = Array.from(new Set([...activeExams, ...profile.exams]));
    handleEditPatientField("activeExams", mergedExams);
  };

  return (
    <aside className="lg:col-span-3 h-full overflow-y-auto bg-slate-50/50 border-r border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg tracking-tight">Ficha Clínica</h3>
          <p className="text-xs text-slate-500 font-medium">Antecedentes generales del paciente</p>
        </div>
        {!readOnly && (
          <button
            onClick={toggleEditPatient}
            className={`text-sm px-4 py-2 rounded-full font-bold transition-all shadow-sm ${
              isEditingPatient
                ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 active:scale-95"
            }`}
          >
            {isEditingPatient ? "Guardar Cambios" : "Editar Datos"}
          </button>
        )}
      </div>

      {/* 2. Antecedentes Mórbidos */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-red-500" /> Antecedentes Mórbidos
        </h4>

        {isEditingPatient && !readOnly ? (
          <div className="space-y-4">
            {/* Quick activate buttons */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Presione para activar/desactivar:</p>
              <div className="flex flex-wrap gap-1.5">
                {BTN_MEDICAL_HISTORY.map((opt) => {
                  const isSelected = isMedicalSelected(opt);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleMedicalItem(opt)}
                      className={`text-xs px-3 py-2 rounded-xl font-bold border transition-all ${
                        isSelected
                          ? "bg-red-500 text-white border-red-600 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt.display}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex gap-2">
              <input
                className="flex-1 p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-red-500 bg-white"
                placeholder="+ Otra patología..."
                value={customMedical}
                onChange={(e) => setCustomMedical(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddHistory("medical", customMedical);
                    setCustomMedical("");
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  handleAddHistory("medical", customMedical);
                  setCustomMedical("");
                }}
                className="bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-600"
              >
                Agregar
              </button>
            </div>

            {/* Display custom items for editing */}
            {customMedicalItems.length > 0 && (
              <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Otras Patologías Ingresadas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {customMedicalItems.map((h, idx) => {
                    const itemId = typeof h === "string" ? h : h.id || h.code || idx.toString();
                    const itemLabel = typeof h === "string" ? h : h.display;
                    return (
                      <span
                        key={itemId}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1"
                      >
                        {itemLabel}
                        <button
                          type="button"
                          onClick={() =>
                            handleEditPatientField(
                              "medicalHistory",
                              medicalHistory.filter((item, i) => {
                                const idToComp = typeof item === "string" ? item : item.id || item.code || i.toString();
                                return idToComp !== itemId;
                              })
                            )
                          }
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Read Mode */
          <div className="flex flex-wrap gap-1.5">
            {medicalHistory.map((h, idx) => {
              const label = typeof h === "string" ? h : h.display;
              const code = typeof h === "string" ? "" : h.code;
              const isPredef = BTN_MEDICAL_HISTORY.some(b => b.display.toLowerCase() === label.toLowerCase() || b.code === code);
              return (
                <span
                  key={idx}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 ${
                    isPredef
                      ? "bg-red-50 text-red-700 border-red-100"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                  title={code ? `SNOMED: ${code}` : "Texto libre"}
                >
                  {isPredef && <Activity className="w-3 h-3 text-red-500" />}
                  {label}
                </span>
              );
            })}
            {medicalHistory.length === 0 && (
              <p className="text-xs text-slate-400 italic">Sin antecedentes patológicos declarados.</p>
            )}
          </div>
        )}
      </div>

      {/* 3. Antecedentes Quirúrgicos */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Scissors className="w-4 h-4 text-indigo-500" /> Antecedentes Quirúrgicos
        </h4>

        {isEditingPatient && !readOnly ? (
          <div className="space-y-4">
            {/* Quick activate buttons */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Presione para activar/desactivar:</p>
              <div className="flex flex-wrap gap-1.5">
                {BTN_SURGICAL_HISTORY.map((opt) => {
                  const isSelected = isSurgicalSelected(opt);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleSurgicalItem(opt)}
                      className={`text-xs px-3 py-2 rounded-xl font-bold border transition-all ${
                        isSelected
                          ? "bg-indigo-500 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt.display}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex gap-2">
              <input
                className="flex-1 p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-indigo-500 bg-white"
                placeholder="+ Otra cirugía..."
                value={customSurgical}
                onChange={(e) => setCustomSurgical(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddHistory("surgical", customSurgical);
                    setCustomSurgical("");
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  handleAddHistory("surgical", customSurgical);
                  setCustomSurgical("");
                }}
                className="bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-indigo-600"
              >
                Agregar
              </button>
            </div>

            {/* Display custom items for editing */}
            {customSurgicalItems.length > 0 && (
              <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Otras Cirugías Ingresadas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {customSurgicalItems.map((h, idx) => {
                    const itemId = typeof h === "string" ? h : h.id || h.code || idx.toString();
                    const itemLabel = typeof h === "string" ? h : h.display;
                    return (
                      <span
                        key={itemId}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1"
                      >
                        {itemLabel}
                        <button
                          type="button"
                          onClick={() =>
                            handleEditPatientField(
                              "surgicalHistory",
                              surgicalHistory.filter((item, i) => {
                                const idToComp = typeof item === "string" ? item : item.id || item.code || i.toString();
                                return idToComp !== itemId;
                              })
                            )
                          }
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Read Mode */
          <div className="flex flex-wrap gap-1.5">
            {surgicalHistory.map((h, idx) => {
              const label = typeof h === "string" ? h : h.display;
              const code = typeof h === "string" ? "" : h.code;
              const isPredef = BTN_SURGICAL_HISTORY.some(b => b.display.toLowerCase() === label.toLowerCase() || b.code === code);
              return (
                <span
                  key={idx}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 ${
                    isPredef
                      ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                  title={code ? `SNOMED: ${code}` : "Texto libre"}
                >
                  {isPredef && <Scissors className="w-3 h-3 text-indigo-500" />}
                  {label}
                </span>
              );
            })}
            {surgicalHistory.length === 0 && (
              <p className="text-xs text-slate-400 italic">Sin antecedentes quirúrgicos declarados.</p>
            )}
          </div>
        )}
      </div>

      {/* 4. Alergias */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" /> Alergias
        </h4>

        {isEditingPatient && !readOnly ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">¿Presenta Alergias?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSetHasAllergies("Si")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                    hasAllergies === "Si"
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  SI
                </button>
                <button
                  type="button"
                  onClick={() => handleSetHasAllergies("No")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                    hasAllergies === "No"
                      ? "bg-slate-700 text-white border-slate-800 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  NO
                </button>
              </div>
            </div>

            {hasAllergies === "Si" && (
              <div className="space-y-3 pt-2.5 border-t border-slate-100">
                {/* List current allergies with X */}
                {allergies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allergies.map((al) => (
                      <span
                        key={al.id}
                        className="px-2.5 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-100 flex items-center gap-1"
                      >
                        {al.substance}
                        <button
                          type="button"
                          onClick={() =>
                            handleEditPatientField(
                              "allergies",
                              allergies.filter((x) => x.id !== al.id)
                            )
                          }
                          className="text-amber-500 hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add new allergy */}
                <div className="flex gap-2">
                  <input
                    className="flex-1 p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-amber-500 bg-white"
                    placeholder="Nueva sustancia/alérgeno..."
                    value={tempAllergy}
                    onChange={(e) => setTempAllergy(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddAllergy();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddAllergy}
                    className="bg-amber-500 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-600"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Read Mode */
          <div>
            {hasAllergies === "No" ? (
              <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl border border-slate-200 font-bold block text-center">
                Sin alergias conocidas
              </span>
            ) : allergies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {allergies.map((al) => (
                  <span
                    key={al.id}
                    className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl border border-amber-100 flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    {al.substance}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No registrado.</p>
            )}
          </div>
        )}
      </div>

      {/* 5. Hábitos */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500" /> Hábitos y Estilo de Vida
        </h4>

        {isEditingPatient && !readOnly ? (
          <div className="space-y-4 divide-y divide-slate-100">
            {/* Tabaco */}
            <div className="pt-0 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tabaco</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSetHasTobacco("Si")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    hasTobacco === "Si"
                      ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  SI
                </button>
                <button
                  type="button"
                  onClick={() => handleSetHasTobacco("No")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    hasTobacco === "No"
                      ? "bg-slate-700 text-white border-slate-800 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  NO
                </button>
              </div>
              {hasTobacco === "Si" && (
                <input
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-rose-500 bg-white"
                  placeholder="Cuanto? (ej. 5 cigarrillos al dia)"
                  value={tobaccoAmount}
                  onChange={(e) => handleEditPatientField("tobaccoAmount", e.target.value)}
                />
              )}
            </div>

            {/* Alcohol */}
            <div className="pt-3 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alcohol (OH)</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSetHasAlcohol("Si")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    hasAlcohol === "Si"
                      ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  SI
                </button>
                <button
                  type="button"
                  onClick={() => handleSetHasAlcohol("No")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    hasAlcohol === "No"
                      ? "bg-slate-700 text-white border-slate-800 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  NO
                </button>
              </div>
              {hasAlcohol === "Si" && (
                <input
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-rose-500 bg-white"
                  placeholder="Cuanto y frecuencia? (ej. 1 copa ocasional)"
                  value={alcoholAmount}
                  onChange={(e) => handleEditPatientField("alcoholAmount", e.target.value)}
                />
              )}
            </div>

            {/* Otras Sustancias / Drogas */}
            <div className="pt-3 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Otras Sustancias</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSetHasDrugs("Si")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    hasDrugs === "Si"
                      ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  SI
                </button>
                <button
                  type="button"
                  onClick={() => handleSetHasDrugs("No")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    hasDrugs === "No"
                      ? "bg-slate-700 text-white border-slate-800 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  NO
                </button>
              </div>
              {hasDrugs === "Si" && (
                <textarea
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-rose-500 bg-white min-h-[60px]"
                  placeholder="Especifique que sustancia y cantidad..."
                  value={drugDetails}
                  onChange={(e) => handleEditPatientField("drugDetails", e.target.value)}
                />
              )}
            </div>
          </div>
        ) : (
          /* Read Mode */
          <div className="grid grid-cols-1 gap-2">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">TABACO</span>
              <span className="text-xs font-extrabold text-slate-700">
                {hasTobacco === "Si" ? `SI (${tobaccoAmount || "No especifica cantidad"})` : hasTobacco === "No" ? "NO" : "No registrado"}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">ALCOHOL</span>
              <span className="text-xs font-extrabold text-slate-700">
                {hasAlcohol === "Si" ? `SI (${alcoholAmount || "No especifica cantidad"})` : hasAlcohol === "No" ? "NO" : "No registrado"}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">OTRAS SUSTANCIAS</span>
              <span className="text-xs font-extrabold text-slate-700">
                {hasDrugs === "Si" ? `SI (${drugDetails || "No especifica"})` : hasDrugs === "No" ? "NO" : "No registrado"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 6. Fármacos en uso */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Pill className="w-4 h-4 text-blue-500" /> Fármacos en Uso Permanente
        </h4>

        <div className="space-y-3">
          {medications.map((m) => (
            <div
              key={m.id}
              className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 relative group"
            >
              <span className="font-extrabold text-slate-700 block text-sm">{m.name}</span>
              <span className="text-slate-500 font-medium">
                {m.dose} • {m.frequency}
              </span>
              {isEditingPatient && !readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    handleEditPatientField(
                      "medications",
                      medications.filter((med) => med.id !== m.id)
                    )
                  }
                  className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1 bg-white rounded-full border border-slate-150 shadow-sm transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {medications.length === 0 && (
            <p className="text-xs text-slate-400 italic">No hay fármacos permanentes registrados.</p>
          )}
        </div>

        {isEditingPatient && !readOnly && (
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mt-2 space-y-2.5">
            <p className="text-xs font-bold text-blue-800">Agregar Medicamento:</p>
            <AutocompleteInput
              value={tempMedication.name || ""}
              onChange={(val) => setTempMedication({ ...tempMedication, name: val })}
              options={COMMON_MEDICATIONS}
              placeholder="Nombre del fármaco..."
              className="w-full p-2.5 text-xs border border-blue-200 rounded-lg outline-none bg-white focus:border-blue-500"
            />
            <div className="flex gap-2">
              <input
                className="w-1/2 p-2.5 text-xs border border-blue-250 rounded-lg outline-none bg-white focus:border-blue-500"
                placeholder="Dosis (ej. 50 mg)"
                value={tempMedication.dose}
                onChange={(e) => setTempMedication({ ...tempMedication, dose: e.target.value })}
              />
              <input
                className="w-1/2 p-2.5 text-xs border border-blue-250 rounded-lg outline-none bg-white focus:border-blue-500"
                placeholder="Frecuencia (ej. cada 12 hrs)"
                value={tempMedication.frequency}
                onChange={(e) =>
                  setTempMedication({ ...tempMedication, frequency: e.target.value })
                }
              />
            </div>
            <button
              type="button"
              onClick={handleAddMedication}
              className="w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              Agregar Fármaco
            </button>
          </div>
        )}
      </div>

      {/* 8. Datos Sociales */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-600" /> Datos Sociales y de Contacto
        </h4>
        <div className="space-y-4">
          {/* Actividad */}
          <div className="text-xs text-slate-700 space-y-1">
            <span className="font-bold block text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" /> Actividad / Ocupación
            </span>
            {isEditingPatient && !readOnly ? (
              <input
                className="w-full p-2.5 border border-slate-350 rounded-xl outline-none focus:border-blue-500 bg-white"
                value={selectedPatient.occupation || ""}
                onChange={(e) => handleEditPatientField("occupation", e.target.value)}
              />
            ) : (
              <span className="text-slate-800 font-semibold text-sm bg-slate-50 p-2.5 rounded-xl block border border-slate-100">
                {selectedPatient.occupation || "No registrada"}
              </span>
            )}
          </div>

          {/* Con quién vive */}
          <div className="text-xs text-slate-700 space-y-1">
            <span className="font-bold block text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-slate-400" /> Con Quién Vive
            </span>
            {isEditingPatient && !readOnly ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {LIVING_WITH_BTN_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleSocialBtn(opt)}
                      className={`text-xs px-2.5 py-1.5 rounded-xl border font-bold transition-all ${
                        livingWith.includes(opt)
                          ? "bg-slate-700 text-white border-slate-800 shadow-sm"
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white"
                    placeholder="+ Agregar otra persona..."
                    value={customSocial}
                    onChange={(e) => setCustomSocial(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSocial(customSocial);
                        setCustomSocial("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleAddSocial(customSocial);
                      setCustomSocial("");
                    }}
                    className="bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800"
                  >
                    +
                  </button>
                </div>

                {/* Display co-habitants for edit */}
                {livingWith.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                    {livingWith.map((person, idx) => (
                      <span
                        key={idx}
                        className="bg-white px-2 py-1 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 flex items-center gap-1"
                      >
                        {person}
                        <button
                          type="button"
                          onClick={() =>
                            handleEditPatientField(
                              "livingWith",
                              livingWith.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Read Mode for Living With */
              <div className="flex flex-wrap gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                {livingWith.map((person, idx) => (
                  <span
                    key={idx}
                    className="bg-white px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 border border-slate-200/60"
                  >
                    {person}
                  </span>
                ))}
                {livingWith.length === 0 && (
                  <span className="text-slate-400 italic">No especificado</span>
                )}
              </div>
            )}
          </div>

          {/* Dirección */}
          <div className="text-xs text-slate-700 space-y-1">
            <span className="font-bold block text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Dirección
            </span>
            {isEditingPatient && !readOnly ? (
              <input
                className="w-full p-2.5 border border-slate-350 rounded-xl outline-none focus:border-blue-500 bg-white"
                value={selectedPatient.address || ""}
                onChange={(e) => handleEditPatientField("address", e.target.value)}
              />
            ) : (
              <span className="text-slate-800 font-semibold text-sm bg-slate-50 p-2.5 rounded-xl block border border-slate-100">
                {selectedPatient.address || "No registrada"}
              </span>
            )}
          </div>

          {/* Comuna */}
          <div className="text-xs text-slate-700 space-y-1">
            <span className="font-bold block text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Comuna
            </span>
            {isEditingPatient && !readOnly ? (
              <select
                className="w-full p-2.5 border border-slate-350 rounded-xl outline-none focus:border-blue-500 bg-white"
                value={selectedPatient.commune || ""}
                onChange={(e) => handleEditPatientField("commune", e.target.value)}
              >
                <option value="">Seleccione...</option>
                {MAULE_COMMUNES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-slate-800 font-semibold text-sm bg-slate-50 p-2.5 rounded-xl block border border-slate-100">
                {selectedPatient.commune || "No especificada"}
              </span>
            )}
          </div>

          {/* Teléfono */}
          <div className="text-xs text-slate-700 space-y-1">
            <span className="font-bold block text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> Teléfono
            </span>
            {isEditingPatient && !readOnly ? (
              <input
                className="w-full p-2.5 border border-slate-350 rounded-xl outline-none focus:border-blue-500 bg-white"
                value={selectedPatient.phone || ""}
                onChange={(e) => handleEditPatientField("phone", e.target.value)}
              />
            ) : (
              <span className="text-slate-800 font-semibold text-sm bg-slate-50 p-2.5 rounded-xl block border border-slate-100">
                {isPiiMasked ? maskPhone(selectedPatient.phone || "") : (selectedPatient.phone || "-")}
              </span>
            )}
          </div>

          {/* Mascotas */}
          <div className="text-xs text-slate-700 space-y-1">
            <span className="font-bold block text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-450" /> Mascotas
            </span>
            {isEditingPatient && !readOnly ? (
              <input
                className="w-full p-2.5 border border-slate-350 rounded-xl outline-none focus:border-blue-500 bg-white"
                placeholder="Perros, gatos, etc."
                value={pets}
                onChange={(e) => handleEditPatientField("pets", e.target.value)}
              />
            ) : (
              <span className="text-slate-800 font-semibold text-sm bg-slate-50 p-2.5 rounded-xl block border border-slate-100">
                {pets || "No registradas"}
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default PatientSidebar;

