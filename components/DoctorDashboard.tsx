import React, { useState, useEffect, useMemo, useContext } from "react";
import {
  Patient,
  Consultation,
  Attachment,
  Appointment,
  Prescription,
  AgendaConfig,
  ClinicalTemplate,
  Doctor,
  ProfessionalRole,
  AuditLogEvent,
  ExamProfile,
  ExamDefinition,
  WhatsappTemplate,
} from "../types";
import {
  calculateAge,
  generateId,
  generateSlotId,
  sanitizeText,
  base64ToBlob,
  normalizePhone,
  formatPersonName,
  applyWhatsappTemplate,
  openEmailCompose,
  getProfessionalPrefix,
} from "../utils";
import {
  COMMON_DIAGNOSES,
  DEFAULT_TEMPLATES,
  EXAM_PROFILES,
  TRACKED_EXAMS_OPTIONS,
} from "../constants";
import { DEFAULT_CLINICAL_TEMPLATES } from "../constants/clinicalTemplates";
import {
  Search,
  Book,
  Plus,
  User,
  Calendar,
  ChevronRight,
  LogOut,
  Save,
  ShieldCheck,
  X,
  AlertCircle,
  ExternalLink,
  FileText,
  Bell,
  UsersRound,
  CalendarCheck,
  AlarmClock,
  MessageCircle,
  Clock,
  ArrowUpDown,
  Filter,
  Settings,
  Trash2,
  Edit,
  Activity,
  RefreshCw,
  Layers,
  CheckSquare,
  Square,
  KeyRound,
  Shield,
  TestTube,
  History,
} from "lucide-react";
import { useToast } from "./Toast";
import { CenterContext } from "../CenterContext";
import {
  collection,
  serverTimestamp,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { logAccessSafe, useAuditLog } from "../hooks/useAuditLog";
import { usePatientManagement } from "../hooks/doctor/usePatientManagement";
import { useConsultationLogic } from "../hooks/doctor/useConsultationLogic";
import { usePrescriptionLogic } from "../hooks/doctor/usePrescriptionLogic";
import { useDashboardData } from "../hooks/doctor/useDashboardData";

// Sub-components
import VitalsForm from "./VitalsForm";
import PrescriptionManager from "./PrescriptionManager";
import ConsultationHistory from "./ConsultationHistory";
import AgendaView from "./AgendaView";
import PatientSidebar from "./PatientSidebar";
import PatientDetail from "./PatientDetail";
import PrintPreviewModal from "./PrintPreviewModal";
import ClinicalReportModal from "./ClinicalReportModal";
import ConsultationDetailModal from "./ConsultationDetailModal";
import ExamOrderModal from "./ExamOrderModal";
import AutocompleteInput from "./AutocompleteInput";
import Odontogram from "./Odontogram";
import Podogram from "./Podogram";
import BioMarkers from "./BioMarkers";
import LogoHeader from "./LogoHeader";
import {
  DEFAULT_EXAM_ORDER_CATALOG,
  ExamOrderCatalog,
  getCategoryLabel,
} from "../utils/examOrderCatalog";
import LegalLinks from "./LegalLinks";
import { StartProgramModal, SessionModal } from "./KinesiologyModals";
import { ExamSheetsSection } from "./ExamSheetsSection";
import { KinesiologyProgram, KinesiologySession } from "../types";
import DrivePicker from "./DrivePicker";
import { DoctorPatientsListTab } from "../features/doctor/components/DoctorPatientsListTab";
import { DoctorAgendaTab } from "../features/doctor/components/DoctorAgendaTab";
import { DoctorSettingsTab } from "../features/doctor/components/DoctorSettingsTab";
import { DoctorPatientRecord } from "../features/doctor/components/DoctorPatientRecord";

interface ProfessionalDashboardProps {
  patients: Patient[];
  doctorName: string; // Professional Name
  doctorId: string; // Professional ID
  role: ProfessionalRole;
  agendaConfig?: AgendaConfig;
  savedTemplates?: ClinicalTemplate[];
  currentUser?: Doctor;
  doctors?: Doctor[]; // All doctors in the center (needed for Administrativo role)
  portfolioMode?: "global" | "center";
  onSetPortfolioMode?: (mode: "global" | "center") => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
  onUpdateDoctor: (updatedDoctor: Doctor) => void;
  onLogout: () => void;
  onOpenLegal: (target: "terms" | "privacy") => void;
  appointments: Appointment[];
  onUpdateAppointments: (appointments: Appointment[]) => void;
  onUpdateAppointment?: (appointment: Appointment) => Promise<void>;
  onDeleteAppointment?: (id: string) => Promise<void>;
  onLogActivity: (event: any) => void;
  isReadOnly?: boolean; // Read Only Mode for Suspended Centers
  isSyncingAppointments?: boolean;
}

// --- helpers to avoid infinite loops when props are recreated on every render ---
function sameById(a: any[] = [], b: any[] = [], extraKeys: string[] = []) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if ((ai?.id ?? ai) !== (bi?.id ?? bi)) return false;

    for (const k of extraKeys) {
      if ((ai?.[k] ?? undefined) !== (bi?.[k] ?? undefined)) return false;
    }
  }
  return true;
}

