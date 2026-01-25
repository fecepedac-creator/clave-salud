import React, { useMemo, useState } from "react";
import { ViewMode } from "./types";
import PatientForm from "./components/PatientForm";
import { ProfessionalDashboard } from "./components/DoctorDashboard";
import AdminDashboard from "./components/AdminDashboard";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import { useToast } from "./components/Toast";
import { CenterContext } from "./CenterContext";
import { useAuth } from "./hooks/useAuth";
import { useCenters } from "./hooks/useCenters";
import { useFirestoreSync } from "./hooks/useFirestoreSync";
import { useInvite } from "./hooks/useInvite";
import { useBooking } from "./hooks/useBooking";
import { useCrudOperations } from "./hooks/useCrudOperations";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";
import { ErrorMessage } from "./components/ui/ErrorMessage";
import { BackgroundImage } from "./components/ui/BackgroundImage";

// Import render functions from the existing App.tsx
// These will be extracted later or kept inline with minimal changes

const ASSET_BASE = (import.meta as any)?.env?.BASE_URL ?? "/";
const LOGO_SRC = `${ASSET_BASE}assets/logo.png`;
const HOME_BG_SRC = `${ASSET_BASE}assets/fondo%20principal.webp`;
const CENTER_BG_SRC = `${ASSET_BASE}assets/Fondo%202.webp`;
const HOME_BG_FALLBACK_SRC = `${ASSET_BASE}assets/home-bg.png`;
const CENTER_BG_FALLBACK_SRC = `${ASSET_BASE}assets/background.png.png`;

const App: React.FC = () => {
  const { showToast } = useToast();

  // View state (not covered by hooks)
  const [demoMode, setDemoMode] = useState(false);
  const [view, setView] = useState<ViewMode>("home" as ViewMode);
  const [postCenterSelectView, setPostCenterSelectView] = useState<ViewMode>("admin-dashboard" as ViewMode);
  const [isSyncingAppointments, setIsSyncingAppointments] = useState(false);

  // Auth hook
  const auth = useAuth();
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
    handleSuperAdminLogin,
    handleSuperAdminGoogleLogin,
    handleGoogleLogin,
    handleLogout,
    bootstrapSuperAdmin,
    handleSuperAdminUnauthorized,
    handleRedirectResult,
  } = auth;

  // Centers hook
  const centers = useCenters(demoMode, isSuperAdminClaim);
  const {
    centers: centersList,
    setCenters,
    activeCenterId,
    setActiveCenterId,
    activeCenter,
    updateModules,
  } = centers;

  // Firestore sync hook
  const firestoreSync = useFirestoreSync(
    activeCenterId,
    authUser,
    demoMode,
    isSuperAdminClaim,
    setCenters
  );
  const {
    patients,
    setPatients,
    doctors,
    setDoctors,
    appointments,
    setAppointments,
    auditLogs,
    setAuditLogs,
    preadmissions,
    setPreadmissions,
  } = firestoreSync;

  // CRUD operations hook
  const crud = useCrudOperations(activeCenterId, appointments, showToast);
  const {
    updatePatient,
    deletePatient,
    updateStaff,
    deleteStaff,
    updateAppointment,
    deleteAppointment,
    syncAppointments: syncAppointmentsBase,
    updateAuditLog,
    updateCenter,
    deleteCenter,
    createPreadmission,
    approvePreadmission,
  } = crud;

  // Wrap syncAppointments to include the isSyncingAppointments state
  const syncAppointments = async (nextAppointments: any[]) => {
    await syncAppointmentsBase(nextAppointments, setIsSyncingAppointments);
  };

  // Booking hook
  const booking = useBooking(
    activeCenterId,
    appointments,
    patients,
    doctors,
    updateAppointment,
    setAppointments,
    showToast
  );
  const {
    bookingStep,
    setBookingStep,
    bookingData,
    setBookingData,
    prefillContact,
    setPrefillContact,
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
    setCancelResults,
    handleBookingConfirm,
    resetBooking,
    handleLookupAppointments,
    cancelPatientAppointment,
    handleReschedule,
  } = booking;

  // Invite hook
  const invite = useInvite();
  const {
    inviteToken,
    setInviteToken,
    inviteLoading,
    inviteError,
    setInviteError,
    inviteEmail,
    setInviteEmail,
    inviteCenterId,
    setInviteCenterId,
    inviteCenterName,
    setInviteCenterName,
    invitePassword,
    setInvitePassword,
    invitePassword2,
    setInvitePassword2,
    inviteMode,
    setInviteMode,
    inviteDone,
    setInviteDone,
    acceptInviteForUser,
  } = invite;

  // CenterContext value
  const centerContextValue = useMemo(
    () => ({
      centerId: activeCenterId,
      activeCenter: activeCenter || null,
      modules: activeCenter?.modules || {},
      updateModules,
    }),
    [activeCenterId, activeCenter, updateModules]
  );

  // All render functions would go here
  // For now, we'll include placeholders and the main router
  // The actual render functions from the original App.tsx will be included
  // but they'll reference the hook state instead of local state

  // TODO: Import all render functions from original App.tsx
  // renderCenterPortal, renderPatientMenu, renderPatientCancel, 
  // renderPatientForm, renderBooking, renderHomeBackdrop, 
  // renderLogin, renderSuperAdminLogin, renderSelectCenter, 
  // renderInviteRegister, renderHomeDirectory, renderCenterBackdrop

  const renderByView = () => {
    // This is the main router - will be populated with actual render functions
    switch (view) {
      case "home":
        return <div>Home View - To be implemented</div>;
      case "superadmin-dashboard":
        return (
          <SuperAdminDashboard
            centers={centersList}
            onUpdateCenter={updateCenter}
            onDeleteCenter={deleteCenter}
            onLogout={handleLogout}
            onBack={() => setView("home" as ViewMode)}
          />
        );
      case "admin-dashboard":
        return (
          <AdminDashboard
            patients={patients}
            doctors={doctors}
            appointments={appointments}
            auditLogs={auditLogs}
            preadmissions={preadmissions}
            onUpdatePatient={updatePatient}
            onDeletePatient={deletePatient}
            onUpdateStaff={updateStaff}
            onDeleteStaff={deleteStaff}
            onUpdateAppointment={updateAppointment}
            onDeleteAppointment={deleteAppointment}
            onSyncAppointments={syncAppointments}
            onUpdateAuditLog={updateAuditLog}
            isSyncingAppointments={isSyncingAppointments}
            onLogout={handleLogout}
            onBack={() => setView("center-portal" as ViewMode)}
            onApprovePreadmission={approvePreadmission}
          />
        );
      case "doctor-dashboard":
        return (
          <ProfessionalDashboard
            currentUser={currentUser}
            patients={patients}
            appointments={appointments}
            onUpdatePatient={updatePatient}
            onUpdateAppointment={updateAppointment}
            onLogout={handleLogout}
            onBack={() => setView("center-portal" as ViewMode)}
          />
        );
      // Add other view cases here
      default:
        return <div>View not implemented: {view}</div>;
    }
  };

  return (
    <CenterContext.Provider value={centerContextValue}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {renderByView()}
      </div>
    </CenterContext.Provider>
  );
};

export default App;
