import { useCallback } from "react";
import { db, auth } from "../firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Patient, Doctor, Appointment, AuditLogEntry, MedicalCenter, Preadmission } from "../types";
import { generateId } from "../utils";

export function useCrudOperations(
  activeCenterId: string,
  appointments: Appointment[],
  showToast: (message: string, type: "success" | "error" | "info" | "warning") => void
) {
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
      await setDoc(
        doc(db, "centers", activeCenterId, "patients", id),
        { ...payload, id, centerId: activeCenterId },
        { merge: true }
      );
    },
    [activeCenterId, requireCenter]
  );

  const deletePatient = useCallback(
    async (id: string) => {
      if (!requireCenter("eliminar pacientes")) return;
      await deleteDoc(doc(db, "centers", activeCenterId, "patients", id));
    },
    [activeCenterId, requireCenter]
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
      const doctorUid = (payload as any).doctorUid ?? payload.doctorId;
      await setDoc(
        doc(db, "centers", activeCenterId, "appointments", id),
        { ...payload, doctorUid, id, centerId: activeCenterId },
        { merge: true }
      );
    },
    [activeCenterId, requireCenter]
  );

  const deleteAppointment = useCallback(
    async (id: string) => {
      if (!requireCenter("eliminar citas")) return;
      await deleteDoc(doc(db, "centers", activeCenterId, "appointments", id));
    },
    [activeCenterId, requireCenter]
  );

  const syncAppointments = useCallback(
    async (nextAppointments: Appointment[], setIsSyncingAppointments: (val: boolean) => void) => {
      const nextIds = new Set(nextAppointments.map((a) => a.id));
      const removed = appointments.filter((appt) => !nextIds.has(appt.id));

      setIsSyncingAppointments(true);
      try {
        for (const appt of removed) {
          await deleteAppointment(appt.id);
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

  const updateAuditLog = useCallback(
    async (payload: AuditLogEntry) => {
      if (!requireCenter("registrar auditoría")) return;
      const id = payload?.id ?? generateId();
      const actorUid = payload.actorUid ?? auth.currentUser?.uid ?? null;
      const timestamp = payload.timestamp ?? new Date().toISOString();
      await setDoc(
        doc(db, "centers", activeCenterId, "auditLogs", id),
        {
          ...payload,
          actorUid,
          id,
          centerId: activeCenterId,
          timestamp,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    [activeCenterId, requireCenter]
  );

  const updateCenter = useCallback(async (payload: MedicalCenter) => {
    const id = payload?.id ?? generateId();
    await setDoc(doc(db, "centers", id), { ...payload, id }, { merge: true });
  }, []);

  const deleteCenter = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "centers", id));
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
