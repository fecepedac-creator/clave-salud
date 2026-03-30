import { useState, useCallback } from "react";
import { auth } from "../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Appointment, Doctor, Patient } from "../types";
import { issuePublicAppointmentChallenge } from "../src/publicAppointmentChallenge";
import {
  extractChileanPhoneDigits,
  formatChileanPhone,
  formatRUT,
  validateRUT,
} from "../utils";

export function useBooking(
  activeCenterId: string,
  appointments: Appointment[],
  patients: Patient[],
  doctors: Doctor[],
  updateAppointment: (appointment: Appointment) => Promise<void>,
  setAppointments: (setter: (prev: Appointment[]) => Appointment[]) => void,
  showToast: (message: string, type: "success" | "error" | "info" | "warning") => void
) {
  const [bookingStep, setBookingStep] = useState(0);
  const [bookingType, setBookingType] = useState<"medical" | "service" | null>(null);
  const [selectedMedicalService, setSelectedMedicalService] = useState<any | null>(null);
  const [bookingData, setBookingData] = useState<{
    name: string;
    rut: string;
    phoneDigits: string;
    email: string;
  }>({
    name: "",
    rut: "",
    phoneDigits: "",
    email: "",
  });
  const [prefillContact, setPrefillContact] = useState<{
    name: string;
    rut: string;
    phone: string;
    email?: string;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("lastBookingContact");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<Doctor | null>(null);
  const [bookingDate, setBookingDate] = useState<Date>(new Date());
  const [bookingMonth, setBookingMonth] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    time: string;
    appointmentId: string;
  } | null>(null);

  // Cancellation state
  const [cancelRut, setCancelRut] = useState("");
  const [cancelPhoneDigits, setCancelPhoneDigits] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelResults, setCancelResults] = useState<Appointment[]>([]);

  const normalizeRut = (value: string) => value.replace(/[^0-9kK]/g, "").toUpperCase();

  const handleBookingConfirm = useCallback(async () => {
    const name = bookingData.name.trim();
    const rut = bookingData.rut.trim();
    const phoneDigits = bookingData.phoneDigits.trim();
    if (!selectedSlot || !selectedDoctorForBooking) {
      showToast("Selecciona un horario y profesional.", "error");
      return;
    }
    if (!name) {
      showToast("Ingresa el nombre completo.", "error");
      return;
    }
    if (!rut || !validateRUT(rut)) {
      showToast("RUT inválido. Verifica el formato.", "error");
      return;
    }
    if (!phoneDigits || phoneDigits.length !== 8) {
      showToast("Ingresa un teléfono válido de 8 dígitos.", "error");
      return;
    }
    const email = bookingData.email.trim().toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showToast("Ingresa un email válido o déjalo vacío.", "error");
      return;
    }

    const phone = formatChileanPhone(phoneDigits);
    const slotAppointment = appointments.find(
      (appointment) => appointment.id === selectedSlot.appointmentId
    );
    if (!slotAppointment || slotAppointment.status !== "available") {
      showToast("El horario ya no está disponible. Selecciona otro.", "error");
      return;
    }

    const normalizedRut = normalizeRut(rut);
    const formattedRut = formatRUT(normalizedRut);
    let bookedAppointment: Appointment;

    try {
      const functions = getFunctions();
      const challenge = await issuePublicAppointmentChallenge({
        centerId: activeCenterId,
        action: "book",
        rut: formattedRut,
        phone,
      });
      const fn = httpsCallable(functions, "bookPublicAppointment");
      const response = await fn({
        centerId: activeCenterId,
        appointmentId: selectedSlot.appointmentId,
        doctorId: selectedDoctorForBooking.id,
        date: selectedSlot.date,
        patientName: name,
        rut: formattedRut,
        phone,
        email,
        serviceId: bookingType === "service" ? selectedMedicalService?.id || "" : "",
        serviceName: bookingType === "service" ? selectedMedicalService?.name || "" : "",
        challengeId: challenge.challengeId,
        challengeToken: challenge.challengeToken,
      });

      const data = (response.data as { appointment?: Appointment } | undefined)?.appointment;
      if (!data) {
        throw new Error("No se recibió confirmación de la reserva.");
      }

      bookedAppointment = {
        ...slotAppointment,
        ...data,
        active: data.active ?? slotAppointment.active ?? true,
      };

      setAppointments((prev) =>
        prev.map((appt) => (appt.id === bookedAppointment.id ? bookedAppointment : appt))
      );
    } catch (txError: unknown) {
      const message =
        txError instanceof Error ? txError.message : "No se pudo completar la reserva.";
      showToast(message, "error");
      return;
    }

    if (!auth.currentUser) {
      const storedContact = {
        name: bookingData.name,
        rut: formattedRut,
        phone,
        email: email || undefined,
      };
      setPrefillContact(storedContact);
      try {
        window.localStorage.setItem("lastBookingContact", JSON.stringify(storedContact));
      } catch {
        // ignore storage failures
      }
    }

    setBookingStep(5);
  }, [
    bookingData,
    selectedSlot,
    selectedDoctorForBooking,
    appointments,
    patients,
    activeCenterId,
    showToast,
    updateAppointment,
    setAppointments,
  ]);

  const resetBooking = useCallback(() => {
    setBookingStep(0);
    setBookingType(null);
    setSelectedMedicalService(null);
    setBookingData({ name: "", rut: "", phoneDigits: "", email: "" });
    setSelectedRole("");
    setSelectedDoctorForBooking(null);
    setBookingDate(new Date());
    setBookingMonth(new Date());
    setSelectedSlot(null);
  }, []);

  const handleLookupAppointments = useCallback(async () => {
    if (!activeCenterId) {
      showToast("Selecciona un centro activo para continuar.", "warning");
      return;
    }
    const rut = cancelRut.trim();
    const phoneDigits = cancelPhoneDigits.trim();
    if (!rut || !validateRUT(rut)) {
      setCancelError("Ingresa un RUT válido.");
      return;
    }
    try {
      if (!phoneDigits || phoneDigits.length !== 8) {
        setCancelError("Ingresa un teléfono válido de 8 dígitos.");
        return;
      }
      setCancelError("");
      setCancelLoading(true);
      const functions = getFunctions();
      const fn = httpsCallable(functions, "listPatientAppointments");
      const challenge = await issuePublicAppointmentChallenge({
        centerId: activeCenterId,
        action: "lookup",
        rut,
        phone: formatChileanPhone(phoneDigits),
      });
      const response = await fn({
        centerId: activeCenterId,
        rut,
        phone: formatChileanPhone(phoneDigits),
        challengeId: challenge.challengeId,
        challengeToken: challenge.challengeToken,
      });
      const data = (response.data as { appointments?: Appointment[] }) || {};
      setCancelResults((data.appointments || []) as Appointment[]);
      if (!data.appointments || data.appointments.length === 0) {
        showToast("No encontramos horas agendadas con esos datos.", "info");
      }
    } catch (error) {
      console.error("lookupAppointments", error);
      showToast("No se pudieron cargar las horas agendadas.", "error");
    } finally {
      setCancelLoading(false);
    }
  }, [activeCenterId, cancelRut, cancelPhoneDigits, showToast]);

  const cancelPatientAppointment = useCallback(
    async (appointment: Appointment) => {
      if (!activeCenterId) {
        showToast("Selecciona un centro activo para cancelar.", "warning");
        return false;
      }
      const rut = cancelRut.trim();
      const phoneDigits = cancelPhoneDigits.trim();
      if (!rut || !phoneDigits) {
        setCancelError("Ingresa tu RUT y teléfono.");
        return false;
      }
      try {
        const functions = getFunctions();
        const fn = httpsCallable(functions, "cancelPatientAppointment");
        const challenge = await issuePublicAppointmentChallenge({
          centerId: activeCenterId,
          action: "cancel",
          rut,
          phone: formatChileanPhone(phoneDigits),
        });
        await fn({
          centerId: activeCenterId,
          appointmentId: appointment.id,
          rut,
          phone: formatChileanPhone(phoneDigits),
          challengeId: challenge.challengeId,
          challengeToken: challenge.challengeToken,
        });
        setCancelResults((prev) => prev.filter((item) => item.id !== appointment.id));
        showToast("Hora cancelada y liberada correctamente.", "success");
        return true;
      } catch (error) {
        console.error("cancelAppointment", error);
        showToast("No se pudo cancelar la hora. Verifica los datos.", "error");
        return false;
      }
    },
    [activeCenterId, cancelRut, cancelPhoneDigits, showToast]
  );

  const handleReschedule = useCallback(
    async (appointment: Appointment) => {
      const cancelled = await cancelPatientAppointment(appointment);
      if (!cancelled) return;
      const doctor = doctors.find(
        (doc) => doc.id === (appointment.doctorUid ?? appointment.doctorId)
      );
      if (doctor) {
        setSelectedRole(String(doctor.clinicalRole || doctor.specialty || doctor.role || ""));
        setSelectedDoctorForBooking(doctor);
      }
      setBookingData({
        name: appointment.patientName || bookingData.name,
        rut: appointment.patientRut || bookingData.rut,
        phoneDigits: extractChileanPhoneDigits(appointment.patientPhone || ""),
      });
      setSelectedSlot(null);
      setBookingDate(new Date());
      setBookingMonth(new Date());
      setBookingStep(3);
    },
    [cancelPatientAppointment, doctors, bookingData]
  );

  return {
    bookingStep,
    setBookingStep,
    bookingType,
    setBookingType,
    selectedMedicalService,
    setSelectedMedicalService,
    bookingData,
    setBookingData,
    prefillContact,
    setPrefillContact,
    selectedRole,
    setSelectedRole,
    selectedDoctorForBooking,
    setSelectedDoctorForBooking,
    bookingDate,
    setBookingDate,
    bookingMonth,
    setBookingMonth,
    selectedSlot,
    setSelectedSlot,
    cancelRut,
    setCancelRut,
    cancelPhoneDigits,
    setCancelPhoneDigits,
    cancelLoading,
    cancelError,
    setCancelError,
    cancelResults,
    setCancelResults,
    handleBookingConfirm,
    resetBooking,
    handleLookupAppointments,
    cancelPatientAppointment,
    handleReschedule,
  };
}
