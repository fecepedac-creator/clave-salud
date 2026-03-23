import React, { useState, useEffect, useContext } from "react";
import { CenterContext } from "../CenterContext";
import {
  Doctor,
  Appointment,
  AuditLogEvent,
  AuditLogEntry,
  Patient,
  Preadmission,
  MedicalService,
} from "../types";
import { downloadJSON } from "../utils";
import {
  X,
  QrCode,
  Share2,
  Copy,
  ShieldCheck,
  Upload,
  Download,
  LogOut,
  Activity,
  Users,
  Calendar,
  MessageCircle,
  User,
  TrendingUp,
  Plus,
  Save,
  Phone,
  Check,
  Shield,
  ImageIcon,
  Clock,
  Mail,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "./Toast";
import { db, auth } from "../firebase";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  where,
  getDocs,
  getDoc,
  Timestamp,
  updateDoc,
  query,
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
import ServicesManager from "./ServicesManager";
import ServiceAgendasManager from "./ServiceAgendasManager";
import { AdminPerformanceTab } from "../features/admin/components/AdminPerformanceTab";
import AdminCommandCenter from "../features/admin/components/AdminCommandCenter";
import { WhatsappSettings } from "../features/admin/components/WhatsappSettings";
import { ProfessionalManagement } from "../features/admin/components/ProfessionalManagement";
import { AdminAgenda } from "../features/admin/components/AdminAgenda";

interface AdminDashboardProps {
  centerId: string; // NEW PROP: Required to link slots to the specific center
  doctors: Doctor[];
  onUpdateDoctors: (doctors: Doctor[]) => void;
  appointments: Appointment[];
  onUpdateAppointments: (appointments: Appointment[]) => void;
  onUpdateAppointment?: (appointment: Appointment) => Promise<void>; // Individual upsert
  onDeleteAppointment?: (id: string) => Promise<void>; // Individual delete
  isSyncingAppointments?: boolean;
  onLogout: () => void;
  onOpenLegal: (target: "terms" | "privacy") => void;
  patients: Patient[];
  onUpdatePatients: (patients: Patient[]) => void;
  preadmissions: Preadmission[];
  onApprovePreadmission: (item: Preadmission) => void;
  logs?: AuditLogEntry[]; // Prop used as fallback for Mock Mode (when db is null)
  onLogActivity: (event: AuditLogEvent) => void;
  currentUser?: any; // Role-based customization
  onClosePanel?: () => void;
}

// Build ROLE_LABELS dynamically from ROLE_CATALOG so ALL roles appear in dropdowns
export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_CATALOG.map((r) => [r.id, r.label])
);


