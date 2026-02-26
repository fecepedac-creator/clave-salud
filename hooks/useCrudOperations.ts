import { useCallback } from "react";
import { db, auth } from "../firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Patient, Doctor, Appointment, AuditLogEntry, MedicalCenter, Preadmission } from "../types";
import { generateId, generateSlotId, sanitizeForFirestore } from "../utils";
import { logAuditEventSafe } from "./useAuditLog";

export function useCrudOperations(
  activeCenterId: string,
  appointments: Appointment[],
  showToast: (message: string, type: "success" | "error" | "info" | "warning") => void,
  authUser?: any,
  isSuperAdmin?: boolean
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
    [activeCenterId, requireCenter]
  );

  const updatePatient = useCallback(
    async (payload: Patient) => {
      const id = payload?.id ?? generateId();
      const currentUid = authUser?.uid ?? "";

      const ownerUid = payload.ownerUid || currentUid;
      const accessControl = payload.accessControl || {
        allowedUids: [currentUid],
        centerIds: activeCenterId ? [activeCenterId] : [],
      };
      if (!accessControl.allowedUids.includes(ownerUid)) {
        accessControl.allowedUids.push(ownerUid);
      }

      const ref = doc(db, "patients", id);
      const existingSnap = await getDoc(ref);

      await setDoc(
        ref,
        sanitizeForFirestore({
          ...payload,
          id,
          ownerUid,
          accessControl,
          lastUpdated: new Date().toISOString(),
          createdAt: payload.createdAt ?? serverTimestamp(),
        }),
        { merge: true }
      );

      await updateAuditLog({
        id: generateId(),
        centerId: activeCenterId,
        actorUid: authUser?.uid ?? "unknown",
        actorName: authUser?.displayName ?? "Usuario",
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
    [activeCenterId, updateAuditLog]
  );

  const deletePatient = useCallback(
    async (id: string) => {
      const patientSnap = await getDoc(doc(db, "patients", id));
      const patientData = patientSnap.exists() ? (patientSnap.data() as any) : null;
      if (!patientData) {
        showToast("Paciente no encontrado.", "error");
        return;
      }

      // Retention check
      const fallbackConsultations = Array.isArray(patientData?.consultations) ? patientData.consultations : [];
      const oldestConsultation = fallbackConsultations
        .map((c: any) => new Date(c?.date || ""))
        .filter((d: Date) => !Number.isNaN(d.getTime()))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];

      const retentionDate = patientData?.createdAt ?? oldestConsultation;
      if (isOverRetention(retentionDate)) {
        showToast("Este registro supera 15 años. No puede archivarse.", "warning");
        return;
      }

      const reason = requestDeleteReason("este paciente");
      if (!reason) return;

      await updateDoc(doc(db, "patients", id), {
        active: false,
        deletedAt: serverTimestamp(),
        deletedBy: authUser?.uid ?? "unknown",
        deleteReason: reason,
      });

      await updateAuditLog({
        id: generateId(),
        centerId: activeCenterId,
        actorUid: authUser?.uid ?? "unknown",
        actorName: authUser?.displayName ?? "Usuario",
        actorRole: "staff",
        action: "PATIENT_ARCHIVE",
        entityType: "patient",
        entityId: id,
        patientId: id,
        details: "Archivo de ficha clínica (root).",
        metadata: { deleteReason: reason },
      });
    },
    [activeCenterId, requestDeleteReason, updateAuditLog]
  );

  const updateStaff = useCallback(
    async (payload: Doctor) => {
      if (!requireCenter("guardar profesionales")) return;
      const id = payload?.id ?? generateId();
      await setDoc(
        doc(db, "centers", activeCenterId, "staff", id),
        sanitizeForFirestore({ ...payload, id, centerId: activeCenterId }),
        { merge: true }
      );
      await setDoc(
        doc(db, "centers", activeCenterId, "publicStaff", id),
        sanitizeForFirestore({
          id,
          centerId: activeCenterId,
          fullName: payload.fullName ?? "",
          role: payload.role ?? "",
          specialty: payload.specialty ?? "",
          photoUrl: payload.photoUrl ?? "",
          clinicalRole: payload.clinicalRole ?? "",
          visibleInBooking: payload.visibleInBooking ?? true,
          agendaConfig: payload.agendaConfig ?? null,
          active: payload.active ?? true,
          updatedAt: serverTimestamp(),
        }),
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
        sanitizeForFirestore({
          ...payload,
          doctorUid,
          id,
          centerId: activeCenterId,
          createdAt: payload.createdAt ?? serverTimestamp(),
        }),
        { merge: true }
      );
      await updateAuditLog({
        id: generateId(),
        centerId: activeCenterId,
        actorUid: authUser?.uid ?? "unknown",
        actorName: authUser?.displayName ?? "Usuario",
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
          actorUid: authUser?.uid ?? "unknown",
          actorName: authUser?.displayName ?? "Usuario",
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
        deletedBy: authUser?.uid ?? "unknown",
        deleteReason: reason,
      });
      await updateAuditLog({
        id: generateId(),
        centerId: activeCenterId,
        actorUid: authUser?.uid ?? "unknown",
        actorName: authUser?.displayName ?? "Usuario",
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
    async (nextAppointments: Appointment[], setIsSyncingAppointments?: (val: boolean) => void) => {
      // Delta Sync to avoid catastrophic O(N) writes
      if (!requireCenter("sincronizar agenda")) return;
      setIsSyncingAppointments?.(true);
      try {
        const batches: any[] = [writeBatch(db)];
        let currentBatchIdx = 0;
        let count = 0;

        const addToBatch = (ref: any, data: any, options?: { merge: boolean }) => {
          if (count > 0 && count % 500 === 0) {
            batches.push(writeBatch(db));
            currentBatchIdx++;
          }
          if (options?.merge) {
            batches[currentBatchIdx].set(ref, data, { merge: true });
          } else {
            batches[currentBatchIdx].set(ref, data);
          }
          count++;
        };

        const updateInBatch = (ref: any, data: any) => {
          if (count > 0 && count % 500 === 0) {
            batches.push(writeBatch(db));
            currentBatchIdx++;
          }
          batches[currentBatchIdx].update(ref, data);
          count++;
        };

        // 1. Identify what to Add or Update
        for (const nextAppt of nextAppointments) {
          const currentAppt = appointments.find((a) => a.id === nextAppt.id);
          const needsUpdate =
            !currentAppt ||
            currentAppt.status !== nextAppt.status ||
            currentAppt.active !== nextAppt.active ||
            currentAppt.patientRut !== nextAppt.patientRut ||
            currentAppt.time !== nextAppt.time;

          if (needsUpdate) {
            const ref = doc(db, "centers", activeCenterId, "appointments", nextAppt.id);
            addToBatch(
              ref,
              sanitizeForFirestore({
                ...nextAppt,
                doctorUid: (nextAppt as any).doctorUid ?? nextAppt.doctorId,
                centerId: activeCenterId,
                updatedAt: serverTimestamp(),
              }),
              { merge: true }
            );
          }
        }

        // 2. Identify what to Deactivate (instead of deletion for safety)
        const nextIds = new Set(nextAppointments.map((a) => a.id));
        const toDeactivate = appointments.filter(
          (a) => !nextIds.has(a.id) && a.active !== false
        );

        for (const appt of toDeactivate) {
          const ref = doc(db, "centers", activeCenterId, "appointments", appt.id);
          updateInBatch(ref, {
            active: false,
            updatedAt: serverTimestamp(),
            deletedAt: serverTimestamp(),
            deleteReason: "Sincronización de bloques (cierre masivo)",
          });
        }

        if (count > 0) {
          await Promise.all(batches.map((b) => b.commit()));
          console.log(`[Delta Sync] Commited ${count} changes in ${batches.length} batches.`);
        }
      } catch (err) {
        console.error("syncAppointments error", err);
        showToast("Error al sincronizar la agenda.", "error");
      } finally {
        setIsSyncingAppointments?.(false);
      }
    },
    [activeCenterId, appointments, requireCenter, showToast]
  );

  const updateCenter = useCallback(async (payload: MedicalCenter & { auditReason?: string }) => {
    const id = payload?.id ?? generateId();
    const fn = httpsCallable(getFunctions(), "upsertCenter");
    const sanitizeObj = (obj: any): any => {
      if (!obj || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(sanitizeObj);
      const res: any = {};
      for (const key in obj) {
        const val = obj[key];
        if (val === undefined) continue;
        if (typeof val === "function") continue;
        if (val && typeof val === "object" && val.constructor?.name === "File") continue;
        res[key] = sanitizeObj(val);
      }
      return res;
    };

    try {
      await fn({ ...payload, id });
      return;
    } catch (err: any) {
      console.warn("[updateCenter Catch] Error detected:", {
        code: err?.code,
        message: err?.message,
        authUser: !!authUser,
        isSuperAdminFlag: isSuperAdmin
      });

      const code = String(err?.code || "").toLowerCase();
      const message = String(err?.message || "").toLowerCase();

      const isCallableNetworkIssue =
        code.includes("unavailable") ||
        code.includes("internal") ||
        code.includes("deadline-exceeded") ||
        message.includes("cors") ||
        message.includes("failed to fetch") ||
        message.includes("network error");

      if (!isCallableNetworkIssue) {
        console.error("updateCenter definitive error:", err);
        throw err;
      }

      console.warn("updateCenter callable failed (CORS/Network), trying direct Firestore fallback...");

      // Determinar si es SuperAdmin de forma segura
      let isFinalSuper = isSuperAdmin === true;
      if (!isFinalSuper && authUser && typeof authUser.getIdTokenResult === "function") {
        try {
          const tokenResult = await authUser.getIdTokenResult();
          const claims = tokenResult?.claims || {};
          isFinalSuper = (claims.super_admin === true || claims.superadmin === true || claims.superAdmin === true);
          console.log("[Auth Diagnosis] Computed SuperAdmin claims:", claims);
        } catch (authDiagErr) {
          console.error("[Auth Diagnosis] Failed to get claims:", authDiagErr);
        }
      }

      console.log("[Auth Diagnosis] Final SuperAdmin assessment:", isFinalSuper);

      if (!isFinalSuper) {
        console.error("User is NOT SuperAdmin. Rejecting fallback flow.");
        throw err;
      }

      try {
        const centerRef = doc(db, "centers", id);
        const existingSnap = await getDoc(centerRef);

        // Sanitizar payload para evitar errores Internal de Firestore por datos no serializables
        const cleanPayload = sanitizeObj(payload);

        const updateData: any = {
          ...cleanPayload,
          id,
          name: String(cleanPayload?.name || "").trim(),
          slug: String(cleanPayload?.slug || "").trim(),
          updatedAt: serverTimestamp(),
        };

        if (existingSnap.exists()) {
          const oldData = existingSnap.data();
          updateData.createdAt = cleanPayload?.createdAt ?? oldData?.createdAt ?? serverTimestamp();
        } else {
          updateData.createdAt = cleanPayload?.createdAt ?? serverTimestamp();
        }

        console.log("[Fallback Data Check]: Executing setDoc with:", updateData);
        await setDoc(centerRef, updateData, { merge: true });
        showToast("Centro actualizado vía fallback", "success");
      } catch (fallbackErr: any) {
        console.error("CRITICAL FALLBACK ERROR:", fallbackErr);
        throw fallbackErr;
      }
    }
  }, [authUser, db, updateAuditLog, showToast, isSuperAdmin]);

  const deleteCenter = useCallback(async (id: string, reason?: string) => {
    try {
      const fn = httpsCallable(getFunctions(), "deleteCenter");
      await fn({ centerId: id, reason });
    } catch (err: any) {
      console.warn("deleteCenter callable failed, trying direct fallback...", err);

      const tokenResult = await authUser?.getIdTokenResult();
      const claims = tokenResult?.claims || {};
      const isSuper = claims.super_admin === true || claims.superadmin === true || claims.superAdmin === true;

      if (!isSuper) throw err;

      // Fallback defensivo: eliminación directa de Firestore si la función falla (CORS/Red)
      await deleteDoc(doc(db, "centers", id));

      // Registrar auditoría manual si el callable falló (ya que el servidor no lo hizo)
      await updateAuditLog({
        id: generateId(),
        centerId: id, // Aunque el centro se borre, lo logueamos
        actorUid: authUser?.uid ?? "unknown",
        actorName: authUser?.displayName ?? "Usuario",
        actorRole: "super_admin",
        action: "CENTER_DELETE_FALLBACK",
        entityType: "centerSettings",
        entityId: id,
        details: `Eliminación manual por falla en backend. Motivo: ${reason || "N/A"}`,
      }).catch(() => { });
    }
  }, [authUser, updateAuditLog]);

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
        submittedByUid: authUser?.uid ?? null,
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
        ownerUid: authUser?.uid ?? "",
        accessControl: {
          allowedUids: [authUser?.uid ?? ""],
          centerIds: activeCenterId ? [activeCenterId] : [],
        },
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
        const appointmentId =
          (appointmentDraft as any).id ||
          generateSlotId(
            activeCenterId,
            (appointmentDraft.doctorId ?? appointmentDraft.doctorUid ?? "") as string,
            appointmentDraft.date ?? "",
            appointmentDraft.time ?? ""
          );
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
