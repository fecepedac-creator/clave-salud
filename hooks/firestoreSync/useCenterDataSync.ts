import { useEffect, useState } from "react";
import {
  collection,
  DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import {
  Appointment,
  AuditLogEntry,
  Doctor,
  MedicalService,
  Preadmission,
} from "../../types";
import { resolveActiveState } from "../../utils/activeState";

type UseCenterDataSyncParams = {
  activeCenterId: string;
  demoMode: boolean;
  isAdminOrStaff: boolean;
  mapStaffToDoctor: (id: string, payload: Record<string, unknown>) => Doctor;
};

export function useCenterDataSync({
  activeCenterId,
  demoMode,
  isAdminOrStaff,
  mapStaffToDoctor,
}: UseCenterDataSyncParams) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [preadmissions, setPreadmissions] = useState<Preadmission[]>([]);
  const [services, setServices] = useState<MedicalService[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [doctorsError, setDoctorsError] = useState("");
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (demoMode || !activeCenterId) return;
    setIsLoadingDoctors(true);
    setDoctorsError("");
    setIsLoadingAppointments(true);
    setAppointmentsError("");
    setIsLoadingServices(true);
    setServicesError("");

    const doctorsCollection = isAdminOrStaff
      ? collection(db, "centers", activeCenterId, "staff")
      : collection(db, "centers", activeCenterId, "publicStaff");

    const unsubDoctors = onSnapshot(
      doctorsCollection,
      (snap) => {
        const items = snap.docs.map((d) => mapStaffToDoctor(d.id, d.data() as any));
        const filtered = auth.currentUser
          ? items.filter((doctor) => resolveActiveState(doctor as any))
          : items.filter(
              (doctor) => resolveActiveState(doctor as any) && doctor.visibleInBooking === true
            );

        setDoctors(filtered);
        setIsLoadingDoctors(false);
        setDoctorsError("");
      },
      (error) => {
        console.error("[useFirestoreSync] doctors error:", error);
        setDoctors([]);
        setIsLoadingDoctors(false);
        setDoctorsError("No pudimos cargar el equipo del centro.");
      }
    );

    const apptCollection = collection(db, "centers", activeCenterId, "appointments");
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (auth.currentUser ? 180 : 90));
    const endDateStr = endDate.toISOString().split("T")[0];

    const apptQuery = auth.currentUser
      ? query(
          apptCollection,
          where("date", ">=", startDateStr),
          where("date", "<=", endDateStr),
          orderBy("date", "asc"),
          orderBy("time", "asc"),
          limit(1200)
        )
      : query(
          apptCollection,
          where("status", "==", "available"),
          where("date", ">=", startDateStr),
          where("date", "<=", endDateStr),
          orderBy("date", "asc"),
          orderBy("time", "asc"),
          limit(600)
        );

    const unsubAppts = onSnapshot(
      apptQuery,
      (snap) => {
        const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Appointment[];
        const filtered = raw
          .filter((a) => resolveActiveState(a as any))
          .filter((a) => a.date >= startDateStr)
          .sort((a, b) => {
            const dateCompare = (a.date || "").localeCompare(b.date || "");
            if (dateCompare !== 0) return dateCompare;
            return (a.time || "").localeCompare(b.time || "");
          });
        setAppointments(filtered);
        setIsLoadingAppointments(false);
        setAppointmentsError("");
      },
      (error) => {
        console.error("appointments snapshot error", error);
        setAppointments([]);
        setIsLoadingAppointments(false);
        setAppointmentsError("No pudimos sincronizar la agenda del centro.");
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

    const unsubServices = onSnapshot(
      query(collection(db, "centers", activeCenterId, "services"), where("active", "==", true)),
      (snap) => {
        const rawServices = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as MedicalService[];
        const filteredServices = auth.currentUser
          ? rawServices
          : rawServices.filter((s) => s.isAgendable !== false);
        setServices(filteredServices);
        setIsLoadingServices(false);
        setServicesError("");
      },
      (error) => {
        console.error("services snapshot error", error);
        setServices([]);
        setIsLoadingServices(false);
        setServicesError("No pudimos cargar las prestaciones del centro.");
      }
    );

    return () => {
      unsubDoctors();
      unsubAppts();
      unsubLogs();
      unsubPreadmissions();
      unsubServices();
    };
  }, [demoMode, activeCenterId, isAdminOrStaff, mapStaffToDoctor, reloadToken]);

  return {
    doctors,
    setDoctors,
    appointments,
    setAppointments,
    auditLogs,
    setAuditLogs,
    preadmissions,
    setPreadmissions,
    services,
    setServices,
    isLoadingDoctors,
    doctorsError,
    isLoadingAppointments,
    appointmentsError,
    isLoadingServices,
    servicesError,
    reloadCenterData: () => setReloadToken((prev) => prev + 1),
  };
}
