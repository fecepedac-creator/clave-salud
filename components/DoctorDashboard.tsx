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
  sanitizeText,
  base64ToBlob,
  normalizePhone,
  formatPersonName,
  applyWhatsappTemplate,
  openEmailCompose,
} from "../utils";
import {
  COMMON_DIAGNOSES,
  DEFAULT_TEMPLATES,
  EXAM_PROFILES,
  TRACKED_EXAMS_OPTIONS,
} from "../constants";
import {
  Search,
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
} from "lucide-react";
import { useToast } from "./Toast";
import { CenterContext } from "../CenterContext";
import { collection, addDoc, serverTimestamp, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { logAccessSafe, useAuditLog } from "../hooks/useAuditLog";

// Sub-components
import VitalsForm from "./VitalsForm";
import PrescriptionManager from "./PrescriptionManager";
import ConsultationHistory from "./ConsultationHistory";
import AgendaView from "./AgendaView";
import PatientSidebar from "./PatientSidebar";
import PatientDetail from "./PatientDetail";
import PrintPreviewModal from "./PrintPreviewModal";
import ClinicalReportModal from "./ClinicalReportModal";
import AutocompleteInput from "./AutocompleteInput";
import Odontogram from "./Odontogram";
import BioMarkers from "./BioMarkers";
import LogoHeader from "./LogoHeader";
import LegalLinks from "./LegalLinks";

interface ProfessionalDashboardProps {
  patients: Patient[];
  doctorName: string; // Professional Name
  doctorId: string; // Professional ID
  role: ProfessionalRole;
  agendaConfig?: AgendaConfig;
  savedTemplates?: ClinicalTemplate[];
  currentUser?: Doctor;
  onUpdatePatient: (updatedPatient: Patient) => void;
  onUpdateDoctor: (updatedDoctor: Doctor) => void;
  onLogout: () => void;
  onOpenLegal: (target: "terms" | "privacy") => void;
  appointments: Appointment[];
  onUpdateAppointments: (appointments: Appointment[]) => void;
  onLogActivity: (event: AuditLogEvent) => void;
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

export const ProfessionalDashboard: React.FC<ProfessionalDashboardProps> = ({
  patients,
  doctorName,
  doctorId,
  role,
  agendaConfig,
  savedTemplates,
  currentUser,
  onUpdatePatient,
  onUpdateDoctor,
  onLogout,
  onOpenLegal,
  appointments,
  onUpdateAppointments,
  onLogActivity,
  isReadOnly = false,
  isSyncingAppointments = false,
}) => {
  const { showToast } = useToast();
  const { logAccess } = useAuditLog();
  const [activeTab, setActiveTab] = useState<"patients" | "agenda" | "reminders" | "settings">(
    "patients"
  );
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(""); // FIX: was referenced but not defined
  const [isCreatingConsultation, setIsCreatingConsultation] = useState(false);
  const [centerLogoError, setCenterLogoError] = useState(false);

  // --- contexto del centro ---
  const { activeCenterId, activeCenter, isModuleEnabled } = useContext(CenterContext);
  const hasActiveCenter = Boolean(activeCenterId);
  const anthropometryEnabled = Boolean(activeCenter?.features?.anthropometryEnabled);

  // Load WhatsApp templates configured by Center Admin (fallback to defaults)
  useEffect(() => {
    const loadTemplates = async () => {
      if (!activeCenterId) return;
      try {
        const whatsappRef = doc(db, "centers", activeCenterId, "settings", "whatsapp");
        const snap = await getDoc(whatsappRef);
        const data = snap.exists() ? (snap.data() as any) : null;

        const templatesRaw = Array.isArray(data?.templates) ? data.templates : null;
        if (!templatesRaw) {
          setWhatsAppTemplates(DEFAULT_WHATSAPP_TEMPLATES);
          return;
        }

        const parsed: WhatsAppTemplate[] = templatesRaw
          .map((t: any, i: number) => ({
            id: String(t.id ?? i),
            title: String(t.title ?? "Plantilla"),
            body: String(t.body ?? ""),
            enabled: Boolean(t.enabled ?? true),
          }))
          .filter((t: WhatsAppTemplate) => t.body.trim().length > 0);

        setWhatsAppTemplates(parsed.length ? parsed : DEFAULT_WHATSAPP_TEMPLATES);
      } catch (err) {
        // If something fails, we keep defaults (do not block UI)
        setWhatsAppTemplates(DEFAULT_WHATSAPP_TEMPLATES);
      }
    };

    loadTemplates();
  }, [activeCenterId]);

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

  const selectedPatientConsultations = selectedPatient
    ? getActiveConsultations(selectedPatient)
    : [];

  const buildWhatsAppText = (templateBody: string, p: Patient) => {
    const centerName = activeCenter?.name ?? "Centro Médico";
    const nextCtrl = getNextControlDateFromPatient(p);
    const nextCtrlStr = nextCtrl ? nextCtrl.toLocaleDateString("es-CL") : "";
    return templateBody
      .replaceAll("{patientName}", formatPersonName(p.fullName) || "Paciente")
      .replaceAll("{centerName}", centerName)
      .replaceAll("{nextControlDate}", nextCtrlStr);
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
    lines.push(`Profesional: Dr. ${consultation.professionalName || "-"}`);
    lines.push("");
    lines.push(`Motivo: ${consultation.reason || "-"}`);
    lines.push(`Diagnóstico / Hipótesis: ${consultation.diagnosis || "-"}`);
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
  const getEmptyConsultation = (): Partial<Consultation> => ({
    weight: "",
    height: "",
    bmi: "",
    bloodPressure: "",
    hgt: "",
    waist: "",
    hip: "",
    reason: "",
    anamnesis: "",
    physicalExam: "",
    diagnosis: "",
    prescriptions: [],
    dentalMap: [],
    exams: {},
    nextControlDate: "",
    nextControlReason: "",
    reminderActive: false,
  });

  // --- módulos del centro (SuperAdmin) ---
  const moduleGuards = useMemo(
    () => ({
      patients: isModuleEnabled ? isModuleEnabled("patients") : true,
      agenda: isModuleEnabled ? isModuleEnabled("agenda") : true,
      prescriptions: isModuleEnabled ? isModuleEnabled("prescriptions") : true,
      vitals: isModuleEnabled ? isModuleEnabled("vitals") : true,
      exams: isModuleEnabled ? isModuleEnabled("exams") : true,
      dental: isModuleEnabled ? isModuleEnabled("dental") : true,
      settings: isModuleEnabled ? isModuleEnabled("settings") : true,
    }),
    [isModuleEnabled]
  );
  // Edit Mode State
  const [isEditingPatient, setIsEditingPatient] = useState(false);

  const [showLicenciaOptions, setShowLicenciaOptions] = useState(false);
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [safePdfUrl, setSafePdfUrl] = useState<string>("");

  // Printing State
  const [docsToPrint, setDocsToPrint] = useState<Prescription[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isClinicalReportOpen, setIsClinicalReportOpen] = useState(false);

  // Agenda State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<string>("");
  const [slotModal, setSlotModal] = useState<{ isOpen: boolean; appointment: Appointment | null }>({
    isOpen: false,
    appointment: null,
  });
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsappTemplate[]>([]);
  const [whatsappTemplatesError, setWhatsappTemplatesError] = useState<string | null>(null);

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
  
  // Helper function to handle patient selection with audit logging
  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    
    // Log patient access for audit trail (DS 41 MINSAL)
    if (activeCenterId && patient.id) {
      logAccessSafe(logAccess, {
        centerId: activeCenterId,
        resourceType: "patient",
        resourcePath: `/centers/${activeCenterId}/patients/${patient.id}`,
        patientId: patient.id,
        actorUid: auth.currentUser?.uid ?? undefined,
      });
    }
  };
  
  const handleOpenPatientFromAppointment = (appointment: Appointment) => {
    const foundById = appointment.patientId
      ? patients.find((patient) => patient.id === appointment.patientId)
      : null;
    const appointmentRut = normalizeRut(appointment.patientRut);
    const foundByRut =
      !foundById && appointmentRut
        ? patients.find((patient) => normalizeRut(patient.rut) === appointmentRut)
        : null;
    const resolvedPatient = foundById ?? foundByRut ?? null;

    if (resolvedPatient) {
      handleSelectPatient(resolvedPatient);
      setActiveTab("patients");
      return;
    }

    showToast("Paciente no encontrado; revisa si fue creado", "warning");
  };
  const patientDisplayName = formatPersonName(slotModal.appointment?.patientName) || "Paciente";
  const doctorFormattedName = formatPersonName(doctorName);
  const doctorDisplayName = doctorFormattedName
    ? `el Dr. ${doctorFormattedName}`
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

  useEffect(() => {
    if (!db || !activeCenterId) {
      setWhatsappTemplates([]);
      setWhatsappTemplatesError(null);
      return;
    }

    const docRef = doc(db, "centers", activeCenterId, "settings", "whatsapp");
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const data = snapshot.data();
        setWhatsappTemplates(
          Array.isArray(data?.templates) ? (data?.templates as WhatsappTemplate[]) : []
        );
        setWhatsappTemplatesError(null);
      },
      (error) => {
        const message =
          error.code === "permission-denied"
            ? "Sin permisos para leer plantillas de WhatsApp."
            : "Error cargando plantillas de WhatsApp.";
        setWhatsappTemplatesError(message);
      }
    );

    return () => unsubscribe();
  }, [activeCenterId]);

  const enabledWhatsappTemplates = useMemo(
    () => whatsappTemplates.filter((template) => template.enabled),
    [whatsappTemplates]
  );

  // New Consultation State
  const [newConsultation, setNewConsultation] =
    useState<Partial<Consultation>>(getEmptyConsultation());

  // Templates State
  const [myTemplates, setMyTemplates] = useState<ClinicalTemplate[]>([]);
  const [tempTemplate, setTempTemplate] = useState<ClinicalTemplate>({
    id: "",
    title: "",
    content: "",
  });
  const [isEditingTemplateId, setIsEditingTemplateId] = useState<string | null>(null);

  // Exam Profiles State
  const [myExamProfiles, setMyExamProfiles] = useState<ExamProfile[]>([]);
  const [tempProfile, setTempProfile] = useState<ExamProfile>({
    id: "",
    label: "",
    exams: [],
    description: "",
  });
  const [isEditingProfileId, setIsEditingProfileId] = useState<string | null>(null);

  // Custom Exams State
  const [newCustomExam, setNewCustomExam] = useState<Partial<ExamDefinition>>({
    label: "",
    unit: "",
    category: "",
  });

  // Password Change State
  const [pwdState, setPwdState] = useState({ current: "", new: "", confirm: "" });

  const [filterNextControl, setFilterNextControl] = useState<"all" | "week" | "month">("all");

  // --- WhatsApp templates (per center) ---
  type WhatsAppTemplate = {
    id: string;
    title: string;
    body: string;
    enabled: boolean;
  };

  const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
    {
      id: "reminder",
      title: "Recordatorio control",
      body:
        "Hola {patientName}, le recordamos su control el {nextControlDate} en {centerName}. Si desea confirmar, responda a este mensaje. Si necesita reagendar, indíquenos un horario alternativo.",
      enabled: true,
    },
    {
      id: "confirm",
      title: "Confirmación asistencia",
      body:
        "Hola {patientName}, desde {centerName} queremos confirmar su asistencia al control del {nextControlDate}. ¿Confirma su asistencia?",
      enabled: true,
    },
    {
      id: "reschedule",
      title: "Reagendar",
      body:
        "Hola {patientName}, desde {centerName}. Vimos que tiene un control próximo ({nextControlDate}). Si no puede asistir, indíquenos por favor un horario alternativo para reagendar.",
      enabled: true,
    },
  ];

  const [whatsAppTemplates, setWhatsAppTemplates] = useState<WhatsAppTemplate[]>(
    DEFAULT_WHATSAPP_TEMPLATES
  );
  const [whatsAppMenuForPatientId, setWhatsAppMenuForPatientId] = useState<string | null>(null);

  // --- COMBINED EXAM OPTIONS (Default + Custom) ---
  const allExamOptions = useMemo(() => {
    const customs = currentUser?.customExams || [];
    return [...TRACKED_EXAMS_OPTIONS, ...customs];
  }, [currentUser?.customExams]);

  // Load Doctor Data (Templates & Profiles)
  useEffect(() => {
    // Templates
    const nextTemplates = Array.isArray(savedTemplates)
      ? savedTemplates
      : DEFAULT_TEMPLATES.filter((t) => t.roles?.includes(role));

    setMyTemplates((prev) =>
      sameById(prev, nextTemplates, ["title", "content"]) ? prev : nextTemplates
    );

    // Exam profiles
    const nextProfiles =
      currentUser?.savedExamProfiles && currentUser.savedExamProfiles.length > 0
        ? currentUser.savedExamProfiles
        : EXAM_PROFILES;

    setMyExamProfiles((prev) =>
      sameById(prev, nextProfiles, ["label", "description"]) ? prev : nextProfiles
    );
  }, [role, savedTemplates, currentUser?.savedExamProfiles]);

  // PDF Safety
  useEffect(() => {
    if (previewFile && previewFile.type === "pdf") {
      const blob = base64ToBlob(previewFile.url);
      const url = URL.createObjectURL(blob);
      setSafePdfUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setSafePdfUrl("");
    }
  }, [previewFile]);

  // Filter Patients
  const activePatients = patients.filter(
    (p) => p.active !== false && (p as any).activo !== false
  );

  const filteredPatients = activePatients.filter((p) => {
    // Filter by active center first
    if (activeCenterId && p.centerId !== activeCenterId) return false;

    // Show if linked to this professional OR if filtering by all
    const nameMatch =
      p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || p.rut.includes(searchTerm);
    if (!nameMatch) return false;

    // Control date filter
    if (filterNextControl !== "all") {
      // SAFE ACCESS: Check if consultations exist and is array
      const consults = getActiveConsultations(p);
      const lastConsultation = consults.length > 0 ? consults[0] : null;

      if (!lastConsultation || !lastConsultation.nextControlDate) return false;
      const date = new Date(lastConsultation.nextControlDate + "T12:00:00");
      const now = new Date();
      const limit = new Date();
      if (filterNextControl === "week") limit.setDate(now.getDate() + 7);
      else limit.setMonth(now.getMonth() + 1);

      return date <= limit && date >= now;
    }
    return true;
  });

  // Vitals logic
  const handleVitalsChange = (field: keyof Consultation, value: string) => {
    let finalValue = value;

    if (field === "bloodPressure") {
      const rawNumbers = value.replace(/\D/g, "");
      if (rawNumbers.length > 6) return;
      if (rawNumbers.length >= 4) {
        finalValue = `${rawNumbers.slice(0, -2)}/${rawNumbers.slice(-2)}`;
      } else {
        finalValue = rawNumbers;
      }
    }

    const updated = { ...newConsultation, [field]: finalValue };
    if (field === "weight" || field === "height") {
      const weight = parseFloat(updated.weight || "0");
      const height = parseFloat(updated.height || "0") / 100;
      if (weight > 0 && height > 0) {
        updated.bmi = (weight / (height * height)).toFixed(1);
      }
    }
    setNewConsultation(updated);
  };

  const handleExamChange = (examId: string, value: string) => {
    setNewConsultation((prev) => ({
      ...prev,
      exams: { ...prev.exams, [examId]: value },
    }));
  };

  const handleCreateConsultation = async () => {
    if (!selectedPatient) return;

    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo antes de guardar.", "warning");
      return;
    }

    const professionalName = (currentUser?.fullName ?? doctorName ?? "").trim();
    const professionalRut = (currentUser?.rut ?? "").trim();
    const professionalRole = (currentUser?.role ?? role) as ProfessionalRole;

    if (!professionalName || !professionalRut) {
      showToast(
        "Completa tu perfil profesional (nombre y RUT) antes de registrar una atención.",
        "warning"
      );
      return;
    }

    // Construye un objeto consulta (local + nube)
    const consultation: Consultation = {
      id: generateId(),
      date: new Date().toISOString(),
      ...(newConsultation as any),
      prescriptions: (newConsultation.prescriptions || []) as any,
      dentalMap: (newConsultation.dentalMap || []) as any,
      exams: (newConsultation.exams || {}) as any,
      nextControlDate: (newConsultation.nextControlDate || "") as any,
      nextControlReason: (newConsultation.nextControlReason || "") as any,
      reminderActive: Boolean((newConsultation as any).reminderActive),
      active: true,
      patientId: selectedPatient.id as any,
      centerId: activeCenterId as any,
      createdBy: (auth.currentUser?.uid ?? doctorId) as any,
      professionalId: auth.currentUser?.uid ?? doctorId,
      professionalName,
      professionalRole,
      professionalRut,
    } as any;

    // 1) Guardar en Firestore (colección "consultations")
    try {
      if (!activeCenterId) throw new Error("Centro no seleccionado");
      await addDoc(collection(db, "centers", activeCenterId, "consultations"), {
        ...consultation,
        centerId: activeCenterId,
        patientId: selectedPatient?.id ?? null,
        createdByUid: auth.currentUser?.uid ?? doctorId,
        createdAt: serverTimestamp(),
      } as any);
      showToast("Atención guardada correctamente en la nube", "success");
    } catch (error) {
      console.error(error);
      showToast("Error al guardar en la nube (se guardó localmente)", "error");
    }

    // 2) Actualizar estado local (lista de pacientes)
    const updatedPatient: Patient = {
      ...selectedPatient,
      consultations: [consultation, ...(selectedPatient.consultations || [])],
      lastUpdated: new Date().toISOString(),
    };

    onUpdatePatient(updatedPatient);

    // 3) Auditoría
    try {
      onLogActivity({
        action: "CONSULTATION_CREATE",
        entityType: "consultation",
        entityId: consultation.id,
        patientId: selectedPatient.id,
        details: `Creó atención para ${selectedPatient.fullName}. Motivo: ${(consultation as any).reason || ""}`,
      });
    } catch {
      // no-op
    }

    // 4) Reset UI
    setSelectedPatient(updatedPatient);
    setIsCreatingConsultation(false);
    setNewConsultation(getEmptyConsultation());
    setActiveTab("patients");
  };

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

  // UI Helpers based on Role
  const canSeeVitals = ["Medico", "Enfermera", "Kinesiologo", "Matrona", "Nutricionista"].includes(
    role
  );
  // Prescriber Logic: Only Medico, Odontologo, Matrona can prescribe drugs/exams
  const canPrescribeDrugs = ["Medico", "Odontologo", "Matrona"].includes(role);
  // Only Medico and Odontologo can issue licenses. Matronas cannot.
  const canIssueLicense = ["Medico", "Odontologo"].includes(role);

  const isDentist = role === "Odontologo";
  const isPsych = role === "Psicologo";

  // --- RENDER SELECTED PATIENT ---
  if (selectedPatient) {
    return (
      <div className="flex flex-col h-screen font-sans animate-fadeIn">
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
          doctorName={doctorName}
          centerName={activeCenter?.name}
          centerLogoUrl={activeCenter?.logoUrl}
          selectedPatient={selectedPatient}
        />

        <ClinicalReportModal
          isOpen={isClinicalReportOpen}
          onClose={() => setIsClinicalReportOpen(false)}
          patient={selectedPatient}
          centerName={activeCenter?.name ?? "Centro Médico"}
          centerLogoUrl={activeCenter?.logoUrl}
          professionalName={doctorName}
          professionalRole={role}
          professionalRegistry={currentUser?.rut}
          examDefinitions={currentUser?.customExams}
        />

        <header className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedPatient(null)}
              className="text-slate-400 hover:text-slate-700 transition-colors p-2 hover:bg-slate-100/50 rounded-full"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <LogoHeader size="sm" showText={true} />
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {formatPersonName(selectedPatient.fullName)}
                <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full font-mono font-medium border border-primary-100">
                  {selectedPatient.rut}
                </span>
              </h1>
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                <span>
                  {safeAgeLabel(selectedPatient.birthDate)} • {selectedPatient.gender}
                </span>
                {/* Fallback empty array to prevent BioMarkers crash */}
                <BioMarkers
                  activeExams={selectedPatient.activeExams || []}
                  consultations={selectedPatientConsultations}
                  examOptions={allExamOptions} // Pass dynamic options
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <div className="h-full max-w-[1800px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12">
            {/* SIDEBAR */}
            <PatientSidebar
              selectedPatient={selectedPatient}
              isEditingPatient={isEditingPatient}
              toggleEditPatient={() => {
                if (isEditingPatient) {
                  onUpdatePatient(selectedPatient);
                  // LOG ACTIVITY
                  onLogActivity({
                    action: "PATIENT_UPDATE",
                    entityType: "patient",
                    entityId: selectedPatient.id,
                    patientId: selectedPatient.id,
                    details: `Actualizó datos ficha de ${selectedPatient.fullName}`,
                  });
                  showToast("Guardado", "success");
                }
                setIsEditingPatient(!isEditingPatient);
              }}
              handleEditPatientField={(f, v) => setSelectedPatient({ ...selectedPatient, [f]: v })}
              onFileUpload={(e) => {
                if (e.target.files?.[0]) {
                  const f = e.target.files[0];
                  const att: Attachment = {
                    id: generateId(),
                    name: f.name,
                    type: f.type.includes("image") ? "image" : "pdf",
                    date: new Date().toISOString(),
                    url: URL.createObjectURL(f),
                  };
                  const up = {
                    ...selectedPatient,
                    attachments: [...(selectedPatient.attachments || []), att],
                  }; // SAFE
                  onUpdatePatient(up);
                  setSelectedPatient(up);
                  onLogActivity({
                    action: "PATIENT_UPDATE",
                    entityType: "patient",
                    entityId: selectedPatient.id,
                    patientId: selectedPatient.id,
                    details: `Subió archivo ${f.name} a paciente ${selectedPatient.fullName}`,
                  });
                }
              }}
              onPreviewFile={setPreviewFile}
              readOnly={isReadOnly}
              availableProfiles={myExamProfiles}
              examOptions={allExamOptions} // PASS DYNAMIC OPTIONS
            />

            {/* MAIN CONTENT */}
            <section className="lg:col-span-9 h-full overflow-y-auto bg-slate-50/30 p-6 lg:p-10">
              {!isCreatingConsultation && (
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">Historial Clínico</h2>
                    <p className="text-slate-500 text-base mt-1 flex items-center gap-2">
                      <span className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded text-xs uppercase font-bold">
                        {role}
                      </span>
                      {selectedPatientConsultations.length}{" "}
                      atenciones registradas
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={() => setIsCreatingConsultation(true)}
                      disabled={!hasActiveCenter}
                      title={hasActiveCenter ? "Crear atención" : "Selecciona un centro activo"}
                      className="bg-primary-600 text-white pl-6 pr-8 py-4 rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 flex items-center gap-2 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-6 h-6" /> Nueva Atención
                    </button>
                  )}
                </div>
              )}

              {isCreatingConsultation ? (
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 animate-slideUp">
                  <div className="bg-slate-800 text-white px-8 py-5 flex justify-between items-center rounded-t-2xl">
                    <h3 className="font-bold text-xl flex items-center gap-2">
                      <FileText className="w-6 h-6 text-primary-400" /> Nueva Atención ({role})
                    </h3>
                    <button
                      onClick={() => setIsCreatingConsultation(false)}
                      className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-8 md:p-10 space-y-10">
                    {/* 1. Vitals & Bio-Markers (Conditional) */}
                    {canSeeVitals && !moduleGuards.vitals && (
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                        Módulo de Signos Vitales deshabilitado por el administrador del centro.
                      </div>
                    )}
                    {canSeeVitals && moduleGuards.vitals && (
                      <VitalsForm
                        newConsultation={newConsultation}
                        onChange={handleVitalsChange}
                        onExamChange={handleExamChange} // NEW
                        consultationHistory={selectedPatientConsultations} // SAFETY: Fallback to empty array
                        activeExams={selectedPatient.activeExams || []} // SAFETY: Fallback to empty array
                        patientBirthDate={selectedPatient.birthDate} // NEW
                        patientGender={selectedPatient.gender} // NEW
                        examOptions={allExamOptions} // PASS DYNAMIC OPTIONS
                        role={role} // PASS ROLE
                        anthropometryEnabled={anthropometryEnabled}
                      />
                    )}

                    {/* 2. Odontogram (Conditional) */}
                    {isDentist && !moduleGuards.dental && (
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                        Módulo de Odontograma deshabilitado por el administrador del centro.
                      </div>
                    )}
                    {isDentist && moduleGuards.dental && (
                      <Odontogram
                        value={newConsultation.dentalMap || []}
                        onChange={(val) =>
                          setNewConsultation({ ...newConsultation, dentalMap: val })
                        }
                      />
                    )}

                    {/* 3. Clinical Data (Adaptive) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="col-span-full">
                        <label className="block text-lg font-bold text-slate-700 mb-3">
                          Motivo de Consulta
                        </label>
                        <input
                          value={newConsultation.reason}
                          onChange={(e) =>
                            setNewConsultation({ ...newConsultation, reason: e.target.value })
                          }
                          className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none font-medium text-xl text-slate-800"
                        />
                      </div>
                      <div className={isPsych ? "col-span-full" : ""}>
                        <label className="block text-lg font-bold text-slate-700 mb-3">
                          {isPsych ? "Desarrollo de la Sesión / Evolución" : "Anamnesis Próxima"}
                        </label>
                        <textarea
                          value={newConsultation.anamnesis}
                          onChange={(e) =>
                            setNewConsultation({ ...newConsultation, anamnesis: e.target.value })
                          }
                          spellCheck={true}
                          className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none resize-none h-60 text-lg leading-relaxed text-slate-700"
                        />
                      </div>
                      {!isPsych && (
                        <div>
                          <label className="block text-lg font-bold text-slate-700 mb-3">
                            Examen Físico
                          </label>
                          <textarea
                            value={newConsultation.physicalExam}
                            onChange={(e) =>
                              setNewConsultation({
                                ...newConsultation,
                                physicalExam: e.target.value,
                              })
                            }
                            spellCheck={true}
                            className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none resize-none h-60 text-lg leading-relaxed text-slate-700"
                          />
                        </div>
                      )}
                      <div className="col-span-full">
                        <label className="block text-lg font-bold text-slate-700 mb-3">
                          Diagnóstico / Hipótesis
                        </label>
                        <AutocompleteInput
                          value={newConsultation.diagnosis || ""}
                          onChange={(val) =>
                            setNewConsultation({ ...newConsultation, diagnosis: val })
                          }
                          options={COMMON_DIAGNOSES}
                          className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none font-bold text-xl text-slate-800"
                        />
                      </div>
                    </div>

                    {/* 4. Indications / Prescriptions (Filtered by Role) */}
                    <div
                      className={
                        !canPrescribeDrugs
                          ? "bg-slate-50 p-6 rounded-2xl border border-slate-200"
                          : ""
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
                              setNewConsultation({
                                ...newConsultation,
                                prescriptions: [...(newConsultation.prescriptions || []), doc],
                              })
                            }
                            onRemovePrescription={(id) =>
                              setNewConsultation({
                                ...newConsultation,
                                prescriptions: newConsultation.prescriptions?.filter(
                                  (p) => p.id !== id
                                ),
                              })
                            }
                            onPrint={(docs) => {
                              setDocsToPrint(docs);
                              setIsPrintModalOpen(true);
                            }}
                            onOpenClinicalReport={() => setIsClinicalReportOpen(true)}
                            templates={myTemplates}
                            role={role}
                          />

                          {!canPrescribeDrugs && (
                            <p className="text-xs text-slate-400 mt-2 italic">
                              * Su perfil no permite emitir recetas de medicamentos o exámenes, solo
                              indicaciones y certificados.
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                          Módulo de Indicaciones/Recetas deshabilitado por el administrador del
                          centro.
                        </div>
                      )}{" "}
                    </div>

                    {/* 5. Next Control */}
                    <div className="bg-secondary-50 p-8 rounded-3xl border border-secondary-100">
                      <h4 className="text-secondary-900 font-bold text-lg uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Calendar className="w-5 h-5" /> Próximo Control
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-lg font-bold text-slate-700 mb-3">
                            Fecha Estimada
                          </label>
                          <input
                            type="date"
                            value={newConsultation.nextControlDate}
                            onChange={(e) =>
                              setNewConsultation({
                                ...newConsultation,
                                nextControlDate: e.target.value,
                              })
                            }
                            className="w-full p-4 border-2 border-secondary-200 rounded-xl outline-none focus:border-secondary-500 bg-white text-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-lg font-bold text-slate-700 mb-3">
                            Indicaciones / Requisitos
                          </label>
                          <input
                            placeholder="Ej: Traer radiografía..."
                            value={newConsultation.nextControlReason}
                            onChange={(e) =>
                              setNewConsultation({
                                ...newConsultation,
                                nextControlReason: e.target.value,
                              })
                            }
                            className="w-full p-4 border-2 border-secondary-200 rounded-xl outline-none focus:border-secondary-500 bg-white text-lg"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end items-center pt-8 border-t border-slate-100 gap-4 relative">
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
                        onClick={handleCreateConsultation}
                        disabled={!hasActiveCenter}
                        title={hasActiveCenter ? "Guardar atención" : "Selecciona un centro activo"}
                        className="bg-primary-600 text-white px-10 py-5 rounded-2xl font-bold hover:bg-primary-700 shadow-xl shadow-primary-200 transition-all transform active:scale-95 flex items-center gap-3 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-7 h-7" /> Guardar Atención
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <ConsultationHistory
                  consultations={selectedPatientConsultations} // SAFETY: Fallback to empty array
                  centerId={activeCenterId}
                  patientId={selectedPatient.id}
                  onPrint={(docs) => {
                    setDocsToPrint(docs);
                    setIsPrintModalOpen(true);
                  }}
                  onSendEmail={(c) => {
                    showToast("Abriendo correo...", "info");
                    sendConsultationByEmail(c);
                  }}
                />
              )}
            </section>
          </div>
        </main>
      </div>
    );
  }

  // --- RENDER PATIENT LIST / DASHBOARD LANDING ---
  return (
    <div className="flex flex-col h-screen font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm px-8 py-4 flex justify-between items-center sticky top-0 z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <LogoHeader size="md" showText={false} />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Panel Médico</h1>
            <p className="text-xs text-slate-400 font-medium">Bienvenido, {doctorName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm border border-blue-100 flex items-center gap-2">
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
            <LogOut className="w-4 h-4" /> Salir
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
          className={`max-w-7xl mx-auto w-full h-full flex flex-col ${activeTab === "settings" ? "" : "overflow-hidden"}`}
        >
          {/* Tabs */}
          <div className="flex-shrink-0 px-8 pt-8 pb-4">
            <div className="flex gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/50 w-fit shadow-sm">
              <button
                onClick={() => setActiveTab("patients")}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === "patients" ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}
              >
                <UsersRound className="w-4 h-4" /> Pacientes
              </button>
              <button
                onClick={() => setActiveTab("agenda")}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === "agenda" ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}
              >
                <CalendarCheck className="w-4 h-4" /> Mi Agenda
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === "settings" ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}
              >
                <Settings className="w-4 h-4" /> Configuración
              </button>
            </div>
          </div>

          {/* CONTENT AREA */}
          <div
            className={`flex-1 px-8 pb-8 ${activeTab === "settings" ? "overflow-y-auto" : "overflow-hidden"}`}
          >
            {/* CONTENT: PATIENTS LIST */}
            {activeTab === "patients" && (
              <div className="h-full bg-white/80 backdrop-blur-md rounded-3xl border border-white/50 shadow-xl overflow-hidden flex flex-col animate-fadeIn">
                {/* Toolbar */}
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 flex-shrink-0">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o RUT..."
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium text-slate-700 bg-white"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                      <button
                        onClick={() => setFilterNextControl("all")}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterNextControl === "all" ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => setFilterNextControl("week")}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterNextControl === "week" ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Control 7d
                      </button>
                      <button
                        onClick={() => setFilterNextControl("month")}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterNextControl === "month" ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Control 30d
                      </button>
                    </div>
                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          if (!hasActiveCenter) {
                            showToast(
                              "Selecciona un centro activo para crear pacientes.",
                              "warning"
                            );
                            return;
                          }
                          const newP: Patient = {
                            id: generateId(),
                            centerId: activeCenterId || "", // Set from active center (fallback empty)
                            rut: "",
                            fullName: "Nuevo Paciente",
                            birthDate: new Date().toISOString(),
                            gender: "Otro",
                            medicalHistory: [],
                            surgicalHistory: [],
                            medications: [],
                            allergies: [],
                            consultations: [],
                            attachments: [],
                            livingWith: [],
                            smokingStatus: "No fumador",
                            alcoholStatus: "No consumo",
                            lastUpdated: new Date().toISOString(),
                            active: true,
                          };
                          setSelectedPatient(newP);
                          setIsEditingPatient(true);
                        }}
                        disabled={!hasActiveCenter}
                        title={hasActiveCenter ? "Crear paciente" : "Selecciona un centro activo"}
                        className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 flex items-center gap-2 shadow-lg shadow-slate-200 transition-transform active:scale-95"
                      >
                        <Plus className="w-5 h-5" /> Nuevo Paciente
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                  {filteredPatients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                      <UsersRound className="w-16 h-16 mb-4 opacity-20" />
                      <p className="font-medium">No se encontraron pacientes</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50/80 backdrop-blur sticky top-0 z-10 text-slate-500 text-xs uppercase font-bold tracking-wider">
                        <tr>
                          <th className="p-5 border-b border-slate-200">Paciente</th>
                          <th className="p-5 border-b border-slate-200 hidden md:table-cell">
                            Edad / RUT
                          </th>
                          <th className="p-5 border-b border-slate-200 hidden md:table-cell">
                            Última Atención
                          </th>
                          <th className="p-5 border-b border-slate-200">Próximo Control</th>
                          <th className="p-5 border-b border-slate-200 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPatients.map((p) => {
                          const patientConsultations = getActiveConsultations(p);
                          const lastConsult =
                            patientConsultations.length > 0 ? patientConsultations[0] : null;
                          const nextCtrl = lastConsult?.nextControlDate
                            ? new Date(lastConsult.nextControlDate + "T12:00:00")
                            : null;
                          const isControlNear =
                            nextCtrl &&
                            nextCtrl <= new Date(new Date().setDate(new Date().getDate() + 7));

                          return (
                            <tr
                              key={p.id}
                              className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                              onClick={() => handleSelectPatient(p)}
                            >
                              <td className="p-5">
                                <div className="font-bold text-slate-800 text-base">
                                  {formatPersonName(p.fullName)}
                                </div>
                                <div className="text-xs text-slate-400 font-medium md:hidden">
                                  {p.rut}
                                </div>
                              </td>
                              <td className="p-5 hidden md:table-cell">
                                <div className="text-slate-600 font-medium">
                                  {safeAgeLabel(p.birthDate)}
                                </div>
                                <div className="text-xs text-slate-400 font-mono">{p.rut}</div>
                              </td>
                              <td className="p-5 hidden md:table-cell">
                                {lastConsult ? (
                                  <div>
                                    <span className="text-slate-700 font-medium">
                                      {new Date(lastConsult.date).toLocaleDateString()}
                                    </span>
                                    <p className="text-xs text-slate-400 truncate max-w-[150px]">
                                      {lastConsult.reason}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 italic text-sm">
                                    Sin historial
                                  </span>
                                )}
                              </td>
                              <td className="p-5">
                                {nextCtrl ? (
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-bold ${isControlNear ? "bg-orange-100 text-orange-700" : "bg-green-50 text-green-700"}`}
                                  >
                                    {nextCtrl.toLocaleDateString()}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              
                              <td className="p-5 text-right relative">
                                <div className="flex items-center justify-end gap-2">
                                  {(() => {
                                    const nextCtrl = getNextControlDateFromPatient(p);
                                    const canWhatsapp = Boolean(nextCtrl) && Boolean(p.phone);
                                    if (!canWhatsapp) return null;

                                    return (
                                      <div className="relative">
                                        <button
                                          className="text-green-700 hover:bg-green-50 p-2 rounded-lg transition-colors"
                                          title="Enviar recordatorio por WhatsApp"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setWhatsAppMenuForPatientId(
                                              whatsAppMenuForPatientId === p.id ? null : p.id
                                            );
                                          }}
                                        >
                                          <MessageCircle className="w-5 h-5" />
                                        </button>

                                        {whatsAppMenuForPatientId === p.id && (
                                          <div
                                            className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50">
                                              Plantillas WhatsApp
                                            </div>
                                            <div className="p-1">
                                              {whatsAppTemplates
                                                .filter((t) => t.enabled)
                                                .map((t) => (
                                                  <button
                                                    key={t.id}
                                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                                                    onClick={() => {
                                                      openWhatsApp(p, t.body);
                                                      setWhatsAppMenuForPatientId(null);
                                                    }}
                                                  >
                                                    {t.title}
                                                  </button>
                                                ))}
                                              {whatsAppTemplates.filter((t) => t.enabled).length ===
                                                0 && (
                                                <div className="px-3 py-2 text-sm text-slate-500">
                                                  No hay plantillas activas.
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                                    <ChevronRight className="w-5 h-5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* CONTENT: AGENDA VIEW */}
            {activeTab === "agenda" && moduleGuards.agenda && (
              <div className="h-full overflow-hidden">
                <AgendaView
                  currentMonth={currentMonth}
                  selectedAgendaDate={selectedAgendaDate}
                  appointments={appointments}
                  doctorId={doctorId}
                  agendaConfig={agendaConfig}
                  isSyncingAppointments={isSyncingAppointments}
                  onMonthChange={(inc) => {
                    const newDate = new Date(currentMonth);
                    newDate.setMonth(newDate.getMonth() + inc);
                    setCurrentMonth(newDate);
                  }}
                  onDateClick={(date) => setSelectedAgendaDate(date.toISOString().split("T")[0])}
                  onToggleSlot={(time) => {
                    if (isReadOnly) return;
                    if (!hasActiveCenter) {
                      showToast("Selecciona un centro activo para modificar la agenda.", "warning");
                      return;
                    }
                    const date = selectedAgendaDate;
                    if (!date) return;

                    const matchingSlots = appointments.filter(
                      (a) =>
                        ((a as any).doctorUid ?? a.doctorId) === doctorId &&
                        a.date === date &&
                        a.time === time
                    );
                    const bookedSlot = matchingSlots.find((slot) => slot.status === "booked");

                    if (bookedSlot) {
                      setSlotModal({ isOpen: true, appointment: bookedSlot });
                    } else if (matchingSlots.length > 0) {
                      // Remove slot (Close it)
                      const matchingIds = new Set(matchingSlots.map((slot) => slot.id));
                      onUpdateAppointments(appointments.filter((a) => !matchingIds.has(a.id)));
                      showToast("Bloque cerrado (horario bloqueado).", "info");
                    } else {
                      // Add slot (Open it)
                      // NOTE: 'centerId' should technically come from currentUser context or App,
                      // but App handles filtering. We add a placeholder here or rely on App's logic.
                      // Ideally passed as prop, but empty string works if filtered by doctorId.
                      const newSlot: Appointment = {
                        id: generateId(),
                        centerId: currentUser?.centerId || "",
                        doctorId,
                        doctorUid: doctorId,
                        date,
                        time,
                        status: "available",
                        patientName: "",
                        patientRut: "",
                        active: true,
                      };
                      onUpdateAppointments([...appointments, newSlot]);
                      showToast("Bloque abierto disponible.", "success");
                    }
                  }}
                  onOpenPatient={handleOpenPatientFromAppointment}
                  readOnly={isReadOnly}
                />
              </div>
            )}

            {/* CONTENT: SETTINGS (TEMPLATES & PROFILES) */}
            {activeTab === "settings" && (
              <div className="w-full animate-fadeIn grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
                <div className="lg:col-span-12 bg-blue-50 border border-blue-100 text-blue-900 rounded-3xl p-6 flex items-start gap-4 shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-blue-500 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-lg">Preingresos sin autenticación</h3>
                    <p className="text-sm text-blue-700">
                      Los pacientes pueden enviar preingresos sin iniciar sesión. Estas solicitudes
                      se revisan y aprueban desde el panel administrativo del centro.
                    </p>
                  </div>
                </div>

                {/* 1. EXAM PROFILES EDITOR */}
                <div className="lg:col-span-6 bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-lg flex flex-col h-[600px]">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Layers className="w-6 h-6 text-emerald-500" /> Mis Perfiles de Exámenes
                  </h3>

                  <div className="flex-1 overflow-hidden flex flex-col gap-6">
                    {/* List */}
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 border-b border-slate-100 pb-4">
                      {myExamProfiles.length === 0 && (
                        <p className="text-slate-400 italic text-sm text-center py-4">
                          No tiene perfiles configurados.
                        </p>
                      )}
                      {myExamProfiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 transition-all shadow-sm group"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-slate-700 text-sm">{profile.label}</h4>
                              <p className="text-xs text-slate-400">
                                {profile.description || "Sin descripción"}
                              </p>
                            </div>
                            {!isReadOnly && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditProfile(profile)}
                                  className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProfile(profile.id)}
                                  className="p-1.5 hover:bg-red-50 text-red-500 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {profile.exams.map((ex) => {
                              const def = allExamOptions.find((o) => o.id === ex);
                              const label = def ? def.label.split("(")[0] : ex;
                              return (
                                <span
                                  key={ex}
                                  className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase"
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Editor Form */}
                    {!isReadOnly && (
                      <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">
                              Nombre Perfil
                            </label>
                            <input
                              className="w-full p-2 border rounded-lg text-sm"
                              placeholder="Ej: Control Diabetes"
                              value={tempProfile.label}
                              onChange={(e) =>
                                setTempProfile({ ...tempProfile, label: e.target.value })
                              }
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">
                              Descripción
                            </label>
                            <input
                              className="w-full p-2 border rounded-lg text-sm"
                              placeholder="Opcional..."
                              value={tempProfile.description}
                              onChange={(e) =>
                                setTempProfile({ ...tempProfile, description: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        {/* Checkbox Grid */}
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                            Seleccionar Exámenes
                          </label>
                          <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white">
                            {allExamOptions
                              .filter((e) => !e.readOnly)
                              .map((opt) => (
                                <button
                                  key={opt.id}
                                  onClick={() => toggleExamInTempProfile(opt.id)}
                                  className={`text-xs text-left px-2 py-1 rounded flex items-center gap-2 transition-colors ${tempProfile.exams.includes(opt.id) ? "bg-emerald-50 text-emerald-700 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                                >
                                  {tempProfile.exams.includes(opt.id) ? (
                                    <CheckSquare className="w-3 h-3" />
                                  ) : (
                                    <Square className="w-3 h-3" />
                                  )}
                                  <span className="truncate">{opt.label}</span>
                                </button>
                              ))}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleSaveProfile}
                            className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                          >
                            {isEditingProfileId ? "Guardar Cambios" : "Crear Perfil"}
                          </button>
                          {isEditingProfileId && (
                            <button
                              onClick={() => {
                                setIsEditingProfileId(null);
                                setTempProfile({ id: "", label: "", exams: [], description: "" });
                              }}
                              className="px-3 py-2 bg-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-300 text-sm"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        <button
                          onClick={handleResetProfiles}
                          className="w-full text-xs text-slate-400 hover:text-emerald-600 flex justify-center items-center gap-1 mt-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Restaurar predeterminados
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 1.5 CUSTOM EXAM CREATION (NEW) */}
                <div className="lg:col-span-6 space-y-8">
                  {/* NEW: CREATE CUSTOM EXAM */}
                  <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-lg flex flex-col h-auto">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <TestTube className="w-6 h-6 text-purple-500" /> Definir Nuevo Examen
                    </h3>
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-3">
                      <p className="text-xs text-purple-700 mb-2">
                        Cree un examen personalizado si no está en la lista estándar.
                      </p>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 p-2 border border-purple-200 rounded-lg text-sm outline-none focus:border-purple-500"
                          placeholder="Nombre (ej: Estradiol)"
                          value={newCustomExam.label}
                          onChange={(e) =>
                            setNewCustomExam({ ...newCustomExam, label: e.target.value })
                          }
                        />
                        <input
                          className="w-24 p-2 border border-purple-200 rounded-lg text-sm outline-none focus:border-purple-500"
                          placeholder="Unidad"
                          value={newCustomExam.unit}
                          onChange={(e) =>
                            setNewCustomExam({ ...newCustomExam, unit: e.target.value })
                          }
                        />
                      </div>
                      <select
                        className="w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:border-purple-500 bg-white"
                        value={newCustomExam.category}
                        onChange={(e) =>
                          setNewCustomExam({ ...newCustomExam, category: e.target.value })
                        }
                      >
                        <option value="">Seleccione Categoría</option>
                        <option value="Metabólico">Metabólico</option>
                        <option value="Hormonal">Hormonal</option>
                        <option value="Hematológico">Hematológico</option>
                        <option value="Cardíaco">Cardíaco</option>
                        <option value="Otro">Otro</option>
                      </select>
                      <button
                        onClick={handleCreateCustomExam}
                        className="w-full bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                      >
                        Agregar a la Lista
                      </button>
                    </div>

                    {/* LIST OF CUSTOM EXAMS */}
                    {currentUser?.customExams && currentUser.customExams.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                          Mis Exámenes Personalizados
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {currentUser.customExams.map((ex) => (
                            <span
                              key={ex.id}
                              className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full flex items-center gap-1 border border-purple-200"
                            >
                              {ex.label} ({ex.unit})
                              <button
                                onClick={() => handleDeleteCustomExam(ex.id)}
                                className="hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. CLINICAL TEMPLATES EDITOR */}
                  <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-lg flex flex-col min-h-[300px]">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <FileText className="w-6 h-6 text-slate-400" /> Mis Plantillas Clínicas
                    </h3>

                    <div className="flex-1 overflow-hidden flex flex-col gap-6">
                      {/* List */}
                      <div className="flex-1 overflow-y-auto pr-2 space-y-2 border-b border-slate-100 pb-4 max-h-40">
                        {myTemplates.length === 0 && (
                          <p className="text-center text-slate-400 text-sm italic py-4">
                            No tiene plantillas.
                          </p>
                        )}
                        {myTemplates.map((t) => (
                          <div
                            key={t.id}
                            className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors group"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-slate-700 text-sm">{t.title}</span>
                              {!isReadOnly && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleEditTemplate(t)}
                                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTemplate(t.id)}
                                    className="p-1.5 hover:bg-red-50 text-red-500 rounded"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-1">{t.content}</p>
                          </div>
                        ))}
                      </div>

                      {/* Editor Form */}
                      <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase">
                            Título
                          </label>
                          <input
                            className="w-full p-2 border-2 border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-700 text-sm"
                            placeholder="Ej: Resfrío Común"
                            value={tempTemplate.title}
                            onChange={(e) =>
                              setTempTemplate({ ...tempTemplate, title: e.target.value })
                            }
                            readOnly={isReadOnly}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase">
                            Contenido
                          </label>
                          <textarea
                            className="w-full p-2 border-2 border-slate-200 rounded-lg outline-none focus:border-blue-500 h-16 resize-none text-slate-600 text-sm"
                            placeholder="Texto predefinido..."
                            value={tempTemplate.content}
                            onChange={(e) =>
                              setTempTemplate({ ...tempTemplate, content: e.target.value })
                            }
                            readOnly={isReadOnly}
                          />
                        </div>
                        {!isReadOnly && (
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveTemplate}
                              className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                              {isEditingTemplateId ? "Actualizar" : "Crear Nueva"}
                            </button>
                            {isEditingTemplateId && (
                              <button
                                onClick={() => {
                                  setIsEditingTemplateId(null);
                                  setTempTemplate({ id: "", title: "", content: "" });
                                }}
                                className="px-3 py-2 bg-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-300 text-sm"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. ACCOUNT SECURITY (NEW) */}
                <div className="lg:col-span-12 bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-lg flex flex-col">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-indigo-500" /> Seguridad de la Cuenta
                  </h3>

                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="md:w-1/3">
                      <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-indigo-900">
                        <KeyRound className="w-8 h-8 mb-4 opacity-80" />
                        <h4 className="font-bold text-lg mb-2">Cambiar Contraseña</h4>
                        <p className="text-sm opacity-80 mb-4">
                          Es recomendable actualizar su contraseña periódicamente para proteger el
                          acceso a las fichas clínicas.
                        </p>
                        <p className="text-xs font-bold uppercase tracking-wider opacity-60">
                          Requisitos
                        </p>
                        <ul className="text-xs list-disc pl-4 mt-1 opacity-80 space-y-1">
                          <li>Mínimo 4 caracteres</li>
                          <li>Diferente a la actual</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 max-w-md">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                          Contraseña Actual
                        </label>
                        <input
                          type="password"
                          className="w-full p-3 border rounded-xl outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                          placeholder="••••••••"
                          value={pwdState.current}
                          onChange={(e) => setPwdState({ ...pwdState, current: e.target.value })}
                          readOnly={isReadOnly}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Nueva Contraseña
                          </label>
                          <input
                            type="password"
                            className="w-full p-3 border rounded-xl outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                            placeholder="••••••••"
                            value={pwdState.new}
                            onChange={(e) => setPwdState({ ...pwdState, new: e.target.value })}
                            readOnly={isReadOnly}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Repetir Nueva
                          </label>
                          <input
                            type="password"
                            className="w-full p-3 border rounded-xl outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                            placeholder="••••••••"
                            value={pwdState.confirm}
                            onChange={(e) => setPwdState({ ...pwdState, confirm: e.target.value })}
                            readOnly={isReadOnly}
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        {!isReadOnly ? (
                          <button
                            onClick={handleChangePassword}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-transform active:scale-95 w-full md:w-auto"
                          >
                            Actualizar Contraseña
                          </button>
                        ) : (
                          <p className="text-sm text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100">
                            No se pueden realizar cambios en modo solo lectura.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                        <div className="text-xs text-slate-400">
                          No hay plantillas habilitadas.
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        {enabledWhatsappTemplates.map((template) => {
                          const templateMessage = applyWhatsappTemplate(template.body, {
                            patientName: patientDisplayName,
                            nextControlDate: slotDateLabel,
                            centerName,
                          });
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
    </div>
  );
};


export default ProfessionalDashboard;
