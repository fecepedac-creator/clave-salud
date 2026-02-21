import { useState, useEffect } from "react";
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
import { Patient, Doctor, Appointment, AuditLogEntry, Preadmission, MedicalCenter } from "../types";
import { MOCK_PATIENTS, INITIAL_DOCTORS } from "../constants";

export function useFirestoreSync(
  activeCenterId: string,
  authUser: any,
  demoMode: boolean,
  isSuperAdminClaim: boolean,
  setCenters?: (centers: MedicalCenter[]) => void,
  currentUser?: any, // NEW: Need roles to decide which collection to read
  portfolioMode: "global" | "center" = "global"
) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [preadmissions, setPreadmissions] = useState<Preadmission[]>([]);
  const isActiveRecord = (data: any) => data?.active !== false && data?.activo !== false;
  const normalizeClinicalRole = (data: any): string => {
    const clinicalRole = String(data?.clinicalRole ?? data?.professionalRole ?? "").trim();
    if (clinicalRole) return clinicalRole;
    const legacyRole = String(data?.role ?? "").trim();
    if (!legacyRole) return "";
    const lower = legacyRole.toLowerCase();
    return lower === "center_admin" ? "" : legacyRole;
  };
  const mapStaffToDoctor = (id: string, payload: any): Doctor => {
    const accessRole = String(payload?.accessRole ?? "").trim();
    const clinicalRole = normalizeClinicalRole(payload);
    const role = (clinicalRole || String(payload?.role ?? "").trim() || "Medico") as any;
    return {
      id,
      ...(payload as any),
      role,
      accessRole: accessRole || (String(payload?.role ?? "").trim().toLowerCase() === "center_admin" ? "center_admin" : undefined),
      clinicalRole,
      visibleInBooking: payload?.visibleInBooking === true,
      active: payload?.active !== false && payload?.activo !== false,
    } as Doctor;
  };

  useEffect(() => {
    let unsubCenters: (() => void) | null = null;

    if (demoMode) {
      setPatients(MOCK_PATIENTS);
      setDoctors(INITIAL_DOCTORS);
      setAppointments([]);
      setAuditLogs([]);
      return;
    }

    if (isSuperAdminClaim && setCenters) {
      unsubCenters = onSnapshot(
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
    }

    if (!activeCenterId && portfolioMode === "center") {
      setPatients([]);
      setDoctors([]);
      setAppointments([]);
      setAuditLogs([]);
      setPreadmissions([]);
      return () => {
        unsubCenters?.();
      };
    }

    // ==========================================
    // PATIENT PORTFOLIO: Handle Global vs Center
    // ==========================================
    const isAdminRole =
      currentUser?.isAdmin === true ||
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("center_admin") ||
      currentUser?.roles?.includes("ADMIN_CENTRO") ||
      currentUser?.roles?.includes("ADMINISTRATIVO");

    const currentUid = authUser?.uid;

    let patientsQuery;
    if (currentUid) {
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
    } else {
      setPatients([]);
      patientsQuery = null;
    }

    const unsubPatients = patientsQuery
      ? onSnapshot(
        patientsQuery,
        (snap: QuerySnapshot<DocumentData>) => {
          const pts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Patient[];
          setPatients(pts);
        },
        () => setPatients([])
      )
      : () => { };

    // FIX: Only admins/staff should read from "staff" (protected).
    const isAdminOrStaff =
      currentUser?.isAdmin === true ||
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("center_admin") ||
      currentUser?.roles?.includes("doctor") ||
      currentUser?.roles?.includes("staff") ||
      isSuperAdminClaim;

    let unsubDoctors = () => { };
    let unsubAppts = () => { };
    let unsubLogs = () => { };
    let unsubPreadmissions = () => { };

    if (!activeCenterId) {
      setDoctors([]);
      setAppointments([]);
      setAuditLogs([]);
      setPreadmissions([]);
    } else {
      const doctorsCollection = isAdminOrStaff
        ? collection(db, "centers", activeCenterId, "staff")
        : collection(db, "centers", activeCenterId, "publicStaff");

      unsubDoctors = onSnapshot(
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

      unsubAppts = onSnapshot(
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
      let usingFallback = false;
      const handleLogsSnapshot = (snap: QuerySnapshot<DocumentData>) =>
        setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AuditLogEntry[]);

      const unsubPrimaryLogs = onSnapshot(logsQuery, handleLogsSnapshot, () => {
        if (usingFallback) return;
        usingFallback = true;
        unsubLogs = onSnapshot(fallbackLogsQuery, handleLogsSnapshot, () => setAuditLogs([]));
      });
      unsubLogs = unsubPrimaryLogs;

      unsubPreadmissions = onSnapshot(
        collection(db, "centers", activeCenterId, "preadmissions"),
        (snap) =>
          setPreadmissions(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Preadmission[]
          ),
        () => setPreadmissions([])
      );
    }

    return () => {
      unsubCenters?.();
      unsubPatients();
      unsubDoctors();
      unsubAppts();
      unsubLogs();
      unsubPreadmissions();
    };
  }, [activeCenterId, authUser, demoMode, isSuperAdminClaim, setCenters, currentUser]);

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
