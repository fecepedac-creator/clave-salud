import React, { createContext, useEffect, useMemo, useState } from "react";
import {
  Patient,
  ViewMode,
  Appointment,
  Doctor,
  MedicalCenter,
  AuditLogEntry,
} from "./types";
import {
  MOCK_PATIENTS,
  INITIAL_DOCTORS,
  INITIAL_CENTERS,
} from "./constants";
import PatientForm from "./components/PatientForm";
import { ProfessionalDashboard } from "./components/DoctorDashboard";
import AdminDashboard from "./components/AdminDashboard";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import {
  formatRUT,
  generateId,
  getStandardSlots,
  getDaysInMonth,
} from "./utils";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  ShieldCheck,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { useToast } from "./components/Toast";

import { db, auth } from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup, sendPasswordResetEmail, GoogleAuthProvider, createUserWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  limit,
} from "firebase/firestore";

// -------------------- Center / Modules Context --------------------
// Permite que cualquier componente (AdminDashboard, DoctorDashboard, etc.) pueda leer:
// - centro activo
// - configuración de módulos (centers/{id}.modules)
//
// Uso en otros componentes:
//   import { useContext } from "react";
//   import { CenterContext } from "../App";
//   const { activeCenter, modules, isModuleEnabled } = useContext(CenterContext);

export type CenterModules = Record<string, boolean>;

export const CenterContext = createContext<{
  activeCenterId: string;
  activeCenter: MedicalCenter;
  modules: CenterModules;
  isModuleEnabled: (key: string) => boolean;
}>({
  activeCenterId: "",
  activeCenter: {} as any,
  modules: {},
  isModuleEnabled: () => true,
});

function isValidCenter(c: any): c is { id: string } {
  return !!c && typeof c === "object" && typeof (c as any).id === "string" && (c as any).id.length > 0;
}

/**
 * Convención recomendada de roles (en users/{uid}.roles):
 * - "super_admin": puede crear/editar centros y asignar admin de centro
 * - "center_admin": admin del/los centros listados en users/{uid}.centros
 * - Roles profesionales (solo para UI/filtro): "Medico", "Enfermera", "Kinesiologo", etc.
 *
 * users/{uid} ejemplo:
 *  {
 *    email: "medico@saludmass.cl",
 *    activo: true,
 *    roles: ["Medico", "center_admin"],   // puede ser solo ["Medico"] si NO administra
 *    centros: ["c_saludmass"]             // IDs de centros (de constants.ts o de Firestore)
 *  }
 */

// --- Helpers de persistencia ---
type GlobalCollection = "patients" | "doctors" | "appointments" | "logs" | "centers" | "users";

function isValidCollection(c: string): c is GlobalCollection {
  return ["patients", "doctors", "appointments", "logs", "centers", "users"].includes(c);
}

// Public assets (works even when the app is served under a sub-path)
const ASSET_BASE = (import.meta as any)?.env?.BASE_URL ?? "/";
const LOGO_SRC = `${ASSET_BASE}assets/logo.png`;
const HOME_BG_SRC = `${ASSET_BASE}assets/home-bg.png`;

const App: React.FC = () => {
  const { showToast } = useToast();

  // ---------- Global data ----------
  const [centers, setCenters] = useState<MedicalCenter[]>(INITIAL_CENTERS);
  // --- Centros (directorio público) desde Firestore ---
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "centers")),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MedicalCenter[];
        // Si Firestore está vacío, mantenemos los INITIAL_CENTERS para demo
        setCenters(items.length ? items : INITIAL_CENTERS);
      },
      () => {
        // si falla Firestore, quedamos con INITIAL_CENTERS
        setCenters(INITIAL_CENTERS);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS);
  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [demoMode, setDemoMode] = useState(false);

  // tenant selection
  const [activeCenterId, setActiveCenterId] = useState<string>("");
  
  // módulos del centro (persistidos en Firestore dentro de centers/{id}.modules)
  const centerModules = useMemo(() => {
    const c = (centers as any[])?.find((x: any) => x?.id === activeCenterId);
    return (c?.modules ?? {}) as CenterModules;
  }, [centers, activeCenterId]);

  const isModuleEnabled = (key: string) => {
    const v = centerModules?.[key];
    return v === undefined ? true : !!v; // default allow si no está definido
  };

