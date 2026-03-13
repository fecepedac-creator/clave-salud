import React from 'react';
import {
    CalendarPlus,
    UserRound,
    AlertCircle
} from 'lucide-react';
import { Doctor, Appointment, ViewMode } from '../types';
import LogoHeader from './LogoHeader';
import { formatRUT } from '../utils';

interface PatientPortalProps {
    view: ViewMode;
    onNavigate: (view: ViewMode) => void;
    bookingState: any; // Return value from useBooking
    doctors: Doctor[];
    renderCenterBackdrop: (children: React.ReactNode) => React.ReactNode;
}

export const PatientMenu: React.FC<PatientPortalProps> = ({
    onNavigate,
    bookingState,
    renderCenterBackdrop
}) => {
    return renderCenterBackdrop(
        <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
            <div className="max-w-4xl w-full">
                <div className="flex justify-center mb-8">
                    <LogoHeader size="lg" showText={true} />
                </div>

                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold text-slate-800">¿Qué deseas realizar?</h2>
                    <p className="text-slate-500 mt-2 text-xl">Selecciona una opción para continuar</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <button
                        onClick={() => {
                            bookingState.setBookingStep(0);
                            onNavigate("patient-booking" as ViewMode);
                        }}
                        className="bg-white/90 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-indigo-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
                    >
                        <div className="w-24 h-24 bg-indigo-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                            <CalendarPlus className="w-12 h-12 text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-3xl text-slate-800">Solicitar Hora</h3>
                        <p className="text-slate-500 mt-2 font-medium text-lg">Agendar cita con especialistas</p>
                    </button>

                    <button
                        onClick={() => onNavigate("patient-form" as ViewMode)}
                        className="bg-white/90 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-blue-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
                    >
                        <div className="w-24 h-24 bg-blue-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                            <UserRound className="w-12 h-12 text-blue-600" />
                        </div>
                        <h3 className="font-bold text-3xl text-slate-800">Completar Antecedentes</h3>
                        <p className="text-slate-500 mt-2 font-medium text-lg">Pre-ingreso y ficha clínica</p>
                    </button>

                    <button
                        onClick={() => onNavigate("patient-cancel" as ViewMode)}
                        className="bg-white/90 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-rose-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
                    >
                        <div className="w-24 h-24 bg-rose-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                            <AlertCircle className="w-12 h-12 text-rose-500" />
                        </div>
                        <h3 className="font-bold text-3xl text-slate-800">Cancelar Hora</h3>
                        <p className="text-slate-500 mt-2 font-medium text-lg">Libera una cita agendada</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const PatientCancel: React.FC<PatientPortalProps> = ({
    onNavigate,
    bookingState,
    doctors,
    renderCenterBackdrop
}) => {
    const {
        cancelRut,
        setCancelRut,
        cancelPhoneDigits,
        setCancelPhoneDigits,
        cancelLoading,
        cancelError,
        cancelResults,
        handleLookupAppointments,
        cancelPatientAppointment,
        handleReschedule
    } = bookingState;

    return renderCenterBackdrop(
        <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
            <div className="max-w-xl w-full">
                <div className="flex justify-center mb-8">
                    <LogoHeader size="md" showText={true} />
                </div>

                <div className="bg-white/90 backdrop-blur-sm rounded-[2.5rem] shadow-xl border border-white p-10">
                    <h2 className="text-3xl font-bold text-slate-800 mb-3 text-center">Cancelar Hora</h2>
                    <p className="text-slate-500 text-center mb-8">Ingresa tu RUT y teléfono para ver tus horas agendadas.</p>

                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">RUT</label>
                            <input
                                className="w-full p-4 border-2 border-slate-200 rounded-2xl font-medium outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all"
                                value={cancelRut}
                                onChange={(e) => setCancelRut(formatRUT(e.target.value))}
                                placeholder="12.345.678-9"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Teléfono</label>
                            <div className="flex items-center gap-2">
                                <span className="px-4 py-4 text-base border-2 rounded-2xl border-slate-200 bg-slate-50 text-slate-500 font-bold">+56 9</span>
                                <input
                                    className="w-full p-4 border-2 border-slate-200 rounded-2xl font-medium outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all"
                                    value={cancelPhoneDigits}
                                    onChange={(e) => setCancelPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 8))}
                                    placeholder="12345678"
                                />
                            </div>
                        </div>

                        {cancelError && <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl p-3 text-sm">{cancelError}</div>}

                        <button
                            onClick={handleLookupAppointments}
                            disabled={cancelLoading}
                            className="w-full bg-rose-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-rose-700 shadow-lg transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {cancelLoading ? "Buscando..." : "Buscar Horas"}
                        </button>

                        {cancelResults.length > 0 && (
                            <div className="pt-6 border-t border-slate-200 space-y-4">
                                <h3 className="text-lg font-bold text-slate-700 text-center">Tus horas agendadas</h3>
                                {cancelResults.map((appointment: Appointment) => {
                                    const doctor = doctors.find((doc) => doc.id === (appointment.doctorUid ?? appointment.doctorId));
                                    return (
                                        <div key={appointment.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                                            <div>
                                                <p className="text-sm text-slate-500">Profesional</p>
                                                <p className="text-base font-bold text-slate-700">{doctor?.fullName || "Profesional"}</p>
                                            </div>
                                            <div className="flex items-center justify-between text-sm text-slate-600">
                                                <span>{appointment.date}</span>
                                                <span className="font-bold">{appointment.time}</span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button onClick={() => cancelPatientAppointment(appointment)} className="flex-1 bg-rose-600 text-white py-2 rounded-xl font-bold hover:bg-rose-700">Anular</button>
                                                <button onClick={() => handleReschedule(appointment)} className="flex-1 bg-slate-900 text-white py-2 rounded-xl font-bold hover:bg-slate-800">Cambiar fecha</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
