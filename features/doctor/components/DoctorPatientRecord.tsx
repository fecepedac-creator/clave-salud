import React, { useMemo, useState, useEffect } from "react";
import {
    ChevronRight,
    ChevronDown,
    Edit,
    Save,
    Plus,
    History,
    Activity,
    Calendar,
    FileText,
    X,
    ExternalLink,
} from "lucide-react";
import { Patient, Consultation, Attachment, ExamProfile, ClinicalTemplate, Doctor, ProfessionalRole, KinesiologyProgram, KinesiologySession } from "../../../types";
import { generateId, formatPersonName, normalizePhone, getProfessionalPrefix } from "../../../utils";
import { COMMON_DIAGNOSES } from "../../../constants";

// Components
import LogoHeader from "../../../components/LogoHeader";
import BioMarkers from "../../../components/BioMarkers";
import PatientDetail from "../../../components/PatientDetail";
import PatientSidebar from "../../../components/PatientSidebar";
import PrescriptionManager from "../../../components/PrescriptionManager";
import { StartProgramModal, SessionModal } from "../../../components/KinesiologyModals";
import { ExamSheetsSection } from "../../../components/ExamSheetsSection";
import VitalsForm from "../../../components/VitalsForm";
import Odontogram from "../../../components/Odontogram";
import Podogram from "../../../components/Podogram";
import AutocompleteInput from "../../../components/AutocompleteInput";
import ConsultationHistory from "../../../components/ConsultationHistory";
import PrintPreviewModal from "../../../components/PrintPreviewModal";
import ConsultationDetailModal from "../../../components/ConsultationDetailModal";
import ExamOrderModal from "../../../components/ExamOrderModal";
import ClinicalReportModal from "../../../components/ClinicalReportModal";

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
    role: ProfessionalRole;
    currentUser?: Doctor;
    isReadOnly: boolean;

    newConsultation: Partial<Consultation>;
    setNewConsultation: React.Dispatch<React.SetStateAction<Partial<Consultation>>>;
    isCreatingConsultation: boolean;
    setIsCreatingConsultation: React.Dispatch<React.SetStateAction<boolean>>;
    handleVitalsChange: (f: any, v: any) => void;
    handleExamChange: (f: any, v: any) => void;
    handleCreateConsultation: () => Promise<Patient>;
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
}

