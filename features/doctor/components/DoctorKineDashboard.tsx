import React, { useState } from "react";
import { Plus, Activity, History, Calendar, Save } from "lucide-react";
import {
  Patient,
  KinesiologyProgram,
  KinesiologySession,
  Consultation,
  ClinicalTemplate,
  RoleId,
} from "../../../types";
import { generateId } from "../../../utils";
import PrescriptionManager from "../../../components/PrescriptionManager";
import { StartProgramModal, SessionModal } from "../../../components/KinesiologyModals";
import { useToast } from "../../../components/Toast";

interface DoctorKineDashboardProps {
  role: RoleId;
  isCreatingConsultation: boolean;
  selectedPatient: Patient;
  onUpdatePatient: (p: Patient) => void;
  setSelectedPatient: (p: Patient | null) => void;
  doctorName: string;
  newConsultation: Partial<Consultation>;
  setNewConsultation: React.Dispatch<React.SetStateAction<Partial<Consultation>>>;
  myTemplates: ClinicalTemplate[];
  hasActiveCenter: boolean;
  handleCreateConsultation: () => Promise<Patient | null>;
  setIsPrintModalOpen: (s: boolean) => void;
  setDocsToPrint: (docs: any[]) => void;
  setIsClinicalReportOpen: (s: boolean) => void;
}