const AdminDashboard: React.FC<AdminDashboardProps> = ({
  centerId,
  doctors,
  onUpdateDoctors,
  appointments,
  onUpdateAppointments,
  onLogout,
  onOpenLegal,
  patients,
  onUpdatePatients,
  preadmissions,
  onApprovePreadmission,
  logs,
  onLogActivity,
  currentUser,
  onClosePanel,
}) => {
  type AdminTab =
    | "command_center"
    | "doctors"
    | "agenda"
    | "whatsapp"
    | "marketing"
    | "audit"
    | "preadmissions"
    | "services"
    | "performance";

  const userRoles = currentUser?.roles || [];
  const isSecretary = userRoles.some((r) => {
    const low = String(r || "").toLowerCase();
    return low === "administrativo" || low === "administrativa" || low === "secretaria";
  });

  const [activeTab, setActiveTab] = useState<AdminTab>(isSecretary ? "agenda" : "doctors");

  const { showToast } = useToast();
  const { activeCenterId, activeCenter, isModuleEnabled } = useContext(CenterContext);
  const hasActiveCenter = Boolean(activeCenterId);
  const resolvedCenterId = activeCenterId || centerId;
  // --- defensive module guard ---
  // Agenda guard removed for E2E testing

  const [anthropometryEnabled, setAnthropometryEnabled] = useState(false);
  const [anthropometrySaving, setAnthropometrySaving] = useState(false);
  const [accessMode, setAccessMode] = useState<"CENTER_WIDE" | "CARE_TEAM">("CENTER_WIDE");

  useEffect(() => {
    setAnthropometryEnabled(Boolean(activeCenter?.features?.anthropometryEnabled));
  }, [activeCenter?.features?.anthropometryEnabled]);

  useEffect(() => {
    setAccessMode(activeCenter?.accessMode ?? "CENTER_WIDE");
  }, [activeCenter?.accessMode]);

  // Marketing Flyer
  const [showMarketingModal, setShowMarketingModal] = useState(false);
  const [marketingFlyerType, setMarketingFlyerType] = useState<"center" | "professional">("center");
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [centerLogoError, setCenterLogoError] = useState(false);
  const [isSyncingPublic, setIsSyncingPublic] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    appointment: Appointment | null;
  }>({ isOpen: false, appointment: null });

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

  const [medicalServices, setMedicalServices] = useState<MedicalService[]>([]);

  useEffect(() => {
    if (!db || !resolvedCenterId) return;
    const q = collection(db, "centers", resolvedCenterId, "services");
    return onSnapshot(q, (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MedicalService);
      setMedicalServices(raw.toSorted((a, b) => (a.name || "").localeCompare(b.name || "")));
    });
  }, [resolvedCenterId]);

  // Agenda State and Logic moved to AdminAgenda component

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
          updatedAt: serverTimestamp(),
        });
      }
      return;
    }

    const accessRole = doctor.isAdmin ? "center_admin" : "doctor";
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    await setDoc(doc(collection(db, "invites")), {
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

  // --- BACKUP & RESTORE FUNCTIONS ---
  const handleRestoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
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

  const handleSyncPublicStaff = async () => {
    if (!db || !centerId || doctors.length === 0) {
      showToast("No hay especialistas cargados para sincronizar.", "info");
      return;
    }
    setIsSyncingPublic(true);
    try {
      let count = 0;
      for (const d of doctors) {
        if (d.active !== false && d.visibleInBooking === true) {
          await upsertStaffAndPublic(d.id, d);
          count++;
        }
      }
      showToast(`Sincronizados ${count} profesionales con el portal.`, "success");
      onLogActivity({
        type: "STAFF_UPDATE",
        description: `Sincronización manual (${count} profesionales)`,
      });
    } catch (err) {
      console.error("Sync error:", err);
      showToast("Error al sincronizar catálogo.", "error");
    } finally {
      setIsSyncingPublic(false);
    }
  };

  const policyText = `La legislación chilena (Ley 20.584 y Reglamento sobre fichas clínicas) establece que los prestadores de salud deben conservar la ficha clínica por un periodo mínimo de 15 años.

Responsabilidades:
1. Integridad: El centro debe asegurar que la información no sea alterado.
2. Disponibilidad: La ficha debe estar disponible para el paciente o sus representantes legales.
3. Confidencialidad: Acceso restringido solo a personal autorizado.

En Clave Salud, los respaldos y registros de auditoría aseguran que se cumpla con la trazabilidad exigida por el Ministerio de Salud (MINSAL) y la Superintendencia de Salud.`;

  // --- CALENDAR & AGENDA FUNCTIONS ---

  // Agenda functions moved to AdminAgenda component

  // Cancellation and booking functions moved to AdminAgenda component

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
      <nav className="bg-slate-800 border-b border-slate-700 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-30 pt-16">
        <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
          <LogoHeader size="md" showText={true} />
          <div className="h-8 w-px bg-slate-700 hidden md:block mx-1" />
          <div className="hidden md:block">
            <h1 className="text-health-400 font-black text-lg uppercase tracking-tight leading-none">
              {isSecretary ? "Panel Administrativo" : "Administración"}
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
              Portal de Gestión
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {activeCenter?.logoUrl && (
            <div className="hidden md:flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-xs font-medium">Centro:</span>
              {!centerLogoError ? (
                <img
                  src={typeof activeCenter?.logoUrl === "string" ? activeCenter.logoUrl : ""}
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
            className="flex items-center gap-2 text-sm font-bold text-health-400 hover:text-health-300 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700"
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
            {!isSecretary && (
              <label className="flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 cursor-pointer">
                <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Restaurar</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleRestoreBackup}
                />
              </label>
            )}
            {!isSecretary && (
              <button
                onClick={() => {
                  downloadJSON({ patients, doctors, appointments }, "backup-clinica.json");
                  showToast("Descargando backup...", "info");
                }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700"
              >
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Backup</span>
              </button>
            )}
            {onClosePanel && (
              <button
                onClick={onClosePanel}
                className="flex-none flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white transition-colors bg-slate-700 px-4 py-2 rounded-lg border border-slate-600 shadow-sm"
                title="Cerrar Panel y Volver"
              >
                <X className="w-4 h-4" /> <span className="hidden sm:inline">Cerrar Panel</span>
              </button>
            )}
            <button
              onClick={onLogout}
              className="flex-none flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-red-400 transition-colors px-3"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />{" "}
              <span className="hidden sm:inline text-[x-small] uppercase tracking-widest font-black opacity-60">
                Salir
              </span>
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
        <div
          data-testid="admin-tab-bar"
          className="flex gap-1 bg-slate-800 p-1 rounded-xl w-full md:w-fit mb-8 overflow-x-auto"
        >
          <button
            onClick={() => setActiveTab("command_center")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "command_center" ? "bg-health-400 text-slate-900 shadow-[0_0_15px_-3px_rgba(74,222,128,0.4)]" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Activity className="w-4 h-4" /> Centro de Mando
          </button>
          {!isSecretary && (
            <button
              onClick={() => setActiveTab("doctors")}
              className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "doctors" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              <Users className="w-4 h-4" /> Gestión de Profesionales
            </button>
          )}
          {(isModuleEnabled ? isModuleEnabled("agenda") : true) && (
            <button
              onClick={() => setActiveTab("agenda")}
              disabled={!hasActiveCenter}
              className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "agenda" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
              title={hasActiveCenter ? "Configurar agenda" : "Selecciona un centro activo"}
              data-testid="admin-tab-agenda"
            >
              <Calendar className="w-4 h-4" /> Configurar Agenda
            </button>
          )}
          <button
            onClick={() => setActiveTab("whatsapp")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "whatsapp" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Plantillas WhatsApp" : "Selecciona un centro activo"}
          >
            <MessageCircle className="w-4 h-4" /> Plantillas WhatsApp
          </button>

          {!isSecretary && (
            <button
              onClick={() => setActiveTab("audit")}
              disabled={!hasActiveCenter}
              className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "audit" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
              title={hasActiveCenter ? "Auditoría" : "Selecciona un centro activo"}
            >
              <ShieldCheck className="w-4 h-4" /> Seguridad / Auditoría
            </button>
          )}
          <button
            onClick={() => setActiveTab("preadmissions")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "preadmissions" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Preingresos" : "Selecciona un centro activo"}
          >
            <User className="w-4 h-4" /> Preingresos
          </button>
          <button
            onClick={() => setActiveTab("services")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "services" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Catálogo de Prestaciones" : "Selecciona un centro activo"}
          >
            <Activity className="w-4 h-4" /> Prestaciones / Exámenes
          </button>
          <button
            onClick={() => setActiveTab("marketing")}
            disabled={!hasActiveCenter}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === "marketing" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Afiche para redes sociales" : "Selecciona un centro activo"}
          >
            <Share2 className="w-4 h-4" /> Afiche RRSS
          </button>
          <button
            data-testid="admin-tab-performance"
            onClick={() => setActiveTab("performance")}
            disabled={!hasActiveCenter}
            className={`px-3 md:px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "performance" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasActiveCenter ? "Rendimiento del Centro" : "Selecciona un centro activo"}
          >
            <TrendingUp className="w-4 h-4" /> Rendimiento
          </button>
        </div>
      </div>

      {/* COMMAND CENTER */}
      {activeTab === "command_center" && (
        <div data-testid="admin-dashboard-metrics-section">
          <AdminCommandCenter
            stats={{
              totalPatients: activeCenter?.stats?.patientCount || patients.length,
              todayAppointments:
                activeCenter?.stats?.appointmentCount ||
                appointments.filter((a) => a.date === new Date().toISOString().split("T")[0]).length,
              pendingPreadmissions: sortedPreadmissions.length,
              activeDoctors: activeCenter?.stats?.staffCount || doctors.filter((d) => d.active !== false).length,
            }}
            appointments={appointments}
            doctors={doctors}
            preadmissions={sortedPreadmissions}
            onOpenPatient={(appt) => {
              showToast(`Abriendo ficha de ${appt.patientName}`, "info");
            }}
            onCancelAppointment={(appt) => setCancelModal({ isOpen: true, appointment: appt })}
            onApprovePreadmission={onApprovePreadmission}
          />
        </div>
      )}

      {/* DOCTORS MANAGEMENT */}
      {activeTab === "doctors" && (
        <ProfessionalManagement
          doctors={doctors}
          onUpdateDoctors={onUpdateDoctors}
          centerId={centerId}
          activeCenter={activeCenter}
          hasActiveCenter={hasActiveCenter}
          onLogActivity={onLogActivity}
          ROLE_LABELS={ROLE_LABELS}
          isSyncingPublic={isSyncingPublic}
          handleSyncPublicStaff={handleSyncPublicStaff}
          anthropometryEnabled={anthropometryEnabled}
          anthropometrySaving={anthropometrySaving}
          handleAnthropometryToggle={handleAnthropometryToggle}
          setShowMarketingModal={setShowMarketingModal}
          setMarketingFlyerType={setMarketingFlyerType}
          setShowMigrationModal={setShowMigrationModal}
          persistDoctorToFirestore={persistDoctorToFirestore}
        />
      )}

      {/* AGENDA MANAGEMENT */}
      {activeTab === "agenda" && (isModuleEnabled ? isModuleEnabled("agenda") : true) && (
        <AdminAgenda
          centerId={centerId || ""}
          resolvedCenterId={resolvedCenterId}
          doctors={doctors}
          appointments={appointments}
          onUpdateAppointments={onUpdateAppointments}
          patients={patients}
          hasActiveCenter={hasActiveCenter}
          onLogActivity={onLogActivity}
          isModuleEnabled={isModuleEnabled}
          ROLE_LABELS={ROLE_LABELS}
          medicalServices={medicalServices}
          showToast={showToast}
          upsertStaffAndPublic={upsertStaffAndPublic}
          activeCenter={activeCenter}
          onUpdatePatients={onUpdatePatients}
        />
      )}

      {/* WHATSAPP TEMPLATES */}
      {activeTab === "whatsapp" && (
        <WhatsappSettings
          db={db!}
          auth={auth}
          activeCenterId={activeCenterId}
          resolvedCenterId={resolvedCenterId}
          showToast={showToast}
        />
      )}

      {/* MARKETING */}
      {activeTab === "marketing" && (activeCenter || centerId) && (
        <div className="animate-fadeIn space-y-6">
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                  <ImageIcon className="w-8 h-8 text-purple-400" /> Generador de Afiches
                </h3>
                <p className="text-slate-400 text-sm max-w-xl">
                  Crea piezas gráficas profesionales para tus redes sociales con QR de agendamiento
                  automático y descargas en alta calidad.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setMarketingFlyerType("center");
                    setShowMarketingModal(true);
                  }}
                  disabled={!hasActiveCenter}
                  className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="w-5 h-5" /> Crear Flyer Centro
                </button>
                <button
                  onClick={() => {
                    setMarketingFlyerType("professional");
                    setShowMarketingModal(true);
                  }}
                  disabled={!hasActiveCenter || doctors.length === 0}
                  className="flex items-center gap-2 px-8 py-4 bg-slate-700 text-white rounded-2xl font-bold hover:bg-slate-600 transition-all border border-slate-600 shadow-lg disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Users className="w-5 h-5" /> Por Especialista
                </button>
              </div>
            </div>
          </div>

          <MarketingPosterModule
            centerId={resolvedCenterId}
            centerName={activeCenter?.name || ""}
          />
        </div>
      )}

      {/* AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="animate-fadeIn">
          <AuditLogViewer logs={displayLogs} centerId={resolvedCenterId} />
        </div>
      )}

      {/* SERVICES MANAGEMENT */}
      {activeTab === "services" && (
        <div className="space-y-8 animate-fadeIn">
          <ServicesManager centerId={resolvedCenterId} />
          <ServiceAgendasManager
            centerId={resolvedCenterId}
            doctors={doctors}
            onUpdateDoctors={onUpdateDoctors}
          />
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
                  <div
                    key={item.id}
                    className="bg-slate-900/70 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4"
                  >
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
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-4 h-4 text-emerald-400" />
                        {contactPhone || "Sin teléfono"}
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Mail className="w-4 h-4 text-indigo-400" />
                        {contactEmail || "Sin email"}
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        {apptDate
                          ? `${apptDate}${apptTime ? ` · ${apptTime}` : ""}`
                          : "Sin hora solicitada"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PERFORMANCE / RENDIMIENTO */}
      {activeTab === "performance" && (
        <div className="animate-fadeIn">
          <AdminPerformanceTab
            centerId={resolvedCenterId}
            currentUserUid={auth.currentUser?.uid ?? ""}
            doctors={doctors}
            showToast={showToast}
          />
        </div>
      )}

      {/* GLOBAL MODALS */}

      {/* CANCEL MODAL (Shared for Command Center) */}
      {cancelModal.isOpen && cancelModal.appointment && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-md w-full animate-fadeIn shadow-2xl">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2">¿Cancelar Cita?</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-center">
              <p className="font-bold text-lg">{cancelModal.appointment.patientName}</p>
              <p className="text-slate-500">
                {cancelModal.appointment.date} - {cancelModal.appointment.time}
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                   onUpdateAppointments(appointments.filter(a => a.id !== cancelModal.appointment?.id));
                   onLogActivity({
                    action: "APPOINTMENT_CANCEL",
                    entityType: "appointment",
                    entityId: cancelModal.appointment!.id,
                    patientId: cancelModal.appointment!.patientId,
                    details: `Canceló cita desde Command Center: ${cancelModal.appointment!.patientName}`,
                   });
                   setCancelModal({ isOpen: false, appointment: null });
                   showToast("Cita cancelada correctamente.", "info");
                }}
                className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-rose-700 transition-colors"
              >
                Confirmar Cancelación
              </button>
              <button
                onClick={() => setCancelModal({ isOpen: false, appointment: null })}
                className="w-full text-slate-400 font-bold py-2 hover:text-slate-600"
              >
                Volver Atrás
              </button>
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
              await setDoc(
                statsRef,
                {
                  ...currentStats,
                  [`flyers_${type}`]: (currentStats[`flyers_${type}`] || 0) + 1,
                  lastUpdated: serverTimestamp(),
                },
                { merge: true }
              );
            } catch (error) {
              console.error("Error updating marketing stats:", error);
            }
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
