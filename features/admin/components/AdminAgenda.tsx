import React, { useState, useEffect, useRef } from "react";
import {
  Doctor,
  Appointment,
  Patient,
  AgendaConfig,
  AuditLogEvent,
  MedicalService,
} from "../../../types";
import { generateId, generateSlotId, getStandardSlots, getPatientIdByRut } from "../../../utils";
import {
  Calendar,
  Save,
  Zap,
  ChevronLeft,
  ChevronRight,
  Settings,
  MessageCircle,
  AlertTriangle,
  User,
} from "lucide-react";
import { useToast } from "../../../components/Toast";
import { db, auth, functions } from "../../../firebase";
import { httpsCallable } from "firebase/functions";
import { upsertTelephoneBooking } from "../../doctor/utils/telephoneBooking";
import AgendaPolicyManager from "../../../components/AgendaPolicyManager";
import { AGENDA_OPERATIONS_V2_ENABLED } from "../../../utils/agendaOperationsFeature";
import {
  collection,
  query,
  doc,
  setDoc,
  serverTimestamp,
  where,
  getDocs,
  getDoc,
  Timestamp,
} from "firebase/firestore";

interface AdminAgendaProps {
  centerId: string;
  resolvedCenterId: string;
  doctors: Doctor[];
  appointments: Appointment[];
  onUpdateAppointments: (appointments: Appointment[]) => void;
  patients: Patient[];
  hasActiveCenter: boolean;
  onLogActivity: (event: AuditLogEvent) => void;
  isModuleEnabled?: (mod: string) => boolean;
  ROLE_LABELS: Record<string, string>;
  upsertStaffAndPublic: (staffId: string, doctor: Partial<Doctor>) => Promise<void>;
  medicalServices: MedicalService[];
  showToast: (msg: string, type?: any) => void;
  activeCenter: any;
  onUpdatePatients: (patients: Patient[]) => void;
}

