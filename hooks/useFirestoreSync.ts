import { useEffect, useCallback, useMemo } from "react";
import { User } from "firebase/auth";
import {
  Doctor,
  MedicalCenter,
  UserProfile,
  AnyRole,
} from "../types";
import { MOCK_PATIENTS, INITIAL_DOCTORS } from "../constants";
import { hasRole } from "../utils/roles";
import { resolveActiveState } from "../utils/activeState";
import { usePatientsSync } from "./firestoreSync/usePatientsSync";
import { useCenterDataSync } from "./firestoreSync/useCenterDataSync";

export function useFirestoreSync(
  activeCenterId: string,
  authUser: User | null,
  demoMode: boolean,
  isSuperAdminClaim: boolean,
  setCenters?: (centers: MedicalCenter[]) => void,
  currentUser?: UserProfile | null, // Corrected from any
  portfolioMode: "global" | "center" = "global"
) {
  const normalizeClinicalRole = useCallback((data: Record<string, unknown>): string => {
    const clinicalRole = String(
      (data.clinicalRole as string) ?? (data.professionalRole as string) ?? ""
    ).trim();
    if (clinicalRole) return clinicalRole;

    const legacyRole = String((data.role as string) ?? "").trim();
    if (!legacyRole) return "";

    // If it's a known management/access role and we have no explicit clinical role,
    // we return empty to avoid it appearing as a "Specialty" in the booking flow.
    const lower = legacyRole.toLowerCase();
    const managementVariants = [
      "center_admin",
      "admin_centro",
      "admin",
      "superadmin",
      "super_admin",
      "secretaria",
      "administrativo",
      "administrativa",
      "secretary",
      "management",
    ];

    if (managementVariants.includes(lower)) return "";
    return legacyRole;
  }, []);

  const mapStaffToDoctor = useCallback(
    (id: string, payload: Record<string, unknown>): Doctor => {
      const accessRole = String(payload.accessRole ?? "").trim();
      const clinicalRole = normalizeClinicalRole(payload);
      const roleStr = clinicalRole || (payload.role as string)?.trim() || "MEDICO";

      const isActive = resolveActiveState(payload as any);
      const isVisible =
        payload.visibleInBooking === true || (payload.visibleInBooking as any) === "true";

      return {
        id,
        ...(payload as any),
        role: roleStr as AnyRole,
        accessRole:
          accessRole ||
          (String(payload.role ?? "")
            .trim()
            .toLowerCase() === "center_admin"
            ? "center_admin"
            : undefined),
        clinicalRole,
        visibleInBooking: isVisible,
        active: isActive,
      } as Doctor;
    },
    [normalizeClinicalRole]
  );

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.isAdmin === true ||
      hasRole(currentUser.roles, "admin") ||
      hasRole(currentUser.roles, "center_admin")
    );
  }, [currentUser]);

  const isAdminOrStaff = useMemo(() => {
    if (!currentUser && !isSuperAdminClaim) return false;
    return (
      isAdmin ||
      hasRole(currentUser?.roles, "doctor") ||
      hasRole(currentUser?.roles, "staff") ||
      isSuperAdminClaim
    );
  }, [isAdmin, currentUser, isSuperAdminClaim]);

  useEffect(() => {
    if (demoMode) {
      return;
    }
  }, [demoMode, activeCenterId, portfolioMode]);
  const patientSync = usePatientsSync({
    activeCenterId,
    authUser,
    demoMode,
    portfolioMode,
    isAdmin,
  });

  const centerDataSync = useCenterDataSync({
    activeCenterId,
    demoMode,
    isAdminOrStaff,
    mapStaffToDoctor,
  });

  const patients = demoMode ? MOCK_PATIENTS : patientSync.patients;
  const doctors = demoMode ? INITIAL_DOCTORS : centerDataSync.doctors;
  const appointments = demoMode ? [] : centerDataSync.appointments;
  const auditLogs = demoMode ? [] : centerDataSync.auditLogs;
  const preadmissions = demoMode ? [] : centerDataSync.preadmissions;
  const services = demoMode ? [] : centerDataSync.services;

  return {
    patients,
    setPatients: patientSync.setPatients,
    isLoadingPatients: patientSync.isLoadingPatients,
    patientsError: patientSync.patientsError,
    reloadPatients: patientSync.reloadPatients,
    doctors,
    setDoctors: centerDataSync.setDoctors,
    isLoadingDoctors: centerDataSync.isLoadingDoctors,
    doctorsError: centerDataSync.doctorsError,
    appointments,
    setAppointments: centerDataSync.setAppointments,
    isLoadingAppointments: centerDataSync.isLoadingAppointments,
    appointmentsError: centerDataSync.appointmentsError,
    auditLogs,
    setAuditLogs: centerDataSync.setAuditLogs,
    preadmissions,
    setPreadmissions: centerDataSync.setPreadmissions,
    services,
    setServices: centerDataSync.setServices,
    isLoadingServices: centerDataSync.isLoadingServices,
    servicesError: centerDataSync.servicesError,
    reloadCenterData: centerDataSync.reloadCenterData,
  };
}