const activeCenter = useMemo(
    () => centers.find((c) => c.id === activeCenterId) ?? null,
    [centers, activeCenterId]
  );

  // ---------- Session ----------
  const [view, setView] = useState<ViewMode>("home" as ViewMode);
  const [postCenterSelectView, setPostCenterSelectView] = useState<ViewMode>("center-portal" as ViewMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // user state (lo dejamos laxo para no romper types)
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [authUser, setAuthUser] = useState<any>(null);
  const [isSuperAdminClaim, setIsSuperAdminClaim] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        const token = await user.getIdTokenResult(true);
        setIsSuperAdminClaim(!!(token.claims as any)?.superadmin);
      } else {
        setIsSuperAdminClaim(false);
      }
    });
    return () => unsub();
  }, []);
  const [error, setError] = useState("");

  // ---------- Invite (crear administrador por token) ----------
  const [inviteToken, setInviteToken] = useState<string>("");
  const [inviteLoading, setInviteLoading] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteCenterId, setInviteCenterId] = useState<string>("");
  const [inviteCenterName, setInviteCenterName] = useState<string>("");
  const [invitePassword, setInvitePassword] = useState<string>("");
  const [invitePassword2, setInvitePassword2] = useState<string>("");
  const [inviteDone, setInviteDone] = useState<boolean>(false);

  // Si la URL viene como /invite?token=..., entramos directo al flujo de invitación.
  useEffect(() => {
    try {
      const path = window.location.pathname || "";
      if (!path.toLowerCase().startsWith("/invite")) return;

      const params = new URLSearchParams(window.location.search);
      const t = (params.get("token") || "").trim();
      if (!t) {
        setInviteError("Invitación inválida: falta el token.");
        setView("home" as ViewMode);
        return;
      }
      setInviteToken(t);
      setView("invite" as any);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar invitación desde Firestore
  useEffect(() => {
    const load = async () => {
      if (!inviteToken) return;
      setInviteLoading(true);
      setInviteError("");
      try {
        const qy = query(collection(db, "invitations"), where("token", "==", inviteToken), limit(1));
        const snap = await getDocs(qy);
        if (snap.empty) throw new Error("Invitación no encontrada o ya fue utilizada.");

        const docSnap = snap.docs[0];
        const inv: any = docSnap.data() || {};

        if (inv.used === true || inv.status === "used") {
          throw new Error("Esta invitación ya fue utilizada.");
        }

        // expiresAt puede venir como Timestamp (Firestore) o string ISO
        const now = Date.now();
        let expMs = 0;
        if (inv.expiresAt?.toMillis) expMs = inv.expiresAt.toMillis();
        else if (typeof inv.expiresAt === "string") expMs = Date.parse(inv.expiresAt);
        else if (typeof inv.expiresAt === "number") expMs = inv.expiresAt;

        if (expMs && now > expMs) throw new Error("Esta invitación expiró. Solicita una nueva invitación.");

        const emailInv = String(inv.email || inv.adminEmail || "").trim().toLowerCase();
        const centerIdInv = String(inv.centerId || inv.centroId || "").trim();
        if (!emailInv || !centerIdInv) throw new Error("Invitación mal formada: faltan datos.");

        // obtener nombre del centro para mostrarlo bonito
        const centerSnap = await getDoc(doc(db, "centers", centerIdInv)).catch(() => null as any);
        const centerName = centerSnap?.exists?.() ? (centerSnap.data() as any)?.name : "";

        setInviteEmail(emailInv);
        setInviteCenterId(centerIdInv);
        setInviteCenterName(centerName || "");
      } catch (e: any) {
        setInviteError(e?.message || "No se pudo cargar la invitación.");
      } finally {
        setInviteLoading(false);
      }
    };
    load();
  }, [inviteToken]);

  // Booking wizard
  const [bookingStep, setBookingStep] = useState(0);
  const [bookingData, setBookingData] = useState<{ name: string; rut: string; phone: string }>({
    name: "",
    rut: "",
    phone: "",
  });
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<Doctor | null>(null);
  const [bookingDate, setBookingDate] = useState<Date>(new Date());
  const [bookingMonth, setBookingMonth] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);

  // ---------- Firestore sync (tolerante a fallos) ----------
  useEffect(() => {
    const unsubCenters = onSnapshot(
      collection(db, "centers"),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MedicalCenter[];
        if (items.length) setCenters(items);
      },
      () => {
        // si falla, quedamos con INITIAL_CENTERS
      }
    );

    const unsubPatients = onSnapshot(
      query(collection(db, "patients"), where("centerId", "==", activeCenterId)),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Patient[];
        setPatients(items);
      },
      () => {}
    );

    const unsubDoctors = onSnapshot(
      query(collection(db, "doctors"), where("centerId", "==", activeCenterId)),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Doctor[];
        setDoctors(items);
      },
      () => {}
    );

    const unsubAppts = onSnapshot(
      query(collection(db, "appointments"), where("centerId", "==", activeCenterId)),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Appointment[];
        setAppointments(items);
      },
      () => {}
    );

    const unsubLogs = onSnapshot(
      query(collection(db, "logs"), where("centerId", "==", activeCenterId)),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AuditLogEntry[];
        setAuditLogs(items);
      },
      () => {}
    );

    return () => {
      unsubCenters();
      unsubPatients();
      unsubDoctors();
      unsubAppts();
      unsubLogs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCenterId]);

  // ---------- CRUD helpers ----------
  const onGlobalUpdate = async (collectionName: string, payload: any) => {
    if (!isValidCollection(collectionName)) throw new Error(`Colección inválida: ${collectionName}`);
    const id = payload?.id ?? generateId();
    await setDoc(doc(db, collectionName, id), { ...payload, id }, { merge: true });
  };

  const onGlobalDelete = async (collectionName: string, id: string) => {
    if (!isValidCollection(collectionName)) throw new Error(`Colección inválida: ${collectionName}`);
    await deleteDoc(doc(db, collectionName, id));
  };

  // ---------- Auth/login ----------
  const handleSuperAdminLogin = async (targetView: ViewMode) => {
    try {
      setError("");
      const emailNorm = email.trim().toLowerCase();

      const cred = await signInWithEmailAndPassword(auth, emailNorm, password);
      const uid = cred.user.uid;

      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) throw new Error("Usuario sin perfil en el sistema");

      const profile: any = snap.data();

      if (profile.activo === false) throw new Error("Usuario inactivo");

            const rolesRaw: string[] = Array.isArray(profile.roles) ? profile.roles : [];
      const roles: string[] = rolesRaw.map((r: any) => String(r ?? "").trim()).filter(Boolean);
      const rolesNorm = roles.map((r) => r.toLowerCase());

      const centros: string[] = Array.isArray(profile.centros) ? profile.centros : [];

      // OJO: usa el usuario recién autenticado; authUser puede estar desfasado aquí
      const token = await cred.user.getIdTokenResult(true).catch(() => null as any);
      const claims: any = token?.claims ?? {};

      const isSuperAdmin =
        !!(claims?.super_admin === true || claims?.superadmin === true || claims?.superAdmin === true) ||
        rolesNorm.includes("superadmin") ||
        rolesNorm.includes("super_admin") ||
        rolesNorm.includes("super-admin") ||
        rolesNorm.includes("super admin");

      const isCenterAdmin =
        rolesNorm.includes("centeradmin") ||
        rolesNorm.includes("center_admin") ||
        rolesNorm.includes("center-admin") ||
        rolesNorm.includes("center admin");

      const isAdmin =
        rolesNorm.includes("admin") ||
        rolesNorm.includes("administrador");
if (targetView === ("admin-dashboard" as ViewMode) && !(isCenterAdmin || isSuperAdmin)) {
        setError("No tiene permisos administrativos.");
        return;
      }

      const userFromFirestore = {
        uid,
        email: profile.email ?? emailNorm,
        roles,
        centros,
        isAdmin: (isCenterAdmin || isSuperAdmin),
        // campos opcionales usados por dashboards; si no existen, se tolera
        fullName: profile.fullName ?? profile.nombre ?? profile.email ?? "Usuario",
        role: profile.role ?? (roles.find((r) => r !== "center_admin" && r !== "super_admin") ?? "Profesional"),
        id: uid, // para dashboards que esperan currentUser.id
      };
setCurrentUser(userFromFirestore as any);

      // ✅ SuperAdmin NO depende de centros: siempre entra a su panel
      if (isSuperAdmin) {
        // SuperAdmin NO depende de centros: entra directo a su panel
        setCurrentUser(userFromFirestore as any);
        setView("superadmin-dashboard" as any);
        return;
      }

      // selección de centro (para usuarios normales / admins de centro)
      setPostCenterSelectView(targetView);

      // Superadmin: puede administrar cualquier centro (no depende de profile.centros)
      if (isSuperAdmin && targetView === ("admin-dashboard" as ViewMode)) {
        setView("select-center" as ViewMode);
        return;
      }

      if (centros.length === 1) {
        setActiveCenterId(centros[0]);
        setView(targetView);
        return;
      }
      if (centros.length > 1) {
        setView("select-center" as ViewMode);
        return;
      }
      // Si no tiene centros asignados y no es superadmin, se bloquea
      throw new Error("Usuario sin centros asignados");
    } catch (e: any) {
      console.error("LOGIN ERROR", e?.code, e?.message);
      setError(e?.message || "Credenciales inválidas o sin permisos");
    }
  };

  const handleGoogleLogin = async (targetView: ViewMode) => {
    try {
      setError("");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;

      const uid = user.uid;
      const emailUser = (user.email || "").trim().toLowerCase();
      if (!emailUser) throw new Error("Tu cuenta Google no tiene email disponible.");

      // 1) Si ya existe perfil, úsalo
      const existingSnap = await getDoc(doc(db, "users", uid));
      if (existingSnap.exists()) {
        const profile: any = existingSnap.data();
        if (profile.activo === false) throw new Error("Usuario inactivo");

        const rolesRaw: string[] = Array.isArray(profile.roles) ? profile.roles : [];
        const roles: string[] = rolesRaw.map((r: any) => String(r ?? "").trim().toLowerCase()).filter(Boolean);
        const centers: string[] = Array.isArray((profile as any).centros) ? (profile as any).centros : (Array.isArray((profile as any).centers) ? (profile as any).centers : []);
        const token = await authUser.getIdTokenResult?.(true).catch(() => null as any);
        const claims: any = token?.claims ?? {};
        const isSuperAdmin = !!(claims?.super_admin === true || claims?.superadmin === true) || roles.includes("super_admin");
        const isCenterAdmin = roles.includes("center_admin");

        const userFromFirestore = {
          uid,
          email: profile.email ?? emailUser,
          roles,
          centers,
          activeCenterId: profile.activeCenterId ?? (centers?.[0] ?? null),
          displayName: profile.displayName ?? user.displayName ?? "",
          photoURL: profile.photoURL ?? user.photoURL ?? "",
        };

        setCurrentUser(userFromFirestore as any);

        // SuperAdmin por Google (si aplica) entra directo
        if (isSuperAdmin) {
          setView("superadmin-dashboard" as any);
          return;
        }

        // selección de centro para el resto
        setPostCenterSelectView(targetView);
        setView("select-center" as any);
        return;
      }

      // 2) No hay perfil: reclamar invitación(es)
      const qInv = query(
        collection(db, "invites"),
        where("emailLower", "==", emailUser),
        where("status", "==", "pending")
      );
      const invSnap = await getDocs(qInv);

      if (invSnap.empty) {
        throw new Error("No tienes invitación activa. Pide al administrador del centro que te invite con este correo.");
      }

      const inviteDocs = invSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const rolesFromInvites = Array.from(new Set(inviteDocs.map((i) => i.role).filter(Boolean)));
      const centersFromInvites = Array.from(new Set(inviteDocs.map((i) => i.centerId).filter(Boolean)));

      // Crear perfil usuario (users/{uid})
      const newProfile = {
        uid,
        email: emailUser,
        displayName: user.displayName ?? "",
        photoURL: user.photoURL ?? "",
        roles: rolesFromInvites,
        centers: centersFromInvites,
        activo: true,
        createdAt: serverTimestamp(),
        activeCenterId: centersFromInvites?.[0] ?? null,
      };

      await setDoc(doc(db, "users", uid), newProfile, { merge: true });

      // Marcar invites como claimed (sin cambiar centerId/role/email)
      await Promise.all(
        inviteDocs.map((inv) =>
          updateDoc(doc(db, "invites", inv.id), {
            status: "claimed",
            claimedAt: serverTimestamp(),
            claimedByUid: uid,
          })
        )
      );

      const userFromFirestore = {
        uid,
        email: emailUser,
        roles: rolesFromInvites,
        centers: centersFromInvites,
        activeCenterId: centersFromInvites?.[0] ?? null,
        displayName: user.displayName ?? "",
        photoURL: user.photoURL ?? "",
      };

      setCurrentUser(userFromFirestore as any);

      // Selección de centro
      setPostCenterSelectView(targetView);
      setView("select-center" as any);
    } catch (e: any) {
      console.error("GOOGLE LOGIN ERROR", e);
      setError(e?.message || "No se pudo iniciar sesión con Google.");
    }
  };


  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setEmail("");
    setPassword("");
    setActiveCenterId("");
    setView("home" as ViewMode);
  };

  const bootstrapSuperAdmin = async () => {
    if (!authUser) {
      alert("Debes iniciar sesión primero");
      return;
    }
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, "setSuperAdmin");
      await fn({ uid: authUser.uid });
      alert(`✅ Usuario convertido en SuperAdmin.
Cierra sesión y vuelve a ingresar para aplicar permisos.`);
    } catch (e: any) {
      console.error("BOOTSTRAP ERROR", e);
      alert(e?.message || "Error al ejecutar bootstrap");
    }
  };

  // ---------- Booking ----------
  const handleBookingConfirm = async () => {
    if (!selectedSlot || !bookingData.rut || !bookingData.name || !selectedDoctorForBooking) {
      showToast("Faltan datos", "error");
      return;
    }
    const newAppt: Appointment = {
      id: generateId(),
      centerId: activeCenterId,
      doctorId: selectedDoctorForBooking.id,
      date: selectedSlot.date,
      time: selectedSlot.time,
      patientName: bookingData.name,
      patientRut: bookingData.rut,
      patientPhone: bookingData.phone,
      status: "booked",
    } as any;

    await onGlobalUpdate("appointments", newAppt);
    setBookingStep(4);
  };

  const resetBooking = () => {
    setBookingStep(0);
    setBookingData({ name: "", rut: "", phone: "" });
    setSelectedRole("");
    setSelectedDoctorForBooking(null);
    setBookingDate(new Date());
    setBookingMonth(new Date());
    setSelectedSlot(null);
    setView("patient-menu" as ViewMode);
  };

  // ---------- Render ----------
  const renderCenterPortal = () => {
    if (!activeCenterId || !isValidCenter(activeCenter)) {
      return renderHomeDirectory();
    }
    const primary = (activeCenter as any).primaryColor ?? "blue";
    return (

    <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-4xl mb-6 flex justify-start">
        <button
          onClick={() => { setActiveCenterId(""); setView("home" as ViewMode); }}
          className="px-4 py-2 rounded-xl bg-white/80 hover:bg-white shadow border border-white text-slate-700 font-bold"
        >
          ← Volver a ClaveSalud
        </button>
      </div>
      <div className="text-center mb-10">
        <div className={"w-24 h-24 bg-blue-50 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-lg"}>
          <Building2 className={"w-12 h-12 text-blue-600"} />
        </div>
        <h1 className="text-5xl font-extrabold text-slate-800 tracking-tight drop-shadow-sm">{activeCenter.name}</h1>
        <p className="text-slate-500 mt-3 text-xl font-medium">Plataforma Integral de Salud</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
        <button
          onClick={() => setView("patient-menu" as ViewMode)}
          className="bg-white/80 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-blue-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-blue-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
            <UserRound className="w-12 h-12 text-blue-600" />
          </div>
          <h3 className="font-bold text-3xl text-slate-800">Soy Paciente</h3>
          <p className="text-slate-500 mt-2 font-medium text-lg">Reserva de horas y ficha clínica</p>
        </button>

        <button
          onClick={() => setView("doctor-login" as ViewMode)}
          className="bg-white/80 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-emerald-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-emerald-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
            <Stethoscope className="w-12 h-12 text-emerald-600" />
          </div>
          <h3 className="font-bold text-3xl text-slate-800">Soy Profesional</h3>
          <p className="text-slate-500 mt-2 font-medium text-lg">Acceso para equipos de salud</p>
        </button>      </div>
      {/* Acceso discreto a SuperAdmin */}
      <button
        type="button"
        onClick={() => setView("superadmin-login" as any)}
        className="fixed top-4 right-4 p-3 rounded-full bg-slate-900/80 text-white shadow-xl hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
        title="Acceso SuperAdmin"
        aria-label="Acceso SuperAdmin"
      >
        <Lock className="w-5 h-5" />
      </button>

    </div>
  );

  };

  const renderPatientMenu = () => (
    <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
      <div className="max-w-4xl w-full">
        <button
          onClick={() => setView("center-portal" as ViewMode)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-8 bg-white/50 px-4 py-2 rounded-full w-fit transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Volver
        </button>

        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-slate-800">¿Qué deseas realizar?</h2>
          <p className="text-slate-500 mt-2 text-xl">Selecciona una opción para continuar</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <button
            onClick={() => {
              setBookingStep(0);
              setView("patient-booking" as ViewMode);
            }}
            className="bg-white/90 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-indigo-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
          >
            <div className="w-24 h-24 bg-indigo-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <CalendarPlus className="w-12 h-12 text-indigo-600" />
            </div>
            <h3 className="font-bold text-3xl text-slate-800">Solicitar Hora</h3>
            <p className="text-slate-500 mt-2 font-medium text-lg">Agendar cita con especialistas</p>
          </button>

          <button
            onClick={() => setView("patient-form" as ViewMode)}
            className="bg-white/90 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-blue-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
          >
            <div className="w-24 h-24 bg-blue-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <AlertCircle className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="font-bold text-3xl text-slate-800">Completar Antecedentes</h3>
            <p className="text-slate-500 mt-2 font-medium text-lg">Pre-ingreso y ficha clínica</p>
          </button>
        </div>
      </div>
    </div>
  );

  const renderPatientForm = () => (
    <div className="min-h-screen pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <h2 className="text-3xl font-bold text-slate-800 mb-8 text-center drop-shadow-sm">Ficha de Pre-Ingreso</h2>
        <PatientForm
          onSave={(patient: Patient) => {
            const exists = patients.find((p) => p.rut === patient.rut);
            const payload = exists ? { ...patient, id: exists.id, centerId: activeCenterId } : { ...patient, centerId: activeCenterId };
            onGlobalUpdate("patients", payload);
            showToast("Ficha actualizada correctamente", "success");
            setView("patient-menu" as ViewMode);
          }}
          onCancel={() => setView("patient-menu" as ViewMode)}
          existingPatients={patients}
        />
      </div>
    </div>
  );

    const renderBooking = () => {
    if (!activeCenterId || !isValidCenter(activeCenter)) return renderHomeDirectory();

    const uniqueRoles = Array.from(
      new Set(doctors.filter((d) => d.centerId === activeCenterId).map((d) => d.role))
    );

    const dateStr = bookingDate.toISOString().split("T")[0];

    // slots disponibles para el día seleccionado (según appointments.status === "available")
    const availableSlotsForDay =
      selectedDoctorForBooking
        ? getStandardSlots(dateStr, selectedDoctorForBooking.id, selectedDoctorForBooking.agendaConfig).filter((slot: any) => {
            const existing = appointments.find(
              (a) =>
                a.doctorId === selectedDoctorForBooking.id &&
                a.date === dateStr &&
                a.time === slot.time &&
                a.status === "available"
            );
            return !!existing;
          })
        : [];

    return (
      <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-4xl">
          <button
            onClick={() => setView("patient-menu" as ViewMode)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-8 bg-white/50 px-4 py-2 rounded-full w-fit transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Volver
          </button>

          {/* Step 0: Rol */}
          {bookingStep === 0 && (
            <div className="animate-fadeIn">
              <h3 className="text-3xl font-bold text-slate-800 mb-8 text-center">Selecciona Especialidad</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {uniqueRoles.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setSelectedRole(r);
                      setSelectedDoctorForBooking(null);
                      setSelectedSlot(null);
                      setBookingStep(1);
                    }}
                    className="p-8 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left bg-white shadow-sm hover:shadow-md"
                  >
                    <span className="font-bold text-xl text-slate-700">{r}</span>
                  </button>
                ))}
                {uniqueRoles.length === 0 && (
                  <p className="text-center text-slate-400 col-span-2">No hay especialistas disponibles.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Profesional */}
          {bookingStep === 1 && (
            <div className="animate-fadeIn">
              <h3 className="text-3xl font-bold text-slate-800 mb-8 text-center">Seleccione Profesional</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {doctors
                  .filter((d) => d.role === selectedRole && d.centerId === activeCenterId)
                  .map((docu) => (
                    <button
                      key={docu.id}
                      onClick={() => {
                        setSelectedDoctorForBooking(docu);
                        setSelectedSlot(null);
                        setBookingStep(2);
                      }}
                      className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left flex items-center gap-6 bg-white shadow-sm hover:shadow-md"
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-100 flex items-center justify-center bg-indigo-50 shrink-0">
                        <span className="font-bold text-indigo-700 text-xl">{docu.fullName?.charAt(0) ?? "?"}</span>
                      </div>
                      <div>
                        <span className="font-bold text-xl text-slate-700 block">{docu.fullName}</span>
                        <span className="text-sm text-slate-500 font-medium">{docu.specialty}</span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Step 2: Fecha + Horario */}
          {bookingStep === 2 && selectedDoctorForBooking && (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => {
                    const d = new Date(bookingMonth);
                    d.setMonth(d.getMonth() - 1);
                    setBookingMonth(d);
                  }}
                  className="p-2 hover:bg-white rounded-xl shadow-sm transition-colors text-slate-600"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <span className="font-bold text-2xl capitalize text-slate-800 tracking-tight">
                  {bookingMonth.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
                </span>

                <button
                  onClick={() => {
                    const d = new Date(bookingMonth);
                    d.setMonth(d.getMonth() + 1);
                    setBookingMonth(d);
                  }}
                  className="p-2 hover:bg-white rounded-xl shadow-sm transition-colors text-slate-600"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-white shadow-xl p-6">
                <div className="grid grid-cols-7 gap-3 mb-3 text-center text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  <div>Lun</div><div>Mar</div><div>Mie</div><div>Jue</div><div>Vie</div><div>Sab</div><div>Dom</div>
                </div>

                <div className="grid grid-cols-7 gap-3">
                  {getDaysInMonth(bookingMonth).map((day: Date | null, idx: number) => {
                    if (!day) return <div key={idx} />;
                    const dStr = day.toISOString().split("T")[0];
                    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                    const availableCount = appointments.filter(
                      (a) =>
                        a.doctorId === selectedDoctorForBooking.id &&
                        a.date === dStr &&
                        a.status === "available"
                    ).length;
                    const isSelected = dateStr === dStr;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (availableCount > 0 && !isPast) {
                            setBookingDate(day);
                            setSelectedSlot(null);
                          }
                        }}
                        disabled={isPast || availableCount === 0}
                        className={[
                          "h-14 rounded-2xl flex flex-col items-center justify-center transition-all relative border-2",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg scale-110 z-10"
                            : isPast
                              ? "bg-slate-50 text-slate-300 border-transparent cursor-not-allowed opacity-50"
                              : availableCount > 0
                                ? "bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 hover:scale-105 font-bold cursor-pointer shadow-sm"
                                : "bg-white text-slate-300 border-slate-100 cursor-not-allowed",
                        ].join(" ")}
                      >
                        <span className="text-base">{day.getDate()}</span>
                        {availableCount > 0 && !isPast && !isSelected && (
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8">
                  <h4 className="text-xl font-extrabold text-slate-800 mb-4 text-center capitalize">
                    {bookingDate.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
                  </h4>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {availableSlotsForDay.map((slot: any) => (
                      <button
                        key={slot.time}
                        onClick={() => {
                          setSelectedSlot({ date: dateStr, time: slot.time });
                          setBookingStep(3);
                        }}
                        className="py-4 bg-white border-2 border-emerald-100 text-emerald-700 font-bold rounded-2xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm hover:shadow-lg text-lg"
                      >
                        {slot.time}
                      </button>
                    ))}
                    {availableSlotsForDay.length === 0 && (
                      <div className="col-span-5 text-center text-slate-400 py-6">
                        No hay horarios disponibles para este día.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setBookingStep(1)}
                  className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold bg-white/70 px-4 py-2 rounded-full w-fit"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver a profesionales
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Datos paciente */}
          {bookingStep === 3 && selectedDoctorForBooking && selectedSlot && (
            <div className="animate-fadeIn max-w-lg mx-auto">
              <h3 className="text-3xl font-bold text-slate-800 mb-6 text-center">Confirmar Reserva</h3>

              <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-white shadow-xl p-8 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">RUT Paciente</label>
                  <input
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl font-bold text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                    value={bookingData.rut}
                    onChange={(e) => setBookingData({ ...bookingData, rut: formatRUT(e.target.value) })}
                    placeholder="12.345.678-9"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Nombre Completo</label>
                  <input
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                    value={bookingData.name}
                    onChange={(e) => setBookingData({ ...bookingData, name: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Teléfono</label>
                  <input
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                    value={bookingData.phone}
                    onChange={(e) => setBookingData({ ...bookingData, phone: e.target.value })}
                    placeholder="+569..."
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleBookingConfirm}
                  className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-bold text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-transform active:scale-95"
                >
                  Confirmar Reserva
                </button>

                <button
                  onClick={() => setBookingStep(2)}
                  className="w-full bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Volver a horarios
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Éxito */}
          {bookingStep === 4 && (
            <div className="animate-fadeIn text-center py-12">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                <Check className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-4xl font-bold text-slate-800 mb-3">¡Reserva Exitosa!</h3>
              <p className="text-slate-500 mb-10 text-xl">Su hora ha sido agendada correctamente.</p>
              <button
                onClick={resetBooking}
                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 text-lg shadow-lg"
              >
                Volver al Inicio
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLogin = (isDoc: boolean) => (
    <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
      <div className={`bg-white/95 backdrop-blur-md p-10 rounded-[2.5rem] shadow-2xl w-full relative transition-all border border-white ${isDoc ? "max-w-4xl" : "max-w-md"}`}>
        <button onClick={() => setView("center-portal" as ViewMode)} className="absolute top-8 left-8 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="flex flex-col gap-10 mt-4">
          <div className={`w-20 h-20 ${isDoc ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"} rounded-3xl flex items-center justify-center mx-auto mb-2 shadow-inner`}>
            {isDoc ? <Stethoscope className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
          </div>
          <h2 className="text-3xl font-bold text-center text-slate-800">{isDoc ? "Acceso Profesional" : "Acceso Administrativo"}</h2>

          <div className="space-y-6 max-w-sm mx-auto w-full">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-colors font-medium text-slate-700" placeholder="nombre@centro.cl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-colors" placeholder="••••••••" />
            </div>
            {error && <p className="text-red-500 font-bold text-sm text-center bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
            <button onClick={() => handleSuperAdminLogin((isDoc ? "doctor-dashboard" : "admin-dashboard") as ViewMode)} className={`w-full py-4 rounded-2xl font-bold text-white text-lg shadow-lg transition-transform active:scale-95 ${isDoc ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-slate-800 hover:bg-slate-900 shadow-slate-200"}`}>
              Ingresar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuperAdminLogin = () => (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Lock className="w-6 h-6 text-slate-700" />
            Acceso SuperAdmin
          </h2>
          <button
            type="button"
            onClick={() => setView("center-portal" as ViewMode)}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Volver
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">Correo</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="correo@dominio.cl"
              autoComplete="username"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-600">Contraseña</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => handleSuperAdminLogin("superadmin-dashboard" as any)}
            className="w-full rounded-xl bg-slate-900 text-white font-bold py-3 hover:bg-slate-800 transition-colors"
          >
            Ingresar
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          * Si este usuario no tiene el rol <span className="font-mono">superadmin</span> / <span className="font-mono">super_admin</span> en Firestore, no podrá entrar.
        </p>
      </div>
    </div>
  );


  const renderSelectCenter = () => {
    // Centros disponibles para el usuario (acepta "centros" o "centers" por compatibilidad)
    const allowed: string[] = Array.isArray(currentUser?.centros) ? currentUser.centros : (Array.isArray(currentUser?.centers) ? currentUser.centers : []);
    const available = centers.filter((c) => allowed.includes(c.id));

    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-slate-800">Selecciona un centro</h2>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Cerrar sesión
            </button>
          </div>

          {available.length === 0 ? (
            <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-xl p-4 text-sm">
              Tu usuario no tiene centros asignados. Pide a SuperAdmin que te asigne un centro.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {available.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCenterId(c.id);
                    setView(postCenterSelectView);
                  }}
                  className="p-5 rounded-2xl border border-slate-100 hover:border-sky-300 hover:shadow-md transition-all text-left bg-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center">
                      {(c as any).logoUrl ? (
                        <img src={(c as any).logoUrl} alt={`Logo de ${c.name}`} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-700" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold text-slate-900">{c.name}</div>
                      <div className="text-slate-500 text-sm">{c.commune ?? c.region ?? "Chile"}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 text-xs text-slate-500">
            Consejo: si administras más de un centro, podrás cambiar de centro desde aquí.
          </div>
        </div>
      </div>
    );
  };

  const renderInviteRegister = () => {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Crear cuenta</h2>
          <p className="text-slate-500 text-sm mb-6">
            {inviteCenterName ? (
              <>Has sido invitado(a) para administrar <span className="font-bold text-slate-700">{inviteCenterName}</span>.</>
            ) : (
              <>Has sido invitado(a) para administrar un centro en ClaveSalud.</>
            )}
          </p>

          {inviteLoading && (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4">
              Cargando invitación…
            </div>
          )}

          {inviteError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
              {inviteError}
            </div>
          )}

          {inviteDone ? (
            <>
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4">
                Cuenta creada. Ya puedes ingresar como administrador del centro.
              </div>

              <button
                type="button"
                onClick={() => {
                  // Limpia URL /invite para no re-abrir el flujo al refrescar
                  try { window.history.replaceState({}, "", "/"); } catch {}
                  setView("admin-login" as any);
                }}
                className="w-full rounded-xl bg-slate-900 text-white font-bold py-3 hover:bg-slate-800 transition-colors"
              >
                Ir a iniciar sesión
              </button>
            </>
          ) : (
            <>
              <label className="block mb-3">
                <span className="text-sm font-semibold text-slate-600">Correo</span>
                <input
                  value={inviteEmail}
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 bg-slate-50 text-slate-700"
                />
              </label>

              <label className="block mb-3">
                <span className="text-sm font-semibold text-slate-600">Contraseña</span>
                <input
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </label>

              <label className="block mb-5">
                <span className="text-sm font-semibold text-slate-600">Repetir contraseña</span>
                <input
                  value={invitePassword2}
                  onChange={(e) => setInvitePassword2(e.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </label>

              <button
                type="button"
                disabled={inviteLoading || !inviteEmail || !inviteCenterId}
                onClick={async () => {
                  try {
                    setInviteError("");
                    if (!inviteEmail || !inviteCenterId) throw new Error("Invitación incompleta.");
                    if (invitePassword.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
                    if (invitePassword !== invitePassword2) throw new Error("Las contraseñas no coinciden.");

                    setInviteLoading(true);

                    const cred = await createUserWithEmailAndPassword(auth, inviteEmail, invitePassword);

                    // Crear perfil users/{uid} para compatibilidad con tu login actual (sin claims aún)
                    const uid = cred.user.uid;
                    await setDoc(doc(db, "users", uid), {
                      uid,
                      email: inviteEmail,
                      activo: true,
                      roles: ["center_admin"],
                      centros: [inviteCenterId],
                      createdAt: serverTimestamp(),
                      fullName: inviteEmail,
                      role: "Administrador",
                    }, { merge: true });

                    // Marcar invitación como usada (idealmente esto debería hacerlo una Cloud Function)
                    const qy = query(collection(db, "invitations"), where("token", "==", inviteToken), limit(1));
                    const snap = await getDocs(qy);
                    if (!snap.empty) {
                      await updateDoc(doc(db, "invitations", snap.docs[0].id), {
                        used: true,
                        usedAt: serverTimestamp(),
                        claimedByUid: uid,
                        status: "used",
                      }).catch(() => {});
                    }

                    setInviteDone(true);
                    showToast("Cuenta creada correctamente", "success");
                  } catch (e: any) {
                    console.error("INVITE REGISTER ERROR", e);
                    setInviteError(e?.message || "No se pudo crear la cuenta.");
                  } finally {
                    setInviteLoading(false);
                  }
                }}
                className="w-full rounded-xl bg-sky-600 text-white font-bold py-3 hover:bg-sky-700 transition-colors disabled:opacity-50"
              >
                Crear cuenta
              </button>

              <button
                type="button"
                onClick={() => {
                  try { window.history.replaceState({}, "", "/"); } catch {}
                  setView("home" as any);
                }}
                className="w-full mt-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderHomeDirectory = () => {
    return (
      <div
        className="relative min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10 pb-16"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(248, 250, 252, 0.86), rgba(248,250,252,0.30)), url(${HOME_BG_SRC})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* 🔐 Bootstrap SuperAdmin (solo si NO es superadmin) */}
        {authUser && !isSuperAdminClaim && (
          <div className="fixed bottom-4 right-4 z-50">
            <button
              onClick={bootstrapSuperAdmin}
              className="bg-red-600 text-white px-5 py-3 rounded-xl shadow-xl font-bold hover:bg-red-700"
            >
              Convertirme en SuperAdmin
            </button>
          </div>
        )}

        {/* Capa sutil de puntos (muy ligera) */} 
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.09) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Candado global SuperAdmin (discreto, arriba derecha) */}
        <button
          type="button"
          onClick={() => setView("superadmin-login" as ViewMode)}
          className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white/80 backdrop-blur border border-white shadow-lg hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          title="Acceso SuperAdmin"
          aria-label="Acceso SuperAdmin"
        >
          <Lock className="w-5 h-5 text-slate-800" />
        </button>

        <div className="text-center mb-10">
          <div className="flex flex-col items-center justify-center gap-3">
            <img
              src={LOGO_SRC}
              alt="ClaveSalud"
              className="h-28 md:h-32 w-auto object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
            />
           <h1 className="text-4xl md:text-5xl font-extrabold">
  <span className="text-sky-500">Clave</span><span className="text-teal-700">Salud</span>
</h1>
          </div>

          <p className="text-slate-500 mt-3 text-lg">
            Ficha clínica digital para equipos de salud.
          </p>
        </div>

        <div className="w-full max-w-5xl">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">
              Directorio de centros médicos
            </h2>
            <p className="text-slate-500 text-sm">
              Selecciona un centro para ingresar a su portal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {centers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCenterId(c.id);
                  setView("center-portal" as ViewMode);
                }}
                className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl shadow-xl border border-white hover:shadow-2xl hover:-translate-y-0.5 transition-all text-left"
              >
                <div className="flex items-center gap-4">
                 {/* ESTE ES EL NUEVO CÓDIGO */}
<div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden">
  {(c as any).logoUrl ? (
    <img src={(c as any).logoUrl} alt={`Logo de ${c.name}`} className="w-full h-full object-cover" />
  ) : (
    <Building2 className="w-7 h-7 text-slate-700" />
  )}
</div>

                  <div className="flex-1">
                    <div className="font-extrabold text-slate-900 text-lg leading-tight">
                      {c.name}
                    </div>
                    <div className="text-slate-500 text-sm">
                      {c.commune ?? c.region ?? "Chile"}
                    </div>
                  </div>
                </div>
                <div className="mt-5 text-sm font-bold text-slate-700 inline-flex items-center gap-2">
                  Ingresar <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const centerCtxValue = useMemo(() => {
    const c = (centers as any[])?.find((x: any) => x?.id === activeCenterId) ?? ({} as any);
    return {
      activeCenterId,
      activeCenter: c,
      modules: (c?.modules ?? {}) as CenterModules,
      isModuleEnabled: (key: string) => {
        const v = (c?.modules ?? {})?.[key];
        return v === undefined ? true : !!v;
      },
    };
  }, [centers, activeCenterId]);

  


  if (view === ("invite" as any)) return (
    <CenterContext.Provider value={centerCtxValue}>
      {renderInviteRegister()}
    </CenterContext.Provider>
  );

  if (view === ("center-portal" as ViewMode)) return (
    <CenterContext.Provider value={centerCtxValue}>
      {renderCenterPortal()}
        </CenterContext.Provider>
  );
  if (view === ("patient-menu" as ViewMode)) return (
    <CenterContext.Provider value={centerCtxValue}>
      {renderPatientMenu()}
        </CenterContext.Provider>
  );
  if (view === ("patient-form" as ViewMode)) return (
    <CenterContext.Provider value={centerCtxValue}>
      {renderPatientForm()}
        </CenterContext.Provider>
  );
  if (view === ("patient-booking" as ViewMode)) return (
    <CenterContext.Provider value={centerCtxValue}>
      {renderBooking()}
        </CenterContext.Provider>
  );
  if (view === ("doctor-login" as ViewMode)) return (
    <CenterContext.Provider value={centerCtxValue}>
      {renderLogin(true)}
    </CenterContext.Provider>
  );
  
  if (view === ("superadmin-login" as ViewMode)) return (
    <CenterContext.Provider value={centerCtxValue}>
      {renderSuperAdminLogin()}
        </CenterContext.Provider>
  );

  if (view === ("superadmin-dashboard" as ViewMode)) {
    return (
      <CenterContext.Provider value={centerCtxValue}>
        <SuperAdminDashboard
        centers={centers}
        doctors={doctors}
        demoMode={demoMode}
        onToggleDemo={() => setDemoMode((d) => !d)}
        onLogout={() => {
          setCurrentUser(null);
          setActiveCenterId("");
    setView("home" as ViewMode);
        }}
        onUpdateCenters={async (updates) => {
          for (const c of updates) await onGlobalUpdate("centers", c as any);
        }}
        onDeleteCenter={async (id) => {
          await onGlobalDelete("centers", id);
        }}
        onUpdateDoctors={async (updates) => {
          for (const d of updates) await onGlobalUpdate("doctors", d as any);
        }}
      />
    )
      </CenterContext.Provider>
    );
  }

if (view === ("admin-login" as ViewMode)) return (
    <CenterContext.Provider value={centerCtxValue}>
      {renderLogin(false)}
    </CenterContext.Provider>
  );
  if (view === ("home" as ViewMode)) return (
        <>
          {renderHomeDirectory()}
        </>
      );

      if (view === ("select-center" as ViewMode)) return (
    <CenterContext.Provider value={centerCtxValue}>
      {renderSelectCenter()}
        </CenterContext.Provider>
  );

  if (view === ("doctor-dashboard" as ViewMode) && currentUser) {
    return (
      <CenterContext.Provider value={centerCtxValue}>
        <ProfessionalDashboard
        patients={patients}
        doctorName={currentUser.fullName}
        doctorId={currentUser.id}
        role={currentUser.role}
        agendaConfig={currentUser.agendaConfig}
        savedTemplates={currentUser.savedTemplates}
        currentUser={currentUser}
        onUpdatePatient={(p: Patient) => onGlobalUpdate("patients", p)}
        onUpdateDoctor={(d: Doctor) => onGlobalUpdate("doctors", d)}
        onLogout={handleLogout}
        appointments={appointments}
        onUpdateAppointments={(newAppts: Appointment[]) => {
          // upsert simplistic: write all changed
          newAppts.forEach((a) => onGlobalUpdate("appointments", a));
        }}
        onLogActivity={(action: any, details: string, targetId?: string) => {
          const log: AuditLogEntry = {
            id: generateId(),
            centerId: activeCenterId,
            timestamp: new Date().toISOString(),
            actorName: currentUser.fullName ?? "Usuario",
            actorRole: currentUser.role ?? "Profesional",
            action,
            details,
            targetId,
          } as any;
          onGlobalUpdate("logs", log);
        }}
        isReadOnly={false}
      />
    )
      </CenterContext.Provider>
    );
  }

  if (view === ("admin-dashboard" as ViewMode) && currentUser) {
    return (
      <CenterContext.Provider value={centerCtxValue}>
        <AdminDashboard
        centerId={activeCenterId}
        doctors={doctors}
        onUpdateDoctors={(newDocs: Doctor[]) => newDocs.forEach((d) => onGlobalUpdate("doctors", d))}
        appointments={appointments}
        onUpdateAppointments={(newAppts: Appointment[]) => newAppts.forEach((a) => onGlobalUpdate("appointments", a))}
        patients={patients}
        onUpdatePatients={(newPatients: Patient[]) => newPatients.forEach((p) => onGlobalUpdate("patients", p))}
        onLogout={handleLogout}
        logs={auditLogs}
        onLogActivity={(action: any, details: string, targetId?: string) => {
          const log: AuditLogEntry = {
            id: generateId(),
            centerId: activeCenterId,
            timestamp: new Date().toISOString(),
            actorName: currentUser.fullName ?? "Usuario",
            actorRole: currentUser.role ?? "Admin",
            action,
            details,
            targetId,
          } as any;
          onGlobalUpdate("logs", log);
        }}
      />
    )
      </CenterContext.Provider>
    );
  }

  return (
    <CenterContext.Provider value={centerCtxValue}>
      <div className="p-6 text-slate-600">Vista no encontrada</div>
    </CenterContext.Provider>
  );
};

export default App;