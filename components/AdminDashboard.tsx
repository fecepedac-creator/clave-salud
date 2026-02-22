import React, { useState, useEffect, useContext } from "react";
import { CenterContext } from "../CenterContext";
import {
  Doctor,
  Appointment,
  Patient,
  AgendaConfig,
  AuditLogEntry,
  AuditLogEvent,
  ProfessionalRole,
  WhatsappTemplate,
  Preadmission,
} from "../types";
import {
  generateId,
  generateSlotId,
  formatRUT,
  getStandardSlots,
  downloadJSON,
  fileToBase64,
  formatPersonName,
  normalizePhone,
} from "../utils";
import {
  Users,
  Calendar,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Zap,
  LogOut,
  Search,
  Clock,
  Phone,
  Edit,
  Lock,
  Mail,
  GraduationCap,
  X,
  Check,
  Download,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Share2,
  Copy,
  Settings,
  Upload,
  MessageCircle,
  AlertTriangle,
  ShieldCheck,
  Shield,
  Briefcase,
  Camera,
  User,
  Activity,
  Image as ImageIcon,
  FileClock,
} from "lucide-react";
import { useToast } from "./Toast";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  where,
  getDocs,
  getDoc,
  Timestamp,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import LogoHeader from "./LogoHeader";
import LegalLinks from "./LegalLinks";
import WhatsappTemplatesManager from "./WhatsappTemplatesManager";
import auditLogPolicy from "../docs/politicas/POLITICA_CONSERVACION_FICHA_CLINICA.md?raw";
import AuditLogViewer from "./AuditLogViewer";
import MarketingPosterModule from "./MarketingPosterModule";
import MarketingFlyerModal from "./MarketingFlyerModal";
import { MigrationModal } from "./MigrationModal";
import { ROLE_CATALOG } from "../constants";

interface AdminDashboardProps {
  centerId: string; // NEW PROP: Required to link slots to the specific center
  doctors: Doctor[];
  onUpdateDoctors: (doctors: Doctor[]) => void;
  appointments: Appointment[];
  onUpdateAppointments: (appointments: Appointment[]) => void;
  onUpdateAppointment?: (appointment: Appointment) => Promise<void>; // Individual upsert
  onDeleteAppointment?: (id: string) => Promise<void>;              // Individual delete
  isSyncingAppointments?: boolean;
  onLogout: () => void;
  onOpenLegal: (target: "terms" | "privacy") => void;
  patients: Patient[];
  onUpdatePatients: (patients: Patient[]) => void;
  preadmissions: Preadmission[];
  onApprovePreadmission: (item: Preadmission) => void;
  logs?: AuditLogEntry[]; // Prop used as fallback for Mock Mode (when db is null)
  onLogActivity: (event: AuditLogEvent) => void;
}

// Build ROLE_LABELS dynamically from ROLE_CATALOG so ALL roles appear in dropdowns
export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_CATALOG.map((r) => [r.id, r.label])
);

// --- EXPORTED COMPONENTS FOR OTHER DASHBOARDS ---

export interface TodayActivityProps {
  appointments: Appointment[];
  doctors: Doctor[];
  onOpenPatient: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
}

