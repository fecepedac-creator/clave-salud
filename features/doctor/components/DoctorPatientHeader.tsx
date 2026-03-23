import React from "react";
import { ChevronRight, Edit, Save } from "lucide-react";
import { Patient, Consultation, Doctor, RoleId } from "../../../types";
import { formatPersonName } from "../../../utils";
import BioMarkers from "../../../components/BioMarkers";
import PatientDetail from "../../../components/PatientDetail";

interface DoctorPatientHeaderProps {
  selectedPatient: Patient;
  setSelectedPatient: React.Dispatch<React.SetStateAction<Patient | null>>;
  isEditingPatient: boolean;
  setIsEditingPatient: (state: boolean) => void;
  handleSavePatient: () => void;
  onUpdatePatient: (p: Patient) => void;
  activeCenterId: string;
  activeCenter: any;
  doctorName: string;
  role: RoleId;
  currentUser?: Doctor;
  isReadOnly: boolean;
  safeAgeLabel: (d?: string) => string;
  allExamOptions: any[];
  selectedPatientConsultations: Consultation[];
}

export const DoctorPatientHeader: React.FC<DoctorPatientHeaderProps> = ({
  selectedPatient,
  setSelectedPatient,
  isEditingPatient,
  setIsEditingPatient,
  handleSavePatient,
  onUpdatePatient,
  activeCenterId,
  activeCenter,
  doctorName,
  role,
  currentUser,
  isReadOnly,
  safeAgeLabel,
  allExamOptions,
  selectedPatientConsultations,
}) => {
  return (
    <header className="bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/90 pt-20 lg:pt-16">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedPatient(null)}
          className="text-slate-400 hover:text-slate-700 transition-colors p-2 hover:bg-slate-100/50 rounded-full"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        {selectedPatient.attachments?.filter(
          (a) =>
            a.type === "profile_picture" ||
            (a.type === "image" && a.name.toLowerCase().includes("perfil"))
        ).length ? (
          <img
            src={
              selectedPatient.attachments
                .filter(
                  (a) =>
                    a.type === "profile_picture" ||
                    (a.type === "image" && a.name.toLowerCase().includes("perfil"))
                )
                .pop()?.url
            }
            alt="Profile"
            className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 shadow-sm"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg border-2 border-indigo-200 shadow-sm uppercase">
            {selectedPatient.fullName.substring(0, 2)}
          </div>
        )}
        <div>
          {isEditingPatient ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  data-testid="edit-patient-name"
                  className="text-2xl font-bold text-slate-800 border-b-2 border-primary-300 outline-none bg-transparent w-full md:w-96 focus:border-primary-500 transition-colors"
                  value={selectedPatient.fullName}
                  onChange={(e) =>
                    setSelectedPatient((prev) =>
                      prev ? { ...prev, fullName: e.target.value } : null
                    )
                  }
                  placeholder="Nombre Completo"
                />
                <input
                  data-testid="edit-patient-rut"
                  className="text-sm font-mono border-b-2 border-primary-300 outline-none bg-transparent w-32 focus:border-primary-500 transition-colors"
                  value={selectedPatient.rut}
                  onChange={(e) =>
                    setSelectedPatient((prev) => (prev ? { ...prev, rut: e.target.value } : null))
                  }
                  placeholder="RUT"
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="date"
                  className="bg-transparent border-b border-slate-300 outline-none text-slate-600 focus:border-primary-500"
                  value={selectedPatient.birthDate ? selectedPatient.birthDate.split("T")[0] : ""}
                  onChange={(e) =>
                    setSelectedPatient((prev) =>
                      prev ? { ...prev, birthDate: e.target.value } : null
                    )
                  }
                />
                <select
                  className="bg-transparent border-b border-slate-300 outline-none text-slate-600 focus:border-primary-500"
                  value={selectedPatient.gender}
                  onChange={(e) =>
                    setSelectedPatient((prev) =>
                      prev ? { ...prev, gender: e.target.value as any } : null
                    )
                  }
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
                <select
                  className="bg-transparent border-b border-slate-300 outline-none text-slate-600 focus:border-primary-500"
                  value={selectedPatient.genderIdentity}
                  onChange={(e) =>
                    setSelectedPatient((prev) =>
                      prev ? { ...prev, genderIdentity: e.target.value } : null
                    )
                  }
                >
                  <option value="Identidad de género no declarada">No declarada</option>
                  <option value="Mujer Trans">Mujer Trans</option>
                  <option value="Hombre Trans">Hombre Trans</option>
                  <option value="Persona No Binaria">No Binaria</option>
                  <option value="Género Fluido">Género Fluido</option>
                  <option value="Cisgénero">Cisgénero</option>
                </select>
                <select
                  className="bg-transparent border-b border-slate-300 outline-none text-slate-600 focus:border-primary-500 font-bold"
                  value={selectedPatient.insurance || ""}
                  onChange={(e) =>
                    setSelectedPatient((prev) =>
                      prev
                        ? {
                            ...prev,
                            insurance: e.target.value as any,
                            insuranceLevel:
                              e.target.value === "FONASA"
                                ? prev.insuranceLevel || "A"
                                : prev.insuranceLevel,
                          }
                        : null
                    )
                  }
                >
                  <option value="" disabled>
                    Seleccione Previsión...
                  </option>
                  <option value="FONASA">FONASA</option>
                  <option value="ISAPRE">ISAPRE</option>
                  <option value="Particular">Particular</option>
                  <option value="DIPRECA">DIPRECA</option>
                  <option value="CAPREDENA">CAPREDENA</option>
                  <option value="SISA">SISA</option>
                  <option value="Otro">Otro</option>
                </select>
                {selectedPatient.insurance === "FONASA" && (
                  <select
                    className="bg-transparent border-b border-slate-300 outline-none text-slate-600 focus:border-primary-500 font-bold"
                    value={selectedPatient.insuranceLevel || "A"}
                    onChange={(e) =>
                      setSelectedPatient((prev) =>
                        prev ? { ...prev, insuranceLevel: e.target.value } : null
                      )
                    }
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                )}
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 group leading-none">
                {formatPersonName(selectedPatient.fullName)}
                <span className="px-4 py-1 bg-indigo-50 text-indigo-700 text-xl rounded-full font-mono font-black border-2 border-indigo-100 shadow-md tracking-tighter">
                  {selectedPatient.rut}
                </span>
                {!isReadOnly && (
                  <button
                    onClick={() => setIsEditingPatient(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 hover:bg-slate-200 text-slate-600 p-1 rounded-full"
                    title="Editar datos básicos"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                  {safeAgeLabel(selectedPatient.birthDate)}
                </span>
                <span className="bg-indigo-50 px-2 py-0.5 rounded text-indigo-700 border border-indigo-100">
                  {selectedPatient.gender}{" "}
                  {selectedPatient.genderIdentity &&
                    selectedPatient.genderIdentity !== "Identidad de género no declarada" &&
                    `(${selectedPatient.genderIdentity})`}
                </span>
                {selectedPatient.insurance && (
                  <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-700 border border-emerald-100 flex items-center gap-1 font-bold">
                    {selectedPatient.insurance}
                    {selectedPatient.insurance === "FONASA" &&
                      selectedPatient.insuranceLevel &&
                      ` (${selectedPatient.insuranceLevel})`}
                  </span>
                )}
                <BioMarkers
                  activeExams={selectedPatient.activeExams || []}
                  consultations={selectedPatientConsultations}
                  examOptions={allExamOptions}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isEditingPatient ? (
          <button
            type="button"
            data-testid="btn-save-patient-header"
            onClick={handleSavePatient}
            className="bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors"
            title="Guardar cambios"
          >
            <Save className="w-5 h-5" /> Guardar Cambios
          </button>
        ) : (
          <PatientDetail
            patient={selectedPatient}
            centerId={activeCenterId}
            center={activeCenter ?? null}
            consultations={selectedPatientConsultations}
            generatedBy={{ name: doctorName, rut: currentUser?.rut, role }}
            onUpdatePatient={(nextPatient) => {
              onUpdatePatient(nextPatient);
              setSelectedPatient(nextPatient);
            }}
          />
        )}
      </div>
    </header>
  );
};
