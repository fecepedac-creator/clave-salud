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
import { db, auth } from "../../../firebase";
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
  updateDoc,
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

  const handleConfirmCancellation = (notify: boolean) => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para cancelar citas.", "warning");
      return;
    }
    if (!cancelModal.appointment) return;

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
      appointments.map((appointment) =>
        appointment.id !== cancelModal.appointment?.id
          ? appointment
          : {
              ...appointment,
              status: "available",
              patientName: "",
              patientRut: "",
              patientId: undefined,
              patientPhone: "",
              patientEmail: "",
              bookedAt: undefined,
              cancelledAt: new Date().toISOString(),
              attendanceStatus: "cancelled",
              billable: false,
            }
      )
    );
    setCancelModal({ isOpen: false, appointment: null });
    showToast("Cita cancelada y horario bloqueado.", "info");
  };

  const normalizeRut = (rut: string) => rut.replace(/[^0-9kK]/g, "").toUpperCase();

  const handleManualBooking = () => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para agendar citas.", "warning");
      return;
    }
    if (!bookingSlotId || !bookingRut || !bookingName) {
      showToast("RUT y Nombre son obligatorios", "error");
      return;
    }

    const selectedService =
      manualBookingType === "SERVICE"
        ? medicalServices.find((s) => s.id === manualBookingServiceId)
        : null;

    const updated = appointments.map((a) => {
      if (a.id === bookingSlotId) {
        return {
          ...a,
          status: "booked" as const,
          patientName: bookingName,
          patientRut: bookingRut,
          patientPhone: bookingPhone,
          type: manualBookingType,
          serviceId: manualBookingType === "SERVICE" ? manualBookingServiceId : undefined,
          serviceName: manualBookingType === "SERVICE" ? selectedService?.name : undefined,
        };
      }
      return a;
    });
    onUpdateAppointments(updated);

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
    setManualBookingType("CONSULTATION");
    setManualBookingServiceId("");
    showToast("Cita agendada manualmente.", "success");
  };

  return (
    <div className="animate-fadeIn grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar Config */}
      <div className="lg:col-span-4 space-y-6">
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
                  <button
                    key={slot.time}
                    onClick={() => toggleSlot(slot.time)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all relative ${bgColor}`}
                  >
                    <span className="text-lg font-black">{slot.time}</span>
                    <span className="text-[10px] uppercase font-bold opacity-60">
                      {isBooked
                        ? "Ocupado"
                        : realSlot
                          ? "Abierto"
                          : isPendingAdd
                            ? "Por Abrir"
                            : "Cerrado"}
                    </span>
                    {isBooked && (
                      <div className="mt-1 flex items-center gap-1 overflow-hidden w-full justify-center">
                        <User className="w-2 h-2 shrink-0" />
                        <span className="text-[8px] truncate">{realSlot.patientName}</span>
                      </div>
                    )}
                  </button>
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
                    className="w-full bg-slate-800 text-white border border-slate-700 p-3 rounded-xl"
                    value={bookingPhone}
                    onChange={(e) => setBookingPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setBookingSlotId(null)}
                  className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleManualBooking}
                  className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