export const AdminAgenda: React.FC<AdminAgendaProps> = ({
  centerId,
  resolvedCenterId,
  doctors,
  appointments,
  onUpdateAppointments,
  patients,
  hasActiveCenter,
  onLogActivity,
  isModuleEnabled,
  ROLE_LABELS,
  medicalServices,
  showToast,
  upsertStaffAndPublic,
  activeCenter,
  onUpdatePatients,
}) => {
  // --- STATE FOR AGENDA MANAGEMENT ---
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctors[0]?.id || "");
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [bookingRut, setBookingRut] = useState("");
  const [bookingName, setBookingName] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingOverrideReason, setBookingOverrideReason] = useState("");
  const [requiresBookingOverride, setRequiresBookingOverride] = useState(false);
  const [isManualBooking, setIsManualBooking] = useState(false);
  const bookingRequestIdRef = useRef("");
  const operationRequestIdsRef = useRef(new Map<string, string>());
  const [updatingOperationId, setUpdatingOperationId] = useState("");
  const [showAgendaPolicies, setShowAgendaPolicies] = useState(false);

  useEffect(() => {
    bookingRequestIdRef.current = bookingSlotId
      ? globalThis.crypto?.randomUUID?.() ||
        `booking_${Date.now()}_${Math.random().toString(36).slice(2)}`
      : "";
    setBookingOverrideReason("");
    setRequiresBookingOverride(false);
  }, [bookingSlotId]);

  const [manualBookingType, setManualBookingType] = useState<"CONSULTATION" | "SERVICE">(
    "CONSULTATION"
  );
  const [manualBookingServiceId, setManualBookingServiceId] = useState<string>("");

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>("");
  const slotsSectionRef = useRef<HTMLDivElement>(null);

  // Pending slot changes
  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set());
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [isSavingSlots, setIsSavingSlots] = useState(false);
  const hasPendingSlotChanges = pendingAdds.size > 0 || pendingDeletes.size > 0;

  // Generate availability panel state
  const todayStr = new Date().toISOString().split("T")[0];
  const defaultGenEnd = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })();
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genFrom, setGenFrom] = useState(todayStr);
  const [genTo, setGenTo] = useState(defaultGenEnd);
  const [genIncludeSat, setGenIncludeSat] = useState(false);
  const [genIncludeSun, setGenIncludeSun] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Dynamic Config State
  const [tempConfig, setTempConfig] = useState<AgendaConfig>({
    slotDuration: 20,
    startTime: "08:00",
    endTime: "21:00",
  });

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const savedConfig = selectedDoctor?.agendaConfig;

  const isConfigEqual = (a?: AgendaConfig, b?: AgendaConfig) =>
    !!a &&
    !!b &&
    a.slotDuration === b.slotDuration &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime;

  const hasUnsavedConfig = savedConfig ? !isConfigEqual(savedConfig, tempConfig) : false;

  // Effects
  useEffect(() => {
    const doc = doctors.find((d) => d.id === selectedDoctorId);
    if (doc && doc.agendaConfig) {
      setTempConfig(doc.agendaConfig);
    } else {
      setTempConfig({ slotDuration: 20, startTime: "08:00", endTime: "21:00" });
    }
  }, [selectedDoctorId, doctors]);

  useEffect(() => {
    setPendingAdds(new Set());
    setPendingDeletes(new Set());
  }, [selectedDate, selectedDoctorId]);

  useEffect(() => {
    if (selectedDate && slotsSectionRef.current) {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        slotsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [selectedDate]);

  // --- FUNCTIONS ---

  const handleSaveConfig = async () => {
    let updatedDoctor: Doctor | null = null;
    doctors.forEach((d) => {
      if (d.id === selectedDoctorId) {
        updatedDoctor = { ...d, agendaConfig: tempConfig };
      }
    });

    if (updatedDoctor && db) {
      try {
        await upsertStaffAndPublic(selectedDoctorId, { ...updatedDoctor });
        showToast("Configuración de agenda guardada correctamente", "success");
      } catch (e) {
        console.error("handleSaveConfig", e);
        showToast("Error al guardar configuración.", "error");
      }
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const days = [];
    for (let i = 0; i < startingDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const handleDateClick = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${d}`);
  };

  const handleMonthChange = (increment: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentMonth(newDate);
    setSelectedDate("");
  };

  // Cancellation Modal State
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    appointment: Appointment | null;
  }>({ isOpen: false, appointment: null });

  const toggleSlot = (time: string) => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para modificar la agenda.", "warning");
      return;
    }
    if (!selectedDate || !selectedDoctorId) return;

    const appointmentDoctorUid = (a: Appointment) => (a as any).doctorUid ?? a.doctorId;
    const realSlot = appointments.find(
      (a) =>
        appointmentDoctorUid(a) === selectedDoctorId && a.date === selectedDate && a.time === time
    );

    if (realSlot?.status === "booked") {
      setCancelModal({ isOpen: true, appointment: realSlot });
      return;
    }

    if (realSlot) {
      if (pendingDeletes.has(realSlot.id)) {
        setPendingDeletes((prev) => {
          const s = new Set(prev);
          s.delete(realSlot.id);
          return s;
        });
      } else {
        setPendingDeletes((prev) => new Set([...prev, realSlot.id]));
      }
    } else {
      if (pendingAdds.has(time)) {
        setPendingAdds((prev) => {
          const s = new Set(prev);
          s.delete(time);
          return s;
        });
      } else {
        setPendingAdds((prev) => new Set([...prev, time]));
      }
    }
  };

  const handleSaveSlots = async () => {
    if (!hasPendingSlotChanges || isSavingSlots) return;
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo.", "warning");
      return;
    }
    setIsSavingSlots(true);
    try {
      const newSlots: Appointment[] = Array.from(pendingAdds).map((time) => ({
        id: generateSlotId(resolvedCenterId, selectedDoctorId!, selectedDate!, time as string),
        centerId: resolvedCenterId,
        doctorId: selectedDoctorId,
        doctorUid: selectedDoctorId,
        date: selectedDate!,
        time: time as string,
        status: "available",
        patientName: "",
        patientRut: "",
        active: true,
      }));

      const filtered = appointments.filter((a) => !pendingDeletes.has(a.id));
      const finalAppointments = [...filtered, ...newSlots];

      await onUpdateAppointments(finalAppointments);

      setPendingAdds(new Set());
      setPendingDeletes(new Set());
      showToast(
        `Agenda guardada: ${newSlots.length} abiertos, ${pendingDeletes.size} cerrados.`,
        "success"
      );
    } finally {
      setIsSavingSlots(false);
    }
  };

  const handleGenerateSlots = async () => {
    if (!selectedDoctorId || !hasActiveCenter || isGenerating) return;
    setIsGenerating(true);
    try {
      const from = new Date(genFrom + "T00:00:00");
      const to = new Date(genTo + "T00:00:00");
      if (from > to) return;

      const slotsToCreate: Array<{ date: string; time: string }> = [];
      const cursor = new Date(from);
      while (cursor <= to) {
        const dow = cursor.getDay();
        const skip = (dow === 6 && !genIncludeSat) || (dow === 0 && !genIncludeSun);
        if (!skip) {
          const dateStr = cursor.toISOString().split("T")[0];
          const templateSlots = getStandardSlots(
            dateStr,
            selectedDoctorId,
            resolvedCenterId,
            savedConfig ?? tempConfig
          );
          const existing = new Set(
            appointments
              .filter(
                (a) =>
                  ((a as any).doctorUid ?? a.doctorId) === selectedDoctorId && a.date === dateStr
              )
              .map((a) => a.time)
          );
          templateSlots
            .filter((s) => !existing.has(s.time))
            .forEach((s) => slotsToCreate.push({ date: dateStr, time: s.time }));
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      if (slotsToCreate.length === 0) {
        showToast("No hay bloques nuevos para generar en ese rango.", "info");
        return;
      }

      const newSlots: Appointment[] = slotsToCreate.map((slot) => ({
        id: generateSlotId(resolvedCenterId, selectedDoctorId, slot.date, slot.time),
        centerId: resolvedCenterId,
        doctorId: selectedDoctorId,
        doctorUid: selectedDoctorId,
        date: slot.date,
        time: slot.time,
        status: "available",
        patientName: "",
        patientRut: "",
        active: true,
      }));

      onUpdateAppointments([...appointments, ...newSlots]);
      showToast(`¡Disponibilidad generada! ${newSlots.length} bloques abiertos.`, "success");
      setShowGenPanel(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmCancellation = async (notify: boolean) => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para cancelar citas.", "warning");
      return;
    }
    if (!cancelModal.appointment) return;
    const apt = cancelModal.appointment;
    try {
      const archiveAppointment = httpsCallable(functions, "archiveAppointment");
      await archiveAppointment({
        centerId: resolvedCenterId,
        appointmentId: apt.id,
        reason: `Cancelacion desde agenda administrativa. Notificacion: ${notify ? "Si" : "No"}`,
      });
    } catch (error) {
      console.error("Admin agenda cancellation", error);
      showToast("No se pudo cancelar la cita.", "error");
      return;
    }

    onLogActivity({
      action: "APPOINTMENT_CANCEL",
      entityType: "appointment",
      entityId: cancelModal.appointment.id,
      patientId: cancelModal.appointment.patientId,
      details: `Canceló cita de ${cancelModal.appointment.patientName} (${cancelModal.appointment.date} ${cancelModal.appointment.time}). Notificación: ${notify ? "Si" : "No"}`,
    });

    if (notify) {
      const apt = cancelModal.appointment;
      const doctor = doctors.find((d) => d.id === ((apt as any).doctorUid ?? apt.doctorId));
      const rawPhone = apt.patientPhone || "";
      const cleanPhone = rawPhone.replace(/\D/g, "");
      let waNumber = cleanPhone;
      if (cleanPhone.length === 9 && cleanPhone.startsWith("9")) waNumber = `56${cleanPhone}`;

      const centerName = activeCenter?.name || "nuestro centro";
      const message = `Hola ${apt.patientName}, le escribimos de ${centerName}. Lamentamos informar que su hora agendada para el día ${apt.date} a las ${apt.time} hrs con ${doctor?.fullName || "el especialista"} ha tenido que ser suspendida por motivos de fuerza mayor. Por favor contáctenos para reagendar.`;

      const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank");
    }

    onUpdateAppointments(
      appointments.map((a) =>
        a.id === apt.id
          ? { ...a, status: "cancelled", attendanceStatus: "cancelled", active: false }
          : a
      )
    );
    setCancelModal({ isOpen: false, appointment: null });
    showToast("Cita cancelada y horario bloqueado.", "info");
  };

  const normalizeRut = (rut: string) => rut.replace(/[^0-9kK]/g, "").toUpperCase();

  const operationRequestId = (action: string, appointmentId: string) => {
    const key = `${action}:${appointmentId}`;
    const existing = operationRequestIdsRef.current.get(key);
    if (existing) return { key, requestId: existing };
    const requestId =
      globalThis.crypto?.randomUUID?.() ||
      `operation_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    operationRequestIdsRef.current.set(key, requestId);
    return { key, requestId };
  };

  const handleArrival = async (appointment: Appointment, arrived: boolean) => {
    const operation = operationRequestId("arrival", appointment.id);
    setUpdatingOperationId(operation.key);
    try {
      await httpsCallable(
        functions,
        "updateAppointmentArrival"
      )({
        centerId: resolvedCenterId || centerId,
        appointmentId: appointment.id,
        requestId: operation.requestId,
        arrived,
      });
      const updated = appointments.map((item) =>
        item.id === appointment.id
          ? ({
              ...item,
              arrivalStatus: arrived ? "arrived" : null,
            } as Appointment)
          : item
      );
      onUpdateAppointments(updated);
      operationRequestIdsRef.current.delete(operation.key);
      showToast(arrived ? "Llegada registrada." : "Llegada revertida.", "success");
    } catch (error: any) {
      showToast(error?.message || "No fue posible actualizar la llegada.", "error");
    } finally {
      setUpdatingOperationId("");
    }
  };

  const handleOperationalAttendance = async (
    appointment: Appointment,
    attendanceStatus: "completed" | "no-show"
  ) => {
    const operation = operationRequestId(`attendance-${attendanceStatus}`, appointment.id);
    setUpdatingOperationId(operation.key);
    try {
      await httpsCallable(
        functions,
        "updateAppointmentOperationalAttendance"
      )({
        centerId: resolvedCenterId || centerId,
        appointmentId: appointment.id,
        requestId: operation.requestId,
        attendanceStatus,
      });
      onUpdateAppointments(
        appointments.map((item) =>
          item.id === appointment.id ? { ...item, attendanceStatus } : item
        )
      );
      operationRequestIdsRef.current.delete(operation.key);
      showToast(
        attendanceStatus === "completed" ? "Atención registrada." : "Ausencia registrada.",
        "success"
      );
    } catch (error: any) {
      showToast(error?.message || "No fue posible actualizar la asistencia.", "error");
    } finally {
      setUpdatingOperationId("");
    }
  };

  const handleManualBooking = async (continueBooking = false) => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para agendar citas.", "warning");
      return;
    }
    if (!bookingSlotId || !bookingRut || !bookingName) {
      showToast("RUT y Nombre son obligatorios", "error");
      return;
    }

    const selectedSlot = appointments.find((appointment) => appointment.id === bookingSlotId);
    if (!selectedSlot || !selectedDoctorId) {
      showToast("El cupo seleccionado ya no está disponible.", "warning");
      return;
    }

    const selectedService =
      manualBookingType === "SERVICE"
        ? medicalServices.find((s) => s.id === manualBookingServiceId)
        : null;

    const normalizedRutString = normalizeRut(bookingRut);
    const patientId = getPatientIdByRut(normalizedRutString);
    const existingPatient = patients.find((p) => normalizeRut(p.rut) === normalizedRutString);
    const patientPayload: Patient = existingPatient
      ? {
          ...existingPatient,
          rut: bookingRut,
          fullName: bookingName || existingPatient.fullName,
          phone: bookingPhone || existingPatient.phone,
          lastUpdated: new Date().toISOString(),
        }
      : {
          id: patientId,
          centerId,
          rut: bookingRut,
          fullName: bookingName,
          birthDate: "",
          gender: "Otro",
          phone: bookingPhone,
          medicalHistory: [],
          surgicalHistory: [],
          smokingStatus: "No fumador",
          alcoholStatus: "No consumo",
          medications: [],
          allergies: [],
          consultations: [],
          attachments: [],
          lastUpdated: new Date().toISOString(),
          active: true,
        };
    const requestId = bookingRequestIdRef.current;
    if (!requestId) {
      showToast("No fue posible identificar el intento de reserva.", "error");
      return;
    }

    setIsManualBooking(true);
    try {
      const reserveAppointment = httpsCallable(functions, "bookAdministrativeAppointment");
      const result = await reserveAppointment({
        centerId: resolvedCenterId || centerId,
        appointmentId: bookingSlotId,
        idempotencyKey: requestId,
        slot: {
          doctorId: selectedSlot.doctorUid || selectedSlot.doctorId || selectedDoctorId,
          date: selectedSlot.date,
          time: selectedSlot.time,
        },
        patient: {
          id: patientPayload.id,
          fullName: patientPayload.fullName,
          rut: patientPayload.rut,
          phone: patientPayload.phone || "",
          email: patientPayload.email || "",
        },
        ...(bookingOverrideReason.trim()
          ? { override: { reason: bookingOverrideReason.trim() } }
          : {}),
      });
      const reservation = result.data as {
        success: boolean;
        error?:
          | "SLOT_TAKEN"
          | "CONTACT_REQUIRED"
          | "OUTSIDE_HOURS"
          | "APPOINTMENT_CONFLICT"
          | "RESOURCE_CONFLICT"
          | "OVERRIDE_REQUIRED";
      };
      if (!reservation.success) {
        if (reservation.error === "OVERRIDE_REQUIRED") {
          setRequiresBookingOverride(true);
          showToast("Esta reserva requiere un motivo de excepción autorizado.", "warning");
          return;
        }
        const policyMessage: Record<string, string> = {
          CONTACT_REQUIRED: "La política exige teléfono o correo del paciente.",
          OUTSIDE_HOURS: "El horario está fuera de la agenda y no puede ser forzado.",
          APPOINTMENT_CONFLICT: "Existe otra cita para el profesional en ese horario.",
          RESOURCE_CONFLICT: "El recurso seleccionado ya está ocupado en ese horario.",
          SLOT_TAKEN: "Este cupo acaba de ser reservado. Selecciona otro horario.",
        };
        showToast(
          policyMessage[reservation.error || ""] || "La política de agenda rechazó la reserva.",
          "warning"
        );
        if (reservation.error === "SLOT_TAKEN") setBookingSlotId(null);
        return;
      }

      const bookingSlot: Appointment = {
        ...selectedSlot,
        type: manualBookingType,
        serviceId: manualBookingType === "SERVICE" ? manualBookingServiceId : undefined,
        serviceName: manualBookingType === "SERVICE" ? selectedService?.name : undefined,
      };
      onUpdateAppointments(
        upsertTelephoneBooking(appointments, bookingSlot, patientPayload, new Date().toISOString())
      );
      onUpdatePatients([patientPayload]);
      onLogActivity({
        action: "APPOINTMENT_UPDATE",
        entityType: "appointment",
        entityId: bookingSlotId,
        patientId: patientPayload.id,
        details: `Agendamiento manual Admin para ${bookingName}.`,
      });

      setBookingSlotId(null);
      setBookingRut("");
      setBookingName("");
      setBookingPhone("");
      setBookingOverrideReason("");
      setRequiresBookingOverride(false);
      setManualBookingType("CONSULTATION");
      setManualBookingServiceId("");
      showToast(
        continueBooking
          ? "Cita agendada. Selecciona otro cupo para continuar."
          : "Cita agendada manualmente.",
        "success"
      );
    } catch (error: any) {
      showToast(error?.message || "No fue posible agendar la cita.", "error");
    } finally {
      setIsManualBooking(false);
    }
  };

  return (
    <div className="animate-fadeIn grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar Config */}
      <div className="lg:col-span-4 space-y-6">
        {AGENDA_OPERATIONS_V2_ENABLED && (
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-4">
            <button
              type="button"
              aria-expanded={showAgendaPolicies}
              onClick={() => setShowAgendaPolicies((current) => !current)}
              className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left font-bold text-white hover:bg-slate-700"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5" /> Políticas avanzadas
              </span>
              <span className="text-xs text-slate-400">
                {showAgendaPolicies ? "Ocultar" : "Configurar"}
              </span>
            </button>
            {showAgendaPolicies && (
              <div className="mt-4">
                <AgendaPolicyManager centerId={resolvedCenterId || centerId} />
              </div>
            )}
          </div>
        )}
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
          <h3 className="font-bold text-white mb-4">Seleccionar Profesional</h3>
          <select
            data-testid="select-agenda-prof"
            className="w-full bg-slate-900 text-white border border-slate-700 p-3 rounded-xl outline-none"
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
          >
            <optgroup label="Médicos / Profesionales">
              {doctors
                .filter((d) => d.role !== "SERVICIO")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} ({ROLE_LABELS[d.role] || d.role})
                  </option>
                ))}
            </optgroup>
            <optgroup label="Agendas de Servicio">
              {doctors
                .filter((d) => d.role === "SERVICIO")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        {/* DYNAMIC SLOT CONFIG */}
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" /> Configurar Bloques
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                Duración (minutos)
              </label>
              <select
                className="w-full bg-slate-900 text-white border border-slate-700 p-2 rounded-lg outline-none"
                value={tempConfig.slotDuration}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, slotDuration: parseInt(e.target.value) })
                }
              >
                <option value={15}>15 minutos</option>
                <option value={20}>20 minutos</option>
                <option value={25}>25 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                  Inicio
                </label>
                <input
                  type="time"
                  className="w-full bg-slate-900 text-white border border-slate-700 p-2 rounded-lg outline-none"
                  value={tempConfig.startTime}
                  onChange={(e) => setTempConfig({ ...tempConfig, startTime: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fin</label>
                <input
                  type="time"
                  className="w-full bg-slate-900 text-white border border-slate-700 p-2 rounded-lg outline-none"
                  value={tempConfig.endTime}
                  onChange={(e) => setTempConfig({ ...tempConfig, endTime: e.target.value })}
                />
              </div>
            </div>
            <button
              onClick={handleSaveConfig}
              className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg mt-2"
            >
              Guardar Configuración
            </button>
            {hasUnsavedConfig && (
              <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg">
                Cambios sin guardar. La grilla usa la configuración actualmente guardada.
              </p>
            )}
          </div>
        </div>

        {/* CALENDAR */}
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => handleMonthChange(-1)}
              className="p-2 hover:bg-slate-700 rounded-lg text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-lg uppercase tracking-wide text-white">
              {currentMonth.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
            </span>
            <button
              onClick={() => handleMonthChange(1)}
              className="p-2 hover:bg-slate-700 rounded-lg text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={`dow-${i}`} className="text-center text-xs font-bold text-slate-500 mb-2">
                {d}
              </div>
            ))}
            {getDaysInMonth(currentMonth).map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`}></div>;
              const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              const isSelected = dateStr === selectedDate;
              const slotsCount = appointments.filter(
                (a) =>
                  ((a as any).doctorUid == selectedDoctorId || a.doctorId === selectedDoctorId) &&
                  a.date === dateStr
              ).length;
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              const isPast = day < now;

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDateClick(day)}
                  className={`relative p-2 rounded-xl text-sm font-bold transition-all
                    ${isSelected ? "bg-indigo-600 text-white shadow-lg scale-110 z-10" : "hover:bg-slate-700 text-slate-300"}
                    ${isPast ? "opacity-40" : ""}
                  `}
                >
                  {day.getDate()}
                  {slotsCount > 0 && !isSelected && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Slots Grid */}
      <div className="lg:col-span-8 space-y-6" ref={slotsSectionRef}>
        {!selectedDate ? (
          <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-3xl p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-slate-400">Selecciona una fecha</h3>
            <p className="text-slate-500 max-w-xs mx-auto">
              Elige un día en el calendario para gestionar los bloques de atención.
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <p className="text-sm font-bold text-health-400 uppercase tracking-widest mb-1">
                  Gestión de Agenda
                </p>
                <h3 className="text-3xl font-black text-white">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGenPanel(!showGenPanel)}
                  className="bg-slate-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-600 transition-colors"
                >
                  <Zap className="w-4 h-4" /> Generar Rango
                </button>
                <button
                  onClick={handleSaveSlots}
                  disabled={!hasPendingSlotChanges || isSavingSlots}
                  className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg
                    ${hasPendingSlotChanges ? "bg-health-400 text-slate-900 scale-105" : "bg-slate-700 text-slate-500 grayscale opacity-50 cursor-not-allowed"}
                  `}
                >
                  {isSavingSlots ? (
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {hasPendingSlotChanges
                    ? `Guardar (${pendingAdds.size + pendingDeletes.size})`
                    : "Guardado"}
                </button>
              </div>
            </div>

            {/* Availability Generator Panel */}
            {showGenPanel && (
              <div className="bg-slate-900/50 border border-health-500/30 p-6 rounded-2xl mb-8 animate-slideDown">
                <h4 className="font-bold text-health-400 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Generar Disponibilidad Automática
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                      Desde
                    </label>
                    <input
                      type="date"
                      className="w-full bg-slate-800 text-white border border-slate-700 p-2 rounded-lg outline-none"
                      value={genFrom}
                      onChange={(e) => setGenFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                      Hasta
                    </label>
                    <input
                      type="date"
                      className="w-full bg-slate-800 text-white border border-slate-700 p-2 rounded-lg outline-none"
                      value={genTo}
                      onChange={(e) => setGenTo(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={genIncludeSat}
                        onChange={(e) => setGenIncludeSat(e.target.checked)}
                      />
                      <div
                        className={`w-10 h-6 rounded-full transition-colors relative ${genIncludeSat ? "bg-health-400" : "bg-slate-700"}`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${genIncludeSat ? "translate-x-4" : ""}`}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-slate-400 group-hover:text-white">
                        Sáb
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={genIncludeSun}
                        onChange={(e) => setGenIncludeSun(e.target.checked)}
                      />
                      <div
                        className={`w-10 h-6 rounded-full transition-colors relative ${genIncludeSun ? "bg-health-400" : "bg-slate-700"}`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${genIncludeSun ? "translate-x-4" : ""}`}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-slate-400 group-hover:text-white">
                        Dom
                      </span>
                    </label>
                  </div>
                  <button
                    onClick={handleGenerateSlots}
                    disabled={isGenerating}
                    className="bg-health-400 text-slate-900 font-bold py-2 rounded-lg hover:bg-health-300 w-full disabled:opacity-50 h-[42px]"
                  >
                    {isGenerating ? "Generando..." : "Abrir Bloques"}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {getStandardSlots(
                selectedDate,
                selectedDoctorId,
                resolvedCenterId,
                savedConfig ?? tempConfig
              ).map((slot) => {
                const appointmentDoctorUid = (a: Appointment) => (a as any).doctorUid ?? a.doctorId;
                const realSlot = appointments.find(
                  (a) =>
                    appointmentDoctorUid(a) === selectedDoctorId &&
                    a.date === selectedDate &&
                    a.time === slot.time
                );

                const isPendingAdd = pendingAdds.has(slot.time);
                const isPendingDelete = realSlot ? pendingDeletes.has(realSlot.id) : false;
                const isBooked = realSlot?.status === "booked";

                let bgColor =
                  "bg-slate-900/50 border-slate-700 text-slate-500 hover:border-health-400 hover:text-white";
                if (realSlot && !isPendingDelete) {
                  bgColor = isBooked
                    ? "bg-blue-600/20 border-blue-500 text-blue-100"
                    : "bg-emerald-600/20 border-emerald-500 text-emerald-100";
                }
                if (isPendingAdd)
                  bgColor = "bg-health-400 text-slate-900 animate-pulse border-health-300";
                if (isPendingDelete)
                  bgColor = "bg-red-600/20 border-red-500 text-red-100 line-through opacity-50";

                return (
                  <div key={slot.time} className="space-y-1">
                    <button
                      onClick={() => toggleSlot(slot.time)}
                      className={`relative flex w-full flex-col items-center justify-center rounded-2xl border p-3 transition-all ${bgColor}`}
                    >
                      <span className="text-lg font-black">{slot.time}</span>
                      <span className="text-[10px] font-bold uppercase opacity-60">
                        {isBooked
                          ? "Ocupado"
                          : realSlot
                            ? "Abierto"
                            : isPendingAdd
                              ? "Por Abrir"
                              : "Cerrado"}
                      </span>
                      {isBooked && (
                        <div className="mt-1 flex w-full items-center justify-center gap-1 overflow-hidden">
                          <User className="h-2 w-2 shrink-0" />
                          <span className="truncate text-[8px]">{realSlot.patientName}</span>
                        </div>
                      )}
                    </button>
                    {realSlot && !isBooked && !isPendingDelete && (
                      <button
                        type="button"
                        aria-label={`Agendar paciente ${slot.time}`}
                        onClick={() => setBookingSlotId(realSlot.id)}
                        className="w-full rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-2 py-1.5 text-[10px] font-bold text-indigo-200 hover:bg-indigo-500/20"
                      >
                        Agendar paciente
                      </button>
                    )}
                    {realSlot && isBooked && (
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          aria-label={`Marcar llegada ${slot.time}`}
                          disabled={Boolean(updatingOperationId)}
                          onClick={() =>
                            void handleArrival(
                              realSlot,
                              (realSlot as Appointment & { arrivalStatus?: string })
                                .arrivalStatus !== "arrived"
                            )
                          }
                          className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-1 py-1.5 text-[9px] font-bold text-amber-200 disabled:opacity-50"
                        >
                          {(realSlot as Appointment & { arrivalStatus?: string }).arrivalStatus ===
                          "arrived"
                            ? "Deshacer llegada"
                            : "Llegó"}
                        </button>
                        <button
                          type="button"
                          aria-label={`Marcar atendido ${slot.time}`}
                          disabled={Boolean(updatingOperationId)}
                          onClick={() => void handleOperationalAttendance(realSlot, "completed")}
                          className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-1 py-1.5 text-[9px] font-bold text-emerald-200 disabled:opacity-50"
                        >
                          Atendido
                        </button>
                        <button
                          type="button"
                          aria-label={`Marcar ausente ${slot.time}`}
                          disabled={Boolean(updatingOperationId)}
                          onClick={() => void handleOperationalAttendance(realSlot, "no-show")}
                          className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-1 py-1.5 text-[9px] font-bold text-rose-200 disabled:opacity-50"
                        >
                          Ausente
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CANCEL MODAL (Moved from Dashboard) */}
      {cancelModal.isOpen && cancelModal.appointment && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-8 max-md w-full animate-fadeIn">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2">¿Cancelar Cita?</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-center">
              <p className="font-bold text-lg">{cancelModal.appointment.patientName}</p>
              <p className="text-slate-500">
                {cancelModal.appointment.date} - {cancelModal.appointment.time}
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleConfirmCancellation(true)}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-200"
              >
                <MessageCircle className="w-5 h-5" /> Cancelar y Notificar WhatsApp
              </button>
              <button
                onClick={() => handleConfirmCancellation(false)}
                className="w-full bg-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-300"
              >
                Solo Cancelar
              </button>
              <button
                onClick={() => setCancelModal({ isOpen: false, appointment: null })}
                className="w-full text-slate-400 font-bold py-2 hover:text-slate-600"
              >
                Volver Atrás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL BOOKING MODAL */}
      {bookingSlotId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full">
            <h3 className="text-2xl font-black text-white mb-6">Agendamiento Manual</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  autoFocus
                  aria-label="Nombre completo del paciente"
                  className="w-full bg-slate-800 text-white border border-slate-700 p-3 rounded-xl"
                  value={bookingName}
                  onChange={(e) => setBookingName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    RUT
                  </label>
                  <input
                    type="text"
                    aria-label="RUT del paciente"
                    className="w-full bg-slate-800 text-white border border-slate-700 p-3 rounded-xl"
                    value={bookingRut}
                    onChange={(e) => setBookingRut(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    aria-label="Teléfono del paciente"
                    className="w-full bg-slate-800 text-white border border-slate-700 p-3 rounded-xl"
                    value={bookingPhone}
                    onChange={(e) => setBookingPhone(e.target.value)}
                  />
                </div>
              </div>
              {requiresBookingOverride && (
                <label className="block rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs font-bold uppercase text-amber-100">
                  Motivo de excepción
                  <textarea
                    aria-label="Motivo de excepción de agenda"
                    required
                    minLength={10}
                    maxLength={300}
                    value={bookingOverrideReason}
                    onChange={(event) => setBookingOverrideReason(event.target.value)}
                    className="mt-2 min-h-20 w-full rounded-lg border border-amber-400/30 bg-slate-900 p-3 text-sm font-normal normal-case text-white"
                    placeholder="Explique por qué corresponde autorizar esta excepción"
                  />
                </label>
              )}
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <button
                  onClick={() => setBookingSlotId(null)}
                  disabled={isManualBooking}
                  className="rounded-xl bg-slate-700 py-3 font-bold text-white disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleManualBooking()}
                  disabled={
                    isManualBooking ||
                    (requiresBookingOverride && bookingOverrideReason.trim().length < 10)
                  }
                  className="rounded-xl border border-indigo-400 bg-slate-900 py-3 font-bold text-indigo-200 hover:bg-indigo-950 disabled:opacity-50"
                >
                  Agendar y finalizar
                </button>
                <button
                  onClick={() => void handleManualBooking(true)}
                  disabled={
                    isManualBooking ||
                    (requiresBookingOverride && bookingOverrideReason.trim().length < 10)
                  }
                  className="rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isManualBooking ? "Agendando…" : "Agendar y continuar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
