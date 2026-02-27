import React from "react";
import { Appointment, AgendaConfig, Doctor, Patient } from "../../../types";
import AgendaView from "../../../components/AgendaView";
import { useToast } from "../../../components/Toast";
import { generateSlotId } from "../../../utils";

interface DoctorAgendaTabProps {
    isAdministrativo: boolean;
    clinicalDoctors: Doctor[];
    viewingDoctorId: string;
    setViewingDoctorId: (id: string) => void;
    currentMonth: Date;
    setCurrentMonth: (date: Date) => void;
    selectedAgendaDate: string;
    setSelectedAgendaDate: (date: string) => void;
    appointments: Appointment[];
    effectiveDoctorId: string;
    effectiveAgendaConfig?: AgendaConfig;
    isSyncingAppointments: boolean;
    isReadOnly: boolean;
    hasActiveCenter: boolean;
    currentUser: Doctor | undefined;
    activeCenterId: string | undefined;
    onUpdateAppointments: (appointments: Appointment[]) => Promise<void>;
    setSlotModal: (modal: { isOpen: boolean; appointment: Appointment | null }) => void;
    handleOpenPatientFromAppointment: (patientId: string) => void;
}

export const DoctorAgendaTab: React.FC<DoctorAgendaTabProps> = ({
    isAdministrativo,
    clinicalDoctors,
    viewingDoctorId,
    setViewingDoctorId,
    currentMonth,
    setCurrentMonth,
    selectedAgendaDate,
    setSelectedAgendaDate,
    appointments,
    effectiveDoctorId,
    effectiveAgendaConfig,
    isSyncingAppointments,
    isReadOnly,
    hasActiveCenter,
    currentUser,
    activeCenterId,
    onUpdateAppointments,
    setSlotModal,
    handleOpenPatientFromAppointment,
}) => {
    const { showToast } = useToast();

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pb-20 lg:pb-0">
            {/* Doctor Selector for Administrativo / Secretary */}
            {isAdministrativo && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <label className="text-xs font-bold text-amber-700 uppercase mb-2 block">
                        Seleccionar Profesional para gestionar agenda
                    </label>
                    <select
                        className="w-full bg-white border border-amber-300 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500 font-medium"
                        value={viewingDoctorId}
                        onChange={(e) => setViewingDoctorId(e.target.value)}
                    >
                        <option value="">-- Selecciona un profesional --</option>
                        {clinicalDoctors.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.fullName} ({d.role})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {isAdministrativo && !viewingDoctorId ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <p className="text-lg">Selecciona un profesional para gestionar su agenda.</p>
                </div>
            ) : (
                <AgendaView
                    currentMonth={currentMonth}
                    selectedAgendaDate={selectedAgendaDate}
                    appointments={appointments}
                    doctorId={effectiveDoctorId}
                    agendaConfig={effectiveAgendaConfig}
                    isSyncingAppointments={isSyncingAppointments}
                    onMonthChange={(inc) => {
                        const newDate = new Date(currentMonth);
                        newDate.setMonth(newDate.getMonth() + inc);
                        setCurrentMonth(newDate);
                    }}
                    onDateClick={(date) => setSelectedAgendaDate(date.toISOString().split("T")[0])}
                    onToggleSlot={async (time) => {
                        if (isReadOnly) return;
                        if (!hasActiveCenter) {
                            showToast("Selecciona un centro activo para modificar la agenda.", "warning");
                            return;
                        }
                        const date = selectedAgendaDate;
                        if (!date) return;

                        const matchingSlots = appointments.filter(
                            (a) =>
                                ((a as any).doctorUid ?? a.doctorId) === effectiveDoctorId &&
                                a.date === date &&
                                a.time === time
                        );
                        const bookedSlot = matchingSlots.find((slot) => slot.status === "booked");

                        if (bookedSlot) {
                            setSlotModal({ isOpen: true, appointment: bookedSlot });
                        } else if (matchingSlots.length > 0) {
                            const matchingIds = new Set(matchingSlots.map((slot) => slot.id));
                            await onUpdateAppointments(appointments.filter((a) => !matchingIds.has(a.id)));
                            showToast("Bloque cerrado (horario bloqueado).", "info");
                        } else {
                            const newSlot: Appointment = {
                                id: generateSlotId(
                                    currentUser?.centerId || activeCenterId || "",
                                    effectiveDoctorId,
                                    date,
                                    time
                                ),
                                centerId: currentUser?.centerId || activeCenterId || "",
                                doctorId: effectiveDoctorId,
                                doctorUid: effectiveDoctorId,
                                date,
                                time,
                                status: "available",
                                active: true,
                                patientName: "",
                                patientRut: "",
                            };
                            await onUpdateAppointments([...appointments, newSlot]);
                            showToast("Bloque abierto disponible.", "success");
                        }
                    }}
                    onOpenPatient={handleOpenPatientFromAppointment}
                    readOnly={isReadOnly}
                />
            )}
        </div>
    );
};
