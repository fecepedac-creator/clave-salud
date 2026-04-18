import React, { useMemo } from "react";
import {
  Plus,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Activity,
  Check,
} from "lucide-react";
import { Doctor, Appointment, MedicalCenter, ViewMode, MedicalService } from "../types";
import LogoHeader from "./LogoHeader";
import { formatRUT, getDaysInMonth } from "../utils";
import { resolveActiveState } from "../utils/activeState";
import OperationalState from "./ui/OperationalState";

interface BookingPortalProps {
  activeCenterId: string;
  activeCenter: MedicalCenter | null;
  doctors: Doctor[];
  appointments: Appointment[];
  services: MedicalService[];
  isLoadingDoctors?: boolean;
  doctorsError?: string;
  isLoadingAppointments?: boolean;
  appointmentsError?: string;
  isLoadingServices?: boolean;
  servicesError?: string;
  onRetryData?: () => void;
  bookingState: any; // Return value from useBooking
  renderCenterBackdrop: (children: React.ReactNode) => React.ReactNode;
}

const BookingPortal: React.FC<BookingPortalProps> = ({
  activeCenterId,
  activeCenter,
  doctors,
  appointments,
  services,
  isLoadingDoctors = false,
  doctorsError = "",
  isLoadingAppointments = false,
  appointmentsError = "",
  isLoadingServices = false,
  servicesError = "",
  onRetryData,
  bookingState,
  renderCenterBackdrop,
}) => {
  const {
    bookingStep,
    setBookingStep,
    bookingType,
    setBookingType,
    selectedMedicalService,
    setSelectedMedicalService,
    bookingData,
    setBookingData,
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
    handleBookingConfirm,
    resetBooking,
    error,
  } = bookingState;

  const normalizeDisplayLabel = (value: string) =>
    value
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("es-CL")
      .replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase("es-CL"));

  const getPublicCategory = (doctor: Doctor) => {
    const raw = String(doctor.clinicalRole || doctor.specialty || "").trim();
    if (!raw) return "Otros";
    return normalizeDisplayLabel(raw);
  };

  const getDoctorDedupKey = (doctor: Doctor) => {
    const email = String(doctor.email || "")
      .trim()
      .toLocaleLowerCase("es-CL");
    if (email) return `email:${email}`;

    const rut = String((doctor as any).rut || "")
      .trim()
      .toLocaleLowerCase("es-CL");
    if (rut) return `rut:${rut}`;

    const fullName = String(doctor.fullName || "")
      .trim()
      .toLocaleLowerCase("es-CL");
    const specialty = String(doctor.specialty || doctor.clinicalRole || "")
      .trim()
      .toLocaleLowerCase("es-CL");
    return `name:${doctor.centerId}:${fullName}:${specialty}`;
  };

  const NON_BOOKABLE_ROLES = ["super_admin", "superadmin", "secretaria"];

  const bookableDoctors = useMemo(
    () =>
      doctors.filter((d) => {
        const isVisible = d.visibleInBooking === true;
        const isActive = resolveActiveState(d as any);
        const roleName = String(d.clinicalRole || d.role || "").toLowerCase();
        const isInternalRole = NON_BOOKABLE_ROLES.includes(roleName);
        return isVisible && isActive && !isInternalRole;
      }),
    [doctors]
  );

  const uniqueBookableDoctors = useMemo(() => {
    const map = new Map<string, Doctor>();
    bookableDoctors.forEach((d) => {
      const dedupKey = getDoctorDedupKey(d);
      const existing = map.get(dedupKey);
      if (
        !existing ||
        (d.clinicalRole && !existing.clinicalRole) ||
        (d.specialty && !existing.specialty)
      ) {
        map.set(dedupKey, d);
      }
    });
    return Array.from(map.values());
  }, [bookableDoctors]);

  const uniqueRoles = useMemo(
    () => Array.from(new Set(uniqueBookableDoctors.map((d) => getPublicCategory(d)))),
    [uniqueBookableDoctors]
  );

  const doctorsForRole = useMemo(
    () =>
      selectedRole
        ? uniqueBookableDoctors.filter(
            (d) => getPublicCategory(d) === selectedRole && d.centerId === activeCenterId
          )
        : [],
    [selectedRole, uniqueBookableDoctors, activeCenterId]
  );

  if (!activeCenterId || !activeCenter) return null;

  const bookingFeedLoading = isLoadingDoctors || isLoadingAppointments || isLoadingServices;
  const bookingFeedError = doctorsError || appointmentsError || servicesError;

  const dateStr = bookingDate.toISOString().split("T")[0];
  const appointmentDoctorUid = (a: Appointment) => (a as any).doctorUid ?? a.doctorId;
  const availableSlotsForDay = appointments
    .filter(
      (a) =>
        appointmentDoctorUid(a) === selectedDoctorForBooking?.id &&
        a.date === dateStr &&
        a.status === "available"
    )
    .map((a) => ({
      time: a.time,
      appointmentId: a.id,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  return renderCenterBackdrop(
    <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-4xl">
        <div className="flex justify-center mb-8">
          <LogoHeader size="md" showText={true} />
        </div>

        {/* Step 0: Tipo de Atención */}
        {bookingStep === 0 && (
          <div className="animate-fadeIn">
            <h3 className="text-3xl font-bold text-slate-800 mb-8 text-center">
              ¿Qué tipo de atención necesitas?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <button
                onClick={() => {
                  setBookingType("medical");
                  setBookingStep(1);
                }}
                className="p-8 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center bg-white shadow-sm hover:shadow-md flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                  <Stethoscope className="w-8 h-8" />
                </div>
                <span className="font-bold text-xl text-slate-700">Consulta Médica</span>
                <span className="text-sm text-slate-500">Agendar con un médico especialista</span>
              </button>
              <button
                onClick={() => {
                  setBookingType("service");
                  setBookingStep(1);
                }}
                className="p-8 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-center bg-white shadow-sm hover:shadow-md flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                  <Activity className="w-8 h-8" />
                </div>
                <span className="font-bold text-xl text-slate-700">Exámenes o Pruebas</span>
                <span className="text-sm text-slate-500">
                  Laboratorio, Cardiología, Imagenología, etc.
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Especialidad */}
        {bookingStep === 1 && bookingType === "medical" && (
          <div className="animate-fadeIn">
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => setBookingStep(0)}
                className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-xl border border-slate-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-3xl font-bold text-slate-800 flex-1 text-center pr-12">
                Selecciona Especialidad
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {bookingFeedLoading ? (
                <div className="col-span-2">
                  <OperationalState
                    kind="loading"
                    title="Cargando especialistas y horarios..."
                    description="Estamos preparando la oferta disponible del centro."
                    compact
                  />
                </div>
              ) : bookingFeedError ? (
                <div className="col-span-2">
                  <OperationalState
                    kind="error"
                    title="No pudimos cargar las especialidades"
                    description={bookingFeedError}
                    onAction={onRetryData}
                  />
                </div>
              ) : (
                uniqueRoles.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setSelectedRole(r);
                      setSelectedDoctorForBooking(null);
                      setSelectedMedicalService(null);
                      setSelectedSlot(null);
                      setBookingStep(2);
                    }}
                    className="p-8 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left bg-white shadow-sm hover:shadow-md"
                  >
                    <span className="font-bold text-xl text-slate-700">{r}</span>
                  </button>
                ))
              )}
              {!bookingFeedLoading && !bookingFeedError && uniqueRoles.length === 0 && (
                <p className="text-center text-slate-400 col-span-2">
                  No hay especialistas disponibles.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Examen */}
        {bookingStep === 1 && bookingType === "service" && (
          <div className="animate-fadeIn">
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => setBookingStep(0)}
                className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-xl border border-slate-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-3xl font-bold text-slate-800 flex-1 text-center pr-12">
                Selecciona el Examen
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedMedicalService(s);
                    setSelectedRole(s.category);
                    setSelectedDoctorForBooking(null);
                    setSelectedSlot(null);
                    setBookingStep(2);
                  }}
                  className="p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left bg-white shadow-sm hover:shadow-md flex flex-col gap-2 relative"
                >
                  <span
                    className="font-bold text-lg text-slate-700 pr-12 line-clamp-2"
                    title={s.name}
                  >
                    {s.name}
                  </span>
                  <div className="absolute top-6 right-6">
                    <Plus className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="flex justify-between items-center mt-auto pt-4 text-sm text-slate-500 border-t border-slate-100 w-full">
                    <span className="capitalize">{s.category.toLowerCase()}</span>
                    {s.price > 0 && (
                      <span className="font-bold text-emerald-600">
                        ${s.price.toLocaleString("es-CL")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {services.length === 0 && (
                <p className="text-center text-slate-400 col-span-3 py-12 bg-white/50 rounded-2xl border border-slate-100">
                  No hay exámenes configurados en este centro por el momento.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Profesional / Recurso */}
        {bookingStep === 2 && (
          <div className="animate-fadeIn">
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => setBookingStep(1)}
                className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-xl border border-slate-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-3xl font-bold text-slate-800 flex-1 text-center pr-12">
                {bookingType === "service"
                  ? "Seleccione Recurso o Funcionario"
                  : "Seleccione Profesional"}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {doctorsForRole.map((docu) => (
                <button
                  key={docu.id}
                  onClick={() => {
                    setSelectedDoctorForBooking(docu);
                    setSelectedSlot(null);
                    setBookingStep(3);
                  }}
                  className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left flex items-center gap-6 bg-white shadow-sm hover:shadow-md"
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-100 flex items-center justify-center bg-indigo-50 shrink-0">
                    <span className="font-bold text-indigo-700 text-xl">
                      {docu.fullName?.charAt(0) ?? "?"}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-xl text-slate-700 block">{docu.fullName}</span>
                    <span className="text-sm text-slate-500 font-medium">
                      {docu.specialty || getPublicCategory(docu)}
                    </span>
                  </div>
                </button>
              ))}
              {doctorsForRole.length === 0 && (
                <div className="col-span-2 text-center text-slate-400 py-12 bg-white/50 rounded-2xl border border-slate-100">
                  No hay recursos disponibles para esta opción.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Fecha + Horario */}
        {bookingStep === 3 && selectedDoctorForBooking && (
          <div className="animate-fadeIn">
            {!selectedDoctorForBooking.agendaConfig && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 text-sm font-semibold text-center">
                Profesional no disponible: no tiene agenda configurada.
              </div>
            )}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => {
                  const d = new Date(bookingMonth);
                  d.setMonth(d.getMonth() - 1);
                  setBookingMonth(d);
                }}
                className="p-2 hover:bg-white rounded-xl shadow-sm transition-colors text-slate-600"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <span className="font-bold text-2xl capitalize text-slate-800 tracking-tight">
                {bookingMonth.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
              </span>

              <button
                onClick={() => {
                  const d = new Date(bookingMonth);
                  d.setMonth(d.getMonth() + 1);
                  setBookingMonth(d);
                }}
                className="p-2 hover:bg-white rounded-xl shadow-sm transition-colors text-slate-600"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-white shadow-xl p-6">
              <div className="grid grid-cols-7 gap-3 mb-3 text-center text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                <div>Lun</div>
                <div>Mar</div>
                <div>Mie</div>
                <div>Jue</div>
                <div>Vie</div>
                <div>Sab</div>
                <div>Dom</div>
              </div>

              <div className="grid grid-cols-7 gap-3">
                {getDaysInMonth(bookingMonth).map((day: Date | null, idx: number) => {
                  if (!day) return <div key={idx} />;
                  const dStr = day.toISOString().split("T")[0];
                  const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                  const availableCount = appointments.filter(
                    (a) =>
                      appointmentDoctorUid(a) === selectedDoctorForBooking.id &&
                      a.date === dStr &&
                      a.status === "available"
                  ).length;
                  const isSelected = dateStr === dStr;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (availableCount > 0 && !isPast) {
                          setBookingDate(day);
                          setSelectedSlot(null);
                        }
                      }}
                      disabled={isPast || availableCount === 0}
                      className={[
                        "h-14 rounded-2xl flex flex-col items-center justify-center transition-all relative border-2",
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-lg scale-110 z-10"
                          : isPast
                            ? "bg-slate-50 text-slate-300 border-transparent cursor-not-allowed opacity-50"
                            : availableCount > 0
                              ? "bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 hover:scale-105 font-bold cursor-pointer shadow-sm"
                              : "bg-white text-slate-300 border-slate-100 cursor-not-allowed",
                      ].join(" ")}
                    >
                      <span className="text-base">{day.getDate()}</span>
                      {availableCount > 0 && !isPast && !isSelected && (
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8">
                <h4 className="text-xl font-extrabold text-slate-800 mb-4 text-center capitalize">
                  {bookingDate.toLocaleDateString("es-CL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h4>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {availableSlotsForDay.map((slot: any) => (
                    <button
                      key={slot.time}
                      onClick={() => {
                        setSelectedSlot({
                          date: dateStr,
                          time: slot.time,
                          appointmentId: slot.appointmentId,
                        });
                        setBookingStep(4);
                      }}
                      className="py-4 bg-white border-2 border-emerald-100 text-emerald-700 font-bold rounded-2xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm hover:shadow-lg text-lg"
                    >
                      {slot.time}
                    </button>
                  ))}
                  {availableSlotsForDay.length === 0 && (
                    <div className="col-span-5 text-center text-slate-400 py-6">
                      No hay horarios disponibles para este día.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setBookingStep(2)}
                className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold bg-white/70 px-4 py-2 rounded-full w-fit"
              >
                <ArrowLeft className="w-4 h-4" /> Volver a profesionales
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Datos paciente */}
        {bookingStep === 4 && selectedDoctorForBooking && selectedSlot && (
          <div className="animate-fadeIn max-w-lg mx-auto">
            <h3 className="text-3xl font-bold text-slate-800 mb-6 text-center">
              Confirmar Reserva
            </h3>

            <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-white shadow-xl p-8 space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                  RUT Paciente
                </label>
                <input
                  className="w-full p-4 border-2 border-slate-200 rounded-2xl font-bold text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  value={bookingData.rut}
                  onChange={(e) =>
                    setBookingData({ ...bookingData, rut: formatRUT(e.target.value) })
                  }
                  placeholder="12.345.678-9"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                  Nombre Completo
                </label>
                <input
                  className="w-full p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  value={bookingData.name}
                  onChange={(e) => setBookingData({ ...bookingData, name: e.target.value })}
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                  Teléfono
                </label>
                <div className="flex items-center gap-2">
                  <span className="px-4 py-4 text-base border-2 rounded-2xl border-slate-200 bg-slate-50 text-slate-500 font-bold">
                    +56 9
                  </span>
                  <input
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                    value={bookingData.phoneDigits}
                    onChange={(e) =>
                      setBookingData({
                        ...bookingData,
                        phoneDigits: e.target.value.replace(/\D/g, "").slice(0, 8),
                      })
                    }
                    placeholder="12345678"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                  Email (opcional)
                </label>
                <input
                  type="email"
                  className="w-full p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  value={bookingData.email}
                  onChange={(e) => setBookingData({ ...bookingData, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleBookingConfirm}
                className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-bold text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-transform active:scale-95"
              >
                Confirmar Reserva
              </button>

              <button
                onClick={() => setBookingStep(3)}
                className="w-full bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
              >
                Volver a horarios
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Éxito */}
        {bookingStep === 5 && (
          <div className="animate-fadeIn text-center py-12">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
              <Check className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-4xl font-bold text-slate-800 mb-3">¡Reserva Exitosa!</h3>
            <p className="text-slate-500 text-xl">Su hora ha sido agendada correctamente.</p>
            <p className="text-slate-400 mt-3 text-sm">
              Si necesitas anular o cambiar la fecha, usa la opción “Cancelar Hora” en el menú de
              pacientes.
            </p>
            <button
              onClick={resetBooking}
              className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 text-lg shadow-lg"
            >
              Volver al Inicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPortal;