export const TodayActivity: React.FC<TodayActivityProps> = ({
  appointments,
  doctors,
  onOpenPatient,
  onCancel,
}) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const activeDoctors = doctors.filter((doc) =>
    appointments.some((a) => (a.doctorId === doc.id || (a as any).doctorUid === doc.id) && a.date === todayStr)
  );

  if (activeDoctors.length === 0) {
    return (
      <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center">
        <p className="text-slate-500 italic">No hay citas programadas para hoy.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
      <h3 className="text-xl font-bold text-white mb-6">Actividad del Día</h3>
      <div className="space-y-6">
        {activeDoctors.map((doc) => {
          const docAppts = appointments
            .filter((a) => (a.doctorId === doc.id || (a as any).doctorUid === doc.id) && a.date === todayStr)
            .sort((a, b) => a.time.localeCompare(b.time));

          return (
            <div key={doc.id}>
              <h4 className="font-bold text-sm text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {doc.fullName}
              </h4>
              <div className="space-y-2">
                {docAppts.map((appt) => (
                  <div
                    key={appt.id}
                    className={`p-4 rounded-xl border flex items-center justify-between transition-all ${appt.status === "booked"
                      ? "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                      : "bg-slate-900/30 border-slate-800 opacity-60"
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-indigo-300">{appt.time}</span>
                      <div onClick={() => appt.status === "booked" && onOpenPatient(appt)} className={appt.status === "booked" ? "cursor-pointer hover:underline" : ""}>
                        {appt.status === "booked" ? (
                          <>
                            <p className="font-bold text-white">{appt.patientName}</p>
                            <p className="text-xs text-slate-400">{appt.patientRut}</p>
                          </>
                        ) : (
                          <span className="text-slate-500 italic">Disponible</span>
                        )}
                      </div>
                    </div>
                    {appt.status === "booked" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const waUrl = `https://wa.me/${normalizePhone(appt.patientPhone || "")}`;
                            window.open(waUrl, "_blank");
                          }}
                          className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        {onCancel && (
                          <button
                            onClick={() => onCancel(appt)}
                            className="p-2 bg-red-600/20 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface PreadmissionListProps {
  preadmissions: Preadmission[];
  doctors: Doctor[];
  onApprove: (item: Preadmission) => void;
}

export const PreadmissionList: React.FC<PreadmissionListProps> = ({
  preadmissions,
  doctors,
  onApprove,
}) => {
  if (preadmissions.length === 0) {
    return (
      <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center">
        <p className="text-slate-500 italic">No hay preingresos pendientes.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
      <h3 className="text-xl font-bold text-white mb-6">Solicitudes de Preingreso</h3>
      <div className="space-y-4">
        {preadmissions.map((item) => {
          const doc = doctors.find((d) => d.id === item.doctorId);
          return (
            <div key={item.id} className="p-5 rounded-2xl bg-slate-900/50 border border-slate-700 flex items-center justify-between hover:border-indigo-500/50 transition-all">
              <div>
                <p className="font-bold text-white text-lg">{item.contact?.name || item.patientDraft?.fullName || "Paciente"}</p>
                <p className="text-sm text-slate-400">RUT: {item.contact?.rut || item.patientDraft?.rut || "N/A"} • Tel: {item.contact?.phone || item.patientDraft?.phone || "N/A"}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {doc?.fullName || "Médico no asignado"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onApprove(item)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20"
              >
                <Check className="w-4 h-4" /> Aprobar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  centerId,
  doctors,
  onUpdateDoctors,
  appointments,
  onUpdateAppointments,
  onUpdateAppointment,
  onDeleteAppointment,
  isSyncingAppointments,
  onLogout,
  onOpenLegal,
  patients,
  onUpdatePatients,
  preadmissions,
  onApprovePreadmission,
  logs,
  onLogActivity,
}) => {
  type AdminTab = "command_center" | "doctors" | "agenda" | "whatsapp" | "marketing" | "audit" | "preadmissions";
  const [activeTab, setActiveTab] = useState<AdminTab>("doctors");
  const { showToast } = useToast();
  const { activeCenterId, activeCenter, isModuleEnabled } = useContext(CenterContext);
  const hasActiveCenter = Boolean(activeCenterId);
  const resolvedCenterId = activeCenterId || centerId;
  // --- defensive module guard ---
  useEffect(() => {
    if (activeTab === "agenda" && !isModuleEnabled("agenda")) setActiveTab("doctors");
  }, [activeTab, isModuleEnabled]);

  const [anthropometryEnabled, setAnthropometryEnabled] = useState(false);
  const [anthropometrySaving, setAnthropometrySaving] = useState(false);
  const [accessMode, setAccessMode] = useState<"CENTER_WIDE" | "CARE_TEAM">("CENTER_WIDE");
  const [accessModeSaving, setAccessModeSaving] = useState(false);

  useEffect(() => {
    setAnthropometryEnabled(Boolean(activeCenter?.features?.anthropometryEnabled));
  }, [activeCenter?.features?.anthropometryEnabled]);

  useEffect(() => {
    setAccessMode(activeCenter?.accessMode ?? "CENTER_WIDE");
  }, [activeCenter?.accessMode]);

  // Marketing Flyer
  const [showMarketingModal, setShowMarketingModal] = useState(false);
  const [marketingFlyerType, setMarketingFlyerType] = useState<'center' | 'professional'>('center');
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  const handleAnthropometryToggle = async (nextValue: boolean) => {
    if (!db || !resolvedCenterId) return;
    const previousValue = anthropometryEnabled;
    setAnthropometryEnabled(nextValue);
    setAnthropometrySaving(true);
    try {
      await setDoc(
        doc(db, "centers", resolvedCenterId),
        { features: { anthropometryEnabled: nextValue } },
        { merge: true }
      );
      showToast(
        nextValue
          ? "Antropometría activada para el centro."
          : "Antropometría desactivada para el centro.",
        "success"
      );
    } catch (e) {
      console.error("update anthropometry flag", e);
      setAnthropometryEnabled(previousValue);
      showToast("No se pudo actualizar Antropometría.", "error");
    } finally {
      setAnthropometrySaving(false);
    }
  };

  const handleAccessModeChange = async (nextMode: "CENTER_WIDE" | "CARE_TEAM") => {
    if (!db || !resolvedCenterId) return;
    const previousValue = accessMode;
    setAccessMode(nextMode);
    setAccessModeSaving(true);
    try {
      await setDoc(
        doc(db, "centers", resolvedCenterId),
        { accessMode: nextMode },
        { merge: true }
      );
      onLogActivity({
        action: "CENTER_ACCESSMODE_UPDATE",
        entityType: "centerSettings",
        entityId: resolvedCenterId,
        details:
          nextMode === "CARE_TEAM"
            ? "Modo de acceso restringido por equipo tratante."
            : "Modo de acceso abierto a todo el centro.",
        metadata: { accessMode: nextMode },
      });
      showToast("Modo de acceso actualizado.", "success");
    } catch (e) {
      console.error("update access mode", e);
      setAccessMode(previousValue);
      showToast("No se pudo actualizar el modo de acceso.", "error");
    } finally {
      setAccessModeSaving(false);
    }
  };
  // --- WHATSAPP TEMPLATES (per center) ---
  const DEFAULT_WA_TEMPLATES: WhatsappTemplate[] = [
    {
      id: "reminder",
      title: "Recordatorio de control",
      body: "Estimado/a {patientName}, le recordamos su control programado para el {nextControlDate} en {centerName}. Si no puede asistir, por favor responda a este mensaje para reagendar.",
      enabled: true,
    },
    {
      id: "confirm",
      title: "Confirmar asistencia",
      body: "Estimado/a {patientName}, ¿podría confirmar su asistencia al control del {nextControlDate} en {centerName}? Responda SI para confirmar o NO para reagendar.",
      enabled: true,
    },
    {
      id: "reschedule",
      title: "Reagendar",
      body: "Estimado/a {patientName}, si necesita reagendar su control del {nextControlDate} en {centerName}, indíquenos una fecha/horario alternativo y le ayudaremos.",
      enabled: true,
    },
  ];

  const [waTemplates, setWaTemplates] = useState<WhatsappTemplate[]>(DEFAULT_WA_TEMPLATES);
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
  const [waTemplatesSaving, setWaTemplatesSaving] = useState(false);

  useEffect(() => {
    // Load templates for active center
    const load = async () => {
      if (!db || !activeCenterId) return;
      setWaTemplatesLoading(true);
      try {
        const ref = doc(db, "centers", activeCenterId, "settings", "whatsapp");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (Array.isArray(data.templates) && data.templates.length > 0) {
            setWaTemplates(data.templates);
          } else {
            setWaTemplates(DEFAULT_WA_TEMPLATES);
          }
        } else {
          setWaTemplates(DEFAULT_WA_TEMPLATES);
        }
      } catch (e) {
        console.error("load wa templates", e);
        setWaTemplates(DEFAULT_WA_TEMPLATES);
      } finally {
        setWaTemplatesLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCenterId]);

  const saveWaTemplates = async () => {
    if (!db || !activeCenterId) return;
    setWaTemplatesSaving(true);
    try {
      const ref = doc(db, "centers", activeCenterId, "settings", "whatsapp");
      await setDoc(
        ref,
        {
          templates: waTemplates.map((t) => ({
            id: t.id,
            title: t.title,
            body: t.body,
            enabled: t.enabled !== false,
          })),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || null,
        },
        { merge: true }
      );
      showToast("Plantillas de WhatsApp guardadas.", "success");
    } catch (e) {
      console.error("save wa templates", e);
      showToast("No se pudieron guardar las plantillas.", "error");
    } finally {
      setWaTemplatesSaving(false);
    }
  };

  const addWaTemplate = () => {
    setWaTemplates((prev) => [
      ...prev,
      {
        id: `tpl_${Date.now()}`,
        title: "Nueva plantilla",
        body: "Estimado/a {patientName}, ...",
        enabled: true,
      },
    ]);
  };

  const removeWaTemplate = (id: string) => {
    setWaTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // --- STATE FOR DOCTORS MANAGEMENT ---
  const [isEditingDoctor, setIsEditingDoctor] = useState(false);
  const [currentDoctor, setCurrentDoctor] = useState<Partial<Doctor>>({
    role: Object.keys(ROLE_LABELS)[0] as ProfessionalRole,
    clinicalRole: Object.keys(ROLE_LABELS)[0],
    visibleInBooking: true,
    active: true,
  });

  // --- STATE FOR AGENDA MANAGEMENT ---
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctors[0]?.id || "");
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [bookingRut, setBookingRut] = useState("");
  const [bookingName, setBookingName] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [centerLogoError, setCenterLogoError] = useState(false);

  // Calendar State (must be declared before pending state useEffect)
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Pending slot changes (Option A model)
  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set()); // time strings to open
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set()); // appointment IDs to delete
  const [isSavingSlots, setIsSavingSlots] = useState(false);
  const hasPendingSlotChanges = pendingAdds.size > 0 || pendingDeletes.size > 0;

  // Generate availability panel state
  const todayStr = new Date().toISOString().split("T")[0];
  const defaultGenEnd = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genFrom, setGenFrom] = useState(todayStr);
  const [genTo, setGenTo] = useState(defaultGenEnd);
  const [genIncludeSat, setGenIncludeSat] = useState(false);
  const [genIncludeSun, setGenIncludeSun] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset pending changes when date or doctor changes
  React.useEffect(() => {
    setPendingAdds(new Set());
    setPendingDeletes(new Set());
  }, [selectedDate, selectedDoctorId]);

  // --- STATE FOR AUDIT LOGS (LAZY LOADED) ---
  const [displayLogs, setDisplayLogs] = useState<AuditLogEntry[]>(logs || []);
  useEffect(() => {
    if (db && activeCenterId && activeTab === "audit") {
      const q = query(
        collection(db, "centers", activeCenterId, "auditLogs"),
        orderBy("timestamp", "desc"),
        limit(100)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedLogs: AuditLogEntry[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            centerId: resolvedCenterId, // Added required property
            action: data.action,
            actorUid: data.actorUid,
            actorName: data.actorName,
            actorRole: data.actorRole,
            entityType: data.entityType,
            entityId: data.entityId,
            details: data.details,
            timestamp: data.timestamp?.toDate().toISOString() || new Date().toISOString(),
            patientId: data.patientId || null,
            metadata: data.metadata || {},
          };
        });
        setDisplayLogs(fetchedLogs);
      });
      return () => unsubscribe();
    } else if (logs) {
      setDisplayLogs(logs);
    }
  }, [db, activeCenterId, activeTab, logs, resolvedCenterId]);

  // Cancellation Modal State
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    appointment: Appointment | null;
  }>({ isOpen: false, appointment: null });

  const resolvePreadmissionDate = (item: Preadmission) => {
    const raw = (item as any).createdAt;
    if (!raw) return null;
    if (typeof raw?.toDate === "function") return raw.toDate();
    if (typeof raw?.seconds === "number") return new Date(raw.seconds * 1000);
    if (typeof raw === "string" || typeof raw === "number") return new Date(raw);
    return null;
  };

  const sortedPreadmissions = [...preadmissions].sort((a, b) => {
    const aDate = resolvePreadmissionDate(a)?.getTime() ?? 0;
    const bDate = resolvePreadmissionDate(b)?.getTime() ?? 0;
    return bDate - aDate;
  });

  // Helper Date for past calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Dynamic Config State - DEFAULT: 20 mins, 08:00 to 21:00
  const [tempConfig, setTempConfig] = useState<AgendaConfig>({
    slotDuration: 20,
    startTime: "08:00",
    endTime: "21:00",
  });

  // Update temp config when doctor changes
  useEffect(() => {
    const doc = doctors.find((d) => d.id === selectedDoctorId);
    if (doc && doc.agendaConfig) {
      setTempConfig(doc.agendaConfig);
    } else {
      // Default Fallback
      setTempConfig({ slotDuration: 20, startTime: "08:00", endTime: "21:00" });
    }
  }, [selectedDoctorId, doctors]);

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  const policyText = auditLogPolicy;

  const normalizeRut = (rut: string) => rut.replace(/[^0-9kK]/g, "").toUpperCase();
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const savedConfig = selectedDoctor?.agendaConfig;
  const isConfigEqual = (a?: AgendaConfig, b?: AgendaConfig) =>
    !!a &&
    !!b &&
    a.slotDuration === b.slotDuration &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime;
  const hasUnsavedConfig = savedConfig ? !isConfigEqual(savedConfig, tempConfig) : false;

  const getPublicationStatus = (doc: Doctor) => {
    if (doc.active === false || (doc as any).activo === false) return "Inactivo";
    return doc.visibleInBooking ? "Publicado" : "Oculto";
  };

  const handleToggleVisibleInBooking = async (doctor: Doctor, visibleInBooking: boolean) => {
    if (!db || !hasActiveCenter) return;
    try {
      await setDoc(
        doc(db, "centers", centerId, "staff", doctor.id),
        { visibleInBooking, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await setDoc(
        doc(db, "centers", centerId, "publicStaff", doctor.id),
        { visibleInBooking, updatedAt: serverTimestamp() },
        { merge: true }
      );
      showToast(visibleInBooking ? "Profesional publicado en agenda." : "Profesional oculto de agenda.", "success");
    } catch (error) {
      console.error("toggleVisibleInBooking", error);
      showToast("No se pudo actualizar visibilidad del profesional.", "error");
    }
  };

  useEffect(() => {
    const ensureCurrentAdminInStaff = async () => {
      if (!db || !hasActiveCenter || !centerId || !auth.currentUser?.uid || !auth.currentUser?.email) return;
      const uid = auth.currentUser.uid;
      const email = auth.currentUser.email;
      const staffRef = doc(db, "centers", centerId, "staff", uid);
      const staffSnap = await getDoc(staffRef);
      if (staffSnap.exists()) return;

      await upsertStaffAndPublic(uid, {
        id: uid,
        fullName: auth.currentUser.displayName || email,
        email,
        role: Object.keys(ROLE_LABELS)[0] as ProfessionalRole,
        clinicalRole: Object.keys(ROLE_LABELS)[0],
        specialty: "",
        isAdmin: true,
        visibleInBooking: true,
        active: true,
      });

      const pendingInvites = await getDocs(
        query(
          collection(db, "invites"),
          where("emailLower", "==", email.toLowerCase()),
          where("centerId", "==", centerId),
          where("status", "==", "pending")
        )
      );
      for (const inviteDoc of pendingInvites.docs) {
        await updateDoc(doc(db, "invites", inviteDoc.id), {
          status: "accepted",
          acceptedAt: serverTimestamp(),
          acceptedByUid: uid,
        }).catch(() => { });
      }
    };

    ensureCurrentAdminInStaff().catch((error) => console.error("ensureCurrentAdminInStaff", error));
  }, [db, hasActiveCenter, centerId]);

  // AuditLogViewer maneja su propia carga/filtrado

  // --- DOCTOR FUNCTIONS ---
  // Profesionales se crean inmediatamente con un ID temporal (tempStaffId).
  // También se crea una invitación pendiente. Al aceptar, InvitePage migra
  // el tempStaffId al UID real del usuario autenticado.
  const persistDoctorToFirestore = async (doctor: Doctor) => {
    if (!db) return;

    const emailLower = (doctor.email || "").toLowerCase();
    if (!emailLower) {
      throw new Error("El correo electrónico es requerido para crear el profesional");
    }

    const tempStaffId = doctor.id; // ID temporal generado por el admin

    // 1) Crear staff doc inmediatamente con el tempStaffId
    await upsertStaffAndPublic(tempStaffId, {
      ...doctor,
      isTemp: true,
      active: true,
      activo: true,
    } as any);

    // 2) Crear invitación con tempStaffId para migración posterior
    // Evitar duplicar invitaciones pendientes
    const qInv = query(
      collection(db, "invites"),
      where("emailLower", "==", emailLower),
      where("centerId", "==", centerId),
      where("status", "==", "pending")
    );
    const snap = await getDocs(qInv);
    if (!snap.empty) {
      // Ya existe invite pendiente, no duplicar pero sí actualizar tempStaffId
      for (const invDoc of snap.docs) {
        await updateDoc(doc(db, "invites", invDoc.id), {
          tempStaffId,
          updatedAt: serverTimestamp()
        });
      }
      return;
    }

    const accessRole = doctor.isAdmin ? "center_admin" : "doctor";
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    await setDoc(doc(db, "invites", generateId()), {
      emailLower,
      email: doctor.email,
      centerId,
      role: accessRole,
      professionalRole: doctor.role,
      status: "pending",
      tempStaffId, // enlace al doc temporal para migración
      expiresAt: Timestamp.fromDate(expires),
      createdAt: serverTimestamp(),
      createdByUid: auth.currentUser?.uid ?? "centerAdmin",
      profileData: {
        fullName: doctor.fullName,
        rut: doctor.rut,
        specialty: doctor.specialty || null,
        photoUrl: doctor.photoUrl || null,
        agendaConfig: doctor.agendaConfig || null,
        role: doctor.role,
        clinicalRole: doctor.clinicalRole ?? doctor.role,
        accessRole,
        visibleInBooking: doctor.visibleInBooking === true,
        active: true,
        isAdmin: doctor.isAdmin || false,
      },
    });
  };

  const findStaffByEmail = async (email: string) => {
    if (!db || !email || !centerId) return null;
    const emailLower = email.toLowerCase();
    const staffSnap = await getDocs(collection(db, "centers", centerId, "staff"));
    const existing = staffSnap.docs.find(
      (staffDoc) => String((staffDoc.data() as any)?.emailLower ?? "").toLowerCase() === emailLower
    );
    return existing ? { id: existing.id, data: existing.data() as any } : null;
  };

  const upsertStaffAndPublic = async (staffId: string, doctor: Partial<Doctor>) => {
    if (!db || !centerId) return;
    const isTemp = (doctor as any).isTemp ?? false;
    const payload = {
      fullName: doctor.fullName ?? "",
      rut: doctor.rut ?? "",
      email: doctor.email ?? "",
      emailLower: String(doctor.email ?? "").toLowerCase(),
      specialty: doctor.specialty ?? "",
      photoUrl: doctor.photoUrl ?? "",
      agendaConfig: doctor.agendaConfig ?? null,
      role: doctor.role ?? "Medico",
      accessRole: doctor.isAdmin ? "center_admin" : "doctor",
      clinicalRole: doctor.clinicalRole || doctor.role || "",
      visibleInBooking: doctor.visibleInBooking === true,
      active: doctor.active ?? true,
      activo: doctor.active ?? true,
      isTemp,
      updatedAt: serverTimestamp(),
    } as any;

    await setDoc(doc(db, "centers", centerId, "staff", staffId), payload, { merge: true });
    await setDoc(
      doc(db, "centers", centerId, "publicStaff", staffId),
      {
        id: staffId,
        centerId,
        fullName: payload.fullName,
        specialty: payload.specialty,
        photoUrl: payload.photoUrl,
        role: payload.clinicalRole,
        clinicalRole: payload.clinicalRole,
        accessRole: payload.accessRole,
        agendaConfig: payload.agendaConfig,
        visibleInBooking: payload.visibleInBooking,
        active: payload.active,
        activo: payload.active,
        isTemp,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleSaveDoctor = async () => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para crear profesionales.", "warning");
      return;
    }
    if (
      !currentDoctor.fullName ||
      !currentDoctor.rut ||
      !currentDoctor.email ||
      !(currentDoctor.clinicalRole || currentDoctor.role)
    ) {
      showToast("Por favor complete todos los campos obligatorios.", "error");
      return;
    }

    const normalizedRut = normalizeRut(currentDoctor.rut);
    const duplicateRut = doctors.find(
      (doctor) => normalizeRut(doctor.rut ?? "") === normalizedRut && doctor.id !== currentDoctor.id
    );
    if (duplicateRut) {
      showToast("Ya existe un profesional con este RUT.", "error");
      return;
    }

    if (currentDoctor.id) {
      // Edit existing staff member
      const updated = doctors.map((d) =>
        d.id === currentDoctor.id ? (currentDoctor as Doctor) : d
      );
      onUpdateDoctors(updated);
      try {
        // Update the staff document directly (using their UID)
        await upsertStaffAndPublic(currentDoctor.id, currentDoctor);
        showToast("Profesional actualizado.", "success");
      } catch (e: any) {
        console.error("updateStaffDocument", e);
        showToast(e?.message || "No se pudo actualizar el profesional.", "error");
      }
    } else {
      // Create new professional — immediate activation + invite
      const newDoc: Doctor = {
        ...(currentDoctor as Doctor),
        id: generateId(),
        centerId: centerId,
        active: true,
        agendaConfig: { slotDuration: 20, startTime: "08:00", endTime: "21:00" },
        clinicalRole: currentDoctor.clinicalRole || currentDoctor.role,
        visibleInBooking: currentDoctor.visibleInBooking === true,
      };

      try {
        await persistDoctorToFirestore(newDoc);
        onUpdateDoctors([...doctors, newDoc]);
        showToast(
          `Profesional ${newDoc.fullName} agregado. Se envió invitación a ${newDoc.email}.`,
          "success"
        );
        onLogActivity({
          action: "STAFF_CREATE",
          entityType: "staff",
          entityId: newDoc.id,
          details: `Agregó profesional ${newDoc.fullName} (${newDoc.email})`
        });
      } catch (e: any) {
        console.error("persistDoctorToFirestore", e);
        showToast(e?.message || "No se pudo crear el profesional.", "error");
        return;
      }
    }
    setIsEditingDoctor(false);
    setCurrentDoctor({ role: Object.keys(ROLE_LABELS)[0] as ProfessionalRole, clinicalRole: Object.keys(ROLE_LABELS)[0], visibleInBooking: true, active: true });
  };

  const handleDeleteDoctor = async (id: string) => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para eliminar profesionales.", "warning");
      return;
    }
    if (
      window.confirm("¿Está seguro de eliminar este profesional? Se perderá el acceso y sus datos.")
    ) {
      if (db) {
        try {
          // Try to deactivate the staff document (for accepted professionals)
          const staffRef = doc(db, "centers", centerId, "staff", id);
          const staffSnap = await getDoc(staffRef);

          if (staffSnap.exists()) {
            // Staff member exists - deactivate them
            await setDoc(
              staffRef,
              {
                active: false,
                activo: false,
                updatedAt: serverTimestamp(),
                deletedAt: serverTimestamp(),
              },
              { merge: true }
            );

            // Also update publicStaff for syncPublicStaff trigger
            await setDoc(
              doc(db, "centers", centerId, "publicStaff", id),
              {
                active: false,
                activo: false,
                updatedAt: serverTimestamp(),
                deletedAt: serverTimestamp(),
              },
              { merge: true }
            );
            showToast("Profesional desactivado exitosamente.", "success");
          } else {
            // Staff member doesn't exist yet - they may have a pending invite
            // Revoke any pending invites for this email
            const doctor = doctors.find((d) => d.id === id);
            if (doctor?.email) {
              const emailLower = doctor.email.toLowerCase();
              const qInv = query(
                collection(db, "invites"),
                where("emailLower", "==", emailLower),
                where("centerId", "==", centerId),
                where("status", "==", "pending")
              );
              const invSnap = await getDocs(qInv);

              if (!invSnap.empty) {
                for (const invDoc of invSnap.docs) {
                  await setDoc(
                    doc(db, "invites", invDoc.id),
                    { status: "revoked", revokedAt: serverTimestamp() },
                    { merge: true }
                  );
                }
                showToast("Invitación revocada exitosamente.", "success");
              } else {
                showToast("Profesional eliminado de la lista local.", "info");
              }
            }
          }
        } catch (error) {
          console.error("deactivateStaff", error);
          showToast("No se pudo desactivar el profesional en Firestore.", "error");
          return;
        }
      }
      onUpdateDoctors(doctors.filter((d) => d.id !== id));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      try {
        const base64 = await fileToBase64(e.target.files[0]);
        setCurrentDoctor({ ...currentDoctor, photoUrl: base64 });
      } catch (err) {
        showToast("Error al subir imagen. Use JPG/PNG pequeño.", "error");
      }
    }
  };

  // --- BACKUP & RESTORE FUNCTIONS ---
  const handleRestoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json);

        if (data.patients && Array.isArray(data.patients)) {
          onUpdatePatients(data.patients);
        }
        if (data.doctors && Array.isArray(data.doctors)) {
          onUpdateDoctors(data.doctors);
        }
        if (data.appointments && Array.isArray(data.appointments)) {
          onUpdateAppointments(data.appointments);
        }

        showToast("Base de datos restaurada correctamente.", "success");
      } catch (error) {
        console.error(error);
        showToast("Error al leer el archivo de respaldo.", "error");
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = "";
  };

  // --- CALENDAR & AGENDA FUNCTIONS ---

  // Save Config to Doctor Profile
  const handleSaveConfig = async () => {
    let updatedDoctor: Doctor | null = null;

    const updatedDoctors = doctors.map((d) => {
      if (d.id === selectedDoctorId) {
        updatedDoctor = { ...d, agendaConfig: tempConfig };
        return updatedDoctor;
      }
      return d;
    });

    onUpdateDoctors(updatedDoctors);

    if (updatedDoctor && db) {
      upsertStaffAndPublic(updatedDoctor.id, updatedDoctor).catch((e) =>
        console.error("upsertStaffAndPublic", e)
      );
      showToast("Configuración de agenda guardada.", "success");
    }
  };

  // Get calendar days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 Sun, 1 Mon...

    // Adjust for Monday start (Chilean standard usually)
    // 0 (Sun) -> 6, 1 (Mon) -> 0
    const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = [];
    // Empty slots for previous month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const handleDateClick = (date: Date) => {
    // Format YYYY-MM-DD
    const formatted = date.toISOString().split("T")[0];
    setSelectedDate(formatted);
  };

  const handleMonthChange = (increment: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentMonth(newDate);
    setSelectedDate(""); // Reset selection on month change
  };

  // Toggles slot in local pending state only (no Firestore)
  const toggleSlot = (time: string) => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para modificar la agenda.", "warning");
      return;
    }
    if (!selectedDate || !selectedDoctorId) return;

    const appointmentDoctorUid = (a: Appointment) => (a as any).doctorUid ?? a.doctorId;
    const realSlot = appointments.find(
      (a) => appointmentDoctorUid(a) === selectedDoctorId && a.date === selectedDate && a.time === time
    );

    if (realSlot?.status === "booked") {
      setCancelModal({ isOpen: true, appointment: realSlot });
      return;
    }

    if (realSlot) {
      // Slot exists — toggle pending delete
      if (pendingDeletes.has(realSlot.id)) {
        setPendingDeletes((prev) => { const s = new Set(prev); s.delete(realSlot.id); return s; });
      } else {
        setPendingDeletes((prev) => new Set([...prev, realSlot.id]));
      }
    } else {
      // Slot doesn't exist — toggle pending add
      if (pendingAdds.has(time)) {
        setPendingAdds((prev) => { const s = new Set(prev); s.delete(time); return s; });
      } else {
        setPendingAdds((prev) => new Set([...prev, time]));
      }
    }
  };

  // Commits pending changes to Firestore
  const handleSaveSlots = async () => {
    if (!hasPendingSlotChanges || isSavingSlots) return;
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo.", "warning");
      return;
    }
    setIsSavingSlots(true);
    try {
      // --- Process deletes ---
      for (const id of pendingDeletes) {
        const slot = appointments.find((a) => a.id === id);
        if (!slot) continue;
        onUpdateAppointments(appointments.filter((a) => a.id !== id));
        if (onDeleteAppointment) {
          try { await onDeleteAppointment(id); } catch (e) { console.error("deleteSlot", e); }
        }
      }
      // --- Process adds ---
      const newSlots: Appointment[] = Array.from(pendingAdds).map((time) => ({
        id: generateSlotId(resolvedCenterId, selectedDoctorId!, selectedDate!, time as string),
        centerId: resolvedCenterId,
        doctorId: selectedDoctorId,
        doctorUid: selectedDoctorId,
        date: selectedDate!,
        time: time as string,
        status: "available",
        patientName: "",
        patientRut: "",
        active: true,
      }));
      if (newSlots.length > 0) {
        onUpdateAppointments([...appointments, ...newSlots]);
        if (onUpdateAppointment) {
          for (const slot of newSlots) {
            try { await onUpdateAppointment(slot); } catch (e) { console.error("createSlot", e); }
          }
        }
      }
      setPendingAdds(new Set());
      setPendingDeletes(new Set());
      showToast(`Agenda guardada: ${newSlots.length} abiertos, ${pendingDeletes.size} cerrados.`, "success");
    } finally {
      setIsSavingSlots(false);
    }
  };

  // Generates bulk availability for a date range
  const handleGenerateSlots = async () => {
    if (!selectedDoctorId || !hasActiveCenter || isGenerating) return;
    setIsGenerating(true);
    try {
      const from = new Date(genFrom + "T00:00:00");
      const to = new Date(genTo + "T00:00:00");
      if (from > to) return;

      const slotsToCreate: Array<{ date: string; time: string }> = [];
      const cursor = new Date(from);
      while (cursor <= to) {
        const dow = cursor.getDay();
        const skip = (dow === 6 && !genIncludeSat) || (dow === 0 && !genIncludeSun);
        if (!skip) {
          const dateStr = cursor.toISOString().split("T")[0];
          const templateSlots = getStandardSlots(dateStr, selectedDoctorId, resolvedCenterId, savedConfig ?? tempConfig);
          const existing = new Set(
            appointments
              .filter((a) => ((a as any).doctorUid ?? a.doctorId) === selectedDoctorId && a.date === dateStr)
              .map((a) => a.time)
          );
          templateSlots
            .filter((s) => !existing.has(s.time))
            .forEach((s) => slotsToCreate.push({ date: dateStr, time: s.time }));
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      if (slotsToCreate.length === 0) {
        showToast("No hay bloques nuevos para generar en ese rango.", "info");
        return;
      }

      const newSlots: Appointment[] = slotsToCreate.map((slot) => ({
        id: generateSlotId(resolvedCenterId, selectedDoctorId, slot.date, slot.time),
        centerId: resolvedCenterId,
        doctorId: selectedDoctorId,
        doctorUid: selectedDoctorId,
        date: slot.date,
        time: slot.time,
        status: "available",
        patientName: "",
        patientRut: "",
        active: true,
      }));

      onUpdateAppointments([...appointments, ...newSlots]);
      if (onUpdateAppointment) {
        for (const slot of newSlots) {
          try { await onUpdateAppointment(slot); } catch (e) { console.error("genSlot", e); }
        }
      }
      showToast(`¡Disponibilidad generada! ${newSlots.length} bloques abiertos.`, "success");
      setShowGenPanel(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmCancellation = (notify: boolean) => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para cancelar citas.", "warning");
      return;
    }
    if (!cancelModal.appointment) return;

    // LOG CANCELLATION
    onLogActivity({
      action: "APPOINTMENT_CANCEL",
      entityType: "appointment",
      entityId: cancelModal.appointment.id,
      patientId: cancelModal.appointment.patientId,
      details: `Canceló cita de ${cancelModal.appointment.patientName} (${cancelModal.appointment.date} ${cancelModal.appointment.time}). Notificación: ${notify ? "Si" : "No"}`,
    });

    if (notify) {
      // WhatsApp Logic
      const apt = cancelModal.appointment;
      const doctor = doctors.find((d) => d.id === ((apt as any).doctorUid ?? apt.doctorId));
      const rawPhone = apt.patientPhone || "";
      const cleanPhone = rawPhone.replace(/\D/g, ""); // Remove non-digits

      // Basic check for Chilean numbers or international format
      let waNumber = cleanPhone;
      if (cleanPhone.length === 9 && cleanPhone.startsWith("9")) waNumber = `56${cleanPhone}`;

      const centerName = activeCenter?.name || "nuestro centro";
      const message = `Hola ${apt.patientName}, le escribimos de ${centerName}. Lamentamos informar que su hora agendada para el día ${apt.date} a las ${apt.time} hrs con ${doctor?.fullName || "el especialista"} ha tenido que ser suspendida por motivos de fuerza mayor. Por favor contáctenos para reagendar.`;

      const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank");
    }

    // Delete appointment
    onUpdateAppointments(appointments.filter((a) => a.id !== cancelModal.appointment?.id));
    setCancelModal({ isOpen: false, appointment: null });
    showToast("Cita cancelada y horario bloqueado.", "info");
  };

  const handleManualBooking = () => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para agendar citas.", "warning");
      return;
    }
    if (!bookingSlotId || !bookingRut || !bookingName) {
      showToast("RUT y Nombre son obligatorios", "error");
      return;
    }

    const updated = appointments.map((a) => {
      if (a.id === bookingSlotId) {
        return {
          ...a,
          status: "booked" as const,
          patientName: bookingName,
          patientRut: bookingRut,
          patientPhone: bookingPhone,
        };
      }
      return a;
    });
    onUpdateAppointments(updated);

    const normalizedRut = normalizeRut(bookingRut);
    const existingPatient = patients.find((p) => normalizeRut(p.rut) === normalizedRut);
    const patientPayload: Patient = existingPatient
      ? {
        ...existingPatient,
        rut: bookingRut,
        fullName: bookingName || existingPatient.fullName,
        phone: bookingPhone || existingPatient.phone,
        lastUpdated: new Date().toISOString(),
      }
      : {
        id: generateId(),
        centerId,
        rut: bookingRut,
        fullName: bookingName,
        birthDate: "",
        gender: "Otro",
        phone: bookingPhone,
        medicalHistory: [],
        surgicalHistory: [],
        smokingStatus: "No fumador",
        alcoholStatus: "No consumo",
        medications: [],
        allergies: [],
        consultations: [],
        attachments: [],
        lastUpdated: new Date().toISOString(),
        active: true,
      };
    onUpdatePatients([patientPayload]);

    // LOG MANUAL BOOKING
    onLogActivity({
      action: "APPOINTMENT_UPDATE",
      entityType: "appointment",
      entityId: bookingSlotId,
      patientId: patientPayload.id,
      details: `Agendamiento manual Admin para ${bookingName}.`,
    });

    setBookingSlotId(null);
    setBookingRut("");
    setBookingName("");
    setBookingPhone("");
    showToast("Cita agendada manualmente.", "success");
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {!hasActiveCenter && (
        <div className="bg-amber-500/20 text-amber-200 border-b border-amber-500/40 px-6 py-3 text-sm">
          Selecciona un centro activo para habilitar la gestión de profesionales, agenda y
          preingresos.
        </div>
      )}
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-sm w-full relative text-center">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold mb-4">Compartir App</h3>
            <p className="text-slate-500 mb-6">
              Escanea este código con tu celular para abrir la versión móvil.
            </p>

            <div className="bg-slate-100 p-4 rounded-xl mb-6 mx-auto w-48 h-48 flex items-center justify-center border-2 border-slate-200">
              {/* Placeholder for QR Code, in a real app use a library */}
              <QrCode className="w-32 h-32 text-slate-800" />
            </div>

            <div className="flex gap-2">
              <input
                className="w-full bg-slate-100 border border-slate-200 p-3 rounded-lg text-sm text-slate-600"
                value={window.location.origin}
                readOnly
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin);
                  showToast("Enlace copiado", "info");
                }}
                className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showPolicyModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-3xl w-full relative">
            <button
              onClick={() => setShowPolicyModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold mb-4">
              Política de conservación de ficha clínica (15 años)
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm text-slate-700">
              {policyText}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <nav className="bg-slate-800 border-b border-slate-700 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
          <LogoHeader size="md" showText={true} />
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {activeCenter?.logoUrl && (
            <div className="hidden md:flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-xs font-medium">Centro:</span>
              {!centerLogoError ? (
                <img
                  src={activeCenter.logoUrl}
                  alt={`Logo ${activeCenter.name}`}
                  className="h-8 w-auto max-w-[120px] object-contain rounded"
                  onError={() => setCenterLogoError(true)}
                />
              ) : (
                <span className="text-slate-300 text-sm font-bold">{activeCenter.name}</span>
              )}
            </div>
          )}
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700"
          >
            <Share2 className="w-4 h-4" /> Compartir App
          </button>
          <button
            onClick={() => setShowPolicyModal(true)}
            className="flex items-center gap-2 text-sm font-bold text-emerald-300 hover:text-emerald-200 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700"
          >
            <ShieldCheck className="w-4 h-4" /> Política de conservación (15 años)
          </button>

          <div className="flex gap-2 w-full md:w-auto justify-center">
            <label className="flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 cursor-pointer">
              <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Restaurar</span>
              <input type="file" accept=".json" className="hidden" onChange={handleRestoreBackup} />
            </label>
            <button
              onClick={() => {
                downloadJSON({ patients, doctors, appointments }, "backup-clinica.json");
                showToast("Descargando backup...", "info");
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700"
            >
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Backup</span>
            </button>
            <button
              onClick={onLogout}
              className="flex-none flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-red-400 transition-colors px-3"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <LegalLinks
            onOpenTerms={() => onOpenLegal("terms")}
            onOpenPrivacy={() => onOpenLegal("privacy")}
            className="flex"
            buttonClassName="text-slate-400 hover:text-white"
          />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-full md:w-fit mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("command_center")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "command_center" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Activity className="w-4 h-4" /> Centro de Mando
          </button>
          <button
            onClick={() => setActiveTab("doctors")}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "doctors" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
          >
            <Users className="w-4 h-4" /> Gestión de Profesionales
          </button>
          <button
            onClick={() => setActiveTab("agenda")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "agenda" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Configurar agenda" : "Selecciona un centro activo"}
          >
            <Calendar className="w-4 h-4" /> Configurar Agenda
          </button>
          <button
            onClick={() => setActiveTab("whatsapp")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "whatsapp" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Plantillas WhatsApp" : "Selecciona un centro activo"}
          >
            <MessageCircle className="w-4 h-4" /> Plantillas WhatsApp
          </button>


          <button
            onClick={() => setActiveTab("audit")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "audit" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Auditoría" : "Selecciona un centro activo"}
          >
            <ShieldCheck className="w-4 h-4" /> Seguridad / Auditoría
          </button>
          <button
            onClick={() => setActiveTab("preadmissions")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "preadmissions" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Preingresos" : "Selecciona un centro activo"}
          >
            <User className="w-4 h-4" /> Preingresos
          </button>
          <button
            onClick={() => setActiveTab("marketing")}
            disabled={!hasActiveCenter}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === "marketing" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Afiche para redes sociales" : "Selecciona un centro activo"}
          >
            <Share2 className="w-4 h-4" /> Afiche RRSS
          </button>
        </div >
      </div >

      {/* COMMAND CENTER */}
      {activeTab === "command_center" && (
        <div className="space-y-8 animate-fadeIn">
          {/* Métricas del Centro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">Pacientes Totales</div>
              </div>
              <div className="text-3xl font-bold text-white">
                {activeCenter?.stats?.patientCount?.toLocaleString("es-CL") || "—"}
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">Profesionales</div>
              </div>
              <div className="text-3xl font-bold text-white">
                {activeCenter?.stats?.staffCount?.toLocaleString("es-CL") || "—"}
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">Citas Agendadas</div>
              </div>
              <div className="text-3xl font-bold text-white">
                {activeCenter?.stats?.appointmentCount?.toLocaleString("es-CL") || "—"}
              </div>
            </div>
          </div>

          {activeCenter?.stats?.updatedAt && (
            <div className="text-[10px] text-slate-500 italic mt-0">
              Último recalculo de estadísticas: {
                activeCenter.stats.updatedAt?.seconds
                  ? new Date(activeCenter.stats.updatedAt.seconds * 1000).toLocaleString("es-CL")
                  : new Date(activeCenter.stats.updatedAt).toLocaleString("es-CL")
              }
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <TodayActivity
              appointments={appointments}
              doctors={doctors}
              onOpenPatient={(appt) => {
                showToast(`Abriendo ficha de ${appt.patientName}`, "info");
              }}
              onCancel={(appt) => setCancelModal({ isOpen: true, appointment: appt })}
            />
            <PreadmissionList
              preadmissions={sortedPreadmissions}
              doctors={doctors}
              onApprove={onApprovePreadmission}
            />
          </div>
        </div>
      )}

      {/* DOCTORS MANAGEMENT */}
      {activeTab === "doctors" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Configuración del Centro</h3>
                <p className="text-sm text-slate-400">
                  Controla módulos específicos para el equipo clínico.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAnthropometryToggle(!anthropometryEnabled)}
                disabled={!hasActiveCenter || anthropometrySaving}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${anthropometryEnabled ? "bg-emerald-500" : "bg-slate-600"} ${!hasActiveCenter || anthropometrySaving ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-pressed={anthropometryEnabled}
                aria-label="Activar Antropometría"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${anthropometryEnabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-200">Activar Antropometría</p>
                <p className="text-xs text-slate-400">
                  Permite registrar peso, talla, IMC y mediciones adicionales.
                </p>
              </div>
              <span
                className={`text-xs font-bold uppercase px-2 py-1 rounded ${anthropometryEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}
              >
                {anthropometryEnabled ? "Activo" : "Inactivo"}
              </span>
            </div>

            {/* Marketing Digital */}
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-200">Marketing Digital</p>
                <p className="text-xs text-slate-400">
                  Crea flyers profesionales para redes sociales con QR de agendamiento.
                </p>
              </div>
              <button
                onClick={() => {
                  setMarketingFlyerType('center');
                  setShowMarketingModal(true);
                }}
                disabled={!hasActiveCenter}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm font-semibold">Crear Flyer</span>
              </button>
            </div>

            {/* Migration Tool (New) */}
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-200">Migración de Fichas</p>
                <p className="text-xs text-slate-400">
                  Importa fichas clínicas desde JSON (Piloto).
                </p>
              </div>
              <button
                onClick={() => setShowMigrationModal(true)}
                disabled={!hasActiveCenter}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm font-semibold">Importar</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* List */}
            <div className="lg:col-span-2 space-y-4">
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex justify-between items-center group hover:border-indigo-500 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl overflow-hidden border-2 ${doc.isAdmin ? "border-indigo-500" : "border-slate-600"} bg-slate-700`}
                    >
                      {doc.photoUrl ? (
                        <img
                          src={doc.photoUrl}
                          className="w-full h-full object-cover"
                          alt={doc.fullName}
                        />
                      ) : (
                        <span className="text-slate-300">{doc.fullName?.charAt(0) ?? "?"}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        {formatPersonName(doc.fullName)}
                        {doc.isAdmin && (
                          <span className="bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Admin
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="bg-slate-900 text-indigo-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-slate-600">
                          {ROLE_LABELS[(doc.clinicalRole as ProfessionalRole) || (doc.role as ProfessionalRole)] || doc.clinicalRole || doc.role}
                        </span>
                        <span className="text-slate-500 text-xs font-bold uppercase">• {doc.specialty}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getPublicationStatus(doc) === "Publicado" ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" : getPublicationStatus(doc) === "Oculto" ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-slate-300 border-slate-500/40 bg-slate-500/10"}`}>
                          {getPublicationStatus(doc)}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs flex items-center gap-2 mt-1 opacity-70">
                        <Mail className="w-3 h-3" /> {doc.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity items-center">
                    <button
                      onClick={() => handleToggleVisibleInBooking(doc, !(doc.visibleInBooking === true))}
                      className={`px-3 py-2 rounded-lg text-xs font-bold ${doc.visibleInBooking ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}
                    >
                      {doc.visibleInBooking ? "Ocultar" : "Publicar"}
                    </button>
                    <button
                      onClick={() => {
                        setCurrentDoctor(doc);
                        setIsEditingDoctor(true);
                      }}
                      className="p-2 bg-slate-700 rounded-lg hover:bg-indigo-600 text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDoctor(doc.id)}
                      className="p-2 bg-slate-700 rounded-lg hover:bg-red-600 text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 h-fit sticky top-24">
              <h3 className="font-bold text-xl text-white mb-6 flex items-center gap-2">
                {isEditingDoctor ? (
                  <Edit className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Plus className="w-5 h-5 text-indigo-400" />
                )}
                {isEditingDoctor ? "Editar Profesional" : "Nuevo Profesional"}
              </h3>

              {/* Photo Upload Area */}
              <div className="flex justify-center mb-6">
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-600 bg-slate-700 flex items-center justify-center">
                    {currentDoctor.photoUrl ? (
                      <img
                        src={currentDoctor.photoUrl}
                        className="w-full h-full object-cover"
                        alt="preview"
                      />
                    ) : (
                      <User className="w-10 h-10 text-slate-500" />
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer text-white font-bold text-xs flex-col gap-1">
                    <Camera className="w-6 h-6" />
                    Cambiar
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Profesión / Rol
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500 appearance-none font-medium"
                      value={currentDoctor.role || "MEDICO"}
                      onChange={(e) =>
                        setCurrentDoctor({
                          ...currentDoctor,
                          role: e.target.value as ProfessionalRole,
                          clinicalRole: e.target.value,
                        })
                      }
                    >
                      {Object.entries(ROLE_LABELS)
                        .filter(([key]) => {
                          // Always show management roles + filter by center's allowedRoles
                          if (key === "ADMIN_CENTRO" || key === "ADMINISTRATIVO") return true;
                          const allowed = activeCenter?.allowedRoles;
                          if (!allowed || allowed.length === 0) return true; // no restriction = show all
                          return allowed.includes(key as any);
                        })
                        .map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                    </select>
                    <Briefcase className="absolute right-3 top-3 w-5 h-5 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Nombre Completo
                  </label>
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                    value={currentDoctor.fullName || ""}
                    onChange={(e) =>
                      setCurrentDoctor({ ...currentDoctor, fullName: e.target.value })
                    }
                    placeholder="Ej: Dr. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">RUT</label>
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                    value={currentDoctor.rut || ""}
                    onChange={(e) =>
                      setCurrentDoctor({ ...currentDoctor, rut: formatRUT(e.target.value) })
                    }
                    placeholder="12.345.678-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Especialidad</label>
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                    value={currentDoctor.specialty || ""}
                    onChange={(e) =>
                      setCurrentDoctor({ ...currentDoctor, specialty: e.target.value })
                    }
                    placeholder="Ej: Cardiología, General..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Universidad / Institución
                  </label>
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                    value={currentDoctor.university || ""}
                    onChange={(e) =>
                      setCurrentDoctor({ ...currentDoctor, university: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Email (Login)
                  </label>
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                    type="email"
                    value={currentDoctor.email || ""}
                    onChange={(e) => setCurrentDoctor({ ...currentDoctor, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Acceso</label>
                  <div className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                    Ingreso con Google (sin contraseña provisoria)
                  </div>
                </div>
                {/* ADMIN TOGGLE */}
                <label
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${currentDoctor.isAdmin ? "bg-indigo-900/30 border-indigo-500" : "bg-slate-900 border-slate-700 hover:border-slate-500"}`}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentDoctor.isAdmin ? "bg-indigo-500 border-indigo-500" : "border-slate-500"}`}
                  >
                    {currentDoctor.isAdmin && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={currentDoctor.isAdmin || false}
                    onChange={(e) =>
                      setCurrentDoctor({ ...currentDoctor, isAdmin: e.target.checked })
                    }
                  />
                  <div>
                    <span className="block font-bold text-white text-sm">
                      Acceso Administrativo
                    </span>
                    <span className="block text-xs text-slate-400">
                      Permite gestionar agenda y usuarios
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${currentDoctor.visibleInBooking ? "bg-emerald-900/20 border-emerald-500" : "bg-slate-900 border-slate-700 hover:border-slate-500"}`}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentDoctor.visibleInBooking ? "bg-emerald-500 border-emerald-500" : "border-slate-500"}`}
                  >
                    {currentDoctor.visibleInBooking && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={currentDoctor.visibleInBooking || false}
                    onChange={(e) =>
                      setCurrentDoctor({ ...currentDoctor, visibleInBooking: e.target.checked })
                    }
                  />
                  <div>
                    <span className="block font-bold text-white text-sm">Visible para pacientes</span>
                    <span className="block text-xs text-slate-400">Controla si aparece en la agenda pública.</span>
                  </div>
                </label>

                <div className="flex gap-3 mt-6">
                  {isEditingDoctor && (
                    <button
                      onClick={() => {
                        setIsEditingDoctor(false);
                        setCurrentDoctor({ role: Object.keys(ROLE_LABELS)[0] as ProfessionalRole, clinicalRole: Object.keys(ROLE_LABELS)[0], visibleInBooking: true, active: true });
                      }}
                      className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-xl hover:bg-slate-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={handleSaveDoctor}
                    disabled={!hasActiveCenter}
                    title={hasActiveCenter ? "Guardar profesional" : "Selecciona un centro activo"}
                    className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEditingDoctor ? "Guardar Cambios" : "Crear Profesional"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
      }

      {/* AGENDA MANAGEMENT */}
      {
        activeTab === "agenda" && isModuleEnabled("agenda") && (
          <div className="animate-fadeIn grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* ... (Existing Agenda Content) ... */}
            {/* Sidebar Config */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
                <h3 className="font-bold text-white mb-4">Seleccionar Profesional</h3>
                <select
                  className="w-full bg-slate-900 text-white border border-slate-700 p-3 rounded-xl outline-none"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({ROLE_LABELS[d.role] || d.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* DYNAMIC SLOT CONFIG */}
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" /> Configurar Bloques
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                      Duración (minutos)
                    </label>
                    <select
                      className="w-full bg-slate-900 text-white border border-slate-700 p-2 rounded-lg outline-none"
                      value={tempConfig.slotDuration}
                      onChange={(e) =>
                        setTempConfig({ ...tempConfig, slotDuration: parseInt(e.target.value) })
                      }
                    >
                      <option value={15}>15 minutos</option>
                      <option value={20}>20 minutos</option>
                      <option value={25}>25 minutos</option>
                      <option value={30}>30 minutos</option>
                      <option value={45}>45 minutos</option>
                      <option value={60}>60 minutos</option>
                    </select>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                        Inicio
                      </label>
                      <input
                        type="time"
                        className="w-full bg-slate-900 text-white border border-slate-700 p-2 rounded-lg outline-none"
                        value={tempConfig.startTime}
                        onChange={(e) =>
                          setTempConfig({ ...tempConfig, startTime: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                        Fin
                      </label>
                      <input
                        type="time"
                        className="w-full bg-slate-900 text-white border border-slate-700 p-2 rounded-lg outline-none"
                        value={tempConfig.endTime}
                        onChange={(e) => setTempConfig({ ...tempConfig, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveConfig}
                    className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg mt-2"
                  >
                    Guardar Configuración
                  </button>
                  {hasUnsavedConfig && (
                    <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg">
                      Cambios sin guardar. La grilla usa la configuración actualmente guardada.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <button
                    onClick={() => handleMonthChange(-1)}
                    className="p-2 hover:bg-slate-700 rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-bold text-lg uppercase tracking-wide">
                    {currentMonth.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => handleMonthChange(1)}
                    className="p-2 hover:bg-slate-700 rounded-lg"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d) => (
                    <div key={d} className="text-center text-xs font-bold text-slate-500 mb-2">
                      {d}
                    </div>
                  ))}
                  {getDaysInMonth(currentMonth).map((day, idx) => {
                    if (!day) return <div key={idx}></div>;
                    const dateStr = day.toISOString().split("T")[0];
                    const isSelected = dateStr === selectedDate;
                    // Count slots
                    const slotsCount = appointments.filter(
                      (a) =>
                        ((a as any).doctorUid == selectedDoctorId || a.doctorId === selectedDoctorId) &&
                        a.date === dateStr
                    ).length;

                    // Past Day Check
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const isPast = day < now;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleDateClick(day)}
                        className={`
                                                    h-10 rounded-lg text-sm font-bold relative transition-all
                                                    ${isSelected
                            ? "bg-indigo-600 text-white shadow-lg scale-110 z-10"
                            : isPast
                              ? "bg-slate-900/50 text-slate-600 cursor-not-allowed border border-slate-800"
                              : "bg-slate-900 text-slate-400 hover:bg-slate-700"
                          }
                                                `}
                      >
                        {day.getDate()}
                        {slotsCount > 0 && !isPast && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Generate Availability Panel */}
            {selectedDoctorId && (
              <div className="lg:col-span-12 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mb-2">
                <button
                  onClick={() => setShowGenPanel((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="bg-amber-500/20 p-1.5 rounded-lg">
                      <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">Generar disponibilidad automática</p>
                      <p className="text-xs text-slate-400">Abre todos los bloques según la configuración de horario del profesional</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showGenPanel ? "rotate-90" : ""}`} />
                </button>

                {showGenPanel && (
                  <div className="border-t border-slate-700 p-5 bg-slate-900/40">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Desde</label>
                        <input type="date" value={genFrom} min={todayStr}
                          onChange={(e) => setGenFrom(e.target.value)}
                          className="w-full rounded-xl border border-slate-600 px-3 py-2 text-sm text-white bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Hasta</label>
                        <input type="date" value={genTo} min={genFrom || todayStr}
                          onChange={(e) => setGenTo(e.target.value)}
                          className="w-full rounded-xl border border-slate-600 px-3 py-2 text-sm text-white bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 mb-4">
                      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={genIncludeSat} onChange={(e) => setGenIncludeSat(e.target.checked)} className="rounded accent-amber-500" />
                        Incluir sábados
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={genIncludeSun} onChange={(e) => setGenIncludeSun(e.target.checked)} className="rounded accent-amber-500" />
                        Incluir domingos
                      </label>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => setShowGenPanel(false)}
                        className="px-3 py-2 text-sm text-slate-400 hover:text-white rounded-xl border border-slate-600 bg-slate-800 transition-all">
                        Cancelar
                      </button>
                      <button onClick={handleGenerateSlots} disabled={isGenerating || !genFrom || !genTo}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-400 rounded-xl shadow-sm transition-all disabled:opacity-40">
                        <Zap className="w-3.5 h-3.5" />
                        {isGenerating ? "Generando..." : "Generar disponibilidad"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Main Agenda Grid */}
            <div className="lg:col-span-8 bg-slate-800 p-8 rounded-3xl border border-slate-700 min-h-[500px] flex flex-col">
              {selectedDate ? (
                <>
                  <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                    <h3 className="text-2xl font-bold text-white capitalize">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString("es-CL", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(isSyncingAppointments || isSavingSlots) && (
                        <span className="text-xs font-semibold text-amber-200 bg-amber-500/10 border border-amber-500/40 px-2 py-1 rounded-full">
                          Guardando...
                        </span>
                      )}
                      {hasPendingSlotChanges ? (
                        <>
                          <button
                            onClick={() => { setPendingAdds(new Set()); setPendingDeletes(new Set()); }}
                            disabled={isSavingSlots}
                            className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white font-semibold px-3 py-1.5 rounded-xl border border-slate-600 hover:border-slate-400 bg-slate-700 transition-all disabled:opacity-40"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Descartar
                          </button>
                          <button
                            onClick={handleSaveSlots}
                            disabled={isSavingSlots}
                            className="flex items-center gap-1.5 text-sm text-white font-bold px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 shadow-sm transition-all disabled:opacity-40"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Guardar agenda ({pendingAdds.size + pendingDeletes.size} cambio{pendingAdds.size + pendingDeletes.size !== 1 ? "s" : ""})
                          </button>
                        </>
                      ) : (
                        <span className="text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                          Clic para abrir/cerrar bloques
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {getStandardSlots(
                      selectedDate,
                      selectedDoctorId,
                      savedConfig ?? tempConfig
                    ).map((slot) => {
                      const realSlot = appointments.find(
                        (a) =>
                          ((a as any).doctorUid == selectedDoctorId || a.doctorId === selectedDoctorId) &&
                          a.date === selectedDate &&
                          a.time === slot.time
                      );
                      const isBooked = realSlot?.status === "booked";
                      const isPendingDelete = realSlot && pendingDeletes.has(realSlot.id);
                      const isPendingAdd = !realSlot && pendingAdds.has(slot.time);
                      const isOpen = !!realSlot && !isPendingDelete;

                      // Slot past check
                      const slotDate = new Date(selectedDate + "T00:00:00");
                      const isPast = slotDate < today;

                      let bgClass = "";
                      let label = "";
                      if (isPast) {
                        bgClass = "bg-slate-900/50 border-slate-800 text-slate-700 cursor-not-allowed";
                        label = "Pasado";
                      } else if (isBooked) {
                        bgClass = "bg-indigo-900/50 border-indigo-500 text-indigo-300 cursor-not-allowed";
                        label = "Paciente";
                      } else if (isPendingDelete) {
                        bgClass = "bg-orange-900/30 border-orange-500 border-dashed text-orange-300 hover:bg-orange-900/50";
                        label = "Cerrando...";
                      } else if (isPendingAdd) {
                        bgClass = "bg-emerald-900/30 border-emerald-400 border-dashed text-emerald-300 hover:bg-emerald-900/50";
                        label = "Abriendo...";
                      } else if (isOpen) {
                        bgClass = "bg-emerald-500 border-emerald-400 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-400";
                        label = "Disponible";
                      } else {
                        bgClass = "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500";
                        label = "Cerrado";
                      }

                      return (
                        <div key={slot.time} className="relative group">
                          <button
                            onClick={() => toggleSlot(slot.time)}
                            disabled={isPast || isBooked}
                            className={`w-full py-4 rounded-xl border-2 font-bold text-lg transition-all flex flex-col items-center justify-center ${bgClass}`}
                          >
                            {slot.time}
                            <span className="text-[10px] uppercase mt-1">{label}</span>
                          </button>

                          {/* Quick booking button for open (non-pending) slots */}
                          {isOpen && !isBooked && !isPast && !isPendingDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setBookingSlotId(realSlot.id);
                              }}
                              className="absolute -top-2 -right-2 bg-white text-slate-900 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-400 hover:text-white"
                              title="Agendar Manualmente"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}

                          {/* Info tooltip for booked slots */}
                          {isBooked && (
                            <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white text-slate-900 p-3 rounded-xl shadow-xl text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <p className="font-bold">{realSlot.patientName}</p>
                              <p>{realSlot.patientRut}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pending changes banner */}
                  {hasPendingSlotChanges && (
                    <div className="mt-6 flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-3">
                      <div className="text-sm text-amber-200 font-medium">
                        <span className="font-bold">{pendingAdds.size + pendingDeletes.size} cambio{pendingAdds.size + pendingDeletes.size !== 1 ? "s" : ""} pendiente{pendingAdds.size + pendingDeletes.size !== 1 ? "s" : ""}</span>
                        {pendingAdds.size > 0 && <span className="ml-2 text-emerald-400">+{pendingAdds.size} por abrir</span>}
                        {pendingDeletes.size > 0 && <span className="ml-2 text-orange-400">−{pendingDeletes.size} por cerrar</span>}
                      </div>
                      <button
                        onClick={handleSaveSlots}
                        disabled={isSavingSlots}
                        className="flex items-center gap-1.5 text-sm text-white font-bold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 shadow-sm transition-all disabled:opacity-40"
                      >
                        <Save className="w-4 h-4" />
                        {isSavingSlots ? "Guardando..." : "Guardar agenda"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <Calendar className="w-16 h-16 mb-4 opacity-20" />
                  <p>Seleccione un día en el calendario.</p>
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* WHATSAPP TEMPLATES */}
      {activeTab === "whatsapp" && (
        <div className="animate-fadeIn">
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-bold text-white text-2xl flex items-center gap-3">
                  <MessageCircle className="w-8 h-8 text-emerald-400" /> Plantillas de WhatsApp
                </h3>
                <p className="text-slate-400 mt-2">Personaliza los mensajes que se envían desde la ficha clínica.</p>
              </div>
              <button
                onClick={addWaTemplate}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-5 h-5" /> Nueva Plantilla
              </button>
            </div>

            <WhatsappTemplatesManager
              templates={waTemplates}
              onChange={setWaTemplates}
              onRemove={removeWaTemplate}
              loading={waTemplatesLoading}
            />

            <div className="mt-8 pt-8 border-t border-slate-700 flex justify-end">
              <button
                onClick={saveWaTemplates}
                disabled={waTemplatesSaving}
                className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {waTemplatesSaving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MARKETING */}
      {activeTab === "marketing" && (activeCenter || centerId) && (
        <div className="animate-fadeIn">
          <MarketingPosterModule centerId={resolvedCenterId} centerName={activeCenter?.name || ""} />
        </div>
      )}

      {/* AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="animate-fadeIn">
          <AuditLogViewer logs={displayLogs} centerId={resolvedCenterId} />
        </div>
      )}

      {/* PREADMISSIONS */}
      {activeTab === "preadmissions" && (
        <div className="animate-fadeIn">
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-white text-2xl flex items-center gap-2">
                  <User className="w-6 h-6 text-indigo-400" /> Preingresos pendientes
                </h3>
                <p className="text-slate-400 text-sm mt-2">
                  Solicitudes enviadas sin autenticación o por el equipo.
                </p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                Total: {sortedPreadmissions.length}
              </span>
            </div>

            <div className="space-y-4">
              {sortedPreadmissions.map((item) => {
                const date = resolvePreadmissionDate(item);
                const contactName = item.contact?.name || item.patientDraft?.fullName || "Paciente";
                const contactRut = item.contact?.rut || item.patientDraft?.rut || "";
                const contactPhone = item.contact?.phone || item.patientDraft?.phone || "";
                const contactEmail = item.contact?.email || item.patientDraft?.email || "";
                const apptDate = item.appointmentDraft?.date;
                const apptTime = item.appointmentDraft?.time;
                const sourceLabel = item.source === "staff" ? "Equipo" : "Público";

                return (
                  <div key={item.id} className="bg-slate-900/70 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-bold text-white">{contactName}</h4>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mt-1">
                          {contactRut && <span className="font-mono">{contactRut}</span>}
                          {date && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {date.toLocaleString("es-CL")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700">
                          {sourceLabel}
                        </span>
                        <button
                          onClick={() => onApprovePreadmission(item)}
                          className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" /> Aprobar
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-300"><Phone className="w-4 h-4 text-emerald-400" />{contactPhone || "Sin teléfono"}</div>
                      <div className="flex items-center gap-2 text-slate-300"><Mail className="w-4 h-4 text-indigo-400" />{contactEmail || "Sin email"}</div>
                      <div className="flex items-center gap-2 text-slate-300"><Calendar className="w-4 h-4 text-blue-400" />{apptDate ? `${apptDate}${apptTime ? ` · ${apptTime}` : ""}` : "Sin hora solicitada"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL MODALS */}

      {/* MANUAL BOOKING */}
      {bookingSlotId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-sm w-full animate-fadeIn">
            <h3 className="text-xl font-bold mb-4">Agendar Manualmente</h3>
            <div className="space-y-4">
              <input className="w-full bg-slate-100 p-3 rounded-lg outline-none border border-slate-200" placeholder="RUT Paciente" value={bookingRut} onChange={(e) => setBookingRut(formatRUT(e.target.value))} />
              <input className="w-full bg-slate-100 p-3 rounded-lg outline-none border border-slate-200" placeholder="Nombre Completo" value={bookingName} onChange={(e) => setBookingName(e.target.value)} />
              <input className="w-full bg-slate-100 p-3 rounded-lg outline-none border border-slate-200" placeholder="Teléfono" value={bookingPhone} onChange={(e) => setBookingPhone(e.target.value)} />
              <div className="flex gap-2 mt-4">
                <button onClick={() => setBookingSlotId(null)} className="flex-1 bg-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-300">Cancelar</button>
                <button onClick={handleManualBooking} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-lg">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModal.isOpen && cancelModal.appointment && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-md w-full animate-fadeIn">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-8 h-8 text-amber-600" /></div>
            <h3 className="text-xl font-bold text-center mb-2">¿Cancelar Cita?</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-center">
              <p className="font-bold text-lg">{cancelModal.appointment.patientName}</p>
              <p className="text-slate-500">{cancelModal.appointment.date} - {cancelModal.appointment.time}</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => handleConfirmCancellation(true)} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-200"><MessageCircle className="w-5 h-5" /> Cancelar y Notificar WhatsApp</button>
              <button onClick={() => handleConfirmCancellation(false)} className="w-full bg-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-300">Solo Cancelar</button>
              <button onClick={() => setCancelModal({ isOpen: false, appointment: null })} className="w-full text-slate-400 font-bold py-2 hover:text-slate-600">Volver Atrás</button>
            </div>
          </div>
        </div>
      )}

      {/* MARKETING FLYER */}
      {showMarketingModal && activeCenter && (
        <MarketingFlyerModal
          type={marketingFlyerType}
          center={activeCenter}
          doctors={doctors}
          appointments={appointments}
          onClose={() => setShowMarketingModal(false)}
          onStatsUpdate={async (type) => {
            if (!db || !resolvedCenterId) return;
            try {
              const statsRef = doc(db, "centers", resolvedCenterId, "statistics", "marketing");
              const statsDoc = await getDoc(statsRef);
              const currentStats = statsDoc.exists() ? statsDoc.data() : {};
              await setDoc(statsRef, { ...currentStats, [`flyers_${type}`]: (currentStats[`flyers_${type}`] || 0) + 1, lastUpdated: serverTimestamp() }, { merge: true });
            } catch (error) { console.error("Error updating marketing stats:", error); }
          }}
        />
      )}

      {/* MIGRATION */}
      {showMigrationModal && activeCenter && (
        <MigrationModal center={activeCenter} onClose={() => setShowMigrationModal(false)} />
      )}

      {/* FEEDBACK BUTTON */}
      <a
        href="mailto:soporte@clavesalud.cl?subject=Reporte%20de%20Problema%20-%20ClaveSalud"
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

export default AdminDashboard;
