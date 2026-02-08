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
} from "lucide-react";
import { MedicalCenter, Doctor } from "../types";
import { CORPORATE_LOGO, ROLE_CATALOG } from "../constants";
import { useToast } from "./Toast";
import LogoHeader from "./LogoHeader";

// Firebase
import { db, auth, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
  collection,
  doc,
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
 * Mejora: Invitación admin abre correo prellenado (mailto) + opción "Abrir en Gmail"
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
  // Gmail web "compose" (sin API). Requiere que el usuario esté logueado en Gmail.
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
    body: "Estimado/a administrador/a,\n\nLe recordamos que tiene un pago pendiente correspondiente al servicio de ClaveSalud. Le solicitamos regularizar su situación a la brevedad para mantener la continuidad del servicio.\n\nPara más información o coordinación de pago, puede contactarnos respondiendo este mensaje.\n\nAtentamente,\nEquipo ClaveSalud"
  },
  info: {
    title: "Comunicado Informativo",
    body: "Estimado/a administrador/a,\n\nLe informamos que [descripción de la información importante].\n\n[Detalles adicionales si es necesario]\n\nPara cualquier consulta, estamos disponibles.\n\nAtentamente,\nEquipo ClaveSalud"
  },
  fiesta: {
    title: "¡Felices Fiestas!",
    body: "Estimado/a administrador/a,\n\nEn estas fechas especiales, queremos extenderles nuestros mejores deseos. ¡Felices fiestas para usted y todo su equipo!\n\nAgradecemos su confianza en ClaveSalud.\n\nCon los mejores deseos,\nEquipo ClaveSalud"
  },
  bienvenida: {
    title: "¡Bienvenido a ClaveSalud!",
    body: "Estimado/a administrador/a,\n\n¡Bienvenido/a a ClaveSalud! Estamos muy contentos de que su centro forme parte de nuestra plataforma.\n\nEn los próximos días, nuestro equipo estará disponible para ayudarle con cualquier consulta o necesidad durante la configuración inicial.\n\nAtentamente,\nEquipo ClaveSalud"
  },
  mantenimiento: {
    title: "Aviso de Mantenimiento Programado",
    body: "Estimado/a administrador/a,\n\nLe informamos que realizaremos un mantenimiento programado en la plataforma ClaveSalud el día [fecha] entre las [hora inicio] y [hora fin].\n\nDurante este período, el sistema podría presentar interrupciones temporales. Agradecemos su comprensión.\n\nAtentamente,\nEquipo ClaveSalud"
  }
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
  hasMoreCenters = false,
  onLoadMoreCenters,
  isLoadingMoreCenters = false,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const previewRoles = useMemo(
    () =>
      ROLE_CATALOG.filter((role) => !["ADMIN_CENTRO", "ADMINISTRATIVO"].includes(role.id)),
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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

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

  // ✅ NUEVO: guardar la última invitación (para botón Gmail/copy robustos)
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
    const subject = `Invitación a ClaveSalud — Administración del centro (${centerName})`;
    const body = [
      `Hola,`,
      ``,
      `Has sido invitado(a) como Administrador(a) del centro:`,
      `Centro: ${centerName}`,
      ``,
      `Para crear tu cuenta y definir tu contraseña, usa este enlace:`,
      `${link}`,
      ``,
      `Este enlace es personal y expira en 7 días.`,
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

  // Comunicación
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

  // Handler to apply selected template
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

  const [centerContextId, setCenterContextId] = useState<string>(
    centers?.[0]?.id || ""
  );

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

  const promptChangeReason = (label: string) => {
    const reason = window.prompt(`Indica el motivo para ${label}:`);
    if (!reason || !reason.trim()) {
      showToast("Debes indicar un motivo para continuar.", "warning");
      return null;
    }
    return reason.trim();
  };

  const fetchCommHistory = async (centerId: string) => {
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

  useEffect(() => {
    if (!commCenterId) return;
    void fetchCommHistory(commCenterId);
    void fetchCenterInvites(commCenterId);
  }, [commCenterId]);

  useEffect(() => {
    if (!financeCenterId) return;
    void fetchBillingEvents(financeCenterId);
  }, [financeCenterId]);

  useEffect(() => {
    if (!editingCenter?.id) return;
    void fetchCenterInvites(editingCenter.id);
  }, [editingCenter?.id]);

  const renderHealthBadge = (center: CenterExt) => {
    const isActive = !!(center as any).isActive;
    const billingStatus = (center as any).billing?.billingStatus as BillingStatus | undefined;
    const nextDueDate = (center as any).billing?.nextDueDate as string | undefined;
    const isOverdue = billingStatus === "overdue";
    const isRisk =
      !isActive ||
      isOverdue ||
      (nextDueDate ? new Date(nextDueDate) < new Date() : false);
    const label = !isActive ? "Suspendido" : isOverdue ? "Riesgo alto" : isRisk ? "Atención" : "OK";
    const cls = !isActive
      ? "bg-slate-200 text-slate-700"
      : isOverdue
        ? "bg-red-100 text-red-700"
        : isRisk
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-100 text-emerald-700";
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cls}`}>
        {label}
      </span>
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

    // limpiar última invitación
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
            "En Firebase Studio (preview) la subida de logos a Storage suele bloquearse por CORS. Guardaré el centro sin subir logo.",
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
        logoUrl: finalLogoUrl,
        createdAt: isCreating ? new Date().toISOString() : editingCenter.createdAt,
        adminEmail: isCreating ? newCenterAdminEmail.trim() : (editingCenter as any).adminEmail,
      };

      if (!isCreating) {
        const previous = centers.find((c) => c.id === centerId) as CenterExt | undefined;
        const isActiveChanged =
          previous && !!(previous as any).isActive !== !!(finalCenter as any).isActive;
        const billingPrev = (previous as any)?.billing || {};
        const billingNext = (finalCenter as any)?.billing || {};
        const billingChanged =
          billingPrev?.plan !== billingNext?.plan ||
          billingPrev?.monthlyUF !== billingNext?.monthlyUF ||
          billingPrev?.billingStatus !== billingNext?.billingStatus;
        if (isActiveChanged || billingChanged) {
          const reason = promptChangeReason("modificar estado o facturación del centro");
          if (!reason) return;
          (finalCenter as any).auditReason = reason;
        }
      }

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
    const reason = promptChangeReason("eliminar el centro");
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
      auditReason = promptChangeReason("cambiar información de facturación");
      if (!auditReason) return;
    }
    const billing = ({ ...(center as any).billing, ...billingPatch } || {}) as BillingInfo;
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
      showToast("Título y mensaje son obligatorios", "error");
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
      paid: { label: "Al día", cls: "bg-green-100 text-green-700", icon: CheckCircle },
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

      // 2) Crear invitación nueva
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
        "Invitación generada. Copié el correo al portapapeles. Usa los botones para abrir Gmail o mailto.",
        "success"
      );
    } catch (e: any) {
      console.error("INVITE ERROR", e);
      showToast(e?.message || "Error generando invitación", "error");
    } finally {
      setIsInvitingAdmin(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pl-64">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full fixed left-0 top-0 border-r border-slate-800 z-50">
        <div className="p-6 border-b border-slate-800">
          <LogoHeader size="sm" showText={true} className="mb-3" />
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-500">
            <Shield className="w-3 h-3" /> Super Admin
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {renderSidebarButton(
            "general",
            "Visión General",
            <span className="inline-flex w-5 justify-center">
              <Megaphone className="w-4 h-4" />
            </span>
          )}
          {renderSidebarButton(
            "centers",
            "Centros",
            <span className="inline-flex w-5 justify-center">
              <Building2 className="w-4 h-4" />
            </span>
          )}
          {renderSidebarButton(
            "finanzas",
            "Finanzas",
            <span className="inline-flex w-5 justify-center">
              <CreditCard className="w-4 h-4" />
            </span>
          )}
          {renderSidebarButton(
            "comunicacion",
            "Comunicación",
            <span className="inline-flex w-5 justify-center">
              <Mail className="w-4 h-4" />
            </span>
          )}
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

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="text-xs font-bold text-slate-400 uppercase mb-2">
            Centro en contexto
          </div>
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
            Se sincroniza con Finanzas y Comunicación.
          </div>
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
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Centros Activos
                </div>
                <div className="text-3xl font-bold text-slate-800">{totals.active}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Cupos (maxUsers)
                </div>
                <div className="text-3xl font-bold text-slate-800">{totals.maxUsers}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Atrasados</div>
                <div className="text-3xl font-bold text-slate-800">
                  {totals.billingStats.overdue || 0}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-sm text-slate-600">
              <p className="font-semibold text-slate-800 mb-2">Nota importante</p>
              <p>
                Por seguridad, este panel <b>no crea usuarios/contraseñas</b> en Firebase Auth desde
                el navegador. Para un alta segura de administradores, usa una <b>Cloud Function</b>{" "}
                (Admin SDK) o un flujo de invitación controlado.
              </p>
            </div>

            {canUsePreview && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex flex-col gap-1 mb-6">
                  <h2 className="text-xl font-bold text-slate-800">Preview de Roles</h2>
                  <p className="text-sm text-slate-500">
                    Simula dashboards por rol y centro sin crear usuarios ni cambiar login.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                      Centro
                    </label>
                    <select
                      className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-700"
                      value={previewCenterSelection}
                      onChange={(e) => setPreviewCenterSelection(e.target.value)}
                    >
                      <option value="">Selecciona un centro</option>
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                      Rol clínico
                    </label>
                    <select
                      className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-700"
                      value={previewRoleSelection}
                      onChange={(e) => setPreviewRoleSelection(e.target.value)}
                    >
                      <option value="">Selecciona un rol</option>
                      {previewRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!previewCenterSelection || !previewRoleSelection) {
                          showToast("Selecciona un centro y un rol para activar preview.", "error");
                          return;
                        }
                        onStartPreview?.(previewCenterSelection, previewRoleSelection);
                        showToast("Preview activado. Abriendo dashboard.", "success");
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                    >
                      Activar preview
                    </button>
                    {previewCenterId && previewRole && (
                      <button
                        type="button"
                        onClick={onExitPreview}
                        className="w-full px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                      >
                        Salir de preview
                      </button>
                    )}
                  </div>
                </div>

                {previewCenterId && previewRole && (
                  <div className="mt-4 text-xs text-slate-500">
                    Preview activo en{" "}
                    <span className="font-semibold text-slate-700">{previewCenterId}</span> con rol{" "}
                    <span className="font-semibold text-slate-700">{previewRole}</span>.
                  </div>
                )}
              </div>
            )}
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
                              (center as any).isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {(center as any).isActive ? "Activo" : "Suspendido"}
                          </span>
                          {renderBadge(billing?.billingStatus)}
                          {renderHealthBadge(center)}
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {(billing?.plan || "trial").toUpperCase()}
                          </span>
                        </div>

                        <div className="text-sm text-slate-500 mt-1">
                          <span className="font-mono bg-slate-100 px-1 rounded">
                            /{center.slug}
                          </span>
                          {" • "}maxUsers: {(center as any).maxUsers ?? 0}
                          {" • "}Admin:{" "}
                          {(center as any).adminEmail ? (center as any).adminEmail : "—"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            resetLogoState();
                            setEditingCenter(center);
                            setIsCreating(false);

                            // limpiar invitación previa al entrar a editar
                            setLastInviteLink("");
                            setLastInviteTo("");
                            setLastInviteSubject("");
                            setLastInviteBody("");
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
                {centers.length === 0 && (
                  <p className="text-center py-10 text-slate-400 font-bold">
                    No hay centros creados aún.
                  </p>
                )}
                {hasMoreCenters && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-60"
                      disabled={isLoadingMoreCenters}
                      onClick={() => onLoadMoreCenters?.()}
                    >
                      {isLoadingMoreCenters ? "Cargando..." : "Cargar más centros"}
                    </button>
                  </div>
                )}
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
                            Se normaliza automáticamente.
                          </div>
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">
                            Admin Email (primer admin)
                          </span>
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
                            onChange={(e) =>
                              setEditingCenter({ ...editingCenter, name: e.target.value })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">Slug</span>
                          <input
                            className="w-full p-3 border rounded-xl"
                            value={editingCenter.slug}
                            onChange={(e) =>
                              setEditingCenter({ ...editingCenter, slug: e.target.value })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">
                            Admin Email
                          </span>
                          <input
                            className="w-full p-3 border rounded-xl"
                            value={(editingCenter as any).adminEmail || ""}
                            onChange={(e) =>
                              setEditingCenter({
                                ...(editingCenter as any),
                                adminEmail: e.target.value,
                              })
                            }
                            placeholder="admin@centro.cl"
                          />
                        </label>
                      </>
                    )}

                    {/* Logo */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                        Logo del centro
                      </div>
                      <div className="text-sm text-slate-600">
                        Sube un logo (PNG/JPG/WEBP, máx. 2MB). Se guarda en Firebase Storage como{" "}
                        <b>logoUrl</b>.
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

                            if (logoPreview) {
                              try {
                                URL.revokeObjectURL(logoPreview);
                              } catch {}
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
                                setLogoFile(null);
                                if (logoPreview) {
                                  try {
                                    URL.revokeObjectURL(logoPreview);
                                  } catch {}
                                }
                                setLogoPreview("");

                                setEditingCenter({ ...(editingCenter as any), logoUrl: "" });

                                const fileInput = document.getElementById(
                                  "logo-input"
                                ) as HTMLInputElement | null;
                                if (fileInput) fileInput.value = "";
                              }}
                            >
                              Quitar logo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Marketing settings */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                        Marketing RRSS
                      </div>
                      <div className="space-y-4">
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-700">
                            Marketing habilitado
                          </span>
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={marketingSettings.enabled}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({
                                ...prev,
                                enabled: e.target.checked,
                              }))
                            }
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">
                            Límite mensual de afiches
                          </span>
                          <input
                            type="number"
                            min={-1}
                            max={999}
                            className="w-full p-3 border rounded-xl mt-1"
                            value={marketingSettings.monthlyPosterLimit}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({
                                ...prev,
                                monthlyPosterLimit: Number(e.target.value),
                              }))
                            }
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            Usa -1 para ilimitado. 0 desactiva la generación.
                          </p>
                        </label>

                        <label className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-700">
                            Permitir guardar afiches por 7 días
                          </span>
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={marketingSettings.allowPosterRetention}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({
                                ...prev,
                                allowPosterRetention: e.target.checked,
                              }))
                            }
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-slate-400 uppercase">
                            Retención fija (días)
                          </span>
                          <input
                            type="number"
                            className="w-full p-3 border rounded-xl mt-1 bg-slate-100 text-slate-500"
                            value={7}
                            disabled
                          />
                        </label>

                        <button
                          type="button"
                          onClick={handleSaveMarketingSettings}
                          disabled={marketingSaving}
                          className="w-full px-4 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-60"
                        >
                          {marketingSaving ? "Guardando..." : "Guardar marketing"}
                        </button>
                      </div>
                    </div>

                    {/* ✅ INVITAR ADMIN: mailto + Gmail */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                        Invitar administrador
                      </div>
                      <div className="text-sm text-slate-600">
                        Genera un enlace seguro (token) para que el administrador cree su
                        contraseña. Expira en 7 días.
                      </div>

                      <div className="mt-3 flex flex-col gap-2">
                        <button
                          type="button"
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
                          disabled={isInvitingAdmin}
                          onClick={handleInviteCenterAdmin}
                        >
                          {isInvitingAdmin ? "Generando..." : "Generar invitación y abrir correo"}
                        </button>

                        {/* ✅ Botones adicionales solo si ya existe una invitación generada */}
                        {lastInviteLink && lastInviteTo && lastInviteSubject && lastInviteBody && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800"
                              onClick={() =>
                                window.open(
                                  buildGmailComposeUrl(
                                    lastInviteTo,
                                    lastInviteSubject,
                                    lastInviteBody
                                  ),
                                  "_blank"
                                )
                              }
                              title="Abrir Gmail web con el correo prellenado"
                            >
                              Abrir en Gmail
                            </button>

                            <button
                              type="button"
                              className="px-4 py-2 rounded-xl bg-white border text-slate-900 font-bold text-sm hover:bg-slate-50"
                              onClick={async () => {
                                await navigator.clipboard.writeText(
                                  buildCopyEmailText(
                                    lastInviteTo,
                                    lastInviteSubject,
                                    lastInviteBody
                                  )
                                );
                                showToast("Correo completo copiado.", "success");
                              }}
                            >
                              Copiar correo
                            </button>

                            <button
                              type="button"
                              className="px-4 py-2 rounded-xl bg-white border text-slate-900 font-bold text-sm hover:bg-slate-50"
                              onClick={async () => {
                                await navigator.clipboard.writeText(lastInviteLink);
                                showToast("Enlace copiado.", "success");
                              }}
                            >
                              Copiar enlace
                            </button>
                          </div>
                        )}

                        {lastInviteLink && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200">
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">
                              Enlace
                            </div>
                            <div className="text-sm text-slate-700 break-all">{lastInviteLink}</div>
                          </div>
                        )}

                        <div className="text-xs text-slate-500">
                          Requisito: el centro debe estar guardado y tener <b>adminEmail</b>.
                        </div>

                        <div className="mt-4">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                            Invitaciones recientes
                          </div>
                          {invitesLoading ? (
                            <div className="text-sm text-slate-500">Cargando invitaciones...</div>
                          ) : centerInvites.length === 0 ? (
                            <div className="text-sm text-slate-500">
                              No hay invitaciones recientes para este centro.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {centerInvites.slice(0, 5).map((inv) => (
                                <div
                                  key={inv.id}
                                  className="bg-white border rounded-xl p-3 flex flex-col gap-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-bold text-slate-800">
                                      {inv.emailLower}
                                    </div>
                                    <span className="text-[11px] text-slate-400 uppercase font-bold">
                                      {inv.status || "pending"}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Expira:{" "}
                                    {inv.expiresAt?.toDate
                                      ? inv.expiresAt.toDate().toLocaleString()
                                      : "—"}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                                      onClick={async () => {
                                        const fn = httpsCallable(
                                          getFunctions(),
                                          "resendCenterAdminInvite"
                                        );
                                        await fn({ token: inv.id });
                                        showToast("Invitación reenviada.", "success");
                                        await fetchCenterInvites(inv.centerId);
                                      }}
                                    >
                                      Reenviar
                                    </button>
                                    <button
                                      type="button"
                                      className="px-3 py-1.5 rounded-lg bg-white border text-slate-700 text-xs font-bold hover:bg-slate-50"
                                      onClick={async () => {
                                        if (!window.confirm("¿Revocar invitación?")) return;
                                        const fn = httpsCallable(
                                          getFunctions(),
                                          "revokeCenterInvite"
                                        );
                                        await fn({ token: inv.id });
                                        showToast("Invitación revocada.", "success");
                                        await fetchCenterInvites(inv.centerId);
                                      }}
                                    >
                                      Revocar
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Roles permitidos */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                        Roles permitidos
                      </div>
                      <div className="text-sm text-slate-600 mb-3">
                        Define qué perfiles puede crear el centro. Se guarda como IDs estables (ej:
                        MEDICO, ENFERMERA).
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {ROLE_CATALOG.filter((r) => r.id !== "ADMIN_CENTRO").map((r) => {
                          const selected = Array.isArray((editingCenter as any).allowedRoles)
                            ? (editingCenter as any).allowedRoles.includes(r.id)
                            : false;
                          return (
                            <label
                              key={r.id}
                              className="flex items-center gap-3 p-3 bg-white rounded-xl border"
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => {
                                  const curr: string[] = Array.isArray(
                                    (editingCenter as any).allowedRoles
                                  )
                                    ? [...(editingCenter as any).allowedRoles]
                                    : [];
                                  const next = e.target.checked
                                    ? Array.from(new Set([...curr, r.id]))
                                    : curr.filter((x) => x !== r.id);
                                  setEditingCenter({
                                    ...(editingCenter as any),
                                    allowedRoles: next,
                                  });
                                }}
                                className="w-5 h-5 accent-indigo-600"
                              />
                              <span className="font-semibold text-slate-700">{r.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        Nota: el rol "Administrador del Centro" se asigna por invitación/alta y no
                        se controla aquí.
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">maxUsers</span>
                      <input
                        type="number"
                        className="w-full p-3 border rounded-xl"
                        value={(editingCenter as any).maxUsers ?? 0}
                        onChange={(e) =>
                          setEditingCenter({
                            ...(editingCenter as any),
                            maxUsers: Number(e.target.value),
                          })
                        }
                      />
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border">
                      <input
                        type="checkbox"
                        checked={!!(editingCenter as any).isActive}
                        onChange={(e) =>
                          setEditingCenter({
                            ...(editingCenter as any),
                            isActive: e.target.checked,
                          })
                        }
                        className="w-5 h-5 accent-indigo-600"
                      />
                      <div>
                        <span className="block font-bold text-slate-700">Centro activo</span>
                        <span className="text-xs text-slate-400">
                          Si está desactivado, el centro queda suspendido.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Columna derecha: módulos + billing rápido */}
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
                              modules: {
                                ...((editingCenter as any).modules || {}),
                                agenda: e.target.checked,
                              },
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
                              modules: {
                                ...((editingCenter as any).modules || {}),
                                prescriptions: e.target.checked,
                              },
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
                              modules: {
                                ...((editingCenter as any).modules || {}),
                                dental: e.target.checked,
                              },
                            })
                          }
                          className="w-5 h-5 accent-indigo-600"
                        />
                        <span className="font-semibold text-slate-700">Dental</span>
                      </label>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                        Plan / Facturación (rápido)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">
                            Plan
                          </span>
                          <select
                            className="w-full p-3 border rounded-xl bg-white"
                            value={((editingCenter as any).billing?.plan || "trial") as PlanKey}
                            onChange={(e) =>
                              setEditingCenter({
                                ...(editingCenter as any),
                                billing: {
                                  ...((editingCenter as any).billing || {}),
                                  plan: e.target.value as PlanKey,
                                },
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
                          <span className="text-[11px] font-bold text-slate-400 uppercase">
                            UF / mes
                          </span>
                          <input
                            type="number"
                            className="w-full p-3 border rounded-xl"
                            value={Number((editingCenter as any).billing?.monthlyUF || 0)}
                            onChange={(e) =>
                              setEditingCenter({
                                ...(editingCenter as any),
                                billing: {
                                  ...((editingCenter as any).billing || {}),
                                  monthlyUF: Number(e.target.value),
                                },
                              })
                            }
                          />
                        </label>

                        <label className="block">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">
                            Estado
                          </span>
                          <select
                            className="w-full p-3 border rounded-xl bg-white"
                            value={
                              ((editingCenter as any).billing?.billingStatus ||
                                "due") as BillingStatus
                            }
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
                          <span className="text-[11px] font-bold text-slate-400 uppercase">
                            Próximo venc.
                          </span>
                          <input
                            type="date"
                            className="w-full p-3 border rounded-xl"
                            value={String((editingCenter as any).billing?.nextDueDate || "")}
                            onChange={(e) =>
                              setEditingCenter({
                                ...(editingCenter as any),
                                billing: {
                                  ...((editingCenter as any).billing || {}),
                                  nextDueDate: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">
                        Tip: puedes ajustar también desde la pestaña Finanzas.
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
                  {financeCenter?.billing
                    ? renderBadge(financeCenter.billing.billingStatus)
                    : renderBadge("due")}
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
                        onChange={(e) =>
                          updateBilling(financeCenter.id, { plan: e.target.value as PlanKey })
                        }
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
                        onChange={(e) =>
                          updateBilling(financeCenter.id, { monthlyUF: Number(e.target.value) })
                        }
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        Estado de pago
                      </span>
                      <select
                        className="w-full p-3 border rounded-xl bg-white"
                        value={
                          ((financeCenter as any).billing?.billingStatus || "due") as BillingStatus
                        }
                        onChange={(e) =>
                          updateBilling(financeCenter.id, {
                            billingStatus: e.target.value as BillingStatus,
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

                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 inline-flex items-center gap-2"
                        onClick={() =>
                          updateBilling(financeCenter.id, {
                            billingStatus: "paid",
                            lastPaidAt: todayISO(),
                          })
                        }
                        title="Marcar pagado hoy"
                      >
                        <DollarSign className="w-4 h-4" /> Marcar pagado
                      </button>

                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 inline-flex items-center gap-2"
                        onClick={() =>
                          updateBilling(financeCenter.id, { billingStatus: "overdue" })
                        }
                        title="Marcar atrasado"
                      >
                        <CreditCard className="w-4 h-4" /> Marcar atrasado
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        Próximo vencimiento
                      </span>
                      <input
                        type="date"
                        className="w-full p-3 border rounded-xl"
                        value={String((financeCenter as any).billing?.nextDueDate || "")}
                        onChange={(e) =>
                          updateBilling(financeCenter.id, { nextDueDate: e.target.value })
                        }
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        Último pago
                      </span>
                      <input
                        type="date"
                        className="w-full p-3 border rounded-xl"
                        value={String((financeCenter as any).billing?.lastPaidAt || "")}
                        onChange={(e) =>
                          updateBilling(financeCenter.id, { lastPaidAt: e.target.value })
                        }
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        Notas internas
                      </span>
                      <textarea
                        className="w-full p-3 border rounded-xl min-h-[120px]"
                        value={String((financeCenter as any).billing?.notes || "")}
                        onChange={(e) => updateBilling(financeCenter.id, { notes: e.target.value })}
                        placeholder="Ej: convenio, prórroga, contacto administrativo..."
                      />
                    </label>

                    <div className="p-4 bg-slate-50 rounded-2xl border">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                        Historial de facturación
                      </div>
                      {billingEventsLoading ? (
                        <div className="text-sm text-slate-500">Cargando eventos...</div>
                      ) : billingEvents.length === 0 ? (
                        <div className="text-sm text-slate-500">
                          No hay eventos registrados aún.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {billingEvents.map((evt) => (
                            <div key={evt.id} className="bg-white border rounded-xl p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-bold text-slate-800">
                                  {evt.action || "Actualización"}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  {evt.createdAt?.toDate
                                    ? evt.createdAt.toDate().toLocaleString()
                                    : "—"}
                                </span>
                              </div>
                              {evt.reason && (
                                <div className="text-xs text-slate-500 mt-1">
                                  Motivo: {evt.reason}
                                </div>
                              )}
                              {evt.changes && (
                                <div className="text-xs text-slate-500 mt-2">
                                  {Object.entries(evt.changes).map(([key, value]) => (
                                    <div key={key}>
                                      {key}: {String(value)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* COMUNICACIÓN */}
        {activeTab === "comunicacion" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Comunicación</h1>
              <p className="text-slate-500">
                Avisos a administradores (registro local) + plantilla de correo.
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
                      Admin:{" "}
                      {(commCenter as any)?.adminEmail
                        ? (commCenter as any).adminEmail
                        : "— (configúralo en Centros)"}
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
                    <span className="text-xs font-bold text-slate-400 uppercase">Plantilla Predefinida</span>
                    <select
                      className="w-full p-3 border rounded-xl bg-white"
                      value={selectedTemplate}
                      onChange={(e) => handleApplyTemplate(e.target.value)}
                    >
                      <option value="">-- Seleccionar plantilla (opcional) --</option>
                      <option value="cobranza">Cobranza - Recordatorio de pago</option>
                      <option value="info">Información general</option>
                      <option value="fiesta">Saludo por fiestas</option>
                      <option value="bienvenida">Bienvenida a nuevos centros</option>
                      <option value="mantenimiento">Mantenimiento programado</option>
                    </select>
                    <div className="text-xs text-slate-400 mt-1">
                      Seleccione una plantilla para autocompletar título y mensaje. Puede editarlos después.
                    </div>
                  </label>

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
                      <span className="block font-bold text-slate-700">
                        Generar plantilla para email
                      </span>
                      <span className="text-xs text-slate-400">
                        Envío real por correo: idealmente Cloud Function.
                      </span>
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

                    {commCenter && (commCenter as any).adminEmail && commTitle && commBody && (
                      <button
                        type="button"
                        className="px-5 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow inline-flex items-center gap-2"
                        onClick={() => {
                          const adminEmail = (commCenter as any).adminEmail?.trim() || "";
                          const centerName = commCenter.name || "Centro";
                          const subject =
                            commType === "billing"
                              ? `ClaveSalud — Aviso de facturación (${centerName})`
                              : commType === "incident"
                                ? `ClaveSalud — Incidencia operativa (${centerName})`
                                : commType === "security"
                                  ? `ClaveSalud — Aviso de seguridad (${centerName})`
                                  : `ClaveSalud — Información (${centerName})`;
                          const body = `Hola,\n\n${commTitle}\n\n${commBody}\n\n—\nPor favor, si necesitas soporte o más información, responde este correo.\n\n— Equipo ClaveSalud`;
                          const gmailUrl = buildGmailComposeUrl(adminEmail, subject, body);
                          window.open(gmailUrl, "_blank");
                        }}
                      >
                        <Mail className="w-5 h-5" /> Abrir en Gmail
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                      Vista previa (email)
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-slate-700 bg-white border rounded-xl p-3 min-h-[200px]">
                      {emailTemplate}
                    </pre>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                      Historial (centro)
                    </div>
                    {commHistoryLoading ? (
                      <div className="text-sm text-slate-500">Cargando historial...</div>
                    ) : commHistory.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        No hay avisos registrados para este centro.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {commHistory.slice(0, 10).map((n) => (
                          <div key={n.id} className="bg-white border rounded-xl p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-slate-800 text-sm">{n.title}</div>
                              <span className="text-[11px] text-slate-400">
                                {new Date(n.createdAtISO).toLocaleString()}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">
                                {n.type}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">
                                {n.severity}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">
                                {n.sendEmail ? "con email" : "solo interno"}
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-slate-700">{n.body}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