export const DoctorPatientRecord: React.FC<DoctorPatientRecordProps> = ({
    selectedPatient, setSelectedPatient, isEditingPatient, setIsEditingPatient, handleSavePatient, onUpdatePatient, onLogActivity,
    activeCenterId, activeCenter, hasActiveCenter, moduleGuards,
    doctorName, doctorId, role, currentUser, isReadOnly,
    newConsultation, setNewConsultation, isCreatingConsultation, setIsCreatingConsultation, handleVitalsChange, handleExamChange, handleCreateConsultation, selectedPatientConsultations, isUsingLegacyConsultations,
    docsToPrint, setDocsToPrint, isPrintModalOpen, setIsPrintModalOpen, isClinicalReportOpen, setIsClinicalReportOpen,
    selectedConsultationForModal, setSelectedConsultationForModal,
    isExamOrderModalOpen, setIsExamOrderModalOpen, examOrderCatalog,
    myExamProfiles, allExamOptions, myTemplates,
    sendConsultationByEmail, safeAgeLabel
}) => {
    const { showToast } = useToast();

    const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
    const [safePdfUrl, setSafePdfUrl] = useState<string>("");
    const [showLicenciaOptions, setShowLicenciaOptions] = useState(false);

    useEffect(() => {
        if (previewFile && previewFile.type !== "image") {
            if (previewFile.type === "pdf" || previewFile.name.toLowerCase().endsWith(".pdf")) {
                setSafePdfUrl(previewFile.url);
            } else {
                setSafePdfUrl(`https://docs.google.com/gview?url=${encodeURIComponent(previewFile.url)}&embedded=true`);
            }
        } else {
            setSafePdfUrl("");
        }
    }, [previewFile]);

    // Accordion state for One-Page Flow
    const [expandedSection, setExpandedSection] = useState<string>("anamnesis");
    const toggleSection = (section: string) => setExpandedSection(prev => prev === section ? prev : section);

    // Kinesiology local state
    const [isKineProgramModalOpen, setIsKineProgramModalOpen] = useState(false);
    const [isKineSessionModalOpen, setIsKineSessionModalOpen] = useState(false);
    const [selectedKineProgram, setSelectedKineProgram] = useState<KinesiologyProgram | null>(null);
    const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);

    const canSeeVitals = ["MEDICO", "ENFERMERA", "KINESIOLOGO", "MATRONA", "NUTRICIONISTA", "PREPARADOR_FISICO"].includes(role);
    const canPrescribeDrugs = ["MEDICO", "ODONTOLOGO", "MATRONA"].includes(role);
    const canIssueLicense = ["MEDICO", "ODONTOLOGO"].includes(role);
    const isDentist = role === "ODONTOLOGO";
    const isPsych = role === "PSICOLOGO";
    const isPodo = role === "PODOLOGO";

    const labels = useMemo(() => {
        switch (role) {
            case "PODOLOGO": return { reason: "Motivo de Atención Podológica", anamnesis: "Anamnesis y Antecedentes (Calzado, Hábitos)", physical: "Examen Físico de Pies y Miembros Inferiores", diagnosis: "Diagnóstico Podológico / Hallazgos" };
            case "ASISTENTE_SOCIAL": return { reason: "Motivo de Intervención Social", anamnesis: "Antecedentes Familiares y Redes de Apoyo", physical: "Evaluación Socio-Económica / Vivienda", diagnosis: "Diagnóstico Social e Informe de Situación" };
            case "PREPARADOR_FISICO": return { reason: "Objetivo de Entrenamiento / Consulta", anamnesis: "Antecedentes Deportivos y Fitness (Lesiones)", physical: "Evaluación de Condición Física (Tests)", diagnosis: "Diagnóstico Funcional y Planificación" };
            case "QUIMICO_FARMACEUTICO": return { reason: "Motivo de Seguimiento Farmacoterapéutico", anamnesis: "Conciliación de Medicamentos / Reacciones", physical: "Seguimiento de Resultados y Adherencia", diagnosis: "Problemas Relacionados con Medicamentos (PRM)" };
            case "TECNOLOGO_MEDICO": return { reason: "Motivo de Examen / Procedimiento", anamnesis: "Antecedentes Clínicos Relevantes", physical: "Condiciones Propias del Procedimiento Técnico", diagnosis: "Impresión Técnica (Hallazgos)" };
            case "NUTRICIONISTA": return { reason: "Motivo de Consulta Nutricional", anamnesis: "Anamnesis Alimentaria y Hábitos", physical: "Evaluación Antropométrica (Cintura, Hip, Pliegues)", diagnosis: "Diagnóstico Nutricional Integrado (DNI)" };
            case "PSICOLOGO": return { reason: "Motivo de Consulta / Relato", anamnesis: "Desarrollo de la Sesión / Evolución", physical: "", diagnosis: "Hipótesis Diagnóstica / Foco Terapéutico" };
            case "ENFERMERA":
            case "TENS": return { reason: "Motivo de Atención / Procedimiento", anamnesis: "Antecedentes y Observaciones", physical: "Evaluación de Enfermería / Estado General", diagnosis: "Diagnóstico Enfermero / Procedimiento Realizado" };
            case "MATRONA": return { reason: "Motivo de Consulta Gineco-Obstétrica", anamnesis: "Anamnesis y Antecedentes (AGO)", physical: "Examen Físico Segmentario", diagnosis: "Diagnóstico / Hipótesis" };
            case "FONOAUDIOLOGO":
            case "TERAPEUTA_OCUPACIONAL": return { reason: "Motivo de Consulta / Derivación", anamnesis: "Evaluación Clínica / Anamnesis", physical: "Observaciones de Desempeño / Pruebas", diagnosis: "Hipótesis Diagnóstica (CID/CIF)" };
            default: return { reason: "Motivo de Consulta", anamnesis: "Anamnesis Próxima", physical: "Examen Físico", diagnosis: "Diagnóstico / Hipótesis" };
        }
    }, [role]);

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

    return (
        <div className="flex flex-col min-h-screen lg:h-screen font-sans animate-fadeIn">
            {previewFile && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
                    <div className="bg-white rounded-xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                            <h3 className="font-bold text-slate-700">{previewFile.name}</h3>
                            <button onClick={() => setPreviewFile(null)}>
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-200 p-4 flex items-center justify-center">
                            {previewFile.type === "image" ? (
                                <img src={previewFile.url} alt="preview" className="max-w-full max-h-full object-contain shadow-lg" />
                            ) : (
                                <iframe src={safePdfUrl} className="w-full h-full bg-white shadow-lg" title="pdf preview"></iframe>
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
                centerName={activeCenter?.name || "Clave Salud"}
                centerLogoUrl={activeCenter?.logoUrl}
                professionalName={doctorName}
                professionalRole={role}
                professionalRut={currentUser?.rut}
                professionalRegistry={currentUser?.clinicalRole}
                examDefinitions={currentUser?.customExams}
            />

            <header className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedPatient(null)} className="text-slate-400 hover:text-slate-700 transition-colors p-2 hover:bg-slate-100/50 rounded-full">
                        <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                    {selectedPatient.attachments?.filter(a => a.type === 'profile_picture' || (a.type === 'image' && a.name.toLowerCase().includes('perfil'))).length ? (
                        <img src={selectedPatient.attachments.filter(a => a.type === 'profile_picture' || (a.type === 'image' && a.name.toLowerCase().includes('perfil'))).pop()?.url} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 shadow-sm" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl border-2 border-indigo-200 shadow-sm uppercase">
                            {selectedPatient.fullName.substring(0, 2)}
                        </div>
                    )}
                    <div>
                        {isEditingPatient ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <input className="text-2xl font-bold text-slate-800 border-b-2 border-primary-300 outline-none bg-transparent w-full md:w-96 focus:border-primary-500 transition-colors" value={selectedPatient.fullName} onChange={(e) => setSelectedPatient((prev) => prev ? { ...prev, fullName: e.target.value } : null)} placeholder="Nombre Completo" />
                                    <input className="text-sm font-mono border-b-2 border-primary-300 outline-none bg-transparent w-32 focus:border-primary-500 transition-colors" value={selectedPatient.rut} onChange={(e) => setSelectedPatient((prev) => prev ? { ...prev, rut: e.target.value } : null)} placeholder="RUT" />
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <input type="date" className="bg-transparent border-b border-slate-300 outline-none text-slate-600 focus:border-primary-500" value={selectedPatient.birthDate ? selectedPatient.birthDate.split("T")[0] : ""} onChange={(e) => setSelectedPatient((prev) => prev ? { ...prev, birthDate: e.target.value } : null)} />
                                    <select className="bg-transparent border-b border-slate-300 outline-none text-slate-600 focus:border-primary-500" value={selectedPatient.gender} onChange={(e) => setSelectedPatient((prev) => prev ? { ...prev, gender: e.target.value } : null)}>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                    <select className="bg-transparent border-b border-slate-300 outline-none text-slate-600 focus:border-primary-500" value={selectedPatient.genderIdentity} onChange={(e) => setSelectedPatient((prev) => prev ? { ...prev, genderIdentity: e.target.value } : null)}>
                                        <option value="Identidad de género no declarada">No declarada</option>
                                        <option value="Mujer Trans">Mujer Trans</option>
                                        <option value="Hombre Trans">Hombre Trans</option>
                                        <option value="Persona No Binaria">No Binaria</option>
                                        <option value="Género Fluido">Género Fluido</option>
                                        <option value="Cisgénero">Cisgénero</option>
                                    </select>
                                    <select className="bg-transparent border-b border-slate-300 outline-none text-slate-600 focus:border-primary-500" value={selectedPatient.insurance} onChange={(e) => setSelectedPatient((prev) => prev ? { ...prev, insurance: e.target.value } : null)}>
                                        <option value="FONASA">FONASA</option>
                                        <option value="ISAPRE">ISAPRE</option>
                                        <option value="Particular">Particular</option>
                                        <option value="DIPRECA">DIPRECA</option>
                                        <option value="CAPREDENA">CAPREDENA</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 group">
                                    {formatPersonName(selectedPatient.fullName)}
                                    <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full font-mono font-medium border border-primary-100">{selectedPatient.rut}</span>
                                    {!isReadOnly && (
                                        <button onClick={() => setIsEditingPatient(true)} className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-full" title="Editar datos básicos">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    )}
                                </h1>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 font-medium">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">{safeAgeLabel(selectedPatient.birthDate)}</span>
                                    <span className="bg-indigo-50 px-2 py-0.5 rounded text-indigo-700 border border-indigo-100">{selectedPatient.gender} {selectedPatient.genderIdentity && selectedPatient.genderIdentity !== 'Identidad de género no declarada' && `(${selectedPatient.genderIdentity})`}</span>
                                    {selectedPatient.insurance && (
                                        <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-700 border border-emerald-100 flex items-center gap-1">
                                            {selectedPatient.insurance}
                                            {selectedPatient.insurance === 'FONASA' && selectedPatient.insuranceLevel && ` - ${selectedPatient.insuranceLevel}`}
                                        </span>
                                    )}
                                    <BioMarkers activeExams={selectedPatient.activeExams || []} consultations={selectedPatientConsultations} examOptions={allExamOptions} />
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isEditingPatient ? (
                        <button type="button" onClick={handleSavePatient} className="bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors" title="Guardar cambios">
                            <Save className="w-5 h-5" /> Guardar Cambios
                        </button>
                    ) : (
                        <PatientDetail patient={selectedPatient} centerId={activeCenterId} center={activeCenter ?? null} consultations={selectedPatientConsultations} generatedBy={{ name: doctorName, rut: currentUser?.rut, role }} onUpdatePatient={(nextPatient) => { onUpdatePatient(nextPatient); setSelectedPatient(nextPatient); }} />
                    )}
                </div>
            </header>

            <main className="flex-1 lg:overflow-hidden">
                <div className="h-auto lg:h-full max-w-[1800px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12">
                    {/* SIDEBAR */}
                    <PatientSidebar
                        selectedPatient={selectedPatient}
                        isEditingPatient={isEditingPatient}
                        toggleEditPatient={() => { if (isEditingPatient) { handleSavePatient(); } else { setIsEditingPatient(true); } }}
                        handleEditPatientField={(f, v) => setSelectedPatient((prev) => (prev ? { ...prev, [f]: v } : null))}
                        onFileUpload={async (e) => {
                            if (e.target.files?.[0] && currentUser) {
                                const f = e.target.files[0];
                                showToast("Subiendo archivo...", "info");
                                try {
                                    const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
                                    const { storage } = await import("../../../firebase");
                                    const storageRef = ref(storage, `users/${currentUser.uid}/patients/${selectedPatient.id}/${Date.now()}_${f.name}`);
                                    await uploadBytes(storageRef, f);
                                    const downloadUrl = await getDownloadURL(storageRef);

                                    const fileType = f.type.includes("image") ? "image" : (f.type.includes("pdf") || f.name.toLowerCase().endsWith(".pdf") ? "pdf" : "other");
                                    const att: Attachment = { id: generateId(), name: f.name, type: fileType, date: new Date().toISOString(), url: downloadUrl };
                                    const up = { ...selectedPatient, attachments: [...(selectedPatient.attachments || []), att], lastUpdated: new Date().toISOString() };
                                    onUpdatePatient(up);
                                    setSelectedPatient(up);
                                    showToast("Archivo subido correctamente", "success");
                                    onLogActivity({ action: "update", details: `Subió archivo ${f.name} a paciente ${selectedPatient.fullName}`, targetId: selectedPatient.id } as any);
                                } catch (err) {
                                    console.error("Upload error", err);
                                    showToast("Error al subir archivo", "error");
                                }
                            }
                        }}
                        onPreviewFile={setPreviewFile}
                        readOnly={isReadOnly}
                        availableProfiles={myExamProfiles}
                        examOptions={allExamOptions}
                    />

                    {/* MAIN CONTENT */}
                    <section className="lg:col-span-9 h-auto lg:h-full lg:overflow-y-auto bg-slate-50/30 p-4 lg:p-10">
                        {!isCreatingConsultation && (
                            <div className="flex justify-between items-end mb-8">
                                <div>
                                    <h2 className="text-3xl font-bold text-slate-800">Historial Clínico</h2>
                                    <p className="text-slate-500 text-base mt-1 flex items-center gap-2">
                                        <span className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded text-xs uppercase font-bold">{role}</span>
                                        {selectedPatientConsultations.length} atenciones registradas
                                    </p>
                                </div>
                                {!isReadOnly && role !== "KINESIOLOGO" && (
                                    <button onClick={() => setIsCreatingConsultation(true)} disabled={!hasActiveCenter} title={hasActiveCenter ? "Crear atención" : "Selecciona un centro activo"} className="bg-primary-600 text-white pl-6 pr-8 py-4 rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 flex items-center gap-2 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                        <Plus className="w-6 h-6" /> Nueva Atención
                                    </button>
                                )}
                                {!isReadOnly && role === "KINESIOLOGO" && (
                                    <div className="flex gap-4">
                                        <button onClick={() => setIsKineProgramModalOpen(true)} disabled={!hasActiveCenter} className="bg-indigo-600 text-white pl-6 pr-8 py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                            <Plus className="w-6 h-6" /> Nuevo Programa
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* KINESIOLOGY DASHBOARD */}
                        {role === "KINESIOLOGO" && !isCreatingConsultation && (selectedPatient.kinePrograms?.length || 0) > 0 && (
                            <div className="mb-8 space-y-4">
                                <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">Programas Activos</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {selectedPatient.kinePrograms?.map((prog) => (
                                        <div key={prog.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${prog.type.includes("motora") ? "bg-indigo-100 text-indigo-700" : "bg-cyan-100 text-cyan-700"}`}>{prog.type}</span>
                                                        <span className="text-xs text-slate-400 font-medium">{new Date(prog.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 text-lg">{prog.diagnosis}</h4>
                                                    <p className="text-slate-500 text-sm">{prog.sessions?.length || 0} / {prog.totalSessions} Sesiones realizadas</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <button onClick={() => setExpandedProgramId(expandedProgramId === prog.id ? null : prog.id)} className={`px-4 py-2.5 font-bold rounded-xl flex items-center gap-2 transition-colors ${expandedProgramId === prog.id ? "bg-slate-100 text-slate-700" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                                                        <History className="w-4 h-4" /> {expandedProgramId === prog.id ? "Ocultar Historial" : "Ver Historial"}
                                                    </button>
                                                    <button onClick={() => { setSelectedKineProgram(prog); setIsKineSessionModalOpen(true); }} className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 flex items-center gap-2">
                                                        <Activity className="w-4 h-4" /> Registrar Sesión
                                                    </button>
                                                </div>
                                            </div>
                                            {expandedProgramId === prog.id && (
                                                <div className="border-t border-slate-100 pt-4 animate-fadeIn">
                                                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Historial de Sesiones</h5>
                                                    {!prog.sessions || prog.sessions.length === 0 ? (
                                                        <p className="text-sm text-slate-400 italic">No hay sesiones registradas aún.</p>
                                                    ) : (
                                                        <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                                            {prog.sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((session, idx) => (
                                                                <div key={session.id || idx} className="relative pl-8">
                                                                    <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-indigo-100 border-2 border-indigo-500"></div>
                                                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <span className="font-bold text-slate-700 text-sm">Sesión #{session.sessionNumber}</span>
                                                                            <span className="text-xs text-slate-400">{new Date(session.date).toLocaleDateString()}</span>
                                                                        </div>
                                                                        <div className="text-sm text-slate-600 space-y-1">
                                                                            {session.observations && <p><strong className="text-slate-500">Obs:</strong> {session.observations}</p>}
                                                                            {session.techniques && session.techniques.length > 0 && <p><strong className="text-slate-500">Técnicas:</strong> {session.techniques.join(", ")}</p>}
                                                                            <div className="flex gap-4 mt-2">
                                                                                {session.tolerance && <span className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">Tol: {session.tolerance}</span>}
                                                                                {session.response && <span className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">Resp: {session.response}</span>}
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

                        {role === "KINESIOLOGO" && !isCreatingConsultation && (
                            <div className="space-y-8 animate-fadeIn">
                                <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
                                    <PrescriptionManager prescriptions={newConsultation.prescriptions || []} onAddPrescription={(doc) => setNewConsultation((prev) => ({ ...prev, prescriptions: [...(prev.prescriptions || []), doc] }))} onRemovePrescription={(id) => setNewConsultation((prev) => ({ ...prev, prescriptions: prev.prescriptions?.filter((p) => p.id !== id) }))} onPrint={(docs) => { setDocsToPrint(docs); setIsPrintModalOpen(true); }} onOpenClinicalReport={() => setIsClinicalReportOpen(true)} templates={myTemplates} role={role} currentDiagnosis={selectedPatient.kinePrograms?.[0]?.diagnosis || ""} />
                                </div>
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                                    <h4 className="text-secondary-900 font-bold text-lg uppercase tracking-wider mb-6 flex items-center gap-2">
                                        <Calendar className="w-5 h-5" /> Próximo Control
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="block text-lg font-bold text-slate-700 mb-3">Fecha Estimada</label>
                                            <input type="date" value={newConsultation.nextControlDate || ""} onChange={(e) => setNewConsultation((prev) => ({ ...prev, nextControlDate: e.target.value }))} className="w-full p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-secondary-500 bg-slate-50 text-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-lg font-bold text-slate-700 mb-3">Indicaciones / Requisitos</label>
                                            <input placeholder="Ej: Traer radiografía..." value={newConsultation.nextControlReason || ""} onChange={(e) => setNewConsultation((prev) => ({ ...prev, nextControlReason: e.target.value }))} className="w-full p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-secondary-500 bg-slate-50 text-lg" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4 pb-12">
                                    <button onClick={async () => { const updatedPatient = await handleCreateConsultation(); if (updatedPatient) setSelectedPatient(updatedPatient); }} disabled={!hasActiveCenter || (!newConsultation.prescriptions?.length && !newConsultation.nextControlDate)} className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-3 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                        <Save className="w-6 h-6" /> Guardar Gestión / Documentos
                                    </button>
                                </div>
                            </div>
                        )}

                        {role === "KINESIOLOGO" && (
                            <>
                                <StartProgramModal isOpen={isKineProgramModalOpen} onClose={() => setIsKineProgramModalOpen(false)} onConfirm={(t, d) => handleCreateKineProgram(selectedPatient, t, d)} />
                                {selectedKineProgram && (
                                    <SessionModal isOpen={isKineSessionModalOpen} onClose={() => { setIsKineSessionModalOpen(false); setSelectedKineProgram(null); }} program={selectedKineProgram} sessionNumber={(selectedKineProgram.sessions?.length || 0) + 1} onSave={(s) => handleSaveKineSession(selectedPatient, selectedKineProgram.id, s)} />
                                )}
                            </>
                        )}

                        {isCreatingConsultation ? (
                            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 animate-slideUp">
                                <div className="bg-slate-800 text-white px-8 py-5 flex justify-between items-center rounded-t-2xl">
                                    <h3 className="font-bold text-xl flex items-center gap-2"><FileText className="w-6 h-6 text-primary-400" /> Nueva Atención ({role})</h3>
                                    <button onClick={() => setIsCreatingConsultation(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                                </div>

                                <div className="p-8 md:p-10 space-y-10">
                                    {/* 1. Motivo y Anamnesis */}
                                    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden animate-fadeIn">
                                        <button onClick={() => toggleSection('anamnesis')} className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-indigo-500" /> {labels.reason} y {labels.anamnesis.split(' ')[0]}
                                            </h4>
                                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedSection === 'anamnesis' ? 'rotate-180' : ''}`} />
                                        </button>
                                        {expandedSection === 'anamnesis' && (
                                            <div className="p-5 md:p-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
                                                <div className="col-span-full">
                                                    <label className="block text-sm font-bold text-slate-700 mb-2">{labels.reason}</label>
                                                    <input value={newConsultation.reason || ""} onChange={(e) => setNewConsultation((prev) => ({ ...prev, reason: e.target.value }))} className="w-full p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-medium text-lg text-slate-800" placeholder="¿Cuál es el motivo principal de la consulta?" />
                                                </div>
                                                <div className={isPsych ? "col-span-full" : ""}>
                                                    <label className="block text-sm font-bold text-slate-700 mb-2">{labels.anamnesis}</label>
                                                    <textarea value={newConsultation.anamnesis || ""} onChange={(e) => setNewConsultation((prev) => ({ ...prev, anamnesis: e.target.value }))} spellCheck={true} className="w-full p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none resize-none h-40 text-base leading-relaxed text-slate-700" placeholder="Detalle clínico e historial de la enfermedad actual..." />
                                                </div>
                                                {labels.physical && (
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 mb-2">{labels.physical}</label>
                                                        <textarea value={newConsultation.physicalExam || ""} onChange={(e) => setNewConsultation((prev) => ({ ...prev, physicalExam: e.target.value }))} spellCheck={true} className="w-full p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none resize-none h-40 text-base leading-relaxed text-slate-700" placeholder="Hallazgos físicos..." />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Evaluación Médica (Vitals, Odontograma, Exams) */}
                                    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden animate-fadeIn">
                                        <button onClick={() => toggleSection('medical')} className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                <Activity className="w-5 h-5 text-cyan-500" /> Evaluación Médica (Exámenes y Signos Vitales)
                                            </h4>
                                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedSection === 'medical' ? 'rotate-180' : ''}`} />
                                        </button>
                                        {expandedSection === 'medical' && (
                                            <div className="p-5 md:p-8 border-t border-slate-100 space-y-8 bg-white">
                                                {canSeeVitals && !moduleGuards.vitals && <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm">Módulo de Signos Vitales deshabilitado.</div>}
                                                {canSeeVitals && moduleGuards.vitals && (
                                                    <VitalsForm newConsultation={newConsultation} onChange={handleVitalsChange} onExamChange={handleExamChange} consultationHistory={selectedPatientConsultations} activeExams={selectedPatient.activeExams || []} patientBirthDate={selectedPatient.birthDate} patientGender={selectedPatient.gender} examOptions={allExamOptions} role={role} anthropometryEnabled={moduleGuards.vitals} />
                                                )}
                                                {isDentist && !moduleGuards.dental && <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm">Módulo de Odontograma deshabilitado.</div>}
                                                {isDentist && moduleGuards.dental && (
                                                    <Odontogram value={newConsultation.dentalMap || []} onChange={(val) => setNewConsultation((prev) => ({ ...prev, dentalMap: val }))} />
                                                )}
                                                {isPodo && (
                                                    <Podogram value={newConsultation.podogram || []} onChange={(val) => setNewConsultation((prev) => ({ ...prev, podogram: val }))} />
                                                )}
                                                {moduleGuards.exams && (
                                                    <div className="pt-4 border-t border-slate-200">
                                                        <ExamSheetsSection
                                                            examSheets={newConsultation.examSheets || []}
                                                            onChange={(sheets) => setNewConsultation((prev) => ({ ...prev, examSheets: sheets }))}
                                                            examOptions={allExamOptions}
                                                            availableProfiles={currentUser?.savedExamProfiles?.length ? currentUser.savedExamProfiles : myExamProfiles}
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
                                        <button onClick={() => toggleSection('diagnosis')} className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                <Edit className="w-5 h-5 text-emerald-500" /> Diagnóstico, Recetas e Indicaciones
                                            </h4>
                                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedSection === 'diagnosis' ? 'rotate-180' : ''}`} />
                                        </button>
                                        {expandedSection === 'diagnosis' && (
                                            <div className="p-5 md:p-8 border-t border-slate-100 space-y-6 bg-white">
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-2">{labels.diagnosis}</label>
                                                    <AutocompleteInput value={newConsultation.diagnosis || ""} onChange={(val) => setNewConsultation((prev) => ({ ...prev, diagnosis: val }))} options={COMMON_DIAGNOSES} className="w-full p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-lg text-slate-800" placeholder="Buscar CIE-10 o escribir texto libre (Ej: Faringitis Aguda...)" />
                                                </div>
                                                <div className={!canPrescribeDrugs ? "bg-slate-50 p-6 rounded-2xl border border-slate-200" : ""}>
                                                    {!canPrescribeDrugs && <p className="text-sm font-bold text-slate-400 uppercase mb-4">Indicaciones y Certificados</p>}
                                                    {moduleGuards.prescriptions ? (
                                                        <>
                                                            <PrescriptionManager
                                                                prescriptions={newConsultation.prescriptions || []}
                                                                onAddPrescription={(doc) => setNewConsultation((prev) => ({ ...prev, prescriptions: [...(prev.prescriptions || []), doc] }))}
                                                                onRemovePrescription={(id) => setNewConsultation((prev) => ({ ...prev, prescriptions: prev.prescriptions?.filter((p) => p.id !== id) }))}
                                                                onPrint={(docs) => { setDocsToPrint(docs); setIsPrintModalOpen(true); }}
                                                                onOpenClinicalReport={() => setIsClinicalReportOpen(true)}
                                                                onOpenExamOrders={() => setIsExamOrderModalOpen(true)}
                                                                templates={myTemplates}
                                                                role={role}
                                                                currentDiagnosis={newConsultation.diagnosis}
                                                            />
                                                            {!canPrescribeDrugs && <p className="text-xs text-slate-400 mt-2 italic">* Su perfil no permite emitir recetas de medicamentos, solo indicaciones y certificados.</p>}
                                                        </>
                                                    ) : (
                                                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm">Módulo de Indicaciones/Recetas deshabilitado.</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 4. Próximo Control */}
                                    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden animate-fadeIn">
                                        <button onClick={() => toggleSection('control')} className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                <Calendar className="w-5 h-5 text-amber-500" /> Plan y Próximo Control
                                            </h4>
                                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedSection === 'control' ? 'rotate-180' : ''}`} />
                                        </button>
                                        {expandedSection === 'control' && (
                                            <div className="p-5 md:p-8 border-t border-slate-100 bg-amber-50/20">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 mb-2">Fecha Estimada</label>
                                                        <input type="date" value={newConsultation.nextControlDate || ""} onChange={(e) => setNewConsultation((prev) => ({ ...prev, nextControlDate: e.target.value }))} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-500 bg-white" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 mb-2">Indicaciones / Requisitos</label>
                                                        <input placeholder="Ej: Traer radiografía..." value={newConsultation.nextControlReason || ""} onChange={(e) => setNewConsultation((prev) => ({ ...prev, nextControlReason: e.target.value }))} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-500 bg-white" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end items-center pt-8 border-t border-slate-100 gap-4 relative">
                                        {canIssueLicense && (
                                            <div className="relative">
                                                <button onClick={() => setShowLicenciaOptions(!showLicenciaOptions)} className="text-primary-600 font-bold text-lg hover:bg-primary-50 px-6 py-3 rounded-xl transition-colors border border-primary-200">Emitir Licencia Médica</button>
                                                {showLicenciaOptions && (
                                                    <div className="absolute bottom-full right-0 mb-2 bg-white border border-slate-200 shadow-xl rounded-xl p-4 w-72 animate-fadeIn z-20">
                                                        <a href="https://wlme.medipass.cl" target="_blank" className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-slate-700 font-medium" rel="noreferrer"><ExternalLink className="w-4 h-4" /> Medipass</a>
                                                        <a href="https://www.licencia.cl" target="_blank" className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-slate-700 font-medium" rel="noreferrer"><ExternalLink className="w-4 h-4" /> I-Med</a>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <button onClick={async () => { const updatedPatient = await handleCreateConsultation(); if (updatedPatient) setSelectedPatient(updatedPatient); }} disabled={!hasActiveCenter} className="bg-primary-600 text-white px-10 py-5 rounded-2xl font-bold hover:bg-primary-700 shadow-xl shadow-primary-200 transition-all flex items-center gap-3 text-xl disabled:opacity-50 disabled:cursor-not-allowed">
                                            <Save className="w-7 h-7" /> Guardar Atención
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {isUsingLegacyConsultations && <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-semibold">Mostrando historial legacy. Las nuevas atenciones se guardan en subcolección.</div>}
                                <ConsultationHistory
                                    consultations={selectedPatientConsultations}
                                    centerId={activeCenterId}
                                    patientId={selectedPatient.id}
                                    onOpen={(consultation) => setSelectedConsultationForModal(consultation)}
                                    onPrint={(docs) => { setDocsToPrint(docs); setIsPrintModalOpen(true); }}
                                    onSendEmail={(c) => { showToast("Abriendo correo...", "info"); sendConsultationByEmail(c); }}
                                />
                            </>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
};
