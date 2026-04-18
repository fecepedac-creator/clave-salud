import React, { useState, useEffect } from "react";
import { Plus, Activity, X } from "lucide-react";
import {
  Patient,
  Consultation,
  Attachment,
  ExamProfile,
  ClinicalTemplate,
  Doctor,
  RoleId,
  SnomedConcept,
} from "../../../types";
import { generateId } from "../../../utils";

// Components
import PatientSidebar from "../../../components/PatientSidebar";
import ConsultationHistory from "../../../components/ConsultationHistory";
import PrintPreviewModal from "../../../components/PrintPreviewModal";
import ConsultationDetailModal from "../../../components/ConsultationDetailModal";
import ExamOrderModal from "../../../components/ExamOrderModal";
import ClinicalReportModal from "../../../components/ClinicalReportModal";
import { DoctorPatientHeader } from "./DoctorPatientHeader";
import { DoctorKineDashboard } from "./DoctorKineDashboard";
import { ProfessionalConsultationForm } from "./ProfessionalConsultationForm";

import { useToast } from "../../../components/Toast";

// We define a props interface to receive all needed states from DoctorDashboard
export interface DoctorPatientRecordProps {
  selectedPatient: Patient;
  setSelectedPatient: React.Dispatch<React.SetStateAction<Patient | null>>;
  isEditingPatient: boolean;
  setIsEditingPatient: React.Dispatch<React.SetStateAction<boolean>>;
  handleSavePatient: () => void;
  onUpdatePatient: (p: Patient) => void;
  onLogActivity: (event: any) => void;

  activeCenterId: string;
  activeCenter: any;
  hasActiveCenter: boolean;
  moduleGuards: any;

  doctorName: string;
  doctorId: string;
  role: RoleId;
  currentUser?: Doctor;
  isReadOnly: boolean;

  newConsultation: Partial<Consultation>;
  setNewConsultation: React.Dispatch<React.SetStateAction<Partial<Consultation>>>;
  isCreatingConsultation: boolean;
  setIsCreatingConsultation: React.Dispatch<React.SetStateAction<boolean>>;
  diagnoses?: SnomedConcept[];
  addDiagnosis?: (d: string | SnomedConcept) => void;
  removeDiagnosis?: (d: SnomedConcept) => void;
  pinDiagnosis?: (d: SnomedConcept) => void;
  handleVitalsChange: (f: any, v: any) => void;
  handleExamChange: (f: any, v: any) => void;
  handleCreateConsultation: () => Promise<Patient | null>;
  selectedPatientConsultations: Consultation[];
  isUsingLegacyConsultations: boolean;

  docsToPrint: any[];
  setDocsToPrint: React.Dispatch<React.SetStateAction<any[]>>;
  isPrintModalOpen: boolean;
  setIsPrintModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isClinicalReportOpen: boolean;
  setIsClinicalReportOpen: React.Dispatch<React.SetStateAction<boolean>>;

  selectedConsultationForModal: Consultation | null;
  setSelectedConsultationForModal: React.Dispatch<React.SetStateAction<Consultation | null>>;

  isExamOrderModalOpen: boolean;
  setIsExamOrderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  examOrderCatalog: any;

  myExamProfiles: ExamProfile[];
  allExamOptions: any[];
  myTemplates: ClinicalTemplate[];

  sendConsultationByEmail: (c: Consultation) => void;
  safeAgeLabel: (d?: string) => string;

  onSaveExamOrderProfile?: (profile: { label: string; exams: string[] }) => void;
  onDeleteExamOrderProfile?: (id: string) => void;
  savedExamOrderProfiles?: Array<{ id: string; label: string; exams: string[] }>;
}

