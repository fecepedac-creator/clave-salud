import React, { useEffect, useMemo, useState } from "react";
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
  BarChart3,
  Users,
  CalendarDays,
  Menu,
  X,
} from "lucide-react";
import { MedicalCenter, Doctor } from "../types";
import { CORPORATE_LOGO, ROLE_CATALOG } from "../constants";
import { useToast } from "./Toast";
import LogoHeader from "./LogoHeader";
import LegalLinks from "./LegalLinks";
import { DEFAULT_EXAM_ORDER_CATALOG, ExamOrderCatalog } from "../utils/examOrderCatalog";
import MarketingFlyerModal from "./MarketingFlyerModal";
import MetricCard from "./MetricCard";
import { SuperAdminGeneral } from "../features/superadmin/components/SuperAdminGeneral";
import { SuperAdminCenters } from "../features/superadmin/components/SuperAdminCenters";
import { SuperAdminFinance } from "../features/superadmin/components/SuperAdminFinance";
import { SuperAdminCommunications } from "../features/superadmin/components/SuperAdminCommunications";
import { SuperAdminUsers } from "../features/superadmin/components/SuperAdminUsers";
import { SuperAdminMetrics } from "../features/superadmin/components/SuperAdminMetrics";
import { requestCriticalAction } from "../utils/criticalActions";

