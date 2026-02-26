import { useState, useCallback } from "react";
import { db, auth } from "../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, setDoc, updateDoc, serverTimestamp, runTransaction, getDoc } from "firebase/firestore";
import { Appointment, Doctor, Patient, ViewMode } from "../types";
import {
  extractChileanPhoneDigits,
  formatChileanPhone,
  formatRUT,
  generateId,
  validateRUT,
  getPatientIdByRut,
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
    const patientId = getPatientIdByRut(normalizedRut);
    const existingPatient = patients.find(
      (patient) => normalizeRut((patient.rut ?? "").trim()) === normalizedRut
    );

    // ---- TRANSACTIONAL BOOKING (prevents double bookings) ----
    const apptRef = doc(db, "centers", activeCenterId, "appointments", selectedSlot.appointmentId);
    let bookedAppointment: Appointment;

    try {
      await runTransaction(db, async (transaction) => {
        const apptSnap = await transaction.get(apptRef);
        if (!apptSnap.exists()) {
          throw new Error("El horario ya no existe. El profesional puede haberlo cerrado recientemente.");
        }
        const currentData = apptSnap.data() as Appointment;
        if (currentData?.status !== "available") {
          throw new Error("Este horario acaba de ser reservado por otro paciente. Por favor, selecciona otro bloque.");
        }

        transaction.update(apptRef, {
          status: "booked",
          patientName: name,
          patientRut: formattedRut,
          patientId,
          patientPhone: phone,
          patientEmail: email || null,
          bookedAt: serverTimestamp(),
        });
      });

      bookedAppointment = {
        ...slotAppointment,
        status: "booked",
        patientName: name,
        patientRut: formattedRut,
        patientId,
        patientPhone: phone,
        patientEmail: email || undefined,
        bookedAt: new Date().toISOString(),
        active: slotAppointment.active ?? true,
      };

      setAppointments((prev) =>
        prev.map((appt) => (appt.id === bookedAppointment.id ? bookedAppointment : appt))
      );
    } catch (txError: unknown) {
      const message = txError instanceof Error ? txError.message : "No se pudo completar la reserva.";
      showToast(message, "error");
      return;
    }

    if (activeCenterId && !existingPatient) {
      // Assign patient to the DOCTOR (not the person booking)
      const doctorUid = selectedDoctorForBooking.id;
      const patientPayload: Patient = {
        id: patientId,
        ownerUid: doctorUid,
        accessControl: {
          allowedUids: [doctorUid],
          centerIds: activeCenterId ? [activeCenterId] : [],
        },
        centerId: activeCenterId,
        rut: formattedRut,
        fullName: name,
        birthDate: "",
        gender: "Otro",
        phone,
        email: email || undefined,
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

      try {
        // We use setDoc on the GLOBAL collection.
        // If it already exists, this might fail if the user is public and has no update permissions.
        // But for a new patient, it will create the record correctly.
        await setDoc(doc(db, "patients", patientId), patientPayload);
      } catch (err) {
        console.warn("Patient already exists or creation failed (Global):", err);
        // We don't block the booking if patient creation fails (it likely already exists)
      }
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

    setBookingStep(4);
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
      const response = await fn({
        centerId: activeCenterId,
        rut,
        phone: formatChileanPhone(phoneDigits),
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
        await fn({
          centerId: activeCenterId,
          appointmentId: appointment.id,
          rut,
          phone: formatChileanPhone(phoneDigits),
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
      setBookingStep(2);
    },
    [cancelPatientAppointment, doctors, bookingData]
  );

  return {
    bookingStep,
    setBookingStep,
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