const DEFAULT_WHATSAPP_TEMPLATES: WhatsappTemplate[] = [
  {
    id: "reminder",
    title: "Recordatorio de cita",
    body: "Hola {patientName}, le recordamos su control el {nextControlDate} en {centerName}. Si desea confirmar, responda a este mensaje.",
    enabled: true,
  },
  {
    id: "confirm",
    title: "Confirmación asistencia",
    body: "Hola {patientName}, desde {centerName} queremos confirmar su asistencia al control del {nextControlDate}. ¿Confirma su asistencia?",
    enabled: true,
  },
  {
    id: "reschedule",
    title: "Reagendar",
    body: "Hola {patientName}, desde {centerName}. Vimos que tiene un control próximo ({nextControlDate}). Si no puede asistir, indíquenos un horario alternativo.",
    enabled: true,
  },
];

export const ProfessionalDashboard: React.FC<ProfessionalDashboardProps> = ({
  patients,
  doctorName,
  doctorId,
  role: roleRaw,
  agendaConfig,
  savedTemplates,
  currentUser,
  doctors = [],
  onUpdatePatient,
  onUpdateDoctor,
  onLogout,
  onOpenLegal,
  appointments,
  onUpdateAppointments,
  onUpdateAppointment,
  onDeleteAppointment,
  onLogActivity,
  portfolioMode = "global",
  onSetPortfolioMode,
  isReadOnly = false,
  isSyncingAppointments = false,
}) => {
  // --- Context ---
  const { activeCenterId, activeCenter, isModuleEnabled } = useContext(CenterContext);
  const hasActiveCenter = Boolean(activeCenterId);

  const { showToast } = useToast();
  const role = String(roleRaw || "").toUpperCase() as ProfessionalRole;
  // const { logAccess } = useAuditLog(); // Moved to hooks

  const [filterNextControl, setFilterNextControl] = useState<"all" | "week" | "month">("all");
  const [activeTab, setActiveTab] = useState<"patients" | "agenda" | "reminders" | "settings">(
    "patients"
  );

  // Custom Hooks
  const {
    selectedPatient,
    setSelectedPatient,
    searchTerm,
    setSearchTerm,
    isEditingPatient,
    setIsEditingPatient,
    filteredPatients,
    handleSelectPatient,
    handleSavePatient,
    handleOpenPatientFromAppointment,
    consultations,
    isUsingLegacyConsultations,
  } = usePatientManagement({
    patients,
    activeCenterId,
    onUpdatePatient,
    onLogActivity,
    filterNextControl,
  });

  const {
    whatsappTemplates,
    whatsappTemplatesError,
    examOrderCatalog,
  } = useDashboardData({ activeCenterId });

  const {
    newConsultation,
    setNewConsultation,
    isCreatingConsultation,
    setIsCreatingConsultation,
    handleVitalsChange,
    handleExamChange,
    addPrescription,
    removePrescription,
    handleCreateConsultation,
    getEmptyConsultation,
  } = useConsultationLogic({
    selectedPatient,
    activeCenterId,
    activeCenter,
    hasActiveCenter,
    doctorId,
    doctorName,
    role,
    onUpdatePatient,
    onLogActivity,
    setActiveTab,
  });

  const {
    docsToPrint,
    setDocsToPrint,
    isPrintModalOpen,
    setIsPrintModalOpen,
    isClinicalReportOpen,
    setIsClinicalReportOpen,
    handlePrint,
  } = usePrescriptionLogic();

  const [centerLogoError, setCenterLogoError] = useState(false);

  // --- Clinical Templates State ---
  const [myTemplates, setMyTemplates] = useState<ClinicalTemplate[]>(savedTemplates || []);
  const [isEditingTemplateId, setIsEditingTemplateId] = useState<string | null>(null);
  const [tempTemplate, setTempTemplate] = useState({ id: "", title: "", content: "" });

  // --- Exam Profiles State ---
  const [myExamProfiles, setMyExamProfiles] = useState<ExamProfile[]>(
    currentUser?.savedExamProfiles || EXAM_PROFILES
  );
  const [isEditingProfileId, setIsEditingProfileId] = useState<string | null>(null);
  const [tempProfile, setTempProfile] = useState<ExamProfile>({
    id: "",
    label: "",
    exams: [],
    description: "",
  });

  // --- Custom Exams State ---
  const [newCustomExam, setNewCustomExam] = useState({
    label: "",
    unit: "",
    category: "",
  });

  // --- Password State ---
  const [pwdState, setPwdState] = useState({ current: "", new: "", confirm: "" });

  // --- WhatsApp State ---
  const [whatsAppMenuForPatientId, setWhatsAppMenuForPatientId] = useState<string | null>(null);

  // --- Exam Options ---
  const allExamOptions = useMemo(() => {
    const customs = currentUser?.customExams || [];
    return [...TRACKED_EXAMS_OPTIONS, ...customs];
  }, [currentUser?.customExams]);

  // --- Kinesiology State ---
  const [isKineProgramModalOpen, setIsKineProgramModalOpen] = useState(false);
  const [isKineSessionModalOpen, setIsKineSessionModalOpen] = useState(false);
  const [selectedKineProgram, setSelectedKineProgram] = useState<KinesiologyProgram | null>(null);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);

  // --- Consultation / Exam / Print State ---
  const [selectedConsultationForModal, setSelectedConsultationForModal] =
    useState<Consultation | null>(null);
  const [isExamOrderModalOpen, setIsExamOrderModalOpen] = useState(false);

  // ── Administrativo / Secretary role: select which professional's agenda to manage ──
  const isAdministrativo = String(role).toUpperCase() === "ADMINISTRATIVO";
  const NON_CLINICAL_ROLES = ["ADMIN_CENTRO", "ADMINISTRATIVO"];
  const clinicalDoctors = doctors.filter(
    (d) =>
      !NON_CLINICAL_ROLES.includes(String(d.role).toUpperCase()) && d.centerId === activeCenterId
  );
  const [viewingDoctorId, setViewingDoctorId] = useState<string>("");
  // Effective values for the agenda: use the selected doctor when Administrativo
  const viewingDoctor = isAdministrativo
    ? clinicalDoctors.find((d) => d.id === viewingDoctorId)
    : null;
  const effectiveDoctorId = isAdministrativo && viewingDoctor ? viewingDoctor.id : doctorId;
  const effectiveAgendaConfig =
    isAdministrativo && viewingDoctor ? viewingDoctor.agendaConfig : agendaConfig;

  // State for Catalog
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  const handleImportTemplate = async (template: ClinicalTemplate) => {
    if (!currentUser || !currentUser.id) return;
    try {
      const newT: ClinicalTemplate = {
        id: generateId(),
        userId: currentUser.id,
        title: template.title, // Keep original title
        content: template.content,
        category: template.category,
        createdAt: new Date().toISOString(),
      };

      // Add to current doctor templates
      const updatedTemplates = [...(currentUser.savedTemplates || []), newT];
      const updatedDoctor = { ...currentUser, savedTemplates: updatedTemplates };

      onUpdateDoctor(updatedDoctor);
      showToast("Plantilla importada correctamente", "success");
      setIsCatalogOpen(false);
    } catch (e) {
      console.error("Error importing template:", e);
      showToast("Error al importar plantilla", "error");
    }
  };

  // Close WhatsApp menu on outside click / escape
  useEffect(() => {
    const onDocClick = () => setWhatsAppMenuForPatientId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWhatsAppMenuForPatientId(null);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // --- helpers ---

  const safeAgeLabel = (birthDate?: string) => {
    if (!birthDate) return "-";
    const age = calculateAge(birthDate);
    return Number.isFinite(age) ? `${age} años` : "-";
  };

  const getActiveConsultations = (p: Patient) =>
    (p.consultations || []).filter((consultation) => consultation.active !== false);

  const getNextControlDateFromPatient = (p: Patient): Date | null => {
    const activeConsultations = getActiveConsultations(p);
    const lastConsult = activeConsultations[0]
      ? [...activeConsultations].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0]
      : null;
    const raw = lastConsult?.nextControlDate || "";
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getNextControlReasonFromPatient = (p: Patient): string => {
    const activeConsultations = getActiveConsultations(p);
    const lastConsult = activeConsultations[0]
      ? [...activeConsultations].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0]
      : null;
    return lastConsult?.nextControlReason || "";
  };

  const selectedPatientConsultations = useMemo(() => {
    return consultations;
  }, [consultations]);

  const buildWhatsAppText = (templateBody: string, p: Patient) => {
    const centerName = activeCenter?.name ?? "Centro Médico";
    const nextCtrl = getNextControlDateFromPatient(p);
    const nextCtrlStr = nextCtrl ? nextCtrl.toLocaleDateString("es-CL") : "";
    const nextCtrlReason = getNextControlReasonFromPatient(p);
    return templateBody
      .replaceAll("{patientName}", formatPersonName(p.fullName) || "Paciente")
      .replaceAll("{centerName}", centerName)
      .replaceAll("{nextControlDate}", nextCtrlStr)
      .replaceAll("{nextControlReason}", nextCtrlReason);
  };

  const openWhatsApp = (p: Patient, templateBody: string) => {
    const phone = normalizePhone(p.phone || "");
    if (!phone) {
      showToast("Paciente sin teléfono registrado.", "warning");
      return;
    }
    const text = buildWhatsAppText(templateBody, p);
    const waPhone = phone.replaceAll("+", "");
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // --- Email (Gmail compose) ---
  const sendConsultationByEmail = (consultation: Consultation) => {
    if (!selectedPatient) {
      showToast("Paciente no seleccionado.", "warning");
      return;
    }

    const patientEmail = (selectedPatient.email || "").trim();
    if (!patientEmail) {
      showToast("Paciente sin email registrado.", "warning");
      return;
    }

    const dateStr = new Date(consultation.date).toLocaleDateString("es-CL");
    const subject = `Atención ${formatPersonName(selectedPatient.fullName)} - ${dateStr}`;

    const lines: string[] = [];
    lines.push("ATENCIÓN CLÍNICA (resumen)");
    lines.push("");
    lines.push(`Paciente: ${formatPersonName(selectedPatient.fullName)}`);
    lines.push(`RUT: ${selectedPatient.rut || "-"}`);
    lines.push(`Fecha: ${dateStr}`);
    lines.push(
      `Profesional: ${getProfessionalPrefix(consultation.professionalRole)} ${consultation.professionalName || "-"}`
    );
    lines.push("");
    lines.push(`Motivo: ${consultation.reason || "-"}`);
    lines.push("");
    if (consultation.anamnesis) {
      lines.push("Anamnesis:");
      lines.push(consultation.anamnesis);
      lines.push("");
    }
    if (consultation.physicalExam) {
      lines.push("Examen físico:");
      lines.push(consultation.physicalExam);
      lines.push("");
    }
    lines.push(`Diagnóstico / Hipótesis: ${consultation.diagnosis || "-"}`);
    lines.push("");

    // Datos breves si existen
    const vitals: string[] = [];
    if (consultation.weight) vitals.push(`Peso: ${consultation.weight} kg`);
    if (consultation.height) vitals.push(`Talla: ${consultation.height} cm`);
    if (consultation.bmi) vitals.push(`IMC: ${consultation.bmi}`);
    if (consultation.bloodPressure) vitals.push(`PA: ${consultation.bloodPressure}`);
    if (consultation.hgt) vitals.push(`HGT: ${consultation.hgt}`);
    if (vitals.length) {
      lines.push("Signos / antropometría:");
      lines.push(vitals.join(" | "));
      lines.push("");
    }

    const ok = openEmailCompose({
      to: patientEmail,
      subject,
      body: lines.join("\n"),
    });
    if (!ok) showToast("No se pudo abrir el correo.", "error");
  };
  // --- módulos del centro (SuperAdmin) ---
  const moduleGuards = useMemo(() => {
    // Calculate individual flags
    const vitalsBase = isModuleEnabled ? isModuleEnabled("vitals") : true;
    const vitalsUserPref = currentUser.preferences?.vitalsEnabled;
    // If user has a preference, use it. Otherwise use center config.
    const vitalsEffective = vitalsUserPref !== undefined ? vitalsUserPref : vitalsBase;

    return {
      patients: isModuleEnabled ? isModuleEnabled("patients") : true,
      agenda: isModuleEnabled ? isModuleEnabled("agenda") : true,
      prescriptions: isModuleEnabled ? isModuleEnabled("prescriptions") : true,
      vitals: vitalsEffective,
      exams: isModuleEnabled ? isModuleEnabled("exams") : true,
      dental: isModuleEnabled ? isModuleEnabled("dental") : true,
      settings: isModuleEnabled ? isModuleEnabled("settings") : true,
    };
  }, [isModuleEnabled, currentUser]);

  const [showLicenciaOptions, setShowLicenciaOptions] = useState(false);
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [safePdfUrl, setSafePdfUrl] = useState<string>("");

  // Agenda State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<string>("");
  const [slotModal, setSlotModal] = useState<{ isOpen: boolean; appointment: Appointment | null }>({
    isOpen: false,
    appointment: null,
  });

  const slotDateLabel = slotModal.appointment?.date
    ? new Date(`${slotModal.appointment.date}T00:00:00`).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    : "";
  const centerName = activeCenter?.name || "Centro Médico";
  const normalizeRut = (value?: string | null) =>
    String(value ?? "")
      .replace(/[^0-9kK]/g, "")
      .toUpperCase();

  const patientDisplayName = formatPersonName(slotModal.appointment?.patientName) || "Paciente";
  const doctorFormattedName = formatPersonName(doctorName);
  const doctorDisplayName = doctorFormattedName
    ? `el/la ${getProfessionalPrefix(role)} ${doctorFormattedName}`
    : "el profesional asignado";
  const bookingUrl =
    typeof window !== "undefined" ? window.location.origin : "https://clavesalud-2.web.app";
  const cancelWhatsappMessage = slotModal.appointment
    ? `Estimado/a ${patientDisplayName}, le escribimos desde ${centerName}. Por motivos de fuerza mayor, ${doctorDisplayName} no podrá asistir a la consulta del ${slotDateLabel} a las ${slotModal.appointment.time}. Pedimos disculpas e invitamos a reagendar su hora por los canales habituales: teléfono del centro médico o por esta misma vía. Puedes solicitar una nueva hora aquí: ${bookingUrl}`
    : "";
  const confirmWhatsappMessage = slotModal.appointment
    ? `Estimado/a ${patientDisplayName}, lo saludamos desde ${centerName} y queremos confirmar su hora con ${doctorFormattedName || "el profesional"} para el día ${slotDateLabel} a las ${slotModal.appointment.time}. Agradecemos su confirmación, por favor.`
    : "";
  const whatsappPhone = slotModal.appointment
    ? normalizePhone(slotModal.appointment.patientPhone || "")
    : "";
  const cancelWhatsappUrl = slotModal.appointment
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(cancelWhatsappMessage)}`
    : "#";
  const confirmWhatsappUrl = slotModal.appointment
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(confirmWhatsappMessage)}`
    : "#";

  const enabledWhatsappTemplates = useMemo(
    () => whatsappTemplates.filter((template) => template.enabled),
    [whatsappTemplates]
  );

  // --- TEMPLATE HANDLERS ---
  const handleSaveTemplate = () => {
    if (!tempTemplate.title || !tempTemplate.content) return;
    let updatedTemplates: ClinicalTemplate[];
    if (isEditingTemplateId) {
      updatedTemplates = myTemplates.map((t) =>
        t.id === isEditingTemplateId ? { ...tempTemplate, id: isEditingTemplateId } : t
      );
      showToast("Plantilla actualizada", "success");
    } else {
      updatedTemplates = [...myTemplates, { ...tempTemplate, id: generateId(), roles: [role] }];
      showToast("Plantilla creada", "success");
    }
    setMyTemplates(updatedTemplates);
    setTempTemplate({ id: "", title: "", content: "" });
    setIsEditingTemplateId(null);
    onUpdateDoctor({ id: doctorId, savedTemplates: updatedTemplates } as any);
  };

  const handleEditTemplate = (t: ClinicalTemplate) => {
    setTempTemplate({ title: t.title, content: t.content, id: t.id });
    setIsEditingTemplateId(t.id);
  };

  const handleDeleteTemplate = (id: string) => {
    if (window.confirm("¿Eliminar plantilla?")) {
      const updated = myTemplates.filter((t) => t.id !== id);
      setMyTemplates(updated);
      onUpdateDoctor({ id: doctorId, savedTemplates: updated } as any);
    }
  };

  const handleResetTemplates = () => {
    if (window.confirm("¿Restaurar las plantillas originales?")) {
      const roleDefaults = DEFAULT_TEMPLATES.filter((t) => t.roles?.includes(role));
      onUpdateDoctor({ id: doctorId, savedTemplates: roleDefaults } as any);
      setMyTemplates(roleDefaults);
      showToast("Plantillas restauradas.", "success");
    }
  };

  // --- PROFILE HANDLERS ---
  const handleSaveProfile = () => {
    if (!tempProfile.label || tempProfile.exams.length === 0) {
      showToast("El perfil debe tener nombre y al menos un examen.", "error");
      return;
    }
    let updatedProfiles: ExamProfile[];
    if (isEditingProfileId) {
      updatedProfiles = myExamProfiles.map((p) =>
        p.id === isEditingProfileId ? { ...tempProfile, id: isEditingProfileId } : p
      );
      showToast("Perfil actualizado", "success");
    } else {
      updatedProfiles = [...myExamProfiles, { ...tempProfile, id: generateId() }];
      showToast("Perfil creado", "success");
    }
    setMyExamProfiles(updatedProfiles);
    setTempProfile({ id: "", label: "", exams: [], description: "" });
    setIsEditingProfileId(null);

    onUpdateDoctor({ id: doctorId, savedExamProfiles: updatedProfiles } as any);
  };

  const handleEditProfile = (p: ExamProfile) => {
    setTempProfile({ label: p.label, exams: p.exams, description: p.description, id: p.id });
    setIsEditingProfileId(p.id);
  };

  const handleDeleteProfile = (id: string) => {
    if (window.confirm("¿Eliminar perfil de exámenes?")) {
      const updated = myExamProfiles.filter((p) => p.id !== id);
      setMyExamProfiles(updated);
      onUpdateDoctor({ id: doctorId, savedExamProfiles: updated } as any);
    }
  };

  const handleResetProfiles = () => {
    if (window.confirm("¿Restaurar los perfiles de exámenes por defecto?")) {
      setMyExamProfiles(EXAM_PROFILES);
      onUpdateDoctor({ id: doctorId, savedExamProfiles: EXAM_PROFILES } as any);
      showToast("Perfiles restaurados.", "success");
    }
  };

  const toggleExamInTempProfile = (examId: string) => {
    if (tempProfile.exams.includes(examId)) {
      setTempProfile({ ...tempProfile, exams: tempProfile.exams.filter((id) => id !== examId) });
    } else {
      setTempProfile({ ...tempProfile, exams: [...tempProfile.exams, examId] });
    }
  };

  // --- CUSTOM EXAMS HANDLERS (NEW) ---
  const handleCreateCustomExam = () => {
    if (!newCustomExam.label || !newCustomExam.unit || !newCustomExam.category) {
      showToast("Complete todos los campos del nuevo examen.", "error");
      return;
    }
    const newDef: ExamDefinition = {
      id: `custom_${generateId()}`,
      label: newCustomExam.label,
      unit: newCustomExam.unit,
      category: newCustomExam.category,
    };

    const updatedCustoms = [...(currentUser?.customExams || []), newDef];
    // Update Doctor
    onUpdateDoctor({ id: doctorId, customExams: updatedCustoms } as any);
    setNewCustomExam({ label: "", unit: "", category: "" });
    showToast("Nuevo examen creado exitosamente.", "success");
  };

  const handleDeleteCustomExam = (examId: string) => {
    if (window.confirm("¿Eliminar este examen personalizado?")) {
      const updatedCustoms = (currentUser?.customExams || []).filter((e) => e.id !== examId);
      onUpdateDoctor({ id: doctorId, customExams: updatedCustoms } as any);

      // Also remove from any profile that uses it
      const updatedProfiles = myExamProfiles.map((p) => ({
        ...p,
        exams: p.exams.filter((eid) => eid !== examId),
      }));
      setMyExamProfiles(updatedProfiles);
      onUpdateDoctor({
        id: doctorId,
        savedExamProfiles: updatedProfiles,
        customExams: updatedCustoms,
      } as any);
    }
  };

  // --- PASSWORD CHANGE HANDLER ---
  const handleChangePassword = () => {
    if (!currentUser) return;
    if (!pwdState.current || !pwdState.new || !pwdState.confirm) {
      showToast("Complete todos los campos de contraseña.", "error");
      return;
    }
    if (pwdState.current !== currentUser.password) {
      showToast("La contraseña actual no es correcta.", "error");
      return;
    }
    if (pwdState.new !== pwdState.confirm) {
      showToast("Las nuevas contraseñas no coinciden.", "error");
      return;
    }
    if (pwdState.new.length < 4) {
      showToast("La nueva contraseña es muy corta.", "warning");
      return;
    }

    // Update
    onUpdateDoctor({ id: doctorId, password: pwdState.new } as any);
    showToast("Contraseña actualizada correctamente.", "success");
    setPwdState({ current: "", new: "", confirm: "" });
    // Log it
    onLogActivity({
      action: "update",
      entityType: "centerSettings",
      entityId: doctorId,
      details: "Usuario cambió su contraseña.",
      metadata: { scope: "password" },
    });
  };

  // --- KINESIOLOGY HANDLERS ---
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

  // UI Helpers based on Role
  const canSeeVitals = [
    "MEDICO",
    "ENFERMERA",
    "KINESIOLOGO",
    "MATRONA",
    "NUTRICIONISTA",
    "PREPARADOR_FISICO",
  ].includes(role);
  // Prescriber Logic: Only Medico, Odontologo, Matrona can prescribe drugs/exams
  const canPrescribeDrugs = ["MEDICO", "ODONTOLOGO", "MATRONA"].includes(role);
  // Only Medico and Odontologo can issue licenses. Matronas cannot.
  const canIssueLicense = ["MEDICO", "ODONTOLOGO"].includes(role);

  const isDentist = role === "ODONTOLOGO";
  const isPsych = role === "PSICOLOGO";
  const isPodo = role === "PODOLOGO";
  const isNutri = role === "NUTRICIONISTA";

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

  // --- RENDER SELECTED PATIENT ---
  if (selectedPatient) {
    return (
      <DoctorPatientRecord
        selectedPatient={selectedPatient}
        setSelectedPatient={setSelectedPatient}
        isEditingPatient={isEditingPatient}
        setIsEditingPatient={setIsEditingPatient}
        handleSavePatient={handleSavePatient}
        onUpdatePatient={onUpdatePatient}
        onLogActivity={onLogActivity}

        activeCenterId={activeCenterId ?? ""}
        activeCenter={activeCenter}
        hasActiveCenter={hasActiveCenter}
        moduleGuards={moduleGuards}

        doctorName={doctorName}
        doctorId={doctorId}
        role={role}
        currentUser={currentUser}
        isReadOnly={isReadOnly}

        newConsultation={newConsultation}
        setNewConsultation={setNewConsultation}
        isCreatingConsultation={isCreatingConsultation}
        setIsCreatingConsultation={setIsCreatingConsultation}
        handleVitalsChange={handleVitalsChange}
        handleExamChange={handleExamChange}
        handleCreateConsultation={handleCreateConsultation}
        selectedPatientConsultations={selectedPatientConsultations}
        isUsingLegacyConsultations={isUsingLegacyConsultations}

        docsToPrint={docsToPrint}
        setDocsToPrint={setDocsToPrint}
        isPrintModalOpen={isPrintModalOpen}
        setIsPrintModalOpen={setIsPrintModalOpen}
        isClinicalReportOpen={isClinicalReportOpen}
        setIsClinicalReportOpen={setIsClinicalReportOpen}

        selectedConsultationForModal={selectedConsultationForModal}
        setSelectedConsultationForModal={setSelectedConsultationForModal}

        isExamOrderModalOpen={isExamOrderModalOpen}
        setIsExamOrderModalOpen={setIsExamOrderModalOpen}
        examOrderCatalog={examOrderCatalog}

        myExamProfiles={myExamProfiles}
        allExamOptions={allExamOptions}
        myTemplates={myTemplates}

        sendConsultationByEmail={sendConsultationByEmail}
        safeAgeLabel={safeAgeLabel}
      />
    );
  }

  // --- RENDER PATIENT LIST / DASHBOARD LANDING ---
  return (
    <div className="flex flex-col h-screen font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-20 flex-shrink-0 gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <LogoHeader size="md" showText={false} />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Panel Médico</h1>
            <p className="text-xs text-slate-400 font-medium">Bienvenido, {doctorName}</p>
          </div>
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto justify-center">
          {activeCenter?.logoUrl && (
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-xs font-medium">Centro:</span>
              {!centerLogoError ? (
                <img
                  src={activeCenter.logoUrl}
                  alt={`Logo ${activeCenter.name}`}
                  className="h-8 w-auto max-w-[120px] object-contain rounded"
                  onError={() => setCenterLogoError(true)}
                />
              ) : (
                <span className="text-slate-700 text-sm font-bold">{activeCenter.name}</span>
              )}
            </div>
          )}
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm border border-blue-100 flex items-center gap-2 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            {
              appointments.filter(
                (a) =>
                  ((a as any).doctorUid ?? a.doctorId) === doctorId &&
                  a.status === "booked" &&
                  a.date === new Date().toISOString().split("T")[0]
              ).length
            }{" "}
            Citas Hoy
          </div>
          <LegalLinks
            onOpenTerms={() => onOpenLegal("terms")}
            onOpenPrivacy={() => onOpenLegal("privacy")}
            className="flex"
          />
          <button
            onClick={onLogout}
            className="bg-white text-slate-500 hover:text-red-500 px-4 py-2 rounded-lg font-bold text-sm border border-slate-200 hover:border-red-200 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden md:inline">Salir</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        {!hasActiveCenter && (
          <div className="bg-amber-500/20 text-amber-800 border-b border-amber-200 px-8 py-3 text-sm">
            Selecciona un centro activo para habilitar pacientes, agenda y consultas.
          </div>
        )}
        <div
          className={`max-w-7xl mx-auto w-full h-full flex flex-col ${activeTab === "settings" ? "" : "lg:overflow-hidden"}`}
        >
          {/* Tabs */}
          <div className="flex-shrink-0 px-4 md:px-8 pt-4 md:pt-8 pb-4">
            <div className="flex gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/50 w-full md:w-fit shadow-sm overflow-x-auto">
              <button
                onClick={() => setActiveTab("patients")}
                className={`px-3 md:px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "patients" ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}
              >
                <UsersRound className="w-4 h-4" /> Pacientes
              </button>
              <button
                onClick={() => setActiveTab("agenda")}
                className={`px-3 md:px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "agenda" ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}
              >
                <CalendarCheck className="w-4 h-4" /> Mi Agenda
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-3 md:px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "settings" ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}
              >
                <Settings className="w-4 h-4" /> Configuración
              </button>
            </div>
          </div>

          {/* CONTENT AREA */}
          <div
            className={`flex-1 px-4 md:px-8 pb-8 ${activeTab === "settings" ? "overflow-y-auto" : "overflow-y-auto lg:overflow-hidden"}`}
          >

            {/* CONTENT: PATIENTS LIST */}
            {activeTab === "patients" && (
              <DoctorPatientsListTab
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filteredPatients={filteredPatients}
                handleSelectPatient={handleSelectPatient}
                onSetPortfolioMode={onSetPortfolioMode}
                portfolioMode={portfolioMode}
                setFilterNextControl={setFilterNextControl}
                filterNextControl={filterNextControl}
                isReadOnly={isReadOnly}
                hasActiveCenter={hasActiveCenter}
                activeCenterId={activeCenterId}
                currentUser={currentUser}
                setSelectedPatient={setSelectedPatient}
                setIsEditingPatient={setIsEditingPatient}
                getActiveConsultations={getActiveConsultations}
                getNextControlDateFromPatient={getNextControlDateFromPatient}
                setWhatsAppMenuForPatientId={setWhatsAppMenuForPatientId}
                whatsAppMenuForPatientId={whatsAppMenuForPatientId}
                whatsAppTemplates={whatsappTemplates}
                openWhatsApp={openWhatsApp}
              />
            )}

            {/* CONTENT: AGENDA VIEW */}
            {activeTab === "agenda" && moduleGuards.agenda && (
              <DoctorAgendaTab
                isAdministrativo={isAdministrativo}
                clinicalDoctors={clinicalDoctors}
                viewingDoctorId={viewingDoctorId}
                setViewingDoctorId={setViewingDoctorId}
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                selectedAgendaDate={selectedAgendaDate}
                setSelectedAgendaDate={setSelectedAgendaDate}
                appointments={appointments}
                effectiveDoctorId={effectiveDoctorId}
                effectiveAgendaConfig={effectiveAgendaConfig}
                isSyncingAppointments={isSyncingAppointments}
                isReadOnly={isReadOnly}
                hasActiveCenter={hasActiveCenter}
                currentUser={currentUser}
                activeCenterId={activeCenterId}
                onUpdateAppointments={onUpdateAppointments}
                setSlotModal={setSlotModal}
                handleOpenPatientFromAppointment={handleOpenPatientFromAppointment}
              />
            )}

            {/* CONTENT: SETTINGS (TEMPLATES & PROFILES) */}
            {activeTab === "settings" && (
              <DoctorSettingsTab
                currentUser={currentUser}
                doctorId={doctorId}
                role={role}
                moduleGuards={moduleGuards}
                isReadOnly={isReadOnly}
                onUpdateDoctor={onUpdateDoctor}
                onLogActivity={onLogActivity}
                myExamProfiles={myExamProfiles}
                setMyExamProfiles={setMyExamProfiles}
                tempProfile={tempProfile}
                setTempProfile={setTempProfile}
                isEditingProfileId={isEditingProfileId}
                setIsEditingProfileId={setIsEditingProfileId}
                allExamOptions={allExamOptions}
                newCustomExam={newCustomExam}
                setNewCustomExam={setNewCustomExam}
                myTemplates={myTemplates}
                setMyTemplates={setMyTemplates}
                tempTemplate={tempTemplate}
                setTempTemplate={setTempTemplate}
                isEditingTemplateId={isEditingTemplateId}
                setIsEditingTemplateId={setIsEditingTemplateId}
                isCatalogOpen={isCatalogOpen}
                setIsCatalogOpen={setIsCatalogOpen}
                catalogSearch={catalogSearch}
                setCatalogSearch={setCatalogSearch}
                pwdState={pwdState}
                setPwdState={setPwdState}
              />
            )}
            {/* Slot Modal (For Agenda) */}
            {slotModal.isOpen && slotModal.appointment && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fadeIn">
                  <h3 className="font-bold text-lg mb-2">Detalle de Cita</h3>
                  <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-100">
                    <p className="font-bold text-slate-800">
                      {formatPersonName(slotModal.appointment.patientName)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {slotModal.appointment.patientRut} • {slotModal.appointment.patientPhone}
                    </p>
                    <div className="mt-2 text-xs font-bold text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded w-fit">
                      {slotModal.appointment.date} - {slotModal.appointment.time}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => setSlotModal({ isOpen: false, appointment: null })}
                      className="py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      Cerrar
                    </button>
                    <a
                      href={cancelWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" /> Cancelar hora por WhatsApp
                    </a>
                    <a
                      href={confirmWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" /> Confirmar hora por WhatsApp
                    </a>
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">
                        Plantillas del centro
                      </p>
                      {whatsappTemplatesError && (
                        <div className="text-xs text-red-500 mb-2">{whatsappTemplatesError}</div>
                      )}
                      {enabledWhatsappTemplates.length === 0 && !whatsappTemplatesError && (
                        <div className="text-xs text-slate-400">No hay plantillas habilitadas.</div>
                      )}
                      <div className="flex flex-col gap-2">
                        {enabledWhatsappTemplates.map((template) => {
                          const templateMessage = applyWhatsappTemplate(template.body, {
                            patientName: patientDisplayName,
                            nextControlDate: slotDateLabel,
                            centerName,
                          });
                          const whatsappPhone = slotModal.appointment
                            ? normalizePhone(slotModal.appointment.patientPhone || "")
                            : "";
                          const templateUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
                            templateMessage
                          )}`;
                          return (
                            <a
                              key={template.id}
                              href={templateUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                              <MessageCircle className="w-4 h-4" /> {template.title}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {/* FEEDBACK BUTTON (Floating) */}
      <a
        href="mailto:soporte@clavesalud.cl?subject=Reporte%20de%20Problema%20-%20ClaveSalud&body=Hola%2C%20encontr%C3%A9%20el%20siguiente%20problema%3A%0A%0A"
        className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg hover:bg-slate-900 transition-colors flex items-center gap-2 z-50 text-sm font-medium"
        target="_blank"
        rel="noreferrer"
      >
        <span className="bg-red-500 rounded-full w-2 h-2 animate-pulse"></span>
        Reportar Problema
      </a>
    </div>
  );
};

export default ProfessionalDashboard;