// Firebase
import { db, auth, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
  collection,
  collectionGroup,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

/**
 * SuperAdminDashboard (ClaveSalud)
 * Mejora: InvitaciÃƒÆ’Ã‚Â³n admin abre correo prellenado (mailto) + opciÃƒÆ’Ã‚Â³n "Abrir en Gmail"
 */

type Tab = "general" | "centers" | "finanzas" | "metrics" | "comunicacion" | "users";

type PlanKey = "trial" | "basic" | "pro" | "enterprise";
type BillingStatus = "paid" | "due" | "overdue" | "grace" | "suspended";
type NotificationType = "billing" | "incident" | "security" | "info";
type NotificationSeverity = "low" | "medium" | "high";

type BillingInfo = {
  plan?: PlanKey;
  monthlyUF?: number;
  billingStatus?: BillingStatus;
  nextDueDate?: string; // YYYY-MM-DD
  lastPaidAt?: string; // YYYY-MM-DD
  notes?: string;
};

type CenterExt = MedicalCenter & {
  adminEmail?: string;
  billing?: BillingInfo;
  logoUrl?: string;
};

type MarketingSettings = {
  enabled: boolean;
  monthlyPosterLimit: number;
  allowPosterRetention: boolean;
  posterRetentionDays: number;
  retentionEnabled?: boolean;
  updatedAt?: any;
  updatedBy?: string;
};

interface SuperAdminDashboardProps {
  centers: MedicalCenter[];
  doctors: Doctor[];
  demoMode: boolean;
  onToggleDemo: () => void;
  canUsePreview?: boolean;
  previewCenterId?: string;
  previewRole?: string;
  onStartPreview?: (centerId: string, role: string) => void;
  onExitPreview?: () => void;

  onUpdateCenters: (centers: MedicalCenter[]) => Promise<void> | void;
  onDeleteCenter: (id: string, reason?: string) => Promise<void> | void;

  onUpdateDoctors: (doctors: Doctor[]) => Promise<void> | void;

  onLogout: () => void;
  onOpenLegal: (target: "terms" | "privacy") => void;

  hasMoreCenters?: boolean;
  onLoadMoreCenters?: () => void;
  isLoadingMoreCenters?: boolean;
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

function buildGmailComposeUrl(to: string, subject: string, body: string) {
  // Gmail web "compose" (sin API). Requiere que el usuario estÃƒÆ’Ã‚Â© logueado en Gmail.
  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  params.set("to", to);
  params.set("su", subject);
  params.set("body", body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function buildCopyEmailText(to: string, subject: string, body: string) {
  return [`Para: ${to}`, `Asunto: ${subject}`, "", body].join("\n");
}

// Predefined message templates
const MESSAGE_TEMPLATES = {
  cobranza: {
    title: "Recordatorio de Pago Pendiente",
    body: "Estimado/a administrador/a,\n\nLe recordamos que tiene un pago pendiente correspondiente al servicio de ClaveSalud. Le solicitamos regularizar su situaciÃƒÆ’Ã‚Â³n a la brevedad para mantener la continuidad del servicio.\n\nPara mÃƒÆ’Ã‚Â¡s informaciÃƒÆ’Ã‚Â³n o coordinaciÃƒÆ’Ã‚Â³n de pago, puede contactarnos respondiendo este mensaje.\n\nAtentamente,\nEquipo ClaveSalud",
  },
  info: {
    title: "Comunicado Informativo",
    body: "Estimado/a administrador/a,\n\nLe informamos que [descripciÃƒÆ’Ã‚Â³n de la informaciÃƒÆ’Ã‚Â³n importante].\n\n[Detalles adicionales si es necesario]\n\nPara cualquier consulta, estamos disponibles.\n\nAtentamente,\nEquipo ClaveSalud",
  },
  fiesta: {
    title: "Ãƒâ€šÃ‚Â¡Felices Fiestas!",
    body: "Estimado/a administrador/a,\n\nEn estas fechas especiales, queremos extenderles nuestros mejores deseos. Ãƒâ€šÃ‚Â¡Felices fiestas para usted y todo su equipo!\n\nAgradecemos su confianza en ClaveSalud.\n\nCon los mejores deseos,\nEquipo ClaveSalud",
  },
  bienvenida: {
    title: "Ãƒâ€šÃ‚Â¡Bienvenido a ClaveSalud!",
    body: "Estimado/a administrador/a,\n\nÃƒâ€šÃ‚Â¡Bienvenido/a a ClaveSalud! Estamos muy contentos de que su centro forme parte de nuestra plataforma.\n\nEn los prÃƒÆ’Ã‚Â³ximos dÃƒÆ’Ã‚Â­as, nuestro equipo estarÃƒÆ’Ã‚Â¡ disponible para ayudarle con cualquier consulta o necesidad durante la configuraciÃƒÆ’Ã‚Â³n inicial.\n\nAtentamente,\nEquipo ClaveSalud",
  },
  mantenimiento: {
    title: "Aviso de Mantenimiento Programado",
    body: "Estimado/a administrador/a,\n\nLe informamos que realizaremos un mantenimiento programado en la plataforma ClaveSalud el dÃƒÆ’Ã‚Â­a [fecha] entre las [hora inicio] y [hora fin].\n\nDurante este perÃƒÆ’Ã‚Â­odo, el sistema podrÃƒÆ’Ã‚Â­a presentar interrupciones temporales. Agradecemos su comprensiÃƒÆ’Ã‚Â³n.\n\nAtentamente,\nEquipo ClaveSalud",
  },
} as const;

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  centers,
  doctors,
  demoMode,
  onToggleDemo,
  canUsePreview = false,
  previewCenterId,
  previewRole,
  onStartPreview,
  onExitPreview,
  onUpdateCenters,
  onDeleteCenter,
  onUpdateDoctors, // reservado
  onLogout,
  onOpenLegal,
  hasMoreCenters = false,
  onLoadMoreCenters,
  isLoadingMoreCenters = false,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const previewRoles = useMemo(
    () => ROLE_CATALOG, // NOW INCLUDES ALL ROLES (including ADMIN_CENTRO)
    []
  );
  const [previewCenterSelection, setPreviewCenterSelection] = useState(previewCenterId ?? "");
  const [previewRoleSelection, setPreviewRoleSelection] = useState(previewRole ?? "");

  useEffect(() => {
    setPreviewCenterSelection(previewCenterId ?? "");
  }, [previewCenterId]);

  useEffect(() => {
    setPreviewRoleSelection(previewRole ?? "");
  }, [previewRole]);

  // Centros
  const [editingCenter, setEditingCenter] = useState<CenterExt | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  // Marketing Flyer
  const [showMarketingModal, setShowMarketingModal] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const [metricsUpdatedAt, setMetricsUpdatedAt] = useState<string>("");
  const [metrics, setMetrics] = useState({ patients: 0, professionals: 0 });

  // Marketing settings per center
  const [marketingSettings, setMarketingSettings] = useState<MarketingSettings>({
    enabled: false,
    monthlyPosterLimit: 0,
    allowPosterRetention: false,
    posterRetentionDays: 7,
    retentionEnabled: false,
  });
  const [marketingSaving, setMarketingSaving] = useState(false);

  // Invitaciones
  const [isInvitingAdmin, setIsInvitingAdmin] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string>("");

  // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ NUEVO: guardar la ÃƒÆ’Ã‚Âºltima invitaciÃƒÆ’Ã‚Â³n (para botÃƒÆ’Ã‚Â³n Gmail/copy robustos)
  const [lastInviteTo, setLastInviteTo] = useState<string>("");
  const [lastInviteSubject, setLastInviteSubject] = useState<string>("");
  const [lastInviteBody, setLastInviteBody] = useState<string>("");

  const generateSecureToken = (lenBytes: number = 24) => {
    const arr = new Uint8Array(lenBytes);
    crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const buildInviteEmailParts = (centerName: string, link: string) => {
    const subject = `InvitaciÃƒÆ’Ã‚Â³n a ClaveSalud ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â AdministraciÃƒÆ’Ã‚Â³n del centro (${centerName})`;
    const body = [
      `Hola,`,
      ``,
      `Has sido invitado(a) como Administrador(a) del centro:`,
      `Centro: ${centerName}`,
      ``,
      `Para crear tu cuenta y definir tu contraseÃƒÆ’Ã‚Â±a, usa este enlace:`,
      `${link}`,
      ``,
      `Este enlace es personal y expira en 7 dÃƒÆ’Ã‚Â­as.`,
      ``,
      `Saludos,`,
      `Equipo ClaveSalud`,
      ``,
    ].join("\n");
    return { subject, body };
  };

  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterSlug, setNewCenterSlug] = useState("");
  const [newCenterAdminEmail, setNewCenterAdminEmail] = useState("");

  // Finanzas
  const [financeCenterId, setFinanceCenterId] = useState<string>(centers?.[0]?.id || "");
  const financeCenter = useMemo(() => {
    const c = centers.find((x) => x.id === financeCenterId);
    return c ? (c as CenterExt) : null;
  }, [centers, financeCenterId]);

  // ComunicaciÃƒÆ’Ã‚Â³n
  const [commCenterId, setCommCenterId] = useState<string>(centers?.[0]?.id || "");
  const commCenter = useMemo(() => {
    const c = centers.find((x) => x.id === commCenterId);
    return c ? (c as CenterExt) : null;
  }, [centers, commCenterId]);

  const [commType, setCommType] = useState<NotificationType>("billing");
  const [commSeverity, setCommSeverity] = useState<NotificationSeverity>("medium");
  const [commTitle, setCommTitle] = useState("");
  const [commBody, setCommBody] = useState("");
  const [commSendEmail, setCommSendEmail] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [examOrderCatalogDraft, setExamOrderCatalogDraft] = useState<string>(
    JSON.stringify(DEFAULT_EXAM_ORDER_CATALOG, null, 2)
  );
  const [savingExamCatalog, setSavingExamCatalog] = useState(false);
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Handler to apply selected template
  const loadExamOrderCatalog = async () => {
    if (demoMode) {
      setExamOrderCatalogDraft(JSON.stringify(DEFAULT_EXAM_ORDER_CATALOG, null, 2));
      return;
    }
    try {
      const snap = await getDoc(doc(db, "globalSettings", "examOrderCatalog"));
      if (snap.exists()) {
        const data = snap.data() as ExamOrderCatalog;
        if (Array.isArray((data as any)?.categories)) {
          setExamOrderCatalogDraft(JSON.stringify(data, null, 2));
          return;
        }
      }
      setExamOrderCatalogDraft(JSON.stringify(DEFAULT_EXAM_ORDER_CATALOG, null, 2));
    } catch (error) {
      console.error("loadExamOrderCatalog", error);
      setExamOrderCatalogDraft(JSON.stringify(DEFAULT_EXAM_ORDER_CATALOG, null, 2));
    }
  };

  const saveExamOrderCatalog = async () => {
    try {
      setSavingExamCatalog(true);
      const parsed = JSON.parse(examOrderCatalogDraft);
      if (!Array.isArray(parsed?.categories)) {
        showToast("CatÃƒÆ’Ã‚Â¡logo invÃƒÆ’Ã‚Â¡lido: falta categories[]", "error");
        return;
      }
      await setDoc(
        doc(db, "globalSettings", "examOrderCatalog"),
        {
          ...parsed,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid ?? "superadmin",
        },
        { merge: true }
      );
      showToast("Plantilla principal de ÃƒÆ’Ã‚Â³rdenes guardada.", "success");
    } catch (error) {
      console.error("saveExamOrderCatalog", error);
      showToast("No se pudo guardar el catÃƒÆ’Ã‚Â¡logo de ÃƒÆ’Ã‚Â³rdenes.", "error");
    } finally {
      setSavingExamCatalog(false);
    }
  };

  const handleApplyTemplate = (templateKey: string) => {
    if (templateKey && templateKey in MESSAGE_TEMPLATES) {
      const template = MESSAGE_TEMPLATES[templateKey as keyof typeof MESSAGE_TEMPLATES];
      setCommTitle(template.title);
      setCommBody(template.body);
      setSelectedTemplate(templateKey);
    } else {
      setSelectedTemplate("");
    }
  };

  const [commHistory, setCommHistory] = useState<StoredNotification[]>([]);
  const [commHistoryLoading, setCommHistoryLoading] = useState(false);

  const [centerContextId, setCenterContextId] = useState<string>(centers?.[0]?.id || "");

  const [centerInvites, setCenterInvites] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  const [billingEvents, setBillingEvents] = useState<any[]>([]);
  const [billingEventsLoading, setBillingEventsLoading] = useState(false);

  useEffect(() => {
    if (!centers.length) return;
    setCenterContextId((prev) => prev || centers[0]?.id || "");
  }, [centers]);

  useEffect(() => {
    if (!editingCenter?.id) return;
    void loadMarketingSettings(editingCenter.id);
  }, [editingCenter?.id]);

  useEffect(() => {
    if (!centerContextId) return;
    setFinanceCenterId(centerContextId);
    setCommCenterId(centerContextId);
  }, [centerContextId]);

  const promptChangeReason = async (label: string) => {
    const response = await requestCriticalAction({
      title: `Confirmar ${label}`,
      message: "Esta accion quedara registrada en auditoria de superadmin.",
      confirmLabel: "Continuar",
      reasonRequired: true,
      reasonLabel: "Motivo",
      reasonPlaceholder: "Indica el motivo operativo o de cumplimiento",
      requireFinalConfirmation: true,
      confirmationLabel: "Confirmo que deseo continuar con esta accion.",
    });
    const reason = response?.confirmed ? response.reason : null;
    if (!reason || !reason.trim()) {
      showToast("Debes indicar un motivo para continuar.", "warning");
      return null;
    }
    return reason.trim();
  };
  const fetchCommHistory = async (centerId: string) => {
    if (demoMode) {
      setCommHistory([]);
      return;
    }
    if (!centerId) return;
    setCommHistoryLoading(true);
    try {
      const q = query(
        collection(db, "centers", centerId, "adminNotifications"),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          centerId,
          createdAtISO: data?.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data?.createdAtISO || new Date().toISOString(),
          createdBy: "superadmin" as const,
          type: data?.type || "info",
          severity: data?.severity || "medium",
          title: data?.title || "",
          body: data?.body || "",
          sendEmail: Boolean(data?.sendEmail),
        } as StoredNotification;
      });
      setCommHistory(items);
    } catch (e: any) {
      console.error("COMM HISTORY ERROR", e);
      setCommHistory([]);
    } finally {
      setCommHistoryLoading(false);
    }
  };

  const fetchCenterInvites = async (centerId: string) => {
    if (demoMode) {
      setCenterInvites([]);
      return;
    }
    if (!centerId) return;
    setInvitesLoading(true);
    try {
      const q = query(
        collection(db, "invites"),
        where("centerId", "==", centerId),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const snap = await getDocs(q);
      setCenterInvites(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e: any) {
      console.error("INVITES LOAD ERROR", e);
      setCenterInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  };

  const fetchBillingEvents = async (centerId: string) => {
    if (demoMode) {
      setBillingEvents([]);
      return;
    }
    if (!centerId) return;
    setBillingEventsLoading(true);
    try {
      const q = query(
        collection(db, "centers", centerId, "billingEvents"),
        orderBy("createdAt", "desc"),
        limit(8)
      );
      const snap = await getDocs(q);
      setBillingEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e: any) {
      console.error("BILLING EVENTS ERROR", e);
      setBillingEvents([]);
    } finally {
      setBillingEventsLoading(false);
    }
  };

  const loadMetrics = async () => {
    if (demoMode) {
      setMetricsLoading(true);
      // Simulate slight delay for realism but with mock data
      setTimeout(() => {
        setMetrics({
          patients: 1240,
          professionals: 45,
        });
        setMetricsUpdatedAt(new Date().toISOString());
        setMetricsLoading(false);
      }, 100);
      return;
    }

    if (!db) {
      setMetricsError("Firestore no disponible para mÃƒÆ’Ã‚Â©tricas.");
      return;
    }
    setMetricsLoading(true);
    setMetricsError("");
    try {
      // Intentamos obtener conteos uno por uno para mejor diagnÃƒÆ’Ã‚Â³stico
      const patientsSnap = await getCountFromServer(collection(db, "patients"));
      const staffSnap = await getCountFromServer(collectionGroup(db, "staff"));

      setMetrics({
        patients: Number(patientsSnap.data().count ?? 0),
        professionals: Number(staffSnap.data().count ?? 0),
      });
      setMetricsUpdatedAt(new Date().toISOString());
    } catch (error: any) {
      console.error("load metrics error", error);
      const errorMsg = error?.message || String(error);
      setMetricsError(`Error al cargar mÃƒÆ’Ã‚Â©tricas: ${errorMsg}`);
      showToast(`MÃƒÆ’Ã‚Â©tricas: ${errorMsg}`, "error");
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleRecalcStats = async (centerId?: string) => {
    try {
      setMetricsLoading(true);
      const functions = getFunctions();
      const recalc = httpsCallable(functions, "recalcCenterStats");
      const result = await recalc({ centerId });
      showToast("EstadÃƒÆ’Ã‚Â­sticas recalculadas con ÃƒÆ’Ã‚Â©xito. Actualizando vista...", "success");

      // After recalculating on backend, refresh the global counters too
      await loadMetrics();
    } catch (error: any) {
      console.error("handleRecalcStats error", error);
      const msg = error?.message || "Error al recalcular estadÃƒÆ’Ã‚Â­sticas.";

      // Si el error contiene una URL de Firebase (ÃƒÆ’Ã‚Â­ndice faltante), intentamos mostrarla mejor
      if (msg.includes("https://console.firebase.google.com")) {
        showToast(
          "Falta un ÃƒÆ’Ã‚Â­ndice de base de datos. Revisa la consola para el link de creaciÃƒÆ’Ã‚Â³n.",
          "error"
        );
      } else {
        showToast(msg, "error");
      }
    } finally {
      setMetricsLoading(false);
    }
  };

  const resetLogoState = () => {
    if (logoPreview) {
      try {
        URL.revokeObjectURL(logoPreview);
      } catch {}
    }
    setLogoFile(null);
    setLogoPreview("");
  };

  const loadMarketingSettings = async (centerId: string) => {
    if (demoMode) {
      setMarketingSettings({
        enabled: true,
        monthlyPosterLimit: 50,
        allowPosterRetention: true,
        posterRetentionDays: 30,
        retentionEnabled: true,
      });
      return;
    }
    if (!centerId) return;
    try {
      const snap = await getDoc(doc(db, "centers", centerId, "settings", "marketing"));
      if (snap.exists()) {
        const data = snap.data() as MarketingSettings;
        setMarketingSettings({
          enabled: Boolean(data.enabled),
          monthlyPosterLimit: Number(data.monthlyPosterLimit ?? 0),
          allowPosterRetention: Boolean(data.allowPosterRetention),
          posterRetentionDays: Number(data.posterRetentionDays ?? 7),
          retentionEnabled: Boolean(data.retentionEnabled),
        });
      } else {
        setMarketingSettings({
          enabled: false,
          monthlyPosterLimit: 0,
          allowPosterRetention: false,
          posterRetentionDays: 7,
          retentionEnabled: false,
        });
      }
    } catch (e) {
      console.error("load marketing settings", e);
      setMarketingSettings({
        enabled: false,
        monthlyPosterLimit: 0,
        allowPosterRetention: false,
        posterRetentionDays: 7,
        retentionEnabled: false,
      });
    }
  };

  const totals = useMemo(() => {
    const total = centers.length;
    const activeCount = centers.filter((c) => !!(c as any).active).length;
    const inactiveCount = centers.length - activeCount;
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

    const atRisk = centers.filter((c) => {
      const seed = c.id.charCodeAt(0) + c.id.length;
      const mockAttentions = (seed % 300) + 10;
      return mockAttentions < 60;
    }).length;

    return { total, active: activeCount, inactive: inactiveCount, maxUsers, billingStats, atRisk };
  }, [centers]);

  useEffect(() => {
    if (!commCenterId) return;
    void fetchCommHistory(commCenterId);
  }, [commCenterId]);

  useEffect(() => {
    if (!financeCenterId) return;
    void fetchBillingEvents(financeCenterId);
  }, [financeCenterId]);

  useEffect(() => {
    void loadMetrics();
  }, []);

  const fetchGlobalUsers = async () => {
    if (demoMode) {
      setUsersLoading(true);
      setTimeout(() => {
        setGlobalUsers([
          { id: "u1", email: "admin@demo.cl", fullName: "Admin Demo", roles: ["admin"] },
          { id: "u2", email: "doctor@demo.cl", fullName: "Dr. Demo", roles: ["doctor"] },
        ]);
        setUsersLoading(false);
      }, 100);
      return;
    }
    setUsersLoading(true);
    try {
      const q = query(collection(db, "users"), orderBy("email"), limit(200));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setGlobalUsers(items);
    } catch (e: any) {
      console.error("fetchGlobalUsers error", e);
      showToast("Error al cargar usuarios globales.", "error");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      void fetchGlobalUsers();
    }
  }, [activeTab]);

  const handleSaveUser = async (user: any) => {
    try {
      const userRef = doc(db, "users", user.id);
      await setDoc(userRef, user, { merge: true });
      showToast("Usuario actualizado con ÃƒÆ’Ã‚Â©xito.", "success");
      setEditingUser(null);
      void fetchGlobalUsers();
    } catch (e: any) {
      console.error("handleSaveUser error", e);
      showToast("Error al actualizar usuario.", "error");
    }
  };

  useEffect(() => {
    if (!editingCenter?.id) return;
    void fetchCenterInvites(editingCenter.id);
  }, [editingCenter?.id]);

  const renderHealthBadge = (center: CenterExt) => {
    const isActive = !!(center as any).active;
    const isOverdue = (center as any).billingStatus === "overdue";
    const isRisk = (center as any).billingStatus === "risk";
    const nextDueDate = (center as any).nextBillingDate;
    const isNearLimit = (center as any).patientCount >= (center as any).patientLimit * 0.9;

    const label = !isActive ? "Suspendido" : isOverdue ? "Riesgo alto" : isRisk ? "AtenciÃƒÆ’Ã‚Â³n" : "OK";
    const cls = !isActive
      ? "bg-slate-200 text-slate-700"
      : isOverdue
        ? "bg-red-100 text-red-700"
        : isRisk
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-100 text-emerald-700";
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cls}`}>{label}</span>
    );
  };

  const handleStartCreate = () => {
    resetLogoState();
    setIsCreating(true);
    setEditingCenter({
      id: "",
      name: "",
      slug: "",
      primaryColor: "teal",
      active: true,
      maxUsers: 10,
      allowedRoles: ["MEDICO", "ENFERMERA"],
      modules: { dental: false, prescriptions: true, agenda: true },
      adminAccess: { manageUsers: true, configAgenda: true, securityLogs: true, analytics: true },
      createdAt: new Date().toISOString(),
      adminEmail: "",
      subscription: {
        planName: "trial",
        price: 0,
        currency: "UF",
        status: "active",
        lastPaymentDate: "",
      },
    } as CenterExt);

    setNewCenterName("");
    setNewCenterSlug("");
    setNewCenterAdminEmail("");

    // limpiar ÃƒÆ’Ã‚Âºltima invitaciÃƒÆ’Ã‚Â³n
    setLastInviteLink("");
    setLastInviteTo("");
    setLastInviteSubject("");
    setLastInviteBody("");
  };

  const handleSaveCenter = async () => {
    if (!editingCenter) return;

    setIsUploadingLogo(true);

    try {
      const name = (isCreating ? newCenterName : editingCenter.name).trim();
      const slug = normalizeSlug(isCreating ? newCenterSlug : editingCenter.slug);

      if (!name || !slug) {
        showToast("Nombre y slug son obligatorios", "error");
        return;
      }

      const centerId = isCreating ? `c_${uidShort()}` : editingCenter.id;

      let finalLogoUrl = (editingCenter as any).logoUrl || "";
      const prevLogoUrl =
        (((centers.find((c) => c.id === centerId) as any)?.logoUrl || "") as string) || "";

      const isWorkspacePreview =
        typeof window !== "undefined" &&
        window.location?.hostname?.includes("cloudworkstations.dev");

      if (logoFile) {
        if (isWorkspacePreview) {
          showToast(
            "En Firebase Studio (preview) la subida de logos a Storage suele bloquearse por CORS. GuardarÃƒÆ’Ã‚Â© el centro sin subir logo.",
            "warning"
          );
        } else {
          const logoRef = ref(storage, `centers-logos/${centerId}/logo`);
          const uploadResult = await uploadBytes(logoRef, logoFile, { contentType: logoFile.type });
          finalLogoUrl = await getDownloadURL(uploadResult.ref);
        }
      } else if (!finalLogoUrl && prevLogoUrl) {
        if (isWorkspacePreview) {
          console.warn("Storage bloqueado por CORS en preview; se omite deleteObject del logo.");
        } else {
          try {
            const logoRef = ref(storage, `centers-logos/${centerId}/logo`);
            await deleteObject(logoRef);
          } catch (err: any) {
            if (err?.code !== "storage/object-not-found") {
              console.warn("No se pudo eliminar el logo anterior:", err);
            }
          }
        }
      }

      const finalCenter: CenterExt = {
        ...editingCenter,
        id: centerId,
        name,
        slug,
        active: (editingCenter as any).active ?? true,
        logoUrl: finalLogoUrl,
        createdAt: isCreating ? new Date().toISOString() : editingCenter.createdAt,
        adminEmail: isCreating
          ? newCenterAdminEmail.trim()
          : (editingCenter as any).adminEmail || "",
        // Mapping internal 'billing' to 'subscription' for backend compatibility
        subscription: (editingCenter as any).billing
          ? {
              planName: (editingCenter as any).billing?.plan || "trial",
              price: (editingCenter as any).billing?.monthlyUF || 0,
              currency: "UF",
              status: (editingCenter as any).billing?.billingStatus === "paid" ? "active" : "late",
              lastPaymentDate: (editingCenter as any).billing?.lastPaidAt || "",
            }
          : (editingCenter as any).subscription,
      };

      if (!isCreating) {
        const previous = centers.find((c) => c.id === centerId) as CenterExt | undefined;
        const isActiveChanged =
          previous && !!(previous as any).active !== !!(finalCenter as any).active;
        const billingPrev = (previous as any)?.billing || {};
        const billingNext = (finalCenter as any)?.billing || {};
        const billingChanged =
          billingPrev?.plan !== billingNext?.plan ||
          billingPrev?.monthlyUF !== billingNext?.monthlyUF ||
          billingPrev?.billingStatus !== billingNext?.billingStatus;
        if (isActiveChanged || billingChanged) {
          const reason = await promptChangeReason("modificar estado o facturacion del centro");
          if (!reason) return;
          (finalCenter as any).auditReason = reason;
        }
      }

      await onUpdateCenters([finalCenter as any]);

      showToast(isCreating ? "Centro creado con ÃƒÆ’Ã‚Â©xito" : "Centro actualizado con ÃƒÆ’Ã‚Â©xito", "success");

      setEditingCenter(null);
      setIsCreating(false);
      resetLogoState();

      if (isCreating) {
        setFinanceCenterId(centerId);
        setCommCenterId(centerId);
      }
    } catch (e: any) {
      console.error("SAVE CENTER ERROR", e);
      if (e?.code || e?.message) {
        console.error("DEBUG INFO:", {
          code: e.code,
          message: e.message,
          details: e.details,
          payload: editingCenter,
        });
      }
      showToast(e?.message || "Error al guardar centro", "error");
    }
  };

  const handleDeleteCenter = async (id: string) => {
    if (!id) return;
    const decommissionConfirm = await requestCriticalAction({
      title: "Dar de baja centro",
      message: "Se desactivaran usuarios y servicios del centro, manteniendo los datos solo por razones legales.",
      warning: "Esta accion es atomica y no debe ejecutarse sin validacion previa.",
      confirmLabel: "Dar de baja",
      reasonRequired: true,
      reasonLabel: "Motivo formal de baja",
      reasonPlaceholder: "Indica el motivo legal, comercial u operativo",
      requireFinalConfirmation: true,
      confirmationLabel: "Confirmo que deseo dar de baja formal este centro.",
    });
    if (!decommissionConfirm?.confirmed) return;
    const reason = decommissionConfirm.reason?.trim();
    if (!reason) return;
    try {
      await onDeleteCenter(id, reason);
      showToast("Centro eliminado", "success");
      if (financeCenterId === id) setFinanceCenterId(centers?.[0]?.id || "");
      if (commCenterId === id) setCommCenterId(centers?.[0]?.id || "");
    } catch (e: any) {
      showToast(e?.message || "Error al eliminar", "error");
    }
  };

  const updateCenterPatch = async (
    centerId: string,
    patch: Partial<CenterExt>,
    auditReason?: string
  ) => {
    const center = centers.find((c) => c.id === centerId);
    if (!center) {
      showToast("Centro no encontrado", "error");
      return;
    }
    const merged = { ...(center as any), ...patch } as CenterExt;
    if (auditReason) {
      (merged as any).auditReason = auditReason;
    }

    try {
      await onUpdateCenters([merged as any]);
      showToast("Cambios guardados", "success");
    } catch (e: any) {
      showToast(e?.message || "Error guardando cambios", "error");
    }
  };

  const handleSaveMarketingSettings = async () => {
    if (!editingCenter?.id) return;
    setMarketingSaving(true);
    try {
      const payload: MarketingSettings = {
        enabled: Boolean(marketingSettings.enabled),
        monthlyPosterLimit: Number(marketingSettings.monthlyPosterLimit ?? 0),
        allowPosterRetention: Boolean(marketingSettings.allowPosterRetention),
        posterRetentionDays: 7,
        retentionEnabled: Boolean(marketingSettings.retentionEnabled),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "superadmin",
      };
      await setDoc(doc(db, "centers", editingCenter.id, "settings", "marketing"), payload, {
        merge: true,
      });
      showToast("Marketing actualizado para el centro.", "success");
    } catch (e: any) {
      console.error("save marketing settings", e);
      showToast(e?.message || "No se pudo actualizar marketing.", "error");
    } finally {
      setMarketingSaving(false);
    }
  };

  const updateBilling = async (centerId: string, billingPatch: Partial<BillingInfo>) => {
    const center = centers.find((c) => c.id === centerId) as CenterExt | undefined;
    if (!center) {
      showToast("Centro no encontrado", "error");
      return;
    }
    const requiresReason = ["plan", "monthlyUF", "billingStatus"].some(
      (key) => key in billingPatch
    );
    let auditReason: string | null = null;
    if (requiresReason) {
      auditReason = await promptChangeReason("cambiar informacion de facturacion");
      if (!auditReason) return;
    }
    const billing = { ...((center as CenterExt).billing || {}), ...billingPatch } as BillingInfo;
    await updateCenterPatch(centerId, { billing }, auditReason ?? undefined);
  };

  const handleSendNotification = async () => {
    if (!commCenter) {
      showToast("Selecciona un centro", "error");
      return;
    }
    const title = commTitle.trim();
    const body = commBody.trim();

    if (!title || !body) {
      showToast("TÃƒÆ’Ã‚Â­tulo y mensaje son obligatorios", "error");
      return;
    }

    const adminEmail = (commCenter as any).adminEmail?.trim() || "";
    try {
      const fn = httpsCallable(getFunctions(), "createCenterNotification");
      await fn({
        centerId: commCenter.id,
        title,
        body,
        type: commType,
        severity: commSeverity,
        sendEmail: commSendEmail,
      });
      await fetchCommHistory(commCenter.id);
    } catch (e: any) {
      console.error("COMM NOTIFICATION ERROR", e);
      showToast(e?.message || "Error enviando aviso", "error");
      return;
    }

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
      paid: { label: "Al dÃƒÆ’Ã‚Â­a", cls: "bg-green-100 text-green-700", icon: CheckCircle },
      grace: { label: "Gracia", cls: "bg-yellow-100 text-yellow-800", icon: CheckCircle },
      due: { label: "Por vencer", cls: "bg-amber-100 text-amber-800", icon: CheckCircle },
      overdue: { label: "Atrasado", cls: "bg-red-100 text-red-700", icon: XCircle },
      suspended: { label: "Suspendido", cls: "bg-slate-200 text-slate-700", icon: XCircle },
    };
    const Icon = map[st].icon;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[st].cls}`}
      >
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
        ? `ClaveSalud ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Aviso de facturaciÃƒÆ’Ã‚Â³n (${centerName})`
        : commType === "incident"
          ? `ClaveSalud ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Incidencia operativa (${centerName})`
          : commType === "security"
            ? `ClaveSalud ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Aviso de seguridad (${centerName})`
            : `ClaveSalud ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â InformaciÃƒÆ’Ã‚Â³n (${centerName})`;

    const body = [
      `Para: ${adminEmail}`,
      `Asunto: ${subject}`,
      ``,
      `Hola,`,
      ``,
      `${commTitle || "[TÃƒÆ’Ã‚Â­tulo del aviso]"}`,
      ``,
      `${commBody || "[Detalle del mensaje]"}`,
      ``,
      `Centro: ${centerName} (${commCenter.slug})`,
      `Fecha: ${todayISO()}`,
      ``,
      `ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Equipo ClaveSalud`,
    ].join("\n");

    return body;
  }, [commCenter, commType, commTitle, commBody]);

  const handleInviteCenterAdmin = async () => {
    if (!editingCenter) return;
    if (isInvitingAdmin) return;

    const emailLower = (
      isCreating ? newCenterAdminEmail : String((editingCenter as any).adminEmail || "")
    )
      .trim()
      .toLowerCase();

    if (!emailLower) {
      showToast("Falta el correo del administrador (adminEmail).", "error");
      return;
    }

    const centerId = String(editingCenter.id || "").trim();
    if (!centerId) {
      showToast("Primero guarda el centro para poder invitar a su administrador.", "error");
      return;
    }

    setIsInvitingAdmin(true);
    try {
      // 1) Revocar invitaciones PENDING previas
      const prevQ = query(
        collection(db, "invites"),
        where("emailLower", "==", emailLower),
        where("centerId", "==", centerId),
        where("status", "==", "pending")
      );

      const prev = await getDocs(prevQ);
      for (const d of prev.docs) {
        await updateDoc(d.ref, { status: "revoked", revokedAt: serverTimestamp() }).catch(() => {});
      }

      // 2) Crear invitaciÃƒÆ’Ã‚Â³n nueva
      let token = generateSecureToken(24);
      const baseUrl = window.location.origin;
      let link = `${baseUrl}/invite?token=${encodeURIComponent(token)}`;

      const fn = httpsCallable(getFunctions(), "createCenterAdminInvite");
      const res: any = await fn({
        centerId,
        adminEmail: emailLower,
        centerName: editingCenter.name || "",
      });

      const data = res?.data || {};
      if (data?.token) token = String(data.token);
      link = String(data?.inviteUrl || `${baseUrl}/invite?token=${encodeURIComponent(token)}`);

      setLastInviteLink(link);

      const centerName = editingCenter.name || "Centro";
      const { subject, body } = buildInviteEmailParts(centerName, link);

      setLastInviteTo(emailLower);
      setLastInviteSubject(subject);
      setLastInviteBody(body);

      const copyText = buildCopyEmailText(emailLower, subject, body);
      await navigator.clipboard.writeText(copyText);

      showToast(
        "InvitaciÃƒÆ’Ã‚Â³n generada. CopiÃƒÆ’Ã‚Â© el correo al portapapeles. Usa los botones para abrir Gmail o mailto.",
        "success"
      );
    } catch (e: any) {
      console.error("INVITE ERROR", e);
      showToast(e?.message || "Error generando invitaciÃƒÆ’Ã‚Â³n", "error");
    } finally {
      setIsInvitingAdmin(false);
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div
      className={`min-h-screen bg-slate-50 font-sans transition-all duration-300 ${isSidebarOpen ? "overflow-hidden pt-0" : "pt-16"}`}
      data-testid="superadmin-dashboard-root"
    >
      {/* MOBILE/TABLET HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-lg h-16">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            data-testid="superadmin-drawer-toggle"
            title={isSidebarOpen ? "Cerrar menÃƒÆ’Ã‚Âº" : "Abrir menÃƒÆ’Ã‚Âº"}
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-health-400 uppercase tracking-widest">
              SuperAdmin
            </span>
            <span className="text-sm font-bold truncate" data-testid="superadmin-active-tab-label">
              {activeTab === "general"
                ? "VisiÃƒÆ’Ã‚Â³n General"
                : activeTab === "centers"
                  ? "GestiÃƒÆ’Ã‚Â³n de Centros"
                  : activeTab === "finanzas"
                    ? "Finanzas"
                    : activeTab === "comunicacion"
                      ? "ComunicaciÃƒÆ’Ã‚Â³n"
                      : activeTab === "metrics"
                        ? "Uso Plataforma"
                        : "Usuarios"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <LogoHeader size="sm" showText={true} />
          </div>
          <div className="sm:hidden">
            <LogoHeader size="sm" showText={false} />
          </div>
        </div>
      </header>

      {/* OVERLAY for drawer */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity animate-fadeIn"
          onClick={() => setIsSidebarOpen(false)}
          data-testid="superadmin-drawer-overlay"
        />
      )}

      {/* SIDEBAR / DRAWER */}
      <aside
        className={`
          fixed left-0 top-0 h-full bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 z-[55] transition-all duration-300 shadow-2xl
          w-72
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        data-testid="superadmin-sidebar-drawer"
      >
        <div className="p-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
          <div className="flex-1">
            <LogoHeader size="sm" showText={true} className="mb-2" />
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-health-400">
              <Shield className="w-3 h-3" /> Super Admin
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="lg:hidden p-6 border-b border-white/5 flex items-center justify-between">
          <div className="font-bold text-white tracking-wider">MENÃƒÆ’Ã…Â¡ PRINCIPAL</div>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto mt-2">
          {(() => {
            const btn = (tab: Tab, label: string, icon: any) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-800"}`}
                data-testid={`superadmin-tab-${tab}`}
              >
                {icon}
                <span className="font-bold text-sm tracking-wide">{label}</span>
              </button>
            );
            return (
              <>
                {btn("general", "VisiÃƒÆ’Ã‚Â³n General", <Megaphone className="w-4 h-4" />)}
                {btn("centers", "Centros MÃƒÆ’Ã‚Â©dicos", <Building2 className="w-4 h-4" />)}
                {btn("finanzas", "Finanzas & Billing", <CreditCard className="w-4 h-4" />)}
                {btn("comunicacion", "ComunicaciÃƒÆ’Ã‚Â³n", <Mail className="w-4 h-4" />)}
                {btn("metrics", "Uso de Plataforma", <BarChart3 className="w-4 h-4" />)}
                {btn("users", "GestiÃƒÆ’Ã‚Â³n de Usuarios", <Users className="w-4 h-4" />)}
              </>
            );
          })()}
        </nav>

        <div className="p-4 space-y-4 border-t border-slate-800">
          <LegalLinks
            onOpenTerms={() => onOpenLegal("terms")}
            onOpenPrivacy={() => onOpenLegal("privacy")}
            className="flex-col items-start gap-2 text-xs"
            buttonClassName="text-slate-400 hover:text-white text-xs"
            showDivider={false}
          />
          <button
            onClick={onToggleDemo}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
              demoMode
                ? "bg-indigo-900/50 border-indigo-500 text-indigo-100"
                : "bg-slate-800 border-slate-700 text-slate-500"
            }`}
          >
            <div className="flex items-center gap-2">
              {demoMode ? (
                <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ) : (
                <ZapOff className="w-4 h-4" />
              )}
              <span className="text-xs font-bold uppercase">Modo Demo</span>
            </div>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-bold text-sm">Cerrar SesiÃƒÆ’Ã‚Â³n</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main
        className="transition-all duration-300 min-h-screen flex flex-col p-4 md:p-8 lg:p-12"
        data-testid="superadmin-main-content"
      >
        <div className="flex justify-end mb-6">
          <img src={CORPORATE_LOGO} alt="ClaveSalud" className="h-10 w-auto" />
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="text-xs font-bold text-slate-400 uppercase mb-2">Centro en contexto</div>
          <select
            className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-700"
            value={centerContextId}
            onChange={(e) => setCenterContextId(e.target.value)}
          >
            {centers.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>
          <div className="text-xs text-slate-400 mt-1">
            Se sincroniza con Finanzas y ComunicaciÃƒÆ’Ã‚Â³n.
          </div>
        </div>

        {/* GENERAL */}
        {activeTab === "general" && (
          <SuperAdminGeneral
            totals={totals}
            metrics={metrics}
            metricsLoading={metricsLoading}
            metricsUpdatedAt={metricsUpdatedAt}
            metricsError={metricsError}
            setActiveTab={setActiveTab}
            canUsePreview={canUsePreview}
            centers={centers}
            previewCenterSelection={previewCenterSelection}
            setPreviewCenterSelection={setPreviewCenterSelection}
            previewRoles={previewRoles}
            previewRoleSelection={previewRoleSelection}
            setPreviewRoleSelection={setPreviewRoleSelection}
            onStartPreview={onStartPreview}
            showToast={showToast}
            previewCenterId={previewCenterId}
            previewRole={previewRole}
            onExitPreview={onExitPreview}
            setShowMarketingModal={setShowMarketingModal}
          />
        )}

        {/* CENTERS */}
        {activeTab === "centers" && (
          <SuperAdminCenters
            centers={centers}
            editingCenter={editingCenter}
            setEditingCenter={setEditingCenter}
            isCreating={isCreating}
            setIsCreating={setIsCreating}
            handleStartCreate={handleStartCreate}
            handleSaveCenter={handleSaveCenter}
            handleDeleteCenter={handleDeleteCenter}
            isUploadingLogo={isUploadingLogo}
            logoPreview={logoPreview}
            setLogoPreview={setLogoPreview}
            logoFile={logoFile}
            setLogoFile={setLogoFile}
            resetLogoState={resetLogoState}
            marketingSettings={marketingSettings}
            setMarketingSettings={setMarketingSettings}
            marketingSaving={marketingSaving}
            handleSaveMarketingSettings={handleSaveMarketingSettings}
            isInvitingAdmin={isInvitingAdmin}
            setIsInvitingAdmin={setIsInvitingAdmin}
            handleInviteCenterAdmin={handleInviteCenterAdmin}
            lastInviteLink={lastInviteLink}
            setLastInviteLink={setLastInviteLink}
            lastInviteTo={lastInviteTo}
            setLastInviteTo={setLastInviteTo}
            lastInviteSubject={lastInviteSubject}
            setLastInviteSubject={setLastInviteSubject}
            lastInviteBody={lastInviteBody}
            setLastInviteBody={setLastInviteBody}
            invitesLoading={invitesLoading}
            centerInvites={centerInvites}
            hasMoreCenters={hasMoreCenters}
            onLoadMoreCenters={onLoadMoreCenters}
            isLoadingMoreCenters={isLoadingMoreCenters}
            newCenterName={newCenterName}
            setNewCenterName={setNewCenterName}
            newCenterSlug={newCenterSlug}
            setNewCenterSlug={setNewCenterSlug}
            newCenterAdminEmail={newCenterAdminEmail}
            setNewCenterAdminEmail={setNewCenterAdminEmail}
            renderBadge={renderBadge}
            renderHealthBadge={renderHealthBadge}
            buildGmailComposeUrl={buildGmailComposeUrl}
            buildCopyEmailText={buildCopyEmailText}
            showToast={showToast}
            fetchCenterInvites={fetchCenterInvites}
          />
        )}

        {/* FINANZAS */}
        {activeTab === "finanzas" && (
          <SuperAdminFinance
            centers={centers}
            financeCenterId={financeCenterId}
            setFinanceCenterId={setFinanceCenterId}
            financeCenter={financeCenter}
            renderBadge={renderBadge}
            updateBilling={updateBilling}
            todayISO={todayISO}
            billingEventsLoading={billingEventsLoading}
            billingEvents={billingEvents}
          />
        )}

        {/* COMUNICACIÃƒÆ’Ã¢â‚¬Å“N */}
        {activeTab === "comunicacion" && (
          <SuperAdminCommunications
            centers={centers}
            commCenterId={commCenterId}
            setCommCenterId={setCommCenterId}
            commCenter={commCenter}
            commType={commType as any}
            setCommType={setCommType as any}
            commSeverity={commSeverity as any}
            setCommSeverity={setCommSeverity as any}
            selectedTemplate={selectedTemplate}
            handleApplyTemplate={handleApplyTemplate}
            commTitle={commTitle}
            setCommTitle={setCommTitle}
            commBody={commBody}
            setCommBody={setCommBody}
            commSendEmail={commSendEmail}
            setCommSendEmail={setCommSendEmail}
            handleSendNotification={handleSendNotification}
            emailTemplate={emailTemplate}
            showToast={showToast}
            buildGmailComposeUrl={buildGmailComposeUrl}
            commHistoryLoading={commHistoryLoading}
            commHistory={commHistory}
          />
        )}

        {/* METRICS / USAGE */}
        {activeTab === "metrics" && (
          <SuperAdminMetrics
            centers={centers}
            doctors={doctors}
            metricsLoading={metricsLoading}
            handleRecalcStats={handleRecalcStats}
          />
        )}

        {/* USUARIOS */}
        {activeTab === "users" && (
          <SuperAdminUsers
            globalUsers={globalUsers}
            usersLoading={usersLoading}
            fetchGlobalUsers={fetchGlobalUsers}
            userSearchTerm={userSearchTerm}
            setUserSearchTerm={setUserSearchTerm}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            handleSaveUser={handleSaveUser}
          />
        )}

        <div className="mt-12 bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-700/50 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="text-xl font-bold mb-2">AnÃƒÆ’Ã‚Â¡lisis de RetenciÃƒÆ’Ã‚Â³n Proactiva</h4>
              <p className="text-indigo-200 text-sm max-w-md">
                Hemos detectado centros con una caÃƒÆ’Ã‚Â­da en actividad. Activa una campaÃƒÆ’Ã‚Â±a de
                comunicaciÃƒÆ’Ã‚Â³n para recuperar su interÃƒÆ’Ã‚Â©s.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("comunicacion")}
              className="px-8 py-3 bg-white text-indigo-900 font-bold rounded-2xl hover:bg-slate-100 transition-all shadow-lg active:scale-95"
            >
              Ir a comunicaciÃƒÆ’Ã‚Â³n
            </button>
          </div>
        </div>
      </main>

      {/* Marketing Flyer Modal */}
      {showMarketingModal && (
        <MarketingFlyerModal type="platform" onClose={() => setShowMarketingModal(false)} />
      )}

      {/* FEEDBACK BUTTON (Floating) */}
      <a
        href="mailto:soporte@clavesalud.cl?subject=Reporte%20de%20Problema%20-%20ClaveSalud&body=Hola%2C%20encontr%C3%B3%20el%20siguiente%20problema%3A%0A%0A"
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

export default SuperAdminDashboard;
