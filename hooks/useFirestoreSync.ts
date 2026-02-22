import { useState, useEffect, useCallback, useMemo } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  DocumentData,
  limit,
  onSnapshot,
  orderBy,
  QuerySnapshot,
  query,
  where,
  or,
} from "firebase/firestore";
import { User } from "firebase/auth";
import { Patient, Doctor, Appointment, AuditLogEntry, Preadmission, MedicalCenter, UserProfile, AnyRole } from "../types";
import { MOCK_PATIENTS, INITIAL_DOCTORS } from "../constants";
import { hasRole } from "../utils/roles";

export function useFirestoreSync(
  activeCenterId: string,
  authUser: User | null,
  demoMode: boolean,
  isSuperAdminClaim: boolean,
  setCenters?: (centers: MedicalCenter[]) => void,
  currentUser?: UserProfile | null, // Corrected from any
  portfolioMode: "global" | "center" = "global"
) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [preadmissions, setPreadmissions] = useState<Preadmission[]>([]);
  const normalizeClinicalRole = useCallback((data: Record<string, unknown>): string => {
    const clinicalRole = String(
      (data.clinicalRole as string) ?? (data.professionalRole as string) ?? ""
    ).trim();
    if (clinicalRole) return clinicalRole;
    const legacyRole = String((data.role as string) ?? "").trim();
    if (!legacyRole) return "";
    const lower = legacyRole.toLowerCase();
    return lower === "center_admin" ? "" : legacyRole;
  }, []);

  const mapStaffToDoctor = useCallback(
    (id: string, payload: Record<string, unknown>): Doctor => {
      const accessRole = String(payload.accessRole ?? "").trim();
      const clinicalRole = normalizeClinicalRole(payload);
      const roleStr = clinicalRole || (payload.role as string)?.trim() || "MEDICO";

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
        visibleInBooking: payload.visibleInBooking === true,
        active: payload.active !== false && payload.activo !== false,
      } as Doctor;
    },
    [normalizeClinicalRole]
  );

  const isAdminRole = useMemo(() => {
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
      isAdminRole ||
      hasRole(currentUser?.roles, "doctor") ||
      hasRole(currentUser?.roles, "staff") ||
      isSuperAdminClaim
    );
  }, [isAdminRole, currentUser, isSuperAdminClaim]);

  // 1. Reset / Demo Mode Effect
  useEffect(() => {
    if (demoMode) {
      setPatients(MOCK_PATIENTS);
      setDoctors(INITIAL_DOCTORS);
      setAppointments([]);
      setAuditLogs([]);
      setPreadmissions([]);
      return;
    }

    if (!activeCenterId && portfolioMode === "center") {
      setPatients([]);
      setDoctors([]);
      setAppointments([]);
      setAuditLogs([]);
      setPreadmissions([]);
    }
  }, [demoMode, activeCenterId, portfolioMode]);

  // 2. Centers Effect (SuperAdmin)
  useEffect(() => {
    if (demoMode) return;
    if (!isSuperAdminClaim || !setCenters) return;

    const unsub = onSnapshot(
      collection(db, "centers"),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as MedicalCenter[];
        setCenters(items);
      },
      (error) => {
        console.error("Firestore centers subscription error:", error);
      }
    );
    return () => unsub();
  }, [demoMode, isSuperAdminClaim, setCenters]);

  // 3. Patients Effect
  useEffect(() => {
    if (demoMode) return;
    const currentUid = authUser?.uid;
    if (!currentUid) {
      setPatients([]);
      return;
    }

    if (!activeCenterId && portfolioMode === "center") {
      return;
    }

    let patientsQuery;
    if (isAdminRole && activeCenterId && portfolioMode === "center") {
      // Admin View: Everything in this center
      patientsQuery = query(
        collection(db, "patients"),
        where("accessControl.centerIds", "array-contains", activeCenterId),
        orderBy("lastUpdated", "desc"),
        limit(400)
      );
    } else if (portfolioMode === "global") {
      // Professional View: Their global carter (all centers)
      patientsQuery = query(
        collection(db, "patients"),
        where("accessControl.allowedUids", "array-contains", currentUid),
        orderBy("lastUpdated", "desc"),
        limit(400)
      );
    } else {
      // Professional View: Their patients in THIS center
      patientsQuery = query(
        collection(db, "patients"),
        where("accessControl.allowedUids", "array-contains", currentUid),
        where("accessControl.centerIds", "array-contains", activeCenterId),
        orderBy("lastUpdated", "desc"),
        limit(400)
      );
    }

    const unsub = onSnapshot(
      patientsQuery,
      (snap: QuerySnapshot<DocumentData>) => {
        const pts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Patient[];
        setPatients(pts);
      },
      () => setPatients([])
    );

    return () => unsub();
  }, [demoMode, authUser?.uid, activeCenterId, portfolioMode, isAdminRole]);

  // 4. Center Data Effect (Staff, Appointments, Logs, Preadmissions)
  useEffect(() => {
    if (demoMode || !activeCenterId) return;

    const doctorsCollection = isAdminOrStaff
      ? collection(db, "centers", activeCenterId, "staff")
      : collection(db, "centers", activeCenterId, "publicStaff");

    const unsubDoctors = onSnapshot(
      doctorsCollection,
      (snap) => {
        const items = snap.docs.map((d) => mapStaffToDoctor(d.id, d.data() as any));
        const filtered = auth.currentUser
          ? items.filter((doctor) => doctor.active !== false)
          : items.filter((doctor) => doctor.active !== false && doctor.visibleInBooking === true);
        setDoctors(filtered);
      },
      () => setDoctors([])
    );

    const apptCollection = collection(db, "centers", activeCenterId, "appointments");
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    const baseApptQuery = [
      where("date", ">=", startDateStr),
      where("date", "<=", endDateStr),
      orderBy("date", "asc"),
      orderBy("time", "asc"),
      limit(500),
    ];

    const apptQuery = auth.currentUser
      ? query(apptCollection, ...baseApptQuery)
      : query(apptCollection, where("status", "==", "available"), ...baseApptQuery);

    const unsubAppts = onSnapshot(
      apptQuery,
      (snap) =>
        setAppointments(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Appointment[]
        ),
      (error) => {
        console.error("appointments snapshot error", error);
        setAppointments([]);
      }
    );

    const logsCollection = collection(db, "centers", activeCenterId, "auditLogs");
    const logsQuery = query(logsCollection, orderBy("timestamp", "desc"), limit(50));
    const fallbackLogsQuery = query(logsCollection, orderBy("createdAt", "desc"), limit(50));

    let unsubLogs: () => void;
    let usingFallback = false;

    const handleLogsSnapshot = (snap: QuerySnapshot<DocumentData>) =>
      setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AuditLogEntry[]);

    const unsubPrimaryLogs = onSnapshot(logsQuery, handleLogsSnapshot, () => {
      if (usingFallback) return;
      usingFallback = true;
      unsubLogs = onSnapshot(fallbackLogsQuery, handleLogsSnapshot, () => setAuditLogs([]));
    });

    unsubLogs = unsubPrimaryLogs;

    const unsubPreadmissions = onSnapshot(
      collection(db, "centers", activeCenterId, "preadmissions"),
      (snap) =>
        setPreadmissions(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Preadmission[]
        ),
      () => setPreadmissions([])
    );

    return () => {
      unsubDoctors();
      unsubAppts();
      unsubLogs();
      unsubPreadmissions();
    };
  }, [demoMode, activeCenterId, isAdminOrStaff, mapStaffToDoctor]);

  return {
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
  };
}
