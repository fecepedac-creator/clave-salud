import React, { useMemo, useState } from "react";
import {
  Building2,
  LogOut,
  Plus,
  Save,
  Trash2,
  Edit,
  Shield,
  Zap,
  ZapOff,
  CreditCard,
  DollarSign,
  Mail,
  Megaphone,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { MedicalCenter, Doctor } from "../types";
import { CORPORATE_LOGO, ROLE_CATALOG } from "../constants";
import { useToast } from "./Toast";

// Logo en Firebase Storage
import { db, auth, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { addDoc, collection, getDocs, query, serverTimestamp, updateDoc, where, Timestamp } from "firebase/firestore";

/**
 * SuperAdminDashboard (Clavesalud)
 * - Mantiene compatibilidad con el esquema actual de MedicalCenter.
 * - Agrega pestañas: General, Centros, Finanzas, Comunicación.
 * - No crea usuarios en Firebase Auth desde el cliente (seguridad).
 *   En su lugar, permite registrar "adminEmail" y generar/mostrar plantillas de invitación.
 *
 * Nota: Los campos de "billing" / "plan" / "adminEmail" se guardan como propiedades adicionales
 * dentro del objeto center usando casting (center as any). Esto evita romper tu types.ts actual.
 */

type Tab = "general" | "centers" | "finanzas" | "comunicacion";

type PlanKey = "trial" | "basic" | "pro" | "enterprise";
type BillingStatus = "paid" | "due" | "overdue" | "grace" | "suspended";
type NotificationType = "billing" | "incident" | "security" | "info";
type NotificationSeverity = "low" | "medium" | "high";

type BillingInfo = {
  plan?: PlanKey;
  monthlyUF?: number;
  billingStatus?: BillingStatus;
  nextDueDate?: string; // YYYY-MM-DD
  lastPaidAt?: string;  // YYYY-MM-DD
  notes?: string;
};

type CenterExt = MedicalCenter & {
  adminEmail?: string;
  billing?: BillingInfo;
  logoUrl?: string;
};

interface SuperAdminDashboardProps {
  centers: MedicalCenter[];
  doctors: Doctor[];
  demoMode: boolean;
  onToggleDemo: () => void;

  onUpdateCenters: (centers: MedicalCenter[]) => Promise<void> | void;
  onDeleteCenter: (id: string) => Promise<void> | void;

  onUpdateDoctors: (doctors: Doctor[]) => Promise<void> | void;

  onLogout: () => void;
}

const LS_NOTIF_KEY = "clavesalud.centerNotifications.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type StoredNotification = {
  id: string;
  centerId: string;
  createdAtISO: string;
  createdBy: "superadmin";
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  sendEmail: boolean;
};

function loadNotifications(): StoredNotification[] {
  if (typeof window === "undefined") return [];
  return safeParse<StoredNotification[]>(window.localStorage.getItem(LS_NOTIF_KEY), []);
}

function saveNotifications(items: StoredNotification[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_NOTIF_KEY, JSON.stringify(items));
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeSlug(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

function uidShort() {
  return Math.random().toString(36).slice(2, 10);
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  centers,
  doctors,
  demoMode,
  onToggleDemo,
  onUpdateCenters,
  onDeleteCenter,
  onUpdateDoctors, // reservado para futuros usos en este dashboard
  onLogout,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("general");

  // Centros
  const [editingCenter, setEditingCenter] = useState<CenterExt | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Logo (Storage + preview)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);


// Invitaciones (SaaS)
const [isInvitingAdmin, setIsInvitingAdmin] = useState(false);
const [lastInviteLink, setLastInviteLink] = useState<string>("");

const generateSecureToken = (lenBytes: number = 24) => {
  // 24 bytes => 48 hex chars. Suficiente para token de invitación.
  const arr = new Uint8Array(lenBytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
};

const buildInviteEmail = (centerName: string, email: string, link: string) => {
  return [
    "Asunto: Invitación a ClaveSalud – Administración del centro",
    "",
    `Hola,`,
    "",
    `Has sido invitado(a) como Administrador(a) del centro:`,
    `Centro: ${centerName}`,
    "",
    "Para crear tu cuenta, haz clic en este enlace:",
    link,
    "",
    "Este enlace es personal y expira en 7 días.",
    "",
    "Saludos,",
    "Equipo ClaveSalud",
    "",
  ].join("\n");
};

const handleInviteCenterAdmin = async () => {
  if (!editingCenter) return;

  const email = (isCreating ? newCenterAdminEmail : ((editingCenter as any).adminEmail || "")).trim().toLowerCase();
  if (!email) {
    showToast("Falta el correo del administrador (adminEmail).", "error");
    return;
  }
  const centerId = isCreating ? (editingCenter.id || "") : editingCenter.id;
  if (!centerId) {
    showToast("Primero guarda el centro para poder invitar a su administrador.", "error");
    return;
  }

  setIsInvitingAdmin(true);
  try {
    // 1) Revocar invitaciones activas previas para este email + centro
    const invQ = query(
      collection(db, "invitations"),
      where("email", "==", email),
      where("centerId", "==", centerId),
      where("used", "==", false)
    );
    const prev = await getDocs(invQ);
    for (const d of prev.docs) {
      await updateDoc(d.ref, { revoked: true, revokedAt: serverTimestamp() });
    }

    // 2) Crear invitación nueva
    const token = generateSecureToken(24);
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // +7 días

    await addDoc(collection(db, "invitations"), {
      token,
      email,
      centerId,
      role: "center_admin",
      used: false,
      revoked: false,
      expiresAt,
      createdAt: serverTimestamp(),
      createdByUid: auth.currentUser?.uid || null,
    });

    const baseUrl = window.location.origin; // ej: https://clavesalud-2.web.app
    const link = `${baseUrl}/invite?token=${encodeURIComponent(token)}`;

    setLastInviteLink(link);

    // 3) Copiar correo listo para enviar
    const emailBody = buildInviteEmail(editingCenter.name || "Centro", email, link);
    await navigator.clipboard.writeText(emailBody);
    showToast("Invitación generada y copiada al portapapeles.", "success");
  } catch (e: any) {
    console.error("INVITE ERROR", e);
    showToast(e?.message || "Error generando invitación", "error");
  } finally {
    setIsInvitingAdmin(false);
  }
};
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterSlug, setNewCenterSlug] = useState("");
  const [newCenterAdminEmail, setNewCenterAdminEmail] = useState("");

  // Finanzas
  const [financeCenterId, setFinanceCenterId] = useState<string>(centers?.[0]?.id || "");
  const financeCenter = useMemo(() => {
    const c = centers.find((x) => x.id === financeCenterId);
    return (c ? (c as CenterExt) : null);
  }, [centers, financeCenterId]);

  // Comunicación
  const [commCenterId, setCommCenterId] = useState<string>(centers?.[0]?.id || "");
  const commCenter = useMemo(() => {
    const c = centers.find((x) => x.id === commCenterId);
    return (c ? (c as CenterExt) : null);
  }, [centers, commCenterId]);

  const [commType, setCommType] = useState<NotificationType>("billing");
  const [commSeverity, setCommSeverity] = useState<NotificationSeverity>("medium");
  const [commTitle, setCommTitle] = useState("");
  const [commBody, setCommBody] = useState("");
  const [commSendEmail, setCommSendEmail] = useState(true);

  const notifications = useMemo(() => loadNotifications(), []);
  const [notifRefreshTick, setNotifRefreshTick] = useState(0);

  const commHistory = useMemo(() => {
    // fuerza recalculo al enviar
    void notifRefreshTick;
    return loadNotifications()
      .filter((n) => n.centerId === commCenterId)
      .sort((a, b) => (a.createdAtISO < b.createdAtISO ? 1 : -1));
  }, [commCenterId, notifRefreshTick]);


  const resetLogoState = () => {
    if (logoPreview) {
      try { URL.revokeObjectURL(logoPreview); } catch {}
    }
    setLogoFile(null);
    setLogoPreview("");
  };

  const totals = useMemo(() => {
    const total = centers.length;
    const active = centers.filter((c) => !!(c as any).isActive).length;
    const maxUsers = centers.reduce((acc, c) => acc + (Number((c as any).maxUsers) || 0), 0);

    const billingStats = centers.reduce(
      (acc, c) => {
        const b = ((c as any).billing || {}) as BillingInfo;
        const st = (b.billingStatus || "due") as BillingStatus;
        acc[st] = (acc[st] || 0) + 1;
        return acc;
      },
      {} as Record<BillingStatus, number>
    );

    return { total, active, maxUsers, billingStats };
  }, [centers]);

  const handleStartCreate = () => {
    resetLogoState();
    setIsCreating(true);
    setEditingCenter({
      id: "",
      name: "",
      slug: "",
      primaryColor: "teal",
      isActive: true,
      maxUsers: 10,
      allowedRoles: ["MEDICO", "ENFERMERA"],
      modules: { dental: false, prescriptions: true, agenda: true },
      adminAccess: { manageUsers: true, configAgenda: true, securityLogs: true, analytics: true },
      createdAt: new Date().toISOString(),
      adminEmail: "",
      billing: {
        plan: "trial",
        monthlyUF: 0,
        billingStatus: "grace",
        nextDueDate: "",
        lastPaidAt: "",
        notes: "Centro en prueba.",
      },
    } as CenterExt);

    setNewCenterName("");
    setNewCenterSlug("");
    setNewCenterAdminEmail("");
  };

  const handleSaveCenter = async () => {
  if (!editingCenter) return;

  setIsUploadingLogo(true); // bloquea UI mientras sube/guarda

  try {
    const name = (isCreating ? newCenterName : editingCenter.name).trim();
    const slug = normalizeSlug(isCreating ? newCenterSlug : editingCenter.slug);

    if (!name || !slug) {
      showToast("Nombre y slug son obligatorios", "error");
      return;
    }

    const centerId = isCreating ? `c_${uidShort()}` : editingCenter.id;

    // logo actual en edición
    let finalLogoUrl = (editingCenter as any).logoUrl || "";

    // logo anterior (si existía en la lista)
    const prevLogoUrl = ((centers.find((c) => c.id === centerId) as any)?.logoUrl || "") as string;

    // 1) Subir nuevo logo si el usuario seleccionó archivo
    if (logoFile) {
      const logoRef = ref(storage, `centers-logos/${centerId}/logo`);
      const uploadResult = await uploadBytes(logoRef, logoFile, { contentType: logoFile.type });
      finalLogoUrl = await getDownloadURL(uploadResult.ref);
    }
    // 2) Si el usuario quitó el logo (finalLogoUrl vacío) y antes existía -> borrar archivo en Storage
    else if (!finalLogoUrl && prevLogoUrl) {
      try {
        const logoRef = ref(storage, `centers-logos/${centerId}/logo`);
        await deleteObject(logoRef);
      } catch (err: any) {
        if (err?.code !== "storage/object-not-found") {
          console.warn("No se pudo eliminar el logo anterior:", err);
        }
      }
    }

    const finalCenter: CenterExt = {
      ...editingCenter,
      id: centerId,
      name,
      slug,
      logoUrl: finalLogoUrl,
      createdAt: isCreating ? new Date().toISOString() : editingCenter.createdAt,
      adminEmail: isCreating ? newCenterAdminEmail.trim() : (editingCenter as any).adminEmail,
    };

    // Estrategia "upsert": reemplaza/actualiza solo 1 centro
    await onUpdateCenters([finalCenter as any]);

    showToast(isCreating ? "Centro creado con éxito" : "Centro actualizado con éxito", "success");

    setEditingCenter(null);
    setIsCreating(false);
    resetLogoState();

    if (isCreating) {
      setFinanceCenterId(centerId);
      setCommCenterId(centerId);
    }
  } catch (e: any) {
    console.error("SAVE CENTER ERROR", e);
    showToast(e?.message || "Error guardando centro", "error");
  } finally {
    setIsUploadingLogo(false);
  }
};

  const handleDeleteCenter = async (id: string) => {
    if (!id) return;
    if (!window.confirm("¿Eliminar este centro? (no se puede deshacer)")) return;
    try {
      await onDeleteCenter(id);
      showToast("Centro eliminado", "success");
      if (financeCenterId === id) setFinanceCenterId(centers?.[0]?.id || "");
      if (commCenterId === id) setCommCenterId(centers?.[0]?.id || "");
    } catch (e: any) {
      showToast(e?.message || "Error al eliminar", "error");
    }
  };

  const updateCenterPatch = async (centerId: string, patch: Partial<CenterExt>) => {
    const center = centers.find((c) => c.id === centerId);
    if (!center) {
      showToast("Centro no encontrado", "error");
      return;
    }
    const merged = { ...(center as any), ...patch } as CenterExt;

    try {
      await onUpdateCenters([merged as any]);
      showToast("Cambios guardados", "success");
    } catch (e: any) {
      showToast(e?.message || "Error guardando cambios", "error");
    }
  };

  const updateBilling = async (centerId: string, billingPatch: Partial<BillingInfo>) => {
    const center = centers.find((c) => c.id === centerId) as CenterExt | undefined;
    if (!center) {
      showToast("Centro no encontrado", "error");
      return;
    }
    const billing = ({ ...(center as any).billing, ...billingPatch } || {}) as BillingInfo;
    await updateCenterPatch(centerId, { billing });
  };

  const handleSendNotification = async () => {
    if (!commCenter) {
      showToast("Selecciona un centro", "error");
      return;
    }
    const title = commTitle.trim();
    const body = commBody.trim();

    if (!title || !body) {
      showToast("Título y mensaje son obligatorios", "error");
      return;
    }

    const adminEmail = (commCenter as any).adminEmail?.trim() || "";
    const n: StoredNotification = {
      id: `n_${uidShort()}`,
      centerId: commCenter.id,
      createdAtISO: new Date().toISOString(),
      createdBy: "superadmin",
      type: commType,
      severity: commSeverity,
      title,
      body,
      sendEmail: commSendEmail,
    };

    const all = loadNotifications();
    all.unshift(n);
    saveNotifications(all);
    setNotifRefreshTick((x) => x + 1);

    // UX: si pidió email pero no hay adminEmail configurado, lo avisamos
    if (commSendEmail && !adminEmail) {
      showToast("Aviso guardado. Falta adminEmail para enviar por correo.", "warning");
    } else {
      showToast("Aviso enviado (registrado)", "success");
    }

    setCommTitle("");
    setCommBody("");
  };

  const renderSidebarButton = (tab: Tab, label: string, icon?: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        activeTab === tab ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-800"
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </span>
    </button>
  );

  const renderBadge = (status?: BillingStatus) => {
    const st: BillingStatus = status || "due";
    const map: Record<BillingStatus, { label: string; cls: string; icon: any }> = {
      paid: { label: "Al día", cls: "bg-green-100 text-green-700", icon: CheckCircle },
      grace: { label: "Gracia", cls: "bg-yellow-100 text-yellow-800", icon: CheckCircle },
      due: { label: "Por vencer", cls: "bg-amber-100 text-amber-800", icon: CheckCircle },
      overdue: { label: "Atrasado", cls: "bg-red-100 text-red-700", icon: XCircle },
      suspended: { label: "Suspendido", cls: "bg-slate-200 text-slate-700", icon: XCircle },
    };
    const Icon = map[st].icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[st].cls}`}>
        <Icon className="w-3 h-3" /> {map[st].label}
      </span>
    );
  };

  const emailTemplate = useMemo(() => {
    if (!commCenter) return "";
    const adminEmail = (commCenter as any).adminEmail?.trim() || "[admin@centro.cl]";
    const centerName = commCenter.name || "Centro";
    const subject =
      commType === "billing"
        ? `ClaveSalud — Aviso de facturación (${centerName})`
        : commType === "incident"
        ? `ClaveSalud — Incidencia operativa (${centerName})`
        : commType === "security"
        ? `ClaveSalud — Aviso de seguridad (${centerName})`
        : `ClaveSalud — Información (${centerName})`;

    const body = [
      `Para: ${adminEmail}`,
      `Asunto: ${subject}`,
      ``,
      `Hola,`,
      ``,
      `${commTitle || "[Título del aviso]"}`,
      ``,
      `${commBody || "[Detalle del mensaje]"}`,
      ``,
      `Centro: ${centerName} (${commCenter.slug})`,
      `Fecha: ${todayISO()}`,
      ``,
      `— Equipo ClaveSalud`,
    ].join("\n");

    return body;
  }, [commCenter, commType, commTitle, commBody]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pl-64">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full fixed left-0 top-0 border-r border-slate-800 z-50">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-500">
            <Shield className="w-3 h-3" /> Super Admin
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {renderSidebarButton("general", "Visión General", <span className="inline-flex w-5 justify-center"><Megaphone className="w-4 h-4" /></span>)}
          {renderSidebarButton("centers", "Centros", <span className="inline-flex w-5 justify-center"><Building2 className="w-4 h-4" /></span>)}
          {renderSidebarButton("finanzas", "Finanzas", <span className="inline-flex w-5 justify-center"><CreditCard className="w-4 h-4" /></span>)}
          {renderSidebarButton("comunicacion", "Comunicación", <span className="inline-flex w-5 justify-center"><Mail className="w-4 h-4" /></span>)}
        </nav>

        <div className="p-4 space-y-4 border-t border-slate-800">
          <button
            onClick={onToggleDemo}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
              demoMode
                ? "bg-indigo-900/50 border-indigo-500 text-indigo-100"
                : "bg-slate-800 border-slate-700 text-slate-500"
            }`}
          >
            <div className="flex items-center gap-2">
              {demoMode ? <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" /> : <ZapOff className="w-4 h-4" />}
              <span className="text-xs font-bold uppercase">Modo Demo</span>
            </div>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="p-8 max-w-6xl mx-auto">
        <div className="flex justify-end mb-6">
          <img src={CORPORATE_LOGO} alt="ClaveSalud" className="h-10 w-auto" />
        </div>
        {/* GENERAL */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">Visión General</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Total Centros</div>
                <div className="text-3xl font-bold text-slate-800">{totals.total}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Centros Activos</div>
                <div className="text-3xl font-bold text-slate-800">{totals.active}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Cupos (maxUsers)</div>
                <div className="text-3xl font-bold text-slate-800">{totals.maxUsers}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Atrasados</div>
                <div className="text-3xl font-bold text-slate-800">{totals.billingStats.overdue || 0}</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-sm text-slate-600">
              <p className="font-semibold text-slate-800 mb-2">Nota importante</p>
              <p>
                Por seguridad, este panel <b>no crea usuarios/contraseñas</b> en Firebase Auth desde el navegador. Para un
                alta segura de administradores, usa una <b>Cloud Function</b> (Admin SDK) o un flujo de invitación controlado.
              </p>
              <p className="mt-3">
                En este MVP, el SuperAdmin puede: <b>crear centros</b>, registrar <b>adminEmail</b>, administrar <b>plan/estado
                de pago</b> y <b>enviar avisos</b> (registro interno + plantilla de email).
              </p>
            </div>
          </div>
        )}

        {/* CENTERS */}
        {activeTab === "centers" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">Gestión de Centros</h1>
                <p className="text-slate-500">Crear/editar centros, módulos, cupos y adminEmail.</p>
              </div>

              {!editingCenter && (
                <button
                  onClick={handleStartCreate}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"
                >
                  <Plus className="w-5 h-5" /> Crear Centro
                </button>
              )}
            </div>

            {!editingCenter ? (
              <div className="grid gap-4">
                {centers.map((c0) => {
                  const center = c0 as CenterExt;
                  const billing = (center as any).billing as BillingInfo | undefined;
                  return (
                    <div
                      key={center.id}
                      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-start md:items-center"
                    >
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-700 flex-shrink-0 border border-slate-200 overflow-hidden">
                        <Building2 className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-slate-800">{center.name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              (center as any).isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {(center as any).isActive ? "Activo" : "Suspendido"}
                          </span>
                          {renderBadge(billing?.billingStatus)}
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {(billing?.plan || "trial").toUpperCase()}
                          </span>
                        </div>

                        <div className="text-sm text-slate-500 mt-1">
                          <span className="font-mono bg-slate-100 px-1 rounded">/{center.slug}</span>
                          {" • "}maxUsers: {(center as any).maxUsers ?? 0}
                          {" • "}Admin: {(center as any).adminEmail ? (center as any).adminEmail : "—"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            resetLogoState();
                            setEditingCenter(center);
                            setIsCreating(false);
                          }}
                          className="p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-indigo-600 transition-colors"
                          title="Editar centro"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCenter(center.id)}
                          className="p-3 bg-red-50 hover:bg-red-100 rounded-xl text-red-600 transition-colors"
                          title="Eliminar centro"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {centers.length === 0 && <p className="text-center py-10 text-slate-400 font-bold">No hay centros creados aún.</p>}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <h3 className="text-2xl font-bold text-slate-800">
                    {isCreating ? "Nuevo Centro" : `Editar: ${editingCenter.name}`}
                  </h3>
                  <button
                    onClick={() => setEditingCenter(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-sm"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {isCreating ? (
                      <>
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">Nombre</span>
                          <input
                            className="w-full p-3 border rounded-xl"
                            value={newCenterName}
                            onChange={(e) => setNewCenterName(e.target.value)}
                            placeholder="Nombre del centro"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">Slug</span>
                          <input
                            className="w-full p-3 border rounded-xl"
                            value={newCenterSlug}
                            onChange={(e) => setNewCenterSlug(e.target.value)}
                            placeholder="ej: saludmass"
                          />
                          <div className="text-xs text-slate-400 mt-1">
                            Se normaliza automáticamente (minúsculas, sin espacios).
                          </div>
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">Admin Email (primer admin)</span>
                          <input
                            className="w-full p-3 border rounded-xl"
                            value={newCenterAdminEmail}
                            onChange={(e) => setNewCenterAdminEmail(e.target.value)}
                            placeholder="admin@centro.cl"
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">Nombre</span>
                          <input
                            className="w-full p-3 border rounded-xl"
                            value={editingCenter.name}
                            onChange={(e) => setEditingCenter({ ...editingCenter, name: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">Slug</span>
                          <input
                            className="w-full p-3 border rounded-xl"
                            value={editingCenter.slug}
                            onChange={(e) => setEditingCenter({ ...editingCenter, slug: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">Admin Email</span>
                          <input
                            className="w-full p-3 border rounded-xl"
                            value={(editingCenter as any).adminEmail || ""}
                            onChange={(e) => setEditingCenter({ ...(editingCenter as any), adminEmail: e.target.value })}
                            placeholder="admin@centro.cl"
                          />
                        </label>
                      </>
                    )}


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-bold text-slate-400 uppercase">RUT Empresa</span>
                        <input
                          className="w-full p-3 border rounded-xl"
                          value={String((editingCenter as any).legalInfo?.rut || "")}
                          onChange={(e) =>
                            setEditingCenter({
                              ...(editingCenter as any),
                              legalInfo: { ...((editingCenter as any).legalInfo || {}), rut: e.target.value },
                            })
                          }
                          placeholder="76.123.456-7"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-bold text-slate-400 uppercase">Titular / Representante</span>
                        <input
                          className="w-full p-3 border rounded-xl"
                          value={String((editingCenter as any).legalInfo?.representativeName || "")}
                          onChange={(e) =>
                            setEditingCenter({
                              ...(editingCenter as any),
                              legalInfo: { ...((editingCenter as any).legalInfo || {}), representativeName: e.target.value },
                            })
                          }
                          placeholder="Nombre del titular / administrador"
                        />
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Correo (administración / pagos)</span>
                        <input
                          className="w-full p-3 border rounded-xl"
                          value={String((editingCenter as any).legalInfo?.email || "")}
                          onChange={(e) =>
                            setEditingCenter({
                              ...(editingCenter as any),
                              legalInfo: { ...((editingCenter as any).legalInfo || {}), email: e.target.value },
                            })
                          }
                          placeholder="finanzas@centro.cl"
                        />
                      </label>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
  <div className="text-xs font-bold text-slate-400 uppercase mb-2">Logo del centro</div>
  <div className="text-sm text-slate-600">
    Sube un logo (PNG/JPG/WEBP, máx. 2MB). Se guarda en Firebase Storage y se registra como <b>logoUrl</b>.
  </div>
  <div className="mt-3 flex flex-col gap-2">
    <input
      id="logo-input"
      type="file"
      accept="image/png, image/jpeg, image/webp"
      className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
      disabled={isUploadingLogo}
      onChange={(e) => {
        const f = e.target.files?.[0];

        // limpia preview anterior
        if (logoPreview) {
          try { URL.revokeObjectURL(logoPreview); } catch {}
        }

        if (!f) {
          setLogoFile(null);
          setLogoPreview("");
          return;
        }

        if (f.size > 2 * 1024 * 1024) {
          showToast("Archivo muy grande. Máximo 2MB.", "error");
          e.target.value = "";
          setLogoFile(null);
          setLogoPreview("");
          return;
        }

        setLogoFile(f);
        setLogoPreview(URL.createObjectURL(f));
      }}
    />

    {(logoPreview || (editingCenter as any)?.logoUrl) && (
      <div className="flex items-center gap-3 mt-3">
        <img
          src={logoPreview || (editingCenter as any).logoUrl}
          alt="Previsualización del logo"
          className="w-14 h-14 rounded-xl object-cover border-2 border-slate-200 bg-white"
        />
        <button
          type="button"
          className="text-sm font-bold text-red-600 hover:text-red-800 disabled:opacity-50"
          disabled={isUploadingLogo}
          onClick={() => {
            // quitar logo: deja logoUrl vacío y sin archivo
            setLogoFile(null);
            if (logoPreview) {
              try { URL.revokeObjectURL(logoPreview); } catch {}
            }
            setLogoPreview("");

            setEditingCenter({ ...(editingCenter as any), logoUrl: "" });

            const fileInput = document.getElementById("logo-input") as HTMLInputElement | null;
            if (fileInput) fileInput.value = "";
          }}
        >
          Quitar logo
        </button>
      </div>
    )}
  </div>
</div>

<div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">Roles permitidos</div>
                      <div className="text-sm text-slate-600 mb-3">
                        Define qué perfiles puede crear el centro. Se guarda como IDs estables (ej: MEDICO, ENFERMERA).
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {ROLE_CATALOG.filter(r => r.id !== "ADMIN_CENTRO").map((r) => {
                          const selected = Array.isArray((editingCenter as any).allowedRoles)
                            ? (editingCenter as any).allowedRoles.includes(r.id)
                            : false;
                          return (
                            <label key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => {
                                  const curr: string[] = Array.isArray((editingCenter as any).allowedRoles)
                                    ? [...(editingCenter as any).allowedRoles]
                                    : [];
                                  const next = e.target.checked
                                    ? Array.from(new Set([...curr, r.id]))
                                    : curr.filter((x) => x !== r.id);
                                  setEditingCenter({ ...(editingCenter as any), allowedRoles: next });
                                }}
                                className="w-5 h-5 accent-indigo-600"
                              />
                              <span className="font-semibold text-slate-700">{r.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        Nota: el rol "Administrador del Centro" se asigna por invitación/alta y no se habilita/deshabilita desde aquí.
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">maxUsers</span>
                      <input
                        type="number"
                        className="w-full p-3 border rounded-xl"
                        value={(editingCenter as any).maxUsers ?? 0}
                        onChange={(e) => setEditingCenter({ ...(editingCenter as any), maxUsers: Number(e.target.value) })}
                      />
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border">
                      <input
                        type="checkbox"
                        checked={!!(editingCenter as any).isActive}
                        onChange={(e) => setEditingCenter({ ...(editingCenter as any), isActive: e.target.checked })}
                        className="w-5 h-5 accent-indigo-600"
                      />
                      <div>
                        <span className="block font-bold text-slate-700">Centro activo</span>
                        <span className="text-xs text-slate-400">Si está desactivado, el centro queda suspendido.</span>
                      </div>
                    </label>

                    
<div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
  <div className="text-xs font-bold text-slate-400 uppercase mb-2">Invitar administrador</div>
  <div className="text-sm text-slate-600">
    Genera un enlace seguro (token) para que el administrador cree su contraseña. Expira en 7 días.
  </div>

  <div className="mt-3 flex flex-col gap-2">
    <button
      type="button"
      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
      disabled={isInvitingAdmin}
      onClick={handleInviteCenterAdmin}
    >
      {isInvitingAdmin ? "Generando..." : "Generar invitación y copiar correo"}
    </button>

    {lastInviteLink && (
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Enlace</div>
        <div className="text-sm text-slate-700 break-all">{lastInviteLink}</div>
        <button
          type="button"
          className="mt-2 text-sm font-bold text-slate-900 hover:underline"
          onClick={async () => {
            await navigator.clipboard.writeText(lastInviteLink);
            showToast("Enlace copiado.", "success");
          }}
        >
          Copiar enlace
        </button>
      </div>
    )}

    <div className="text-xs text-slate-500">
      Requisito: el centro debe estar guardado y tener <b>adminEmail</b>.
    </div>
  </div>
</div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">Módulos</div>

                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border mb-2">
                        <input
                          type="checkbox"
                          checked={!!(editingCenter as any).modules?.agenda}
                          onChange={(e) =>
                            setEditingCenter({
                              ...(editingCenter as any),
                              modules: { ...((editingCenter as any).modules || {}), agenda: e.target.checked },
                            })
                          }
                          className="w-5 h-5 accent-indigo-600"
                        />
                        <span className="font-semibold text-slate-700">Agenda</span>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border mb-2">
                        <input
                          type="checkbox"
                          checked={!!(editingCenter as any).modules?.prescriptions}
                          onChange={(e) =>
                            setEditingCenter({
                              ...(editingCenter as any),
                              modules: { ...((editingCenter as any).modules || {}), prescriptions: e.target.checked },
                            })
                          }
                          className="w-5 h-5 accent-indigo-600"
                        />
                        <span className="font-semibold text-slate-700">Recetas</span>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border">
                        <input
                          type="checkbox"
                          checked={!!(editingCenter as any).modules?.dental}
                          onChange={(e) =>
                            setEditingCenter({
                              ...(editingCenter as any),
                              modules: { ...((editingCenter as any).modules || {}), dental: e.target.checked },
                            })
                          }
                          className="w-5 h-5 accent-indigo-600"
                        />
                        <span className="font-semibold text-slate-700">Dental</span>
                      </label>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">Plan / Facturación (rápido)</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">Plan</span>
                          <select
                            className="w-full p-3 border rounded-xl bg-white"
                            value={((editingCenter as any).billing?.plan || "trial") as PlanKey}
                            onChange={(e) =>
                              setEditingCenter({
                                ...(editingCenter as any),
                                billing: { ...((editingCenter as any).billing || {}), plan: e.target.value as PlanKey },
                              })
                            }
                          >
                            <option value="trial">Trial</option>
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">UF / mes</span>
                          <input
                            type="number"
                            className="w-full p-3 border rounded-xl"
                            value={Number((editingCenter as any).billing?.monthlyUF || 0)}
                            onChange={(e) =>
                              setEditingCenter({
                                ...(editingCenter as any),
                                billing: { ...((editingCenter as any).billing || {}), monthlyUF: Number(e.target.value) },
                              })
                            }
                          />
                        </label>

                        <label className="block">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">Estado</span>
                          <select
                            className="w-full p-3 border rounded-xl bg-white"
                            value={((editingCenter as any).billing?.billingStatus || "due") as BillingStatus}
                            onChange={(e) =>
                              setEditingCenter({
                                ...(editingCenter as any),
                                billing: {
                                  ...((editingCenter as any).billing || {}),
                                  billingStatus: e.target.value as BillingStatus,
                                },
                              })
                            }
                          >
                            <option value="paid">Al día</option>
                            <option value="due">Por vencer</option>
                            <option value="grace">Gracia</option>
                            <option value="overdue">Atrasado</option>
                            <option value="suspended">Suspendido</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">Próximo venc.</span>
                          <input
                            type="date"
                            className="w-full p-3 border rounded-xl"
                            value={String((editingCenter as any).billing?.nextDueDate || "")}
                            onChange={(e) =>
                              setEditingCenter({
                                ...(editingCenter as any),
                                billing: { ...((editingCenter as any).billing || {}), nextDueDate: e.target.value },
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">
                        Tip: guarda estos cambios aquí o desde la pestaña Finanzas.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-end pt-6 border-t mt-8">
                  <button
                    onClick={() => setEditingCenter(null)}
                    className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveCenter}
                    className="px-8 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg flex items-center gap-2"
                  >
                    <Save className="w-5 h-5" /> {isUploadingLogo ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FINANZAS */}
        {activeTab === "finanzas" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Finanzas</h1>
              <p className="text-slate-500">Plan, estado de pago, vencimientos y notas internas.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <label className="block flex-1">
                  <span className="text-xs font-bold text-slate-400 uppercase">Centro</span>
                  <select
                    className="w-full p-3 border rounded-xl bg-white"
                    value={financeCenterId}
                    onChange={(e) => setFinanceCenterId(e.target.value)}
                  >
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {(c as any).name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center gap-2">
                  {financeCenter?.billing ? renderBadge(financeCenter.billing.billingStatus) : renderBadge("due")}
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                    {String((financeCenter as any)?.billing?.plan || "trial").toUpperCase()}
                  </span>
                </div>
              </div>

              {!financeCenter ? (
                <div className="text-slate-500 mt-4">No hay centro seleccionado.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Plan</span>
                      <select
                        className="w-full p-3 border rounded-xl bg-white"
                        value={((financeCenter as any).billing?.plan || "trial") as PlanKey}
                        onChange={(e) => updateBilling(financeCenter.id, { plan: e.target.value as PlanKey })}
                      >
                        <option value="trial">Trial</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">UF / mes</span>
                      <input
                        type="number"
                        className="w-full p-3 border rounded-xl"
                        value={Number((financeCenter as any).billing?.monthlyUF || 0)}
                        onChange={(e) => updateBilling(financeCenter.id, { monthlyUF: Number(e.target.value) })}
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Estado de pago</span>
                      <select
                        className="w-full p-3 border rounded-xl bg-white"
                        value={((financeCenter as any).billing?.billingStatus || "due") as BillingStatus}
                        onChange={(e) => updateBilling(financeCenter.id, { billingStatus: e.target.value as BillingStatus })}
                      >
                        <option value="paid">Al día</option>
                        <option value="due">Por vencer</option>
                        <option value="grace">Gracia</option>
                        <option value="overdue">Atrasado</option>
                        <option value="suspended">Suspendido</option>
                      </select>
                    </label>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 inline-flex items-center gap-2"
                        onClick={() => updateBilling(financeCenter.id, { billingStatus: "paid", lastPaidAt: todayISO() })}
                        title="Marcar pagado hoy"
                      >
                        <DollarSign className="w-4 h-4" /> Marcar pagado
                      </button>

                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 inline-flex items-center gap-2"
                        onClick={() => updateBilling(financeCenter.id, { billingStatus: "overdue" })}
                        title="Marcar atrasado"
                      >
                        <CreditCard className="w-4 h-4" /> Marcar atrasado
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Próximo vencimiento</span>
                      <input
                        type="date"
                        className="w-full p-3 border rounded-xl"
                        value={String((financeCenter as any).billing?.nextDueDate || "")}
                        onChange={(e) => updateBilling(financeCenter.id, { nextDueDate: e.target.value })}
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Último pago</span>
                      <input
                        type="date"
                        className="w-full p-3 border rounded-xl"
                        value={String((financeCenter as any).billing?.lastPaidAt || "")}
                        onChange={(e) => updateBilling(financeCenter.id, { lastPaidAt: e.target.value })}
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Notas internas</span>
                      <textarea
                        className="w-full p-3 border rounded-xl min-h-[120px]"
                        value={String((financeCenter as any).billing?.notes || "")}
                        onChange={(e) => updateBilling(financeCenter.id, { notes: e.target.value })}
                        placeholder="Ej: convenio, prórroga, contacto administrativo..."
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Resumen por estado</div>
              <div className="flex flex-wrap gap-2">
                {(["paid", "due", "grace", "overdue", "suspended"] as BillingStatus[]).map((st) => (
                  <span key={st} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border">
                    {renderBadge(st)}
                    <span className="text-sm font-bold text-slate-700">{totals.billingStats[st] || 0}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* COMUNICACIÓN */}
        {activeTab === "comunicacion" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Comunicación</h1>
              <p className="text-slate-500">
                Envía avisos a administradores (registro interno) y genera plantilla para correo.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-400 uppercase">Centro</span>
                    <select
                      className="w-full p-3 border rounded-xl bg-white"
                      value={commCenterId}
                      onChange={(e) => setCommCenterId(e.target.value)}
                    >
                      {centers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {(c as any).name}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-slate-400 mt-1">
                      Admin: {(commCenter as any)?.adminEmail ? (commCenter as any).adminEmail : "— (configúralo en Centros)"}
                    </div>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Tipo</span>
                      <select
                        className="w-full p-3 border rounded-xl bg-white"
                        value={commType}
                        onChange={(e) => setCommType(e.target.value as NotificationType)}
                      >
                        <option value="billing">Cobranza / Facturación</option>
                        <option value="incident">Incidencia / Servicio</option>
                        <option value="security">Seguridad</option>
                        <option value="info">Información</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Severidad</span>
                      <select
                        className="w-full p-3 border rounded-xl bg-white"
                        value={commSeverity}
                        onChange={(e) => setCommSeverity(e.target.value as NotificationSeverity)}
                      >
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-bold text-slate-400 uppercase">Título</span>
                    <input
                      className="w-full p-3 border rounded-xl"
                      value={commTitle}
                      onChange={(e) => setCommTitle(e.target.value)}
                      placeholder="Ej: Pago vencido — regularizar para mantener continuidad"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-slate-400 uppercase">Mensaje</span>
                    <textarea
                      className="w-full p-3 border rounded-xl min-h-[140px]"
                      value={commBody}
                      onChange={(e) => setCommBody(e.target.value)}
                      placeholder="Describe la situación, plazos y canal de contacto..."
                    />
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border">
                    <input
                      type="checkbox"
                      checked={commSendEmail}
                      onChange={(e) => setCommSendEmail(e.target.checked)}
                      className="w-5 h-5 accent-indigo-600"
                    />
                    <div>
                      <span className="block font-bold text-slate-700">Generar plantilla para email</span>
                      <span className="text-xs text-slate-400">El envío real por correo debe hacerse en servidor (Cloud Function).</span>
                    </div>
                  </label>

                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="button"
                      className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow inline-flex items-center gap-2"
                      onClick={handleSendNotification}
                    >
                      <Megaphone className="w-5 h-5" /> Enviar aviso
                    </button>

                    <button
                      type="button"
                      className="px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow inline-flex items-center gap-2"
                      onClick={() => {
                        navigator.clipboard?.writeText(emailTemplate);
                        showToast("Plantilla de correo copiada", "success");
                      }}
                    >
                      <Mail className="w-5 h-5" /> Copiar email
                    </button>
                  </div>

                  <div className="text-xs text-slate-400">
                    Consejo: para avisos de cobranza, puedes vincular esto con la pestaña Finanzas (estado "Atrasado").
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">Vista previa (email)</div>
                    <pre className="whitespace-pre-wrap text-xs text-slate-700 bg-white border rounded-xl p-3 min-h-[200px]">
{emailTemplate}
                    </pre>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">Historial (centro)</div>
                    {commHistory.length === 0 ? (
                      <div className="text-sm text-slate-500">No hay avisos registrados para este centro.</div>
                    ) : (
                      <div className="space-y-2">
                        {commHistory.slice(0, 10).map((n) => (
                          <div key={n.id} className="bg-white border rounded-xl p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-slate-800 text-sm">{n.title}</div>
                              <span className="text-[11px] text-slate-400">{new Date(n.createdAtISO).toLocaleString()}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">{n.type}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">{n.severity}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">
                                {n.sendEmail ? "con email" : "solo interno"}
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-slate-700">{n.body}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3">
                      <button
                        type="button"
                        className="text-sm font-bold text-slate-500 hover:text-slate-700"
                        onClick={() => {
                          if (!window.confirm("¿Borrar historial local de avisos?")) return;
                          saveNotifications([]);
                          setNotifRefreshTick((x) => x + 1);
                          showToast("Historial borrado (local)", "success");
                        }}
                      >
                        Borrar historial local
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Notas</div>
              <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
                <li>
                  En producción, reemplaza el guardado local por <b>Firestore</b> y el envío por correo por una <b>Cloud Function</b>.
                </li>
                <li>
                  Para cobranza automática, puedes disparar notificaciones cuando el centro pase a estado <b>overdue</b>.
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
