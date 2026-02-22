import React, { useCallback, useEffect, useMemo, useState, useRef, Suspense } from "react";
import { Patient, ViewMode, Appointment, Doctor, MedicalCenter, AuditLogEntry } from "./types";
// Lazy Loading for Code Splitting
const PatientForm = React.lazy(() => import("./components/PatientForm"));
const ProfessionalDashboard = React.lazy(() => import("./components/DoctorDashboard"));
const AdminDashboard = React.lazy(() => import("./components/AdminDashboard"));
const SuperAdminDashboard = React.lazy(() => import("./components/SuperAdminDashboard"));

// Fallback Loading Component
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
    <p className="text-slate-500 text-lg font-medium animate-pulse">Cargando...</p>
  </div>
);
import LogoHeader from "./components/LogoHeader";
import LegalLinks from "./components/LegalLinks";
import LandingPage from "./components/LandingPage";
import SupportWidget from "./components/SupportWidget";
import OnboardingTour, { OnboardingStep } from "./components/OnboardingTour";
import {
  formatRUT,
  generateId,
  getDaysInMonth,
  generateSlotId,
  validateRUT,
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
  Lock,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { useToast } from "./components/Toast";
import { CenterContext, CenterModules } from "./CenterContext";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { useAuth } from "./hooks/useAuth";
import { useCenters } from "./hooks/useCenters";
import { useFirestoreSync } from "./hooks/useFirestoreSync";
import { useInvite } from "./hooks/useInvite";
import { useBooking } from "./hooks/useBooking";
import { useCrudOperations } from "./hooks/useCrudOperations";
import termsText from "./docs/legal/TERMINOS_Y_CONDICIONES.md?raw";
import privacyText from "./docs/legal/POLITICA_DE_PRIVACIDAD.md?raw";

function isValidCenter(c: any): c is MedicalCenter {
  return (
    !!c &&
    typeof c === "object" &&
    typeof (c as any).id === "string" &&
    (c as any).id.length > 0 &&
    typeof (c as any).name === "string"
  );
}

const ASSET_BASE = (import.meta as any)?.env?.BASE_URL ?? "/";
const LOGO_SRC = `${ASSET_BASE}assets/logo.png`;
const HOME_BG_SRC = `${ASSET_BASE}assets/fondo%20principal.webp`;
const CENTER_BG_SRC = `${ASSET_BASE}assets/Fondo%202.webp`;
const HOME_BG_FALLBACK_SRC = `${ASSET_BASE}assets/home-bg.png`;
const CENTER_BG_FALLBACK_SRC = `${ASSET_BASE}assets/background.png.png`;
const GOOGLE_ICON_SRC = "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";

const App: React.FC = () => {
  const { showToast } = useToast();
  const [demoMode, setDemoMode] = useState(false);
  const [view, setView] = useState<ViewMode>(() => {
    const path = window.location.pathname;
    if (path.startsWith("/accesoprofesionales") || path.startsWith("/pro")) {
      return "doctor-login" as ViewMode;
    }
    return "home" as ViewMode;
  });
  const [postCenterSelectView, setPostCenterSelectView] = useState<ViewMode>(
    "center-portal" as ViewMode
  );
  const [legalReturnView, setLegalReturnView] = useState<ViewMode>("home" as ViewMode);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isSyncingAppointments, setIsSyncingAppointments] = useState(false);
  const [previewCenterId, setPreviewCenterId] = useState("");
  const [previewRole, setPreviewRole] = useState("");

  const {
    authUser,
    isSuperAdminClaim,
    currentUser,
    email,
    setEmail,
    password,
    setPassword,
    error,
    setError,
    setCurrentUser,
    handleSuperAdminLogin: hookHandleSuperAdminLogin,
    handleSuperAdminGoogleLogin: hookHandleSuperAdminGoogleLogin,
    handleGoogleLogin: hookHandleGoogleLogin,
    handleLogout: hookHandleLogout,
    bootstrapSuperAdmin,
    handleSuperAdminUnauthorized,
    handleRedirectResult,
  } = useAuth();

  const [portfolioMode, setPortfolioMode] = useState<"global" | "center">("global");
  const {
    centers,
    setCenters,
    activeCenterId,
    setActiveCenterId,
    activeCenter,
    updateModules,
    hasMoreCenters,
    loadMoreCenters,
    isLoadingMoreCenters,
  } = useCenters(demoMode, isSuperAdminClaim);
  const {
    patients,
    setPatients,
    doctors,
    setDoctors,
    appointments,
    setAppointments,
    auditLogs,
    preadmissions,
  } = useFirestoreSync(
    activeCenterId,
    authUser,
    demoMode,
    isSuperAdminClaim,
    setCenters,
    currentUser,
    portfolioMode
  );
  const {
    inviteToken,
    setInviteToken,
    inviteLoading,
    setInviteLoading,
    inviteError,
    setInviteError,
    inviteEmail,
    setInviteEmail,
    inviteCenterName,
    invitePassword,
    setInvitePassword,
    invitePassword2,
    setInvitePassword2,
    inviteMode,
    setInviteMode,
    inviteDone,
    acceptInviteForUser,
  } = useInvite();
  // Demo overrides
  const [demoDoctorOverrides, setDemoDoctorOverrides] = useState<Record<string, Partial<Doctor>>>(
    {}
  );

  const {
    updatePatient,
    deletePatient,
    updateStaff,
    deleteStaff,
    updateAppointment,
    deleteAppointment,
    syncAppointments: hookSyncAppointments,
    updateAuditLog,
    updateCenter,
    deleteCenter,
    createPreadmission,
    approvePreadmission,
  } = useCrudOperations(
    activeCenterId,
    appointments as any, // Fix typing if needed, originally 'appointments' passed here?
    showToast
  );
  const {
    bookingStep,
    setBookingStep,
    bookingData,
    setBookingData,
    prefillContact,
    selectedRole,
    setSelectedRole,
    selectedDoctorForBooking,
    setSelectedDoctorForBooking,
    bookingDate,
    setBookingDate,
    bookingMonth,
    setBookingMonth,
    selectedSlot,
    setSelectedSlot,
    cancelRut,
    setCancelRut,
    cancelPhoneDigits,
    setCancelPhoneDigits,
    cancelLoading,
    cancelError,
    setCancelError,
    cancelResults,
    handleBookingConfirm,
    resetBooking,
    handleLookupAppointments,
    cancelPatientAppointment,
    handleReschedule,
  } = useBooking(
    activeCenterId,
    appointments,
    patients,
    doctors,
    updateAppointment,
    setAppointments,
    showToast
  );

  const syncAppointments = useCallback(
    (nextAppointments: Appointment[]) =>
      hookSyncAppointments(nextAppointments, setIsSyncingAppointments),
    [hookSyncAppointments]
  );
  const handleSuperAdminLogin = useCallback(
    (targetView: ViewMode) =>
      hookHandleSuperAdminLogin(targetView, (user, view, centerId) => {
        setCurrentUser(user);
        setView(view);
        setDemoMode(false);
        if (centerId) setActiveCenterId(centerId);
      }),
    [hookHandleSuperAdminLogin, setCurrentUser, setActiveCenterId]
  );
  const handleSuperAdminGoogleLogin = useCallback(
    () =>
      hookHandleSuperAdminGoogleLogin(() => {
        setView("superadmin-dashboard" as any);
        setDemoMode(false);
      }, handleSuperAdminUnauthorized),
    [hookHandleSuperAdminGoogleLogin, handleSuperAdminUnauthorized]
  );
  const handleGoogleLogin = useCallback(
    (targetView: ViewMode) =>
      hookHandleGoogleLogin(targetView, (user) => {
        setCurrentUser(user);
        setDemoMode(false);
        setPostCenterSelectView(targetView);
        setView("select-center" as any);
      }),
    [hookHandleGoogleLogin, setCurrentUser]
  );
  const handleLogout = useCallback(async () => {
    await hookHandleLogout();
    setActiveCenterId("");
    setView("home" as ViewMode);
  }, [hookHandleLogout, setActiveCenterId]);

  const PREVIEW_CENTER_KEY = "__previewCenterId";
  const PREVIEW_ROLE_KEY = "__previewRole";
  const ONBOARDING_KEY = "cs_onboarding_complete";

  const isPreviewRoleAdmin = useCallback((role: string) => {
    return role === "ADMIN_CENTRO" || role === "ADMINISTRATIVO";
  }, []);

  const resolvePreviewView = useCallback(
    (role: string): ViewMode =>
      (isPreviewRoleAdmin(role) ? "admin-dashboard" : "doctor-dashboard") as ViewMode,
    [isPreviewRoleAdmin]
  );

  const loadPreviewState = useCallback(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path.startsWith("/accesoprofesionales") || path.startsWith("/pro")) {
      window.localStorage.removeItem(PREVIEW_CENTER_KEY);
      window.localStorage.removeItem(PREVIEW_ROLE_KEY);
      setPreviewCenterId("");
      setPreviewRole("");
      return;
    }
    setPreviewCenterId(window.localStorage.getItem(PREVIEW_CENTER_KEY) ?? "");
    setPreviewRole(window.localStorage.getItem(PREVIEW_ROLE_KEY) ?? "");
  }, []);

  const onboardingSteps: OnboardingStep[] = useMemo(
    () => [
      {
        title: "Bienvenido a ClaveSalud",
        description:
          "Aquí podrás acceder al portal de tu centro médico y gestionar pacientes, agenda y fichas clínicas.",
      },
      {
        title: "Selecciona tu centro",
        description:
          "En el directorio de centros, elige el centro médico donde trabajas para entrar a su portal.",
      },
      {
        title: "Accesos rápidos",
        description:
          "Usa los accesos para pacientes o profesionales según tu rol. Si necesitas ayuda, el botón de soporte siempre está visible.",
      },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (view !== ("home" as ViewMode)) {
      setOnboardingOpen(false);
      return;
    }
    const completed = window.localStorage.getItem(ONBOARDING_KEY) === "true";
    if (!completed) {
      setOnboardingStep(0);
      setOnboardingOpen(true);
    }
  }, [view]);

  const startOnboarding = useCallback(() => {
    setOnboardingStep(0);
    setOnboardingOpen(true);
  }, []);

  const finishOnboarding = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_KEY, "true");
    }
    setOnboardingOpen(false);
  }, []);

  const skipOnboarding = useCallback(() => {
    finishOnboarding();
  }, [finishOnboarding]);

  const isPreviewActive = Boolean(previewCenterId && previewRole);

  const handleStartPreview = useCallback(
    (centerId: string, role: string) => {
      if (!centerId || !role) return;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PREVIEW_CENTER_KEY, centerId);
        window.localStorage.setItem(PREVIEW_ROLE_KEY, role);
      }
      setPreviewCenterId(centerId);
      setPreviewRole(role);
      if (centerId !== activeCenterId) setActiveCenterId(centerId);
      setView(resolvePreviewView(role));
    },
    [activeCenterId, resolvePreviewView, setActiveCenterId]
  );

  const handleExitPreview = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PREVIEW_CENTER_KEY);
      window.localStorage.removeItem(PREVIEW_ROLE_KEY);
    }
    setPreviewCenterId("");
    setPreviewRole("");
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!inviteToken && window.location.pathname.toLowerCase().startsWith("/invite"))
      setView("invite" as any);
  }, [inviteToken]);
  useEffect(() => {
    handleRedirectResult(
      () => setView("superadmin-dashboard" as any),
      handleSuperAdminUnauthorized
    );
  }, [handleRedirectResult, handleSuperAdminUnauthorized]);

  useEffect(() => {
    loadPreviewState();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PREVIEW_CENTER_KEY || event.key === PREVIEW_ROLE_KEY) {
        loadPreviewState();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadPreviewState]);

  useEffect(() => {
    if (!previewCenterId) return;
    if (previewCenterId !== activeCenterId) setActiveCenterId(previewCenterId);
  }, [activeCenterId, previewCenterId, setActiveCenterId]);

  const centerCtxValue = useMemo(() => {
    const c = (centers as any[])?.find((x: any) => x?.id === activeCenterId) ?? null;
    const modules = (c?.modules ?? {}) as CenterModules;
    return {
      activeCenterId,
      activeCenter: c,
      modules,
      setActiveCenterId,
      updateModules,
      isModuleEnabled: (key: string) => {
        const v = modules?.[key];
        return v === true || (typeof v === "string" && v === "enabled");
      },
    };
  }, [activeCenterId, centers, updateModules]);

  const isApplyingPopStateRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);
  const activeCenterIdRef = useRef(activeCenterId);
  const viewRef = useRef(view);

  const getCenterIdFromPath = (pathname: string) => {
    const match = pathname.match(/^\/center\/([^/]+)\/?/);
    return match?.[1] ?? "";
  };

  useEffect(() => {
    activeCenterIdRef.current = activeCenterId;
    viewRef.current = view;
  }, [activeCenterId, view]);

  useEffect(() => {
    const applyPath = (pathname: string) => {
      const nextCenterId = getCenterIdFromPath(pathname);
      const isProAccess =
        pathname.startsWith("/accesoprofesionales") || pathname.startsWith("/pro");

      isApplyingPopStateRef.current = true; // Prevent pushing state again

      if (isProAccess) {
        setView("doctor-login" as ViewMode);
        // Important: activeCenterId remains empty
        if (activeCenterIdRef.current) setActiveCenterId("");
      } else if (nextCenterId) {
        if (nextCenterId !== activeCenterIdRef.current) setActiveCenterId(nextCenterId);
        if (
          viewRef.current === ("home" as ViewMode) ||
          viewRef.current === ("select-center" as ViewMode)
        ) {
          setView("center-portal" as ViewMode);
        }
      } else {
        if (activeCenterIdRef.current) setActiveCenterId("");
        // Only go to home if we are NOT in special views
        if (
          viewRef.current !== ("home" as ViewMode) &&
          viewRef.current !== ("doctor-login" as ViewMode) &&
          !isProAccess // Double check input
        ) {
          setView("home" as ViewMode);
        }
      }
      isApplyingPopStateRef.current = false;
    };

    applyPath(window.location.pathname);
    const handlePopState = () => applyPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setActiveCenterId]);

  useEffect(() => {
    if (isApplyingPopStateRef.current) return;

    let nextPath = "/";
    if (view === ("doctor-login" as ViewMode)) {
      if (window.location.pathname.startsWith("/accesoprofesionales"))
        nextPath = window.location.pathname;
      else if (window.location.pathname.startsWith("/pro")) nextPath = window.location.pathname;
      else nextPath = "/pro"; // Default shorthand
    } else {
      nextPath =
        view === ("home" as ViewMode) || !activeCenterId ? "/" : `/center/${activeCenterId}`;
    }

    if (lastPathRef.current !== nextPath && window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
      lastPathRef.current = nextPath;
    }
  }, [activeCenterId, view]);

  const renderCenterPortal = () => {
    if (!activeCenterId || !isValidCenter(activeCenter)) {
      return renderHomeDirectory();
    }

    return renderCenterBackdrop(
      <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-4xl mb-6 flex justify-start">
          <button
            onClick={() => {
              setActiveCenterId("");
              setView("home" as ViewMode);
            }}
            className="px-4 py-2 rounded-xl bg-white/80 hover:bg-white shadow border border-white text-slate-700 font-bold"
          >
            ← Volver a ClaveSalud
          </button>
        </div>

        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-blue-50 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-lg overflow-hidden">
            {(activeCenter as any).logoUrl ? (
              <img
                src={(activeCenter as any).logoUrl}
                alt={`Logo de ${activeCenter.name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="w-12 h-12 text-blue-600" />
            )}
          </div>
          <h1 className="text-5xl font-extrabold text-slate-800 tracking-tight drop-shadow-sm">
            {activeCenter.name}
          </h1>
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
            <p className="text-slate-500 mt-2 font-medium text-lg">
              Reserva de horas y ficha clínica
            </p>
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
          </button>
        </div>

        <button
          type="button"
          onClick={() => setView("admin-login" as ViewMode)}
          className="fixed top-4 right-4 p-3 rounded-full bg-slate-900/80 text-white shadow-xl hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
          title="Acceso Administrador"
          aria-label="Acceso Administrador"
        >
          <Lock className="w-5 h-5" />
        </button>
      </div>
    );
  };

  const renderPatientMenu = () =>
    renderCenterBackdrop(
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
              <p className="text-slate-500 mt-2 font-medium text-lg">
                Agendar cita con especialistas
              </p>
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

            <button
              onClick={() => setView("patient-cancel" as ViewMode)}
              className="bg-white/90 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-rose-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-rose-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                <AlertCircle className="w-12 h-12 text-rose-500" />
              </div>
              <h3 className="font-bold text-3xl text-slate-800">Cancelar Hora</h3>
              <p className="text-slate-500 mt-2 font-medium text-lg">Libera una cita agendada</p>
            </button>
          </div>
        </div>
      </div>
    );

  const renderPatientCancel = () =>
    renderCenterBackdrop(
      <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="max-w-xl w-full">
          <button
            onClick={() => setView("patient-menu" as ViewMode)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-8 bg-white/50 px-4 py-2 rounded-full w-fit transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Volver
          </button>

          <div className="bg-white/90 backdrop-blur-sm rounded-[2.5rem] shadow-xl border border-white p-10">
            <h2 className="text-3xl font-bold text-slate-800 mb-3 text-center">Cancelar Hora</h2>
            <p className="text-slate-500 text-center mb-8">
              Ingresa tu RUT y teléfono para ver tus horas agendadas.
            </p>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                  RUT
                </label>
                <input
                  className="w-full p-4 border-2 border-slate-200 rounded-2xl font-medium outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all"
                  value={cancelRut}
                  onChange={(e) => setCancelRut(formatRUT(e.target.value))}
                  placeholder="12.345.678-9"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                  Teléfono
                </label>
                <div className="flex items-center gap-2">
                  <span className="px-4 py-4 text-base border-2 rounded-2xl border-slate-200 bg-slate-50 text-slate-500 font-bold">
                    +56 9
                  </span>
                  <input
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl font-medium outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all"
                    value={cancelPhoneDigits}
                    onChange={(e) =>
                      setCancelPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    placeholder="12345678"
                  />
                </div>
              </div>

              {cancelError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl p-3 text-sm">
                  {cancelError}
                </div>
              )}

              <button
                onClick={handleLookupAppointments}
                disabled={cancelLoading}
                className="w-full bg-rose-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-rose-700 shadow-lg transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {cancelLoading ? "Buscando..." : "Buscar Horas"}
              </button>

              {cancelResults.length > 0 && (
                <div className="pt-6 border-t border-slate-200 space-y-4">
                  <h3 className="text-lg font-bold text-slate-700 text-center">
                    Tus horas agendadas
                  </h3>
                  {cancelResults.map((appointment) => {
                    const doctor = doctors.find(
                      (doc) => doc.id === ((appointment as any).doctorUid ?? appointment.doctorId)
                    );
                    return (
                      <div
                        key={appointment.id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3"
                      >
                        <div>
                          <p className="text-sm text-slate-500">Profesional</p>
                          <p className="text-base font-bold text-slate-700">
                            {doctor?.fullName || "Profesional"}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>{appointment.date}</span>
                          <span className="font-bold">{appointment.time}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => cancelPatientAppointment(appointment)}
                            className="flex-1 bg-rose-600 text-white py-2 rounded-xl font-bold hover:bg-rose-700"
                          >
                            Anular
                          </button>
                          <button
                            onClick={() => handleReschedule(appointment)}
                            className="flex-1 bg-slate-900 text-white py-2 rounded-xl font-bold hover:bg-slate-800"
                          >
                            Cambiar fecha
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );

  const renderPatientForm = () =>
    renderCenterBackdrop(
      <div className="min-h-screen pb-12">
        <div className="max-w-4xl mx-auto pt-6 px-4">
          <h2 className="text-3xl font-bold text-slate-800 mb-8 text-center drop-shadow-sm">
            Ficha de Pre-Ingreso
          </h2>
          <PatientForm
            onSave={async (patient: Patient) => {
              const exists = patients.find((p) => p.rut === patient.rut);
              const payload = exists
                ? { ...patient, id: exists.id, centerId: activeCenterId }
                : { ...patient, centerId: activeCenterId };
              const nextPayload = {
                ...payload,
                active: payload.active ?? true,
              };
              if (!auth.currentUser) {
                try {
                  await createPreadmission({
                    patientDraft: nextPayload,
                    contact: {
                      name: patient.fullName,
                      rut: patient.rut,
                      phone: patient.phone,
                      email: patient.email,
                    },
                  });
                  showToast("Preingreso recibido. Te contactaremos.", "success");
                  setView("patient-menu" as ViewMode);
                } catch (error) {
                  console.error("createPreadmission", error);
                  showToast("No se pudo enviar el preingreso.", "error");
                }
                return;
              }
              updatePatient(nextPayload);
              showToast("Ficha actualizada correctamente", "success");
              setView("patient-menu" as ViewMode);
            }}
            onCancel={() => setView("patient-menu" as ViewMode)}
            existingPatients={patients}
            existingPreadmissions={preadmissions}
            prefillContact={prefillContact}
          />
        </div>
      </div>
    );

  const renderBooking = () => {
    if (!activeCenterId || !isValidCenter(activeCenter)) return renderHomeDirectory();

    const getPublicCategory = (doctor: Doctor) =>
      String(doctor.clinicalRole || doctor.specialty || "").trim() || "Otros";

    // Exclude management roles from public booking view
    const NON_BOOKABLE_ROLES = ["ADMIN_CENTRO", "ADMINISTRATIVO"];
    const uniqueRoles = Array.from(new Set(doctors.map((d) => getPublicCategory(d)))).filter(
      (r) => !NON_BOOKABLE_ROLES.includes(String(r))
    );
    const doctorsForRole = selectedRole
      ? doctors.filter(
        (d) => getPublicCategory(d) === selectedRole && d.centerId === activeCenterId
      )
      : [];

    const dateStr = bookingDate.toISOString().split("T")[0];

    const appointmentDoctorUid = (a: Appointment) => (a as any).doctorUid ?? a.doctorId;
    const availableSlotsForDay = appointments
      .filter(
        (a) =>
          appointmentDoctorUid(a) === selectedDoctorForBooking?.id &&
          a.date === dateStr &&
          a.status === "available"
      )
      .map((a) => ({
        time: a.time,
        appointmentId: a.id,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    return renderCenterBackdrop(
      <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-4xl">
          <div className="mb-6">
            <LogoHeader size="md" showText={true} />
          </div>
          <button
            onClick={() => setView("patient-menu" as ViewMode)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-8 bg-white/50 px-4 py-2 rounded-full w-fit transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Volver
          </button>

          {/* Step 0: Rol */}
          {bookingStep === 0 && (
            <div className="animate-fadeIn">
              <h3 className="text-3xl font-bold text-slate-800 mb-8 text-center">
                Selecciona Especialidad
              </h3>
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
                  <p className="text-center text-slate-400 col-span-2">
                    No hay especialistas disponibles.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Profesional */}
          {bookingStep === 1 && (
            <div className="animate-fadeIn">
              <h3 className="text-3xl font-bold text-slate-800 mb-8 text-center">
                Seleccione Profesional
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {doctorsForRole.map((docu) => (
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
                      <span className="font-bold text-indigo-700 text-xl">
                        {docu.fullName?.charAt(0) ?? "?"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-xl text-slate-700 block">
                        {docu.fullName}
                      </span>
                      <span className="text-sm text-slate-500 font-medium">
                        {docu.specialty || getPublicCategory(docu)}
                      </span>
                    </div>
                  </button>
                ))}
                {doctorsForRole.length === 0 && (
                  <div className="col-span-2 text-center text-slate-400">
                    No hay profesionales disponibles para esta especialidad.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Fecha + Horario */}
          {bookingStep === 2 && selectedDoctorForBooking && (
            <div className="animate-fadeIn">
              {!selectedDoctorForBooking.agendaConfig && (
                <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 text-sm font-semibold text-center">
                  Profesional no disponible: no tiene agenda configurada.
                </div>
              )}
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
                  <div>Lun</div>
                  <div>Mar</div>
                  <div>Mie</div>
                  <div>Jue</div>
                  <div>Vie</div>
                  <div>Sab</div>
                  <div>Dom</div>
                </div>

                <div className="grid grid-cols-7 gap-3">
                  {getDaysInMonth(bookingMonth).map((day: Date | null, idx: number) => {
                    if (!day) return <div key={idx} />;
                    const dStr = day.toISOString().split("T")[0];
                    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                    const availableCount = appointments.filter(
                      (a) =>
                        appointmentDoctorUid(a) === selectedDoctorForBooking.id &&
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
                    {bookingDate.toLocaleDateString("es-CL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </h4>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {availableSlotsForDay.map((slot: any) => (
                      <button
                        key={slot.time}
                        onClick={() => {
                          setSelectedSlot({
                            date: dateStr,
                            time: slot.time,
                            appointmentId: slot.appointmentId,
                          });
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
              <h3 className="text-3xl font-bold text-slate-800 mb-6 text-center">
                Confirmar Reserva
              </h3>

              <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-white shadow-xl p-8 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                    RUT Paciente
                  </label>
                  <input
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl font-bold text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                    value={bookingData.rut}
                    onChange={(e) =>
                      setBookingData({ ...bookingData, rut: formatRUT(e.target.value) })
                    }
                    placeholder="12.345.678-9"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                    Nombre Completo
                  </label>
                  <input
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                    value={bookingData.name}
                    onChange={(e) => setBookingData({ ...bookingData, name: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                    Teléfono
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="px-4 py-4 text-base border-2 rounded-2xl border-slate-200 bg-slate-50 text-slate-500 font-bold">
                      +56 9
                    </span>
                    <input
                      className="w-full p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                      value={bookingData.phoneDigits}
                      onChange={(e) =>
                        setBookingData({
                          ...bookingData,
                          phoneDigits: e.target.value.replace(/\D/g, "").slice(0, 8),
                        })
                      }
                      placeholder="12345678"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                    Email (opcional)
                  </label>
                  <input
                    type="email"
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                    value={bookingData.email}
                    onChange={(e) => setBookingData({ ...bookingData, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
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
              <p className="text-slate-500 text-xl">Su hora ha sido agendada correctamente.</p>
              <p className="text-slate-400 mt-3 text-sm">
                Si necesitas anular o cambiar la fecha, usa la opción “Cancelar Hora” en el menú de
                pacientes.
              </p>
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

  const renderHomeBackdrop = (children: React.ReactNode) => (
    <div
      className="home-hero relative min-h-dvh w-full overflow-hidden"
      style={
        {
          "--home-hero-image": `image-set(url("${HOME_BG_SRC}") type("image/webp"), url("${HOME_BG_FALLBACK_SRC}") type("image/png"))`,
        } as React.CSSProperties
      }
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-white/2 to-white/8 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.04),_transparent_55%)] pointer-events-none" />
      <div className="relative z-10 min-h-dvh w-full">{children}</div>
    </div>
  );

  const renderLogin = (isDoc: boolean) => {
    const centerLogoUrl =
      activeCenterId && isValidCenter(activeCenter) ? (activeCenter as any).logoUrl : undefined;
    const content = (
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="flex flex-col items-center gap-6">
          <div
            className={`bg-white/95 backdrop-blur-md p-10 rounded-[2.5rem] shadow-2xl w-full relative transition-all border border-white ${isDoc ? "max-w-4xl" : "max-w-md"}`}
          >
            <button
              onClick={() => setView("center-portal" as ViewMode)}
              className="absolute top-8 left-8 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="flex flex-col gap-10 mt-4">
              <div className="mb-2">
                <LogoHeader size="md" showText={true} className="mx-auto w-fit" />
              </div>
              <h2 className="text-3xl font-bold text-center text-slate-800">
                {isDoc ? "Acceso Profesional" : "Acceso Administrativo"}
              </h2>

              <div className="space-y-6 max-w-sm mx-auto w-full">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-colors font-medium text-slate-700"
                    placeholder="nombre@centro.cl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                {error && (
                  <p className="text-red-500 font-bold text-sm text-center bg-red-50 p-3 rounded-xl border border-red-100">
                    {error}
                  </p>
                )}
                <button
                  onClick={() =>
                    handleSuperAdminLogin(
                      (isDoc ? "doctor-dashboard" : "admin-dashboard") as ViewMode
                    )
                  }
                  className={`w-full py-4 rounded-2xl font-bold text-white text-lg shadow-lg transition-transform active:scale-95 ${isDoc ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-slate-800 hover:bg-slate-900 shadow-slate-200"}`}
                >
                  Ingresar
                </button>

                <button
                  onClick={() =>
                    handleGoogleLogin((isDoc ? "doctor-dashboard" : "admin-dashboard") as ViewMode)
                  }
                  className="w-full py-4 rounded-2xl font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 shadow-lg transition-transform active:scale-95"
                >
                  Continuar con Google
                </button>
              </div>
            </div>
          </div>
          <LegalLinks
            onOpenTerms={() => openLegal("terms")}
            onOpenPrivacy={() => openLegal("privacy")}
          />
        </div>
      </div>
    );

    if (isDoc) return renderCenterBackdrop(content);
    return renderHomeBackdrop(content);
  };

  const renderSuperAdminLogin = () => {
    const content = (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
            <div className="mb-6">
              <LogoHeader size="md" showText={true} className="mb-4" />
            </div>
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
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSuperAdminGoogleLogin}
                className="w-full rounded-xl bg-slate-900 text-white font-bold py-3 hover:bg-slate-800 transition-colors"
              >
                Ingresar con Google
              </button>
            </div>
          </div>
          <LegalLinks
            onOpenTerms={() => openLegal("terms")}
            onOpenPrivacy={() => openLegal("privacy")}
          />
        </div>
      </div>
    );

    return renderHomeBackdrop(content);
  };

  const renderSelectCenter = () => {
    const allowed: string[] = Array.isArray(currentUser?.centros)
      ? currentUser.centros
      : Array.isArray(currentUser?.centers)
        ? currentUser.centers
        : [];
    const available = centers.filter((c) => allowed.includes(c.id));

    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-50">
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
                        <img
                          src={(c as any).logoUrl}
                          alt={`Logo de ${c.name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-700" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold text-slate-900">{c.name}</div>
                      <div className="text-slate-500 text-sm">
                        {c.commune ?? c.region ?? "Chile"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderInviteRegister = () => {
    const isSignup = inviteMode === "signup";
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
            {isSignup ? "Crear cuenta" : "Iniciar sesión"}
          </h2>

          <p className="text-slate-500 text-sm mb-6">
            {inviteCenterName ? (
              <>
                Has sido invitado(a) para administrar{" "}
                <span className="font-bold text-slate-700">{inviteCenterName}</span>.
              </>
            ) : (
              <>Has sido invitado(a) para administrar un centro en ClaveSalud.</>
            )}
          </p>

          {inviteError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {inviteError}
            </div>
          )}

          {inviteDone ? (
            <>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm">
                Invitación aceptada. Ya puedes continuar.
              </div>
              <button
                type="button"
                className="w-full mt-4 rounded-xl bg-sky-600 text-white font-bold py-3 hover:bg-sky-700 transition-colors"
                onClick={() => setView("home" as any)}
              >
                Ir a inicio
              </button>
            </>
          ) : (
            <>
              <label className="block mb-4">
                <span className="text-sm font-semibold text-slate-600">Correo</span>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value.trim().toLowerCase())}
                  type="email"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="correo@dominio.cl"
                  autoComplete="email"
                />
              </label>

              <label className="block mb-5">
                <span className="text-sm font-semibold text-slate-600">Contraseña</span>
                <input
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="••••••••"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
              </label>

              {isSignup && (
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
              )}

              <button
                type="button"
                disabled={inviteLoading || !inviteEmail}
                onClick={async () => {
                  try {
                    setInviteError("");
                    setInviteLoading(true);

                    const token = inviteToken.trim();
                    if (!token) throw new Error("Invitación inválida (sin token).");
                    if (!inviteEmail) throw new Error("Ingresa un correo.");

                    if (isSignup) {
                      if (invitePassword.length < 8)
                        throw new Error("La contraseña debe tener al menos 8 caracteres.");
                      if (invitePassword !== invitePassword2)
                        throw new Error("Las contraseñas no coinciden.");

                      try {
                        const cred = await createUserWithEmailAndPassword(
                          auth,
                          inviteEmail,
                          invitePassword
                        );
                        await acceptInviteForUser(token, cred.user);
                        showToast("Cuenta creada y invitación aceptada", "success");
                      } catch (e: any) {
                        if (e?.code === "auth/email-already-in-use") {
                          setInviteMode("signin");
                          throw new Error(
                            "Este correo ya existe. Inicia sesión para aceptar la invitación."
                          );
                        }
                        if (e?.code === "auth/operation-not-allowed") {
                          throw new Error(
                            "Email/Password no está habilitado en Firebase Auth. Habilítalo en Console → Auth → Método de acceso."
                          );
                        }
                        throw e;
                      }
                    } else {
                      const cred = await signInWithEmailAndPassword(
                        auth,
                        inviteEmail,
                        invitePassword
                      );
                      await acceptInviteForUser(token, cred.user);
                      showToast("Invitación aceptada", "success");
                    }
                  } catch (e: any) {
                    console.error("INVITE FLOW ERROR", e);
                    setInviteError(e?.message || "No se pudo completar la invitación.");
                  } finally {
                    setInviteLoading(false);
                  }
                }}
                className="w-full rounded-xl bg-sky-600 text-white font-bold py-3 hover:bg-sky-700 transition-colors disabled:opacity-50"
              >
                {isSignup ? "Crear cuenta" : "Iniciar sesión"}
              </button>

              <button
                type="button"
                disabled={inviteLoading}
                onClick={async () => {
                  try {
                    setInviteError("");
                    setInviteLoading(true);
                    const token = inviteToken.trim();
                    if (!token) throw new Error("Invitación inválida (sin token).");
                    const prov = new GoogleAuthProvider();
                    const cred = await signInWithPopup(auth, prov);
                    await acceptInviteForUser(token, cred.user);
                    showToast("Invitación aceptada", "success");
                  } catch (e: any) {
                    console.error("INVITE GOOGLE ERROR", e);
                    setInviteError(e?.message || "No se pudo iniciar sesión con Google.");
                  } finally {
                    setInviteLoading(false);
                  }
                }}
                className="w-full mt-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Continuar con Google
              </button>

              <button
                type="button"
                onClick={() => {
                  setInviteError("");
                  setInviteMode(isSignup ? "signin" : "signup");
                }}
                className="w-full mt-3 text-sm text-slate-600 underline underline-offset-4 hover:text-slate-800"
              >
                {isSignup ? "Ya tengo cuenta" : "Quiero crear una cuenta nueva"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setInviteError("");
                  setInviteToken("");
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

  const openLegal = (target: "terms" | "privacy") => {
    setLegalReturnView(view);
    setView(target as ViewMode);
    window.scrollTo(0, 0);
  };

  const renderLegalPage = (title: string, body: string) =>
    renderHomeBackdrop(
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="w-full max-w-3xl bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-white p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">{title}</h2>
            <button
              type="button"
              onClick={() => setView(legalReturnView)}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Volver
            </button>
          </div>
          <div className="prose prose-slate max-w-none text-sm md:text-base whitespace-pre-wrap">
            {body}
          </div>
          <div className="pt-4 border-t border-slate-200">
            <LegalLinks
              onOpenTerms={() => openLegal("terms")}
              onOpenPrivacy={() => openLegal("privacy")}
            />
          </div>
        </div>
      </div>
    );

  const renderCenterBackdrop = (children: React.ReactNode) => (
    <div
      className="center-hero relative min-h-dvh w-full overflow-hidden"
      style={
        {
          "--center-hero-image": `image-set(url("${CENTER_BG_SRC}") type("image/webp"), url("${CENTER_BG_FALLBACK_SRC}") type("image/png"))`,
        } as React.CSSProperties
      }
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-white/2 to-white/8 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,_rgba(14,116,144,0.04),_transparent_55%)] pointer-events-none" />
      <div className="relative z-10 min-h-dvh w-full">{children}</div>
    </div>
  );

  const renderHomeDirectory = () => {
    return (
      <div
        className="home-hero relative min-h-dvh w-full flex flex-col items-center justify-center px-4 py-10 pb-16 overflow-x-hidden"
        style={
          {
            "--home-hero-image": `image-set(url("${HOME_BG_SRC}") type("image/webp"), url("${HOME_BG_FALLBACK_SRC}") type("image/png"))`,
            backgroundAttachment: "fixed",
          } as React.CSSProperties
        }
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-white/2 to-white/8" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.04),_transparent_55%)]" />
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

        <button
          type="button"
          onClick={() => setView("superadmin-login" as ViewMode)}
          className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white/80 backdrop-blur border border-white shadow-lg hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          title="Acceso SuperAdmin"
          aria-label="Acceso SuperAdmin"
        >
          <Lock className="w-5 h-5 text-slate-800" />
        </button>

        <div className="relative z-10 w-full max-w-6xl">
          <div className="text-center mb-10 rounded-3xl bg-white/5 backdrop-blur-md border border-white/15 shadow-[0_24px_50px_rgba(15,23,42,0.12)] px-6 py-10 md:px-12">
            <div className="flex flex-col items-center justify-center gap-3">
              <img
                src={LOGO_SRC}
                alt="ClaveSalud"
                className="h-28 md:h-32 w-auto object-contain drop-shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
              />
              <h1 className="text-4xl md:text-5xl font-extrabold">
                <span className="text-sky-600">Clave</span>
                <span className="text-teal-700">Salud</span>
              </h1>
            </div>
            <p className="text-slate-500 mt-3 text-lg">
              Ficha clínica digital para equipos de salud.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <button
                onClick={() => handleGoogleLogin("doctor-dashboard" as ViewMode)}
                className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 mx-auto"
              >
                <img
                  src={GOOGLE_ICON_SRC}
                  alt="G"
                  className="w-5 h-5 bg-white rounded-full p-0.5"
                />
                Ingreso Rápido (Profesional / Admin)
              </button>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("landing" as ViewMode)}
                  className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-900 font-bold hover:bg-emerald-400"
                >
                  Conoce la plataforma
                </button>
                <button
                  type="button"
                  onClick={() => setView("center-portal" as ViewMode)}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-white"
                >
                  Ingresar al portal
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Ingresa con tu correo y selecciona tu centro después.
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 backdrop-blur-md border border-white/15 shadow-[0_24px_50px_rgba(15,23,42,0.12)] px-5 py-8 md:px-10">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Directorio de centros médicos</h2>
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
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden">
                      {(c as any).logoUrl ? (
                        <img
                          src={(c as any).logoUrl}
                          alt={`Logo de ${c.name}`}
                          className="w-full h-full object-cover"
                        />
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
        <footer className="relative z-10 mt-10">
          <div className="flex flex-col items-center gap-3">
            <LegalLinks
              onOpenTerms={() => openLegal("terms")}
              onOpenPrivacy={() => openLegal("privacy")}
            />
            <button
              type="button"
              onClick={startOnboarding}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Reiniciar tutorial
            </button>
          </div>
        </footer>
      </div>
    );
  };
  const renderByView = () => {
    if (view === ("invite" as any))
      return (
        <CenterContext.Provider value={centerCtxValue}>
          {renderInviteRegister()}
        </CenterContext.Provider>
      );

    if (view === ("center-portal" as ViewMode))
      return (
        <CenterContext.Provider value={centerCtxValue}>
          {renderCenterPortal()}
        </CenterContext.Provider>
      );

    if (view === ("patient-menu" as ViewMode))
      return (
        <CenterContext.Provider value={centerCtxValue}>
          {renderPatientMenu()}
        </CenterContext.Provider>
      );

    if (view === ("patient-cancel" as ViewMode))
      return (
        <CenterContext.Provider value={centerCtxValue}>
          {renderPatientCancel()}
        </CenterContext.Provider>
      );

    if (view === ("patient-form" as ViewMode))
      return (
        <CenterContext.Provider value={centerCtxValue}>
          {renderPatientForm()}
        </CenterContext.Provider>
      );

    if (view === ("patient-booking" as ViewMode))
      return (
        <CenterContext.Provider value={centerCtxValue}>{renderBooking()}</CenterContext.Provider>
      );

    if (view === ("doctor-login" as ViewMode))
      return (
        <CenterContext.Provider value={centerCtxValue}>{renderLogin(true)}</CenterContext.Provider>
      );

    if (view === ("superadmin-login" as ViewMode))
      return (
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
            canUsePreview={isSuperAdminClaim || (import.meta as any)?.env?.DEV === true}
            previewCenterId={previewCenterId}
            previewRole={previewRole}
            onStartPreview={handleStartPreview}
            onExitPreview={handleExitPreview}
            onLogout={() => {
              setCurrentUser(null);
              setActiveCenterId("");
              setView("home" as ViewMode);
            }}
            onOpenLegal={openLegal}
            onUpdateCenters={async (updates) => {
              for (const c of updates) await updateCenter(c as any);
            }}
            onDeleteCenter={async (id, reason) => {
              await deleteCenter(id, reason);
            }}
            onUpdateDoctors={async () => { }}
            hasMoreCenters={hasMoreCenters}
            onLoadMoreCenters={loadMoreCenters}
            isLoadingMoreCenters={isLoadingMoreCenters}
          />
        </CenterContext.Provider>
      );
    }

    if (view === ("admin-login" as ViewMode))
      return (
        <CenterContext.Provider value={centerCtxValue}>{renderLogin(false)}</CenterContext.Provider>
      );

    if (view === ("landing" as ViewMode))
      return <LandingPage onBack={() => setView("home" as ViewMode)} onOpenLegal={openLegal} />;

    if (view === ("terms" as ViewMode)) return renderLegalPage("Términos y Condiciones", termsText);

    if (view === ("privacy" as ViewMode))
      return renderLegalPage("Política de Privacidad", privacyText);

    if (view === ("home" as ViewMode)) return <>{renderHomeDirectory()}</>;

    if (view === ("select-center" as ViewMode))
      return (
        <CenterContext.Provider value={centerCtxValue}>
          {renderSelectCenter()}
        </CenterContext.Provider>
      );

    const previewUser = isPreviewActive
      ? {
        id: authUser?.uid ?? "preview_user",
        uid: authUser?.uid ?? "preview_user",
        email: authUser?.email ?? "preview@demo.cl",
        fullName: authUser?.displayName ?? authUser?.email ?? "Usuario Preview",
        role: previewRole || "MEDICO",
        agendaConfig: { slotDuration: 20, startTime: "09:00", endTime: "18:00" },
        savedTemplates: [],
      }
      : null;

    const userForView = currentUser || previewUser;

    if (view === ("doctor-dashboard" as ViewMode) && userForView) {
      const currentUid = userForView.uid ?? userForView.id;
      const currentEmailLower = String(userForView.email ?? "")
        .trim()
        .toLowerCase();

      // PRIORITIZE EMAIL MATCHING to avoid "UID squatting" from previous tests
      const matchedDoctor =
        doctors.find(
          (doc) =>
            String(doc.email ?? "")
              .trim()
              .toLowerCase() === currentEmailLower
        ) ||
        doctors.find(
          (doc) =>
            String((doc as any).emailLower ?? "")
              .trim()
              .toLowerCase() === currentEmailLower
        ) ||
        doctors.find((doc) => doc.id === currentUid) ||
        doctors.find((doc) => (doc as any).uid === currentUid) ||
        // In preview mode, if we haven't matched by ID/Email, try to match by Role in current center
        (isPreviewActive
          ? doctors.find((doc) => doc.role === previewRole && doc.centerId === activeCenterId)
          : null) ||
        null;

      const resolvedDoctorId = matchedDoctor?.id ?? userForView.id;
      const resolvedDoctorName =
        matchedDoctor?.fullName ?? userForView.fullName ?? userForView.email ?? "Profesional";

      const demoOverride =
        isPreviewActive && demoDoctorOverrides[resolvedDoctorId]
          ? demoDoctorOverrides[resolvedDoctorId]
          : {};

      const mergedCurrentUser = matchedDoctor
        ? ({
          ...userForView,
          ...matchedDoctor,
          ...demoOverride,
          id: resolvedDoctorId,
          // CRITICAL: Preserve the real UID and email from the logged-in user if the staff record is "unclaimed" (uid: null)
          uid: userForView.uid ?? matchedDoctor.uid,
          email: userForView.email ?? matchedDoctor.email,
          fullName: resolvedDoctorName,
        } as any)
        : ({ ...userForView, ...demoOverride } as any);

      const effectiveRole = isPreviewActive ? previewRole : mergedCurrentUser.role;
      return (
        <CenterContext.Provider value={centerCtxValue}>
          <ProfessionalDashboard
            patients={patients}
            doctorName={resolvedDoctorName}
            doctorId={resolvedDoctorId}
            role={effectiveRole}
            agendaConfig={matchedDoctor?.agendaConfig ?? mergedCurrentUser.agendaConfig}
            savedTemplates={matchedDoctor?.savedTemplates ?? mergedCurrentUser.savedTemplates}
            currentUser={mergedCurrentUser}
            doctors={doctors}
            onUpdatePatient={(p: Patient) => {
              if (isPreviewActive) {
                setPatients((prev) => prev.map((pat) => (pat.id === p.id ? p : pat)));
              } else {
                updatePatient(p);
              }
            }}
            onUpdateDoctor={(d: Doctor) => {
              if (isPreviewActive) {
                const targetId = d.id;
                setDemoDoctorOverrides((prev) => ({
                  ...prev,
                  [targetId]: { ...prev[targetId], ...d },
                }));
                showToast("Configuración guardada (Modo Demo - Temporal)", "success");
              } else {
                updateStaff(d);
              }
            }}
            onLogout={handleLogout}
            appointments={appointments}
            onUpdateAppointments={(newAppts: Appointment[]) => {
              setAppointments(newAppts);
              syncAppointments(newAppts);
            }}
            onUpdateAppointment={updateAppointment}
            onDeleteAppointment={deleteAppointment}
            isSyncingAppointments={isSyncingAppointments}
            portfolioMode={portfolioMode}
            onSetPortfolioMode={setPortfolioMode}
            onLogActivity={(event: any) => {
              if (isPreviewActive) {
                console.log("[Demo Log]", event);
                return;
              }
              const log: AuditLogEntry = {
                id: generateId(),
                centerId: activeCenterId,
                timestamp: new Date().toISOString(),
                actorUid: auth.currentUser?.uid ?? userForView.id,
                actorName: userForView.fullName ?? "Usuario",
                actorRole: userForView.role ?? "Profesional",
                action: event.action,
                entityType: event.entityType,
                entityId: event.entityId,
                patientId: event.patientId,
                metadata: event.metadata,
                details: event.details,
              } as any;
              updateAuditLog(log);
            }}
            isReadOnly={isPreviewActive}
            onOpenLegal={openLegal}
          />
        </CenterContext.Provider>
      );
    }

    if (view === ("admin-dashboard" as ViewMode) && userForView) {
      return (
        <CenterContext.Provider value={centerCtxValue}>
          <AdminDashboard
            centerId={activeCenterId}
            doctors={doctors}
            onUpdateDoctors={(newDocs: Doctor[]) => {
              if (isPreviewActive) return;
              newDocs.forEach((d) => updateStaff(d));
            }}
            appointments={appointments}
            onUpdateAppointments={(newAppts: Appointment[]) => {
              if (isPreviewActive) return;
              setAppointments(newAppts);
              syncAppointments(newAppts);
            }}
            isSyncingAppointments={isSyncingAppointments}
            patients={patients}
            onUpdatePatients={(newPatients: Patient[]) => {
              if (isPreviewActive) return;
              newPatients.forEach((p) => updatePatient(p));
            }}
            preadmissions={preadmissions}
            onApprovePreadmission={(p) => {
              if (isPreviewActive) return;
              approvePreadmission(p);
            }}
            onLogout={handleLogout}
            onOpenLegal={openLegal}
            logs={auditLogs}
            onLogActivity={(event) => {
              if (isPreviewActive) return;
              const log: AuditLogEntry = {
                id: generateId(),
                centerId: activeCenterId,
                timestamp: new Date().toISOString(),
                actorUid: auth.currentUser?.uid ?? userForView.id,
                actorName: userForView.fullName ?? "Usuario",
                actorRole: userForView.role ?? "Admin",
                action: event.action,
                entityType: event.entityType,
                entityId: event.entityId,
                patientId: event.patientId,
                metadata: event.metadata,
                details: event.details,
              } as any;
              updateAuditLog(log);
            }}
          />
        </CenterContext.Provider>
      );
    }

    return (
      <CenterContext.Provider value={centerCtxValue}>
        <div className="p-6 text-slate-600">Vista no encontrada</div>
      </CenterContext.Provider>
    );
  };

  return (
    <>
      <Suspense fallback={<PageLoader />}>{renderByView()}</Suspense>
      {isPreviewActive && (
        <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
          <button
            type="button"
            onClick={handleExitPreview}
            className="px-4 py-3 rounded-xl bg-rose-600 text-white font-bold shadow-lg hover:bg-rose-700"
          >
            Salir de Preview
          </button>
        </div>
      )}
      <OnboardingTour
        isOpen={onboardingOpen}
        steps={onboardingSteps}
        currentStep={onboardingStep}
        onNext={() => setOnboardingStep((prev) => Math.min(prev + 1, onboardingSteps.length - 1))}
        onPrev={() => setOnboardingStep((prev) => Math.max(prev - 1, 0))}
        onSkip={skipOnboarding}
        onFinish={finishOnboarding}
      />
      <SupportWidget />
    </>
  );
};

export default App;