export const DoctorPatientRecord: React.FC<DoctorPatientRecordProps> = ({
  selectedPatient,
  setSelectedPatient,
  isEditingPatient,
  setIsEditingPatient,
  handleSavePatient,
  onUpdatePatient,
  onLogActivity,
  activeCenterId,
  activeCenter,
  hasActiveCenter,
  moduleGuards,
  doctorName,
  doctorId,
  role,
  currentUser,
  isReadOnly,
  newConsultation,
  setNewConsultation,
  isCreatingConsultation,
  setIsCreatingConsultation,
  diagnoses = [],
  addDiagnosis,
  removeDiagnosis,
  pinDiagnosis,
  handleVitalsChange,
  handleExamChange,
  handleCreateConsultation,
  selectedPatientConsultations,
  isUsingLegacyConsultations,
  docsToPrint,
  setDocsToPrint,
  isPrintModalOpen,
  setIsPrintModalOpen,
  isClinicalReportOpen,
  setIsClinicalReportOpen,
  selectedConsultationForModal,
  setSelectedConsultationForModal,
  isExamOrderModalOpen,
  setIsExamOrderModalOpen,
  examOrderCatalog,
  myExamProfiles,
  allExamOptions,
  myTemplates,
  sendConsultationByEmail,
  safeAgeLabel,
  onSaveExamOrderProfile,
  onDeleteExamOrderProfile,
  savedExamOrderProfiles,
}) => {
  const { showToast } = useToast();

  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [safePdfUrl, setSafePdfUrl] = useState<string>("");

  useEffect(() => {
    if (previewFile && previewFile.type !== "image") {
      if (previewFile.type === "pdf" || previewFile.name.toLowerCase().endsWith(".pdf")) {
        setSafePdfUrl(previewFile.url);
      } else {
        setSafePdfUrl(
          `https://docs.google.com/gview?url=${encodeURIComponent(previewFile.url)}&embedded=true`
        );
      }
    } else {
      setSafePdfUrl("");
    }
  }, [previewFile]);

  return (
    <div className="flex flex-col min-h-screen lg:h-screen font-sans animate-fadeIn">
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewFile(null)}
        >
          <div className="bg-white rounded-xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-slate-100">
              <h3 className="font-bold text-slate-700">{previewFile.name}</h3>
              <button onClick={() => setPreviewFile(null)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-200 p-4 flex items-center justify-center">
              {previewFile.type === "image" ? (
                <img
                  src={previewFile.url}
                  alt="preview"
                  className="max-w-full max-h-full object-contain shadow-lg"
                />
              ) : (
                <iframe
                  src={safePdfUrl}
                  className="w-full h-full bg-white shadow-lg"
                  title="pdf preview"
                ></iframe>
              )}
            </div>
          </div>
        </div>
      )}

      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        docs={docsToPrint}
        doctorName={selectedConsultationForModal?.professionalName || doctorName}
        doctorRut={selectedConsultationForModal?.professionalRut || currentUser?.rut}
        doctorSpecialty={currentUser?.specialty}
        doctorInstitution={currentUser?.university}
        centerName={activeCenter?.name}
        centerLogoUrl={activeCenter?.logoUrl}
        selectedPatient={selectedPatient}
      />

      <ConsultationDetailModal
        isOpen={Boolean(selectedConsultationForModal)}
        consultation={selectedConsultationForModal}
        onClose={() => setSelectedConsultationForModal(null)}
        onPrint={(docs) => {
          setDocsToPrint(docs);
          setIsPrintModalOpen(true);
        }}
      />

      <ExamOrderModal
        isOpen={isExamOrderModalOpen}
        catalog={examOrderCatalog}
        createdBy={doctorId}
        onClose={() => setIsExamOrderModalOpen(false)}
        onSaveProfile={onSaveExamOrderProfile}
        onDeleteProfile={onDeleteExamOrderProfile}
        customProfiles={savedExamOrderProfiles}
        onSave={(docs) => {
          setNewConsultation((prev) => ({
            ...prev,
            prescriptions: [...(prev.prescriptions || []), ...docs],
          }));
          showToast(`${docs.length} orden(es) de exámenes agregadas.`, "success");
        }}
      />

      <ClinicalReportModal
        isOpen={isClinicalReportOpen}
        onClose={() => setIsClinicalReportOpen(false)}
        patient={selectedPatient}
        consultations={selectedPatientConsultations}
        centerName={activeCenter?.name || "Clave Salud"}
        centerLogoUrl={activeCenter?.logoUrl}
        professionalName={doctorName}
        professionalRole={role}
        professionalRut={currentUser?.rut}
        professionalRegistry={currentUser?.clinicalRole}
        examDefinitions={currentUser?.customExams}
      />

      <DoctorPatientHeader
        selectedPatient={selectedPatient}
        setSelectedPatient={setSelectedPatient}
        isEditingPatient={isEditingPatient}
        setIsEditingPatient={setIsEditingPatient}
        handleSavePatient={handleSavePatient}
        onUpdatePatient={onUpdatePatient}
        activeCenterId={activeCenterId}
        activeCenter={activeCenter}
        doctorName={doctorName}
        role={role}
        currentUser={currentUser}
        isReadOnly={isReadOnly}
        safeAgeLabel={safeAgeLabel}
        allExamOptions={allExamOptions}
        selectedPatientConsultations={selectedPatientConsultations}
      />

      <main className="flex-1 lg:overflow-hidden">
        <div className="h-auto lg:h-full w-full grid grid-cols-1 lg:grid-cols-12">
          <PatientSidebar
            selectedPatient={selectedPatient}
            isEditingPatient={isEditingPatient}
            toggleEditPatient={() => {
              if (isEditingPatient) {
                handleSavePatient();
              } else {
                setIsEditingPatient(true);
              }
            }}
            handleEditPatientField={(f, v) =>
              setSelectedPatient((prev) => (prev ? { ...prev, [f]: v } : null))
            }
            onPreviewFile={setPreviewFile}
            readOnly={isReadOnly}
            availableProfiles={myExamProfiles}
            examOptions={allExamOptions}
          />

          <section className="lg:col-span-9 h-auto lg:h-full lg:overflow-y-auto bg-slate-50/30 p-4 lg:p-6">
            {!isCreatingConsultation && (
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">Historial Clínico</h2>
                  <p className="text-slate-500 text-base mt-1 flex items-center gap-2">
                    <span className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded text-xs uppercase font-bold">
                      {role}
                    </span>
                    {selectedPatientConsultations.length} atenciones registradas
                  </p>
                </div>
                {!isReadOnly &&
                  role !== "KINESIOLOGO" &&
                  ([
                    "MEDICO",
                    "ENFERMERA",
                    "NUTRICIONISTA",
                    "PODOLOGO",
                    "ADMIN_CENTRO",
                    "SUPER_ADMIN",
                  ].includes(role as string) ||
                    (role as string).includes("ADMIN")) && (
                    <div className="flex gap-4">
                      <button
                        disabled={!hasActiveCenter}
                        title={hasActiveCenter ? "Crear atención" : "Selecciona un centro activo"}
                        className="bg-primary-600 text-white pl-6 pr-8 py-4 rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 flex items-center gap-2 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="btn-new-morbidity-consultation"
                        onClick={() => {
                          setNewConsultation((prev) => ({
                            ...prev,
                            consultationType: "morbidity",
                          }));
                          setIsCreatingConsultation(true);
                        }}
                      >
                        <Plus className="w-6 h-6" /> Nueva Atención
                      </button>

                      <button
                        disabled={!hasActiveCenter}
                        className="bg-emerald-600 text-white pl-6 pr-8 py-4 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center gap-2 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="btn-new-pscv-consultation"
                        onClick={() => {
                          setNewConsultation((prev) => ({ ...prev, consultationType: "pscv" }));
                          setIsCreatingConsultation(true);
                        }}
                      >
                        <Activity className="w-6 h-6" /> ⚡ Control Cardiovascular
                      </button>
                    </div>
                  )}
              </div>
            )}

            <DoctorKineDashboard
              role={role}
              isCreatingConsultation={isCreatingConsultation}
              selectedPatient={selectedPatient}
              onUpdatePatient={onUpdatePatient}
              setSelectedPatient={setSelectedPatient}
              doctorName={doctorName}
              newConsultation={newConsultation}
              setNewConsultation={setNewConsultation}
              myTemplates={myTemplates}
              hasActiveCenter={hasActiveCenter}
              handleCreateConsultation={handleCreateConsultation}
              setIsPrintModalOpen={setIsPrintModalOpen}
              setDocsToPrint={setDocsToPrint}
              setIsClinicalReportOpen={setIsClinicalReportOpen}
            />

            {isCreatingConsultation ? (
              <ProfessionalConsultationForm
                newConsultation={newConsultation}
                setNewConsultation={setNewConsultation}
                role={role}
                selectedPatient={selectedPatient}
                onUpdatePatient={onUpdatePatient}
                setSelectedPatient={setSelectedPatient}
                selectedPatientConsultations={selectedPatientConsultations}
                allExamOptions={allExamOptions}
                moduleGuards={moduleGuards}
                currentUser={currentUser}
                myExamProfiles={myExamProfiles}
                myTemplates={myTemplates}
                diagnoses={diagnoses}
                addDiagnosis={addDiagnosis}
                removeDiagnosis={removeDiagnosis}
                pinDiagnosis={pinDiagnosis}
                handleVitalsChange={handleVitalsChange}
                handleExamChange={handleExamChange}
                handleCreateConsultation={handleCreateConsultation}
                setIsPrintModalOpen={setIsPrintModalOpen}
                setDocsToPrint={setDocsToPrint}
                setIsClinicalReportOpen={setIsClinicalReportOpen}
                setIsExamOrderModalOpen={setIsExamOrderModalOpen}
                setIsCreatingConsultation={setIsCreatingConsultation}
                hasActiveCenter={hasActiveCenter}
              />
            ) : (
              <>
                {isUsingLegacyConsultations && (
                  <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-semibold">
                    Mostrando historial legacy. Las nuevas atenciones se guardan en subcolección.
                  </div>
                )}
                <ConsultationHistory
                  consultations={selectedPatientConsultations}
                  centerId={activeCenterId}
                  patientId={selectedPatient.id}
                  onOpen={(consultation) => setSelectedConsultationForModal(consultation)}
                  onPrint={(docs) => {
                    setDocsToPrint(docs);
                    setIsPrintModalOpen(true);
                  }}
                  onSendEmail={(c) => {
                    showToast("Abriendo correo...", "info");
                    sendConsultationByEmail(c);
                  }}
                />
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
