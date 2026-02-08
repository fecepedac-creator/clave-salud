import { useCallback } from "react";
import { db, auth } from "../firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Patient, Doctor, Appointment, AuditLogEntry, MedicalCenter, Preadmission } from "../types";
import { generateId } from "../utils";
import { logAuditEventSafe } from "./useAuditLog";

export function useCrudOperations(
  activeCenterId: string,
  appointments: Appointment[],
  showToast: (message: string, type: "success" | "error" | "info" | "warning") => void
) {
  const ARCHIVE_WARNING =
    "Por normativa, la ficha clínica debe conservarse por al menos 15 años. Archivar no elimina definitivamente.";
  const RETENTION_YEARS = 15;

  const requestDeleteReason = (label: string) => {
    const selection = window.prompt(
      `${ARCHIVE_WARNING}\n\nMotivo para archivar ${label}:\n1) Duplicado\n2) Error administrativo\n3) Solicitud del paciente (Ley 19.628)\n4) Otro (especificar)\n\nEscribe el número o un motivo libre:`
    );
    if (!selection || !selection.trim()) {
      showToast("Debes indicar un motivo para archivar.", "warning");
      return null;
    }
    const normalized = selection.trim();
    if (normalized === "1") return "Duplicado";
    if (normalized === "2") return "Error administrativo";
    if (normalized === "3") return "Solicitud del paciente (Ley 19.628)";
    if (normalized === "4") {
      const other = window.prompt("Especifica el motivo:");
      if (!other || !other.trim()) {
        showToast("Debes indicar un motivo para archivar.", "warning");
        return null;
      }
      return `Otro: ${other.trim()}`;
    }
    return normalized;
  };

  const isOverRetention = (createdAt?: any) => {
    if (!createdAt) return false;
    const createdDate =
      typeof createdAt?.toDate === "function" ? createdAt.toDate() : new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) return false;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
    return createdDate <= cutoff;
  };

  const requireCenter = useCallback(
    (actionLabel: string) => {
      if (!activeCenterId) {
        showToast(`Selecciona un centro para ${actionLabel}.`, "warning");
        return false;
      }
      return true;
    },
    [activeCenterId, showToast]
  );

  const updatePatient = useCallback(
    async (payload: Patient) => {
      if (!requireCenter("guardar pacientes")) return;
      const id = payload?.id ?? generateId();
      const ref = doc(db, "centers", activeCenterId, "patients", id);
      const existingSnap = await getDoc(ref);
      await setDoc(
        ref,
        {
          ...payload,
          id,
          centerId: activeCenterId,
          createdAt: payload.createdAt ?? serverTimestamp(),
        },
        { merge: true }
      );
      await updateAuditLog({
        id: generateId(),
        centerId: activeCenterId,
        actorUid: auth.currentUser?.uid ?? "unknown",
        actorName: auth.currentUser?.displayName ?? "Usuario",
        actorRole: "staff",
        action: existingSnap.exists() ? "PATIENT_UPDATE" : "PATIENT_CREATE",
        entityType: "patient",
        entityId: id,
        patientId: id,
        details: existingSnap.exists()
          ? "Actualización de ficha clínica."
          : "Creación de ficha clínica.",
      });
    },
    [activeCenterId, requireCenter, updateAuditLog]
  );

  const updateAuditLog = useCallback(
    async (payload: AuditLogEntry) => {
      if (!requireCenter("registrar auditoría")) return;
      const id = payload?.id ?? generateId();
      const event = {
        centerId: activeCenterId,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        patientId: payload.patientId,
        details: payload.details,
        metadata: payload.metadata,
      };

      await logAuditEventSafe(event);

      return {
        id,
        ...payload,
        centerId: activeCenterId,
      };
    },
    [activeCenterId, requireCenter, updateAuditLog]
  );

  const deletePatient = useCallback(
    async (id: string) => {
      if (!requireCenter("archivar pacientes")) return;
      const patientSnap = await getDoc(doc(db, "centers", activeCenterId, "patients", id));
      const patientData = patientSnap.exists() ? (patientSnap.data() as any) : null;
      const fallbackConsultations: any[] = Array.isArray(patientData?.consultations)
        ? patientData.consultations
        : [];
      const oldestConsultation = fallbackConsultations
        .map((c) => new Date(c?.date || ""))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const retentionDate = patientData?.createdAt ?? oldestConsultation;
      if (isOverRetention(retentionDate)) {
        showToast(
          "Este registro supera 15 años. Por normativa no puede archivarse desde la plataforma. Contacte al administrador.",
          "warning"
        );
        await updateAuditLog({
          id: generateId(),
          centerId: activeCenterId,
          actorUid: auth.currentUser?.uid ?? "unknown",
          actorName: auth.currentUser?.displayName ?? "Usuario",
          actorRole: "staff",
          action: "ARCHIVE_BLOCKED_RETENTION",
          entityType: "patient",
          entityId: id,
          patientId: id,
          details: "Intento de archivo bloqueado por retención (15 años).",
          metadata: { reason: "RETENTION_15Y" },
        });
        return;
      }
      const reason = requestDeleteReason("este paciente");
      if (!reason) return;
      await updateDoc(doc(db, "centers", activeCenterId, "patients", id), {
        active: false,
        deletedAt: serverTimestamp(),
        deletedBy: auth.currentUser?.uid ?? "unknown",
        deleteReason: reason,
      });
      await updateAuditLog({
        id: generateId(),
        centerId: activeCenterId,
        actorUid: auth.currentUser?.uid ?? "unknown",
        actorName: auth.currentUser?.displayName ?? "Usuario",
        actorRole: "staff",
        action: "PATIENT_ARCHIVE",
        entityType: "patient",
        entityId: id,
        patientId: id,
        details: "Archivo de ficha clínica.",
        metadata: { deleteReason: reason },
      });
    },
    [activeCenterId, requireCenter, requestDeleteReason, updateAuditLog]
  );

  const updateStaff = useCallback(
    async (payload: Doctor) => {
      if (!requireCenter("guardar profesionales")) return;
      const id = payload?.id ?? generateId();
      await setDoc(
        doc(db, "centers", activeCenterId, "staff", id),
        { ...payload, id, centerId: activeCenterId },
        { merge: true }
      );
      await setDoc(
        doc(db, "centers", activeCenterId, "publicStaff", id),
        {
          id,
          centerId: activeCenterId,
          fullName: payload.fullName ?? "",
          role: payload.role ?? "",
          specialty: payload.specialty ?? "",
          photoUrl: payload.photoUrl ?? "",
          agendaConfig: payload.agendaConfig ?? null,
          active: payload.active ?? true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    [activeCenterId, requireCenter]
  );

  const deleteStaff = useCallback(
    async (id: string) => {
      if (!requireCenter("eliminar profesionales")) return;
      await setDoc(
        doc(db, "centers", activeCenterId, "staff", id),
        { active: false, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() },
        { merge: true }
      );
      await setDoc(
        doc(db, "centers", activeCenterId, "publicStaff", id),
        { active: false, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() },
        { merge: true }
      );
    },
    [activeCenterId, requireCenter]
  );

  const updateAppointment = useCallback(
    async (payload: Appointment) => {
      if (!requireCenter("guardar citas")) return;
      const id = payload?.id ?? generateId();
      const ref = doc(db, "centers", activeCenterId, "appointments", id);
      const existingSnap = await getDoc(ref);
      const doctorUid = (payload as any).doctorUid ?? payload.doctorId;
      await setDoc(
        ref,
        {
          ...payload,
          doctorUid,
          id,
          centerId: activeCenterId,
          createdAt: payload.createdAt ?? serverTimestamp(),
        },
        { merge: true }
      );
      await updateAuditLog({
        id: generateId(),
        centerId: activeCenterId,
        actorUid: auth.currentUser?.uid ?? "unknown",
        actorName: auth.currentUser?.displayName ?? "Usuario",
        actorRole: "staff",
        action: existingSnap.exists() ? "APPOINTMENT_UPDATE" : "APPOINTMENT_CREATE",
        entityType: "appointment",
        entityId: id,
        patientId: payload.patientId,
        details: existingSnap.exists() ? "Actualización de cita." : "Creación de cita.",
      });
    },
    [activeCenterId, requireCenter]
  );

  const deleteAppointment = useCallback(
    async (id: string, reasonOverride?: string) => {
      if (!requireCenter("archivar citas")) return;
      const apptSnap = await getDoc(doc(db, "centers", activeCenterId, "appointments", id));
      const apptData = apptSnap.exists() ? (apptSnap.data() as any) : null;
      if (isOverRetention(apptData?.createdAt)) {
        showToast(
          "Este registro supera 15 años. Por normativa no puede archivarse desde la plataforma. Contacte al administrador.",
          "warning"
        );
        await updateAuditLog({
          id: generateId(),
          centerId: activeCenterId,
          actorUid: auth.currentUser?.uid ?? "unknown",
          actorName: auth.currentUser?.displayName ?? "Usuario",
          actorRole: "staff",
          action: "ARCHIVE_BLOCKED_RETENTION",
          entityType: "appointment",
          entityId: id,
          patientId: apptData?.patientId,
          details: "Intento de archivo bloqueado por retención (15 años).",
          metadata: { reason: "RETENTION_15Y" },
        });
        return;
      }
      const reason = reasonOverride ?? requestDeleteReason("esta cita");
      if (!reason) return;
      await updateDoc(doc(db, "centers", activeCenterId, "appointments", id), {
        active: false,
        deletedAt: serverTimestamp(),
        deletedBy: auth.currentUser?.uid ?? "unknown",
        deleteReason: reason,
      });
      await updateAuditLog({
        id: generateId(),
        centerId: activeCenterId,
        actorUid: auth.currentUser?.uid ?? "unknown",
        actorName: auth.currentUser?.displayName ?? "Usuario",
        actorRole: "staff",
        action: "APPOINTMENT_ARCHIVE",
        entityType: "appointment",
        entityId: id,
        patientId: apptData?.patientId,
        details: "Archivo de cita.",
        metadata: { deleteReason: reason },
      });
    },
    [activeCenterId, requireCenter, requestDeleteReason, updateAuditLog]
  );

  const syncAppointments = useCallback(
    async (nextAppointments: Appointment[], setIsSyncingAppointments: (val: boolean) => void) => {
      const nextIds = new Set(nextAppointments.map((a) => a.id));
      const removed = appointments.filter((appt) => !nextIds.has(appt.id));

      setIsSyncingAppointments(true);
      try {
        for (const appt of removed) {
          await deleteAppointment(appt.id, "Cierre de bloque en agenda");
        }

        for (const appt of nextAppointments) {
          await updateAppointment(appt);
        }
      } finally {
        setIsSyncingAppointments(false);
      }
    },
    [appointments, deleteAppointment, updateAppointment]
  );

  const updateCenter = useCallback(async (payload: MedicalCenter & { auditReason?: string }) => {
    const id = payload?.id ?? generateId();
    const fn = httpsCallable(getFunctions(), "upsertCenter");
    await fn({ ...payload, id });
  }, []);

  const deleteCenter = useCallback(async (id: string, reason?: string) => {
    const fn = httpsCallable(getFunctions(), "deleteCenter");
    await fn({ centerId: id, reason });
  }, []);

  const createPreadmission = useCallback(
    async (payload: Omit<Preadmission, "id" | "createdAt" | "centerId" | "status">) => {
      if (!requireCenter("enviar preingresos")) return;
      const id = generateId();
      const submissionSource = auth.currentUser ? "staff" : "public";
      await setDoc(doc(db, "centers", activeCenterId, "preadmissions", id), {
        id,
        centerId: activeCenterId,
        createdAt: serverTimestamp(),
        status: "pending",
        source: submissionSource,
        submittedByUid: auth.currentUser?.uid ?? null,
        ...payload,
      });
    },
    [activeCenterId, requireCenter]
  );

  const approvePreadmission = useCallback(
    async (item: Preadmission) => {
      if (!requireCenter("aprobar preingresos")) return;
      const patientDraft = item.patientDraft ?? {};
      const patientId = (patientDraft as any).id ?? generateId();
      const patientPayload: Patient = {
        id: patientId,
        centerId: activeCenterId,
        rut: (patientDraft.rut ?? item.contact?.rut ?? "") as string,
        fullName: (patientDraft.fullName ?? item.contact?.name ?? "Paciente") as string,
        birthDate: (patientDraft.birthDate ?? "") as string,
        gender: (patientDraft.gender ?? "Otro") as any,
        email: patientDraft.email ?? item.contact?.email,
        phone: patientDraft.phone ?? item.contact?.phone,
        address: patientDraft.address,
        commune: patientDraft.commune,
        occupation: patientDraft.occupation,
        livingWith: patientDraft.livingWith ?? [],
        activeExams: patientDraft.activeExams ?? [],
        medicalHistory: patientDraft.medicalHistory ?? [],
        medicalHistoryDetails: patientDraft.medicalHistoryDetails,
        cancerDetails: patientDraft.cancerDetails,
        surgicalHistory: patientDraft.surgicalHistory ?? [],
        surgicalHistoryDetails: patientDraft.surgicalHistoryDetails,
        herniaDetails: patientDraft.herniaDetails,
        smokingStatus: (patientDraft.smokingStatus ?? "No fumador") as any,
        cigarettesPerDay: patientDraft.cigarettesPerDay,
        yearsSmoking: patientDraft.yearsSmoking,
        packYearsIndex: patientDraft.packYearsIndex,
        alcoholStatus: (patientDraft.alcoholStatus ?? "No consumo") as any,
        alcoholFrequency: patientDraft.alcoholFrequency,
        drugUse: patientDraft.drugUse,
        drugDetails: patientDraft.drugDetails,
        medications: patientDraft.medications ?? [],
        allergies: patientDraft.allergies ?? [],
        consultations: patientDraft.consultations ?? [],
        attachments: patientDraft.attachments ?? [],
        lastUpdated: new Date().toISOString(),
        active: patientDraft.active ?? true,
      };

      await updatePatient(patientPayload);

      if (item.appointmentDraft) {
        const appointmentDraft = item.appointmentDraft;
        const appointmentId = (appointmentDraft as any).id ?? generateId();
        const appointmentPayload: Appointment = {
          id: appointmentId,
          centerId: activeCenterId,
          doctorId: (appointmentDraft.doctorId ?? appointmentDraft.doctorUid ?? "") as string,
          doctorUid: (appointmentDraft.doctorUid ?? appointmentDraft.doctorId ?? "") as string,
          date: appointmentDraft.date ?? new Date().toISOString().split("T")[0],
          time: appointmentDraft.time ?? "",
          patientName: appointmentDraft.patientName ?? patientPayload.fullName,
          patientRut: appointmentDraft.patientRut ?? patientPayload.rut,
          patientId: patientPayload.id,
          patientPhone: appointmentDraft.patientPhone ?? patientPayload.phone,
          status: "booked",
          active: appointmentDraft.active ?? true,
        };
        await updateAppointment(appointmentPayload);
      }

      await deleteDoc(doc(db, "centers", activeCenterId, "preadmissions", item.id));
    },
    [activeCenterId, requireCenter, updatePatient, updateAppointment]
  );

  return {
    updatePatient,
    deletePatient,
    updateStaff,
    deleteStaff,
    updateAppointment,
    deleteAppointment,
    syncAppointments,
    updateAuditLog,
    updateCenter,
    deleteCenter,
    createPreadmission,
    approvePreadmission,
  };
}
