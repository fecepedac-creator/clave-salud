import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Patient, Doctor, Appointment, AuditLogEntry, Preadmission, MedicalCenter } from "../types";
import { MOCK_PATIENTS, INITIAL_DOCTORS } from "../constants";

export function useFirestoreSync(
  activeCenterId: string,
  authUser: any,
  demoMode: boolean,
  isSuperAdminClaim: boolean,
  setCenters?: (centers: MedicalCenter[]) => void
) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [preadmissions, setPreadmissions] = useState<Preadmission[]>([]);

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

    if (!activeCenterId) {
      setPatients([]);
      setDoctors([]);
      setAppointments([]);
      setAuditLogs([]);
      setPreadmissions([]);
      return () => {
        unsubCenters?.();
      };
    }

    const patientsQuery = query(
      collection(db, "centers", activeCenterId, "patients"),
      orderBy("lastUpdated", "desc"),
      limit(400)
    );
    const unsubPatients = onSnapshot(
      patientsQuery,
      (snap) =>
        setPatients(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Patient[]),
      () => setPatients([])
    );

    const doctorsCollection = auth.currentUser
      ? collection(db, "centers", activeCenterId, "staff")
      : collection(db, "centers", activeCenterId, "publicStaff");
    const unsubDoctors = onSnapshot(
      doctorsCollection,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Doctor[];
        const activeOnly = items.filter(
          (doctor) => doctor.active !== false && (doctor as any).activo !== false
        );
        setDoctors(activeOnly);
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

    const logsQuery = query(
      collection(db, "centers", activeCenterId, "auditLogs"),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    const unsubLogs = onSnapshot(
      logsQuery,
      (snap) =>
        setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AuditLogEntry[]),
      () => setAuditLogs([])
    );

    const unsubPreadmissions = onSnapshot(
      collection(db, "centers", activeCenterId, "preadmissions"),
      (snap) =>
        setPreadmissions(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Preadmission[]
        ),
      () => setPreadmissions([])
    );

    return () => {
      unsubCenters?.();
      unsubPatients();
      unsubDoctors();
      unsubAppts();
      unsubLogs();
      unsubPreadmissions();
    };
  }, [activeCenterId, authUser, demoMode, isSuperAdminClaim, setCenters]);

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