export const DoctorKineDashboard: React.FC<DoctorKineDashboardProps> = ({
  role,
  isCreatingConsultation,
  selectedPatient,
  onUpdatePatient,
  setSelectedPatient,
  doctorName,
  newConsultation,
  setNewConsultation,
  myTemplates,
  hasActiveCenter,
  handleCreateConsultation,
  setIsPrintModalOpen,
  setDocsToPrint,
  setIsClinicalReportOpen,
}) => {
  const { showToast } = useToast();

  // Manage states locally
  const [isKineProgramModalOpen, setIsKineProgramModalOpen] = useState(false);
  const [isKineSessionModalOpen, setIsKineSessionModalOpen] = useState(false);
  const [selectedKineProgram, setSelectedKineProgram] = useState<KinesiologyProgram | null>(null);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);

  const handleCreateKineProgram = async (p: Patient, type: string, diagnosis: string) => {
    const newProgram: KinesiologyProgram = {
      id: generateId(),
      patientId: p.id,
      type: type as any,
      diagnosis,
      clinicalCondition: "",
      objectives: [],
      totalSessions: 10,
      professionalName: doctorName,
      status: "active",
      createdAt: new Date().toISOString(),
      sessions: [],
    };
    const updated = { ...p, kinePrograms: [...(p.kinePrograms || []), newProgram] };
    onUpdatePatient(updated);
    setIsKineProgramModalOpen(false);
    showToast("Programa iniciado", "success");
  };

  const handleSaveKineSession = async (
    p: Patient,
    programId: string,
    session: Partial<KinesiologySession>
  ) => {
    const newSession: KinesiologySession = {
      id: generateId(),
      date: new Date().toISOString(),
      professionalName: doctorName,
      ...session,
    } as KinesiologySession;
    const updatedPrograms = (p.kinePrograms || []).map((prog) =>
      prog.id === programId ? { ...prog, sessions: [...prog.sessions, newSession] } : prog
    );
    const updatedPatient = { ...p, kinePrograms: updatedPrograms };
    onUpdatePatient(updatedPatient);
    setIsKineSessionModalOpen(false);
    showToast("Sesión guardada", "success");
  };

  if (role !== "KINESIOLOGO" || isCreatingConsultation) return null;

  return (
    <>
      <div className="flex justify-end mb-8">
        <div className="flex gap-4">
          <button
            onClick={() => setIsKineProgramModalOpen(true)}
            disabled={!hasActiveCenter}
            className="bg-indigo-600 text-white pl-6 pr-8 py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-6 h-6" /> Nuevo Programa
          </button>
        </div>
      </div>

      {(selectedPatient.kinePrograms?.length || 0) > 0 && (
        <div className="mb-8 space-y-4">
          <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">
            Programas Activos
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {selectedPatient.kinePrograms?.map((prog) => (
              <div
                key={prog.id}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${prog.type.includes("motora") ? "bg-indigo-100 text-indigo-700" : "bg-cyan-100 text-cyan-700"}`}
                      >
                        {prog.type}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {new Date(prog.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg">{prog.diagnosis}</h4>
                    <p className="text-slate-500 text-sm">
                      {prog.sessions?.length || 0} / {prog.totalSessions} Sesiones realizadas
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        setExpandedProgramId(expandedProgramId === prog.id ? null : prog.id)
                      }
                      className={`px-4 py-2.5 font-bold rounded-xl flex items-center gap-2 transition-colors ${expandedProgramId === prog.id ? "bg-slate-100 text-slate-700" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      <History className="w-4 h-4" />{" "}
                      {expandedProgramId === prog.id ? "Ocultar Historial" : "Ver Historial"}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedKineProgram(prog);
                        setIsKineSessionModalOpen(true);
                      }}
                      className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 flex items-center gap-2"
                    >
                      <Activity className="w-4 h-4" /> Registrar Sesión
                    </button>
                  </div>
                </div>
                {expandedProgramId === prog.id && (
                  <div className="border-t border-slate-100 pt-4 animate-fadeIn">
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                      Historial de Sesiones
                    </h5>
                    {!prog.sessions || prog.sessions.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">
                        No hay sesiones registradas aún.
                      </p>
                    ) : (
                      <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {prog.sessions
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((session, idx) => (
                            <div key={session.id || idx} className="relative pl-8">
                              <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-indigo-100 border-2 border-indigo-500"></div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-slate-700 text-sm">
                                    Sesión #{session.sessionNumber}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {new Date(session.date).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="text-sm text-slate-600 space-y-1">
                                  {session.observations && (
                                    <p>
                                      <strong className="text-slate-500">Obs:</strong>{" "}
                                      {session.observations}
                                    </p>
                                  )}
                                  {session.techniques && session.techniques.length > 0 && (
                                    <p>
                                      <strong className="text-slate-500">Técnicas:</strong>{" "}
                                      {session.techniques.join(", ")}
                                    </p>
                                  )}
                                  <div className="flex gap-4 mt-2">
                                    {session.tolerance && (
                                      <span className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                                        Tol: {session.tolerance}
                                      </span>
                                    )}
                                    {session.response && (
                                      <span className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                                        Resp: {session.response}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-8 animate-fadeIn">
        <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
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
            templates={myTemplates}
            role={role}
            currentDiagnosis={selectedPatient.kinePrograms?.[0]?.diagnosis || ""}
          />
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="text-secondary-900 font-bold text-lg uppercase tracking-wider mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Próximo Control
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-lg font-bold text-slate-700 mb-3">Fecha Estimada</label>
              <input
                type="date"
                value={newConsultation.nextControlDate || ""}
                onChange={(e) =>
                  setNewConsultation((prev) => ({
                    ...prev,
                    nextControlDate: e.target.value,
                  }))
                }
                className="w-full p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-secondary-500 bg-slate-50 text-lg"
              />
            </div>
            <div>
              <label className="block text-lg font-bold text-slate-700 mb-3">
                Indicaciones / Requisitos
              </label>
              <input
                placeholder="Ej: Traer radiografía..."
                value={newConsultation.nextControlReason || ""}
                onChange={(e) =>
                  setNewConsultation((prev) => ({
                    ...prev,
                    nextControlReason: e.target.value,
                  }))
                }
                className="w-full p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-secondary-500 bg-slate-50 text-lg"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-4 pb-12">
          <button
            onClick={async () => {
              const updatedPatient = await handleCreateConsultation();
              if (updatedPatient) setSelectedPatient(updatedPatient);
            }}
            disabled={
              !hasActiveCenter ||
              (!newConsultation.prescriptions?.length && !newConsultation.nextControlDate)
            }
            className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-3 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-6 h-6" /> Guardar Gestión / Documentos
          </button>
        </div>
      </div>

      <StartProgramModal
        isOpen={isKineProgramModalOpen}
        onClose={() => setIsKineProgramModalOpen(false)}
        onConfirm={(t, d) => handleCreateKineProgram(selectedPatient, t, d)}
      />
      {selectedKineProgram && (
        <SessionModal
          isOpen={isKineSessionModalOpen}
          onClose={() => {
            setIsKineSessionModalOpen(false);
            setSelectedKineProgram(null);
          }}
          program={selectedKineProgram}
          sessionNumber={(selectedKineProgram.sessions?.length || 0) + 1}
          onSave={(s) => handleSaveKineSession(selectedPatient, selectedKineProgram.id, s)}
        />
      )}
    </>
  );
};
