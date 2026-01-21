
import React, { useState, useEffect, useContext } from 'react';
import { CenterContext } from '../CenterContext';
import { Doctor, Appointment, Patient, AgendaConfig, AuditLogEntry, ProfessionalRole, Preadmission } from '../types';
import { generateId, formatRUT, getStandardSlots, downloadJSON, fileToBase64 } from '../utils';
import { Users, Calendar, Plus, Trash2, Save, LogOut, Search, Clock, Phone, Edit, Lock, Mail, GraduationCap, X, Check, Download, ChevronLeft, ChevronRight, Database, QrCode, Share2, Copy, Settings, Upload, MessageCircle, AlertTriangle, ShieldCheck, FileClock, Shield, Briefcase, Camera, User } from 'lucide-react';
import { useToast } from './Toast';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, serverTimestamp, where, getDocs, Timestamp, deleteDoc } from 'firebase/firestore';

interface AdminDashboardProps {
    centerId: string; // NEW PROP: Required to link slots to the specific center
    doctors: Doctor[];
    onUpdateDoctors: (doctors: Doctor[]) => void;
    appointments: Appointment[];
    onUpdateAppointments: (appointments: Appointment[]) => void;
    onLogout: () => void;
    patients: Patient[];
    onUpdatePatients: (patients: Patient[]) => void;
    preadmissions: Preadmission[];
    onApprovePreadmission: (item: Preadmission) => void;
    logs?: AuditLogEntry[]; // Prop used as fallback for Mock Mode (when db is null)
    onLogActivity: (action: AuditLogEntry['action'], details: string, targetId?: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
    'Medico': 'Médico',
    'Enfermera': 'Enfermera/o',
    'Kinesiologo': 'Kinesiólogo',
    'Psicologo': 'Psicólogo',
    'Fonoaudiologo': 'Fonoaudiólogo',
    'Terapeuta': 'Terapeuta Ocupacional',
    'Podologo': 'Podólogo',
    'Odontologo': 'Odontólogo',
    'Matrona': 'Matrona',
    'Nutricionista': 'Nutricionista'
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    centerId, doctors, onUpdateDoctors, appointments, onUpdateAppointments, onLogout, patients, onUpdatePatients, preadmissions, onApprovePreadmission, logs, onLogActivity 
}) => {
    const [activeTab, setActiveTab] = useState<'doctors' | 'agenda' | 'audit' | 'preadmissions'>('doctors');
    const { showToast } = useToast();
    const { activeCenterId, isModuleEnabled } = useContext(CenterContext);
    const hasActiveCenter = Boolean(activeCenterId);
    // --- defensive module guard ---
    useEffect(() => {
        if (activeTab === 'agenda' && !isModuleEnabled('agenda')) setActiveTab('doctors');
        if (activeTab === 'audit' && !isModuleEnabled('audit')) setActiveTab('doctors');
    }, [activeTab, isModuleEnabled]);

    
    // --- STATE FOR DOCTORS MANAGEMENT ---
    const [isEditingDoctor, setIsEditingDoctor] = useState(false);
    const [currentDoctor, setCurrentDoctor] = useState<Partial<Doctor>>({ role: (Object.keys(ROLE_LABELS)[0] as ProfessionalRole) });

    // --- STATE FOR AGENDA MANAGEMENT ---
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctors[0]?.id || '');
    const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
    const [bookingRut, setBookingRut] = useState('');
    const [bookingName, setBookingName] = useState('');
    const [bookingPhone, setBookingPhone] = useState('');

    // --- STATE FOR AUDIT LOGS (LAZY LOADED) ---
    const [fetchedLogs, setFetchedLogs] = useState<AuditLogEntry[]>([]);

    // Cancellation Modal State
    const [cancelModal, setCancelModal] = useState<{ isOpen: boolean, appointment: Appointment | null }>({ isOpen: false, appointment: null });

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string>('');

    const resolvePreadmissionDate = (item: Preadmission) => {
        const raw = (item as any).createdAt;
        if (!raw) return null;
        if (typeof raw?.toDate === 'function') return raw.toDate();
        if (typeof raw?.seconds === 'number') return new Date(raw.seconds * 1000);
        if (typeof raw === 'string' || typeof raw === 'number') return new Date(raw);
        return null;
    };

    const sortedPreadmissions = [...preadmissions].sort((a, b) => {
        const aDate = resolvePreadmissionDate(a)?.getTime() ?? 0;
        const bDate = resolvePreadmissionDate(b)?.getTime() ?? 0;
        return bDate - aDate;
    });
    
    // Helper Date for past calculation
    const today = new Date();
    today.setHours(0,0,0,0);

    // Dynamic Config State - DEFAULT: 20 mins, 08:00 to 21:00
    const [tempConfig, setTempConfig] = useState<AgendaConfig>({
        slotDuration: 20,
        startTime: '08:00',
        endTime: '21:00'
    });

    // Update temp config when doctor changes
    useEffect(() => {
        const doc = doctors.find(d => d.id === selectedDoctorId);
        if (doc && doc.agendaConfig) {
            setTempConfig(doc.agendaConfig);
        } else {
            // Default Fallback
            setTempConfig({ slotDuration: 20, startTime: '08:00', endTime: '21:00' });
        }
    }, [selectedDoctorId, doctors]);

    // Share Modal State
    const [showShareModal, setShowShareModal] = useState(false);

    const normalizeRut = (rut: string) => rut.replace(/[^0-9kK]/g, '').toUpperCase();

    // --- LAZY LOAD LOGS ---
    useEffect(() => {
        if (activeTab === 'audit' && db) {
            // Only fetch if tab is active AND db is connected
            const q = query(collection(db, "centers", centerId, "auditLogs"), orderBy('timestamp', 'desc'), limit(50));
            const unsub = onSnapshot(q, (snapshot) => {
                setFetchedLogs(snapshot.docs.map(d => d.data() as AuditLogEntry));
            });
            return () => unsub();
        }
    }, [activeTab]);

    // Use fetched logs if DB exists, otherwise fallback to props (Mock Mode)
    const displayLogs = (db && fetchedLogs.length > 0) ? fetchedLogs : (logs || []);

    // --- DOCTOR FUNCTIONS ---
// Persistencia (Firestore): en el modelo definitivo NO se escribe a colección raíz 'doctors'.
// El alta de profesionales se hace mediante INVITACIÓN por email. Al aceptar el invite,
// la app (o una Cloud Function) crea centers/{centerId}/staff/{uid}.
const persistDoctorToFirestore = async (doctor: Doctor) => {
    if (!db) return;

    const staffId = doctor.id || generateId();
    const emailLower = (doctor.email || '').toLowerCase();

    await setDoc(
        doc(db, 'centers', centerId, 'staff', staffId),
        {
            ...doctor,
            id: staffId,
            centerId,
            emailLower,
            active: doctor.active ?? true,
            updatedAt: serverTimestamp(),
            createdAt: (doctor as any).createdAt ?? serverTimestamp()
        },
        { merge: true }
    );

    if (!emailLower) return;

    // Evitar duplicar invitaciones pendientes para el mismo correo/centro
    const qInv = query(
        collection(db, 'invites'),
        where('emailLower', '==', emailLower),
        where('centerId', '==', centerId),
        where('status', '==', 'pending')
    );

    const snap = await getDocs(qInv);
    if (!snap.empty) return;

    // Rol de acceso al sistema (no confundir con ProfessionalRole clínico)
    const accessRole = doctor.isAdmin ? 'center_admin' : 'doctor';

    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
    await setDoc(doc(db, 'invites', generateId()), {
        emailLower,
        email: doctor.email,
        centerId,
        role: accessRole,
        professionalRole: doctor.role, // rol/profesión clínica (Medico, Enfermera, etc.)
        status: 'pending',
        expiresAt: Timestamp.fromDate(expires),
        createdAt: serverTimestamp(),
        createdByUid: 'centerAdmin' // (opcional) ideal: uid real en el futuro
    });
};
    const handleSaveDoctor = async () => {
        if (!hasActiveCenter) {
            showToast("Selecciona un centro activo para crear profesionales.", "warning");
            return;
        }
        if (!currentDoctor.fullName || !currentDoctor.rut || !currentDoctor.email || !currentDoctor.role) {
            showToast("Por favor complete todos los campos obligatorios.", "error");
            return;
        }

        const normalizedRut = normalizeRut(currentDoctor.rut);
        const duplicateRut = doctors.find(
            (doctor) => normalizeRut(doctor.rut ?? '') === normalizedRut && doctor.id !== currentDoctor.id
        );
        if (duplicateRut) {
            showToast("Ya existe un profesional con este RUT.", "error");
            return;
        }

        if (currentDoctor.id) {
            // Edit
            const updated = doctors.map(d => d.id === currentDoctor.id ? currentDoctor as Doctor : d);
            onUpdateDoctors(updated);
            try {
                await persistDoctorToFirestore(currentDoctor as Doctor);
                showToast("Profesional actualizado.", "success");
            } catch (e) {
                console.error("persistDoctorToFirestore", e);
                showToast("No se pudo guardar el profesional en Firestore.", "error");
            }
        } else {
            // Create
            const newDoc: Doctor = {
                ...currentDoctor as Doctor,
                id: generateId(),
                centerId: centerId, // Ensure doctor is created in this center
                agendaConfig: { slotDuration: 20, startTime: '08:00', endTime: '21:00' } // Default config
            };
            onUpdateDoctors([...doctors, newDoc]);
            try {
                await persistDoctorToFirestore(newDoc);
                showToast("Profesional creado exitosamente.", "success");
            } catch (e) {
                console.error("persistDoctorToFirestore", e);
                showToast("No se pudo guardar el profesional en Firestore.", "error");
            }
        }
        setIsEditingDoctor(false);
        setCurrentDoctor({ role: 'Medico' });
    };

    const handleDeleteDoctor = async (id: string) => {
        if (!hasActiveCenter) {
            showToast("Selecciona un centro activo para eliminar profesionales.", "warning");
            return;
        }
        if (window.confirm("¿Está seguro de eliminar este profesional? Se perderá el acceso y sus datos.")) {
            if (db) {
                try {
                    await deleteDoc(doc(db, 'centers', centerId, 'staff', id));
                } catch (error) {
                    console.error("deleteDoc", error);
                    showToast("No se pudo eliminar el profesional en Firestore.", "error");
                    return;
                }
            }
            onUpdateDoctors(doctors.filter(d => d.id !== id));
            showToast("Profesional eliminado.", "info");
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const base64 = await fileToBase64(e.target.files[0]);
                setCurrentDoctor({...currentDoctor, photoUrl: base64});
            } catch (err) {
                showToast("Error al subir imagen. Use JPG/PNG pequeño.", "error");
            }
        }
    };

    // --- BACKUP & RESTORE FUNCTIONS ---
    const handleRestoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = e.target?.result as string;
                const data = JSON.parse(json);

                if (data.patients && Array.isArray(data.patients)) {
                    onUpdatePatients(data.patients);
                }
                if (data.doctors && Array.isArray(data.doctors)) {
                    onUpdateDoctors(data.doctors);
                }
                if (data.appointments && Array.isArray(data.appointments)) {
                    onUpdateAppointments(data.appointments);
                }

                showToast("Base de datos restaurada correctamente.", "success");
            } catch (error) {
                console.error(error);
                showToast("Error al leer el archivo de respaldo.", "error");
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    };

    // --- CALENDAR & AGENDA FUNCTIONS ---
    
    // Save Config to Doctor Profile
    const handleSaveConfig = () => {
        let updatedDoctor: Doctor | null = null;
    
        const updatedDoctors = doctors.map(d => {
            if (d.id === selectedDoctorId) {
                updatedDoctor = { ...d, agendaConfig: tempConfig };
                return updatedDoctor;
            }
            return d;
        });
    
        onUpdateDoctors(updatedDoctors);
    
        if (updatedDoctor) {
            persistDoctorToFirestore(updatedDoctor)
                .catch((e) => console.error("persistDoctorToFirestore", e));
        }
    
        showToast("Configuración de agenda guardada.", "success");
    };
    
    // Get calendar days
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 Sun, 1 Mon...
        
        // Adjust for Monday start (Chilean standard usually)
        // 0 (Sun) -> 6, 1 (Mon) -> 0
        const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        const days = [];
        // Empty slots for previous month
        for (let i = 0; i < startingDay; i++) {
            days.push(null);
        }
        // Actual days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const handleDateClick = (date: Date) => {
        // Format YYYY-MM-DD
        const formatted = date.toISOString().split('T')[0];
        setSelectedDate(formatted);
    };

    const handleMonthChange = (increment: number) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentMonth(newDate);
        setSelectedDate(''); // Reset selection on month change
    };

    const toggleSlot = (time: string) => {
        if (!hasActiveCenter) {
            showToast("Selecciona un centro activo para modificar la agenda.", "warning");
            return;
        }
        if (!selectedDate || !selectedDoctorId) return;

        // Check if slot exists
        const appointmentDoctorUid = (a: Appointment) => (a as any).doctorUid ?? a.doctorId;
        const existingSlot = appointments.find(
            a => appointmentDoctorUid(a) === selectedDoctorId && a.date === selectedDate && a.time === time
        );

        if (existingSlot) {
            // If booked, handle via modal
            if (existingSlot.status === 'booked') {
                setCancelModal({ isOpen: true, appointment: existingSlot });
                return;
            }
            // If available, remove slot (Close it/Block it)
            onUpdateAppointments(appointments.filter(a => a.id !== existingSlot.id));
            showToast("Bloque cerrado.", "info");
        } else {
            // Create slot (Open it)
            const newSlot: Appointment = {
                id: generateId(),
                centerId: centerId, // FIXED: Correctly assigning the current center ID
                doctorId: selectedDoctorId,
                doctorUid: selectedDoctorId,
                date: selectedDate,
                time: time,
                status: 'available',
                patientName: '',
                patientRut: ''
            };
            onUpdateAppointments([...appointments, newSlot]);
            showToast("Bloque abierto exitosamente.", "success");
        }
    };

    const handleConfirmCancellation = (notify: boolean) => {
        if (!hasActiveCenter) {
            showToast("Selecciona un centro activo para cancelar citas.", "warning");
            return;
        }
        if (!cancelModal.appointment) return;
        
        // LOG CANCELLATION
        onLogActivity('delete', `Canceló cita de ${cancelModal.appointment.patientName} (${cancelModal.appointment.date} ${cancelModal.appointment.time}). Notificación: ${notify ? 'Si' : 'No'}`, cancelModal.appointment.id);

        if (notify) {
            // WhatsApp Logic
            const apt = cancelModal.appointment;
            const doctor = doctors.find(d => d.id === ((apt as any).doctorUid ?? apt.doctorId));
            const rawPhone = apt.patientPhone || '';
            const cleanPhone = rawPhone.replace(/\D/g, ''); // Remove non-digits
            
            // Basic check for Chilean numbers or international format
            let waNumber = cleanPhone;
            if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) waNumber = `56${cleanPhone}`;
            
            const message = `Hola ${apt.patientName}, le escribimos de Centro SaludMass. Lamentamos informar que su hora agendada para el día ${apt.date} a las ${apt.time} hrs con ${doctor?.fullName || 'el especialista'} ha tenido que ser suspendida por motivos de fuerza mayor. Por favor contáctenos para reagendar.`;
            
            const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
        }

        // Delete appointment
        onUpdateAppointments(appointments.filter(a => a.id !== cancelModal.appointment?.id));
        setCancelModal({ isOpen: false, appointment: null });
        showToast("Cita cancelada y horario bloqueado.", "info");
    };

    const handleManualBooking = () => {
        if (!hasActiveCenter) {
            showToast("Selecciona un centro activo para agendar citas.", "warning");
            return;
        }
        if (!bookingSlotId || !bookingRut || !bookingName) {
            showToast("RUT y Nombre son obligatorios", "error");
            return;
        }

        const updated = appointments.map(a => {
            if (a.id === bookingSlotId) {
                return { 
                    ...a, 
                    status: 'booked' as const, 
                    patientName: bookingName, 
                    patientRut: bookingRut,
                    patientPhone: bookingPhone
                };
            }
            return a;
        });
        onUpdateAppointments(updated);
        
        // LOG MANUAL BOOKING
        onLogActivity('create', `Agendamiento manual Admin para ${bookingName}.`, bookingSlotId);

        setBookingSlotId(null);
        setBookingRut('');
        setBookingName('');
        setBookingPhone('');
        showToast("Cita agendada manualmente.", "success");
    };

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            {!hasActiveCenter && (
                <div className="bg-amber-500/20 text-amber-200 border-b border-amber-500/40 px-6 py-3 text-sm">
                    Selecciona un centro activo para habilitar la gestión de profesionales, agenda y preingresos.
                </div>
            )}
            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-sm w-full relative text-center">
                        <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
                        <h3 className="text-2xl font-bold mb-4">Compartir App</h3>
                        <p className="text-slate-500 mb-6">Escanea este código con tu celular para abrir la versión móvil.</p>
                        
                        <div className="bg-slate-100 p-4 rounded-xl mb-6 mx-auto w-48 h-48 flex items-center justify-center border-2 border-slate-200">
                             {/* Placeholder for QR Code, in a real app use a library */}
                             <QrCode className="w-32 h-32 text-slate-800"/>
                        </div>
                        
                        <div className="flex gap-2">
                             <input className="w-full bg-slate-100 border border-slate-200 p-3 rounded-lg text-sm text-slate-600" value={window.location.origin} readOnly />
                             <button onClick={() => {navigator.clipboard.writeText(window.location.origin); showToast("Enlace copiado", "info")}} className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"><Copy className="w-5 h-5"/></button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <nav className="bg-slate-800 border-b border-slate-700 px-8 py-5 flex justify-between items-center sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-500 p-2 rounded-lg"><Database className="w-6 h-6 text-white"/></div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Panel de Administración</h1>
                        <p className="text-xs text-indigo-400 font-mono tracking-wider">MODO SUPERUSUARIO</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                        <Share2 className="w-4 h-4"/> Compartir App
                     </button>
                     
                     <div className="flex gap-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 cursor-pointer">
                            <Upload className="w-4 h-4"/> Restaurar
                            <input type="file" accept=".json" className="hidden" onChange={handleRestoreBackup} />
                        </label>
                        <button onClick={() => {downloadJSON({ patients, doctors, appointments }, 'backup-clinica.json'); showToast("Descargando backup...", "info")}} className="flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                            <Download className="w-4 h-4"/> Backup
                        </button>
                     </div>

                     <button onClick={onLogout} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-red-400 transition-colors">
                        <LogOut className="w-4 h-4"/> Salir
                     </button>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto p-8">
                {/* Tabs */}
                <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit mb-8">
                    <button 
                        onClick={() => setActiveTab('doctors')}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'doctors' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Users className="w-4 h-4"/> Gestión de Profesionales
                    </button>
                    <button 
                        onClick={() => setActiveTab('agenda')}
                        disabled={!hasActiveCenter}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'agenda' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={hasActiveCenter ? "Configurar agenda" : "Selecciona un centro activo"}
                    >
                        <Calendar className="w-4 h-4"/> Configurar Agenda
                    </button>
                    <button 
                        onClick={() => setActiveTab('audit')}
                        disabled={!hasActiveCenter}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={hasActiveCenter ? "Auditoría" : "Selecciona un centro activo"}
                    >
                        <ShieldCheck className="w-4 h-4"/> Seguridad / Auditoría
                    </button>
                    <button 
                        onClick={() => setActiveTab('preadmissions')}
                        disabled={!hasActiveCenter}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'preadmissions' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={hasActiveCenter ? "Preingresos" : "Selecciona un centro activo"}
                    >
                        <User className="w-4 h-4"/> Preingresos
                    </button>
                </div>

                {/* DOCTORS MANAGEMENT */}
                {activeTab === 'doctors' && isModuleEnabled('doctors') && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
                        {/* List */}
                        <div className="lg:col-span-2 space-y-4">
                            {doctors.map(doc => (
                                <div key={doc.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex justify-between items-center group hover:border-indigo-500 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl overflow-hidden border-2 ${doc.isAdmin ? 'border-indigo-500' : 'border-slate-600'} bg-slate-700`}>
                                            {doc.photoUrl ? (
                                                <img src={doc.photoUrl} className="w-full h-full object-cover" alt={doc.fullName} />
                                            ) : (
                                                <span className="text-slate-300">{doc.fullName.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                                {doc.fullName}
                                                {doc.isAdmin && <span className="bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Admin</span>}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="bg-slate-900 text-indigo-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-slate-600">
                                                    {ROLE_LABELS[doc.role] || doc.role}
                                                </span>
                                                <span className="text-slate-500 text-xs font-bold uppercase">• {doc.specialty}</span>
                                            </div>
                                            <p className="text-slate-400 text-xs flex items-center gap-2 mt-1 opacity-70"><Mail className="w-3 h-3"/> {doc.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => { setCurrentDoctor(doc); setIsEditingDoctor(true); }}
                                            className="p-2 bg-slate-700 rounded-lg hover:bg-indigo-600 text-white"
                                        >
                                            <Edit className="w-4 h-4"/>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteDoctor(doc.id)}
                                            className="p-2 bg-slate-700 rounded-lg hover:bg-red-600 text-white"
                                        >
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Form */}
                        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 h-fit sticky top-24">
                            <h3 className="font-bold text-xl text-white mb-6 flex items-center gap-2">
                                {isEditingDoctor ? <Edit className="w-5 h-5 text-indigo-400"/> : <Plus className="w-5 h-5 text-indigo-400"/>}
                                {isEditingDoctor ? 'Editar Profesional' : 'Nuevo Profesional'}
                            </h3>
                            
                            {/* Photo Upload Area */}
                            <div className="flex justify-center mb-6">
                                <div className="relative group cursor-pointer">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-600 bg-slate-700 flex items-center justify-center">
                                        {currentDoctor.photoUrl ? (
                                            <img src={currentDoctor.photoUrl} className="w-full h-full object-cover" alt="preview" />
                                        ) : (
                                            <User className="w-10 h-10 text-slate-500" />
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer text-white font-bold text-xs flex-col gap-1">
                                        <Camera className="w-6 h-6"/>
                                        Cambiar
                                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Profesión / Rol</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500 appearance-none font-medium"
                                            value={currentDoctor.role || 'Medico'} 
                                            onChange={e => setCurrentDoctor({...currentDoctor, role: e.target.value as ProfessionalRole})}
                                        >
                                            {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                        <Briefcase className="absolute right-3 top-3 w-5 h-5 text-slate-500 pointer-events-none"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</label>
                                    <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500" value={currentDoctor.fullName || ''} onChange={e => setCurrentDoctor({...currentDoctor, fullName: e.target.value})} placeholder="Ej: Dr. Juan Pérez" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">RUT</label>
                                    <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500" value={currentDoctor.rut || ''} onChange={e => setCurrentDoctor({...currentDoctor, rut: formatRUT(e.target.value)})} placeholder="12.345.678-9" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Especialidad</label>
                                    <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500" value={currentDoctor.specialty || ''} onChange={e => setCurrentDoctor({...currentDoctor, specialty: e.target.value})} placeholder="Ej: Cardiología, General..." />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Universidad / Institución</label>
                                    <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500" value={currentDoctor.university || ''} onChange={e => setCurrentDoctor({...currentDoctor, university: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Email (Login)</label>
                                    <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500" type="email" value={currentDoctor.email || ''} onChange={e => setCurrentDoctor({...currentDoctor, email: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Acceso</label>
                                    <div className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">
                                      Ingreso con Google (sin contraseña provisoria)
                                    </div>
                                </div>
{/* ADMIN TOGGLE */}
                                <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${currentDoctor.isAdmin ? 'bg-indigo-900/30 border-indigo-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentDoctor.isAdmin ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500'}`}>
                                        {currentDoctor.isAdmin && <Check className="w-3.5 h-3.5 text-white"/>}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={currentDoctor.isAdmin || false} 
                                        onChange={e => setCurrentDoctor({...currentDoctor, isAdmin: e.target.checked})}
                                    />
                                    <div>
                                        <span className="block font-bold text-white text-sm">Acceso Administrativo</span>
                                        <span className="block text-xs text-slate-400">Permite gestionar agenda y usuarios</span>
                                    </div>
                                </label>

                                <div className="flex gap-3 mt-6">
                                    {isEditingDoctor && (
                                        <button onClick={() => { setIsEditingDoctor(false); setCurrentDoctor({ role: 'Medico' }); }} className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-xl hover:bg-slate-600 transition-colors">Cancelar</button>
                                    )}
                                    <button
                                        onClick={handleSaveDoctor}
                                        disabled={!hasActiveCenter}
                                        title={hasActiveCenter ? "Guardar profesional" : "Selecciona un centro activo"}
                                        className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isEditingDoctor ? 'Guardar Cambios' : 'Crear Profesional'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* AGENDA MANAGEMENT */}
                {activeTab === 'agenda' && isModuleEnabled('agenda') && (
                    <div className="animate-fadeIn grid grid-cols-1 lg:grid-cols-12 gap-8">
                         {/* ... (Existing Agenda Content) ... */}
                         {/* Sidebar Config */}
                         <div className="lg:col-span-4 space-y-6">
                            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
                                <h3 className="font-bold text-white mb-4">Seleccionar Profesional</h3>
                                <select 
                                    className="w-full bg-slate-900 text-white border border-slate-700 p-3 rounded-xl outline-none"
                                    value={selectedDoctorId}
                                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                                >
                                    {doctors.map(d => <option key={d.id} value={d.id}>{d.fullName} ({ROLE_LABELS[d.role] || d.role})</option>)}
                                </select>
                            </div>

                            {/* DYNAMIC SLOT CONFIG */}
                            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5"/> Configurar Bloques</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Duración (minutos)</label>
                                        <select 
                                            className="w-full bg-slate-900 text-white border border-slate-700 p-2 rounded-lg outline-none"
                                            value={tempConfig.slotDuration}
                                            onChange={(e) => setTempConfig({...tempConfig, slotDuration: parseInt(e.target.value)})}
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
                                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Inicio</label>
                                            <input 
                                                type="time" 
                                                className="w-full bg-slate-900 text-white border border-slate-700 p-2 rounded-lg outline-none"
                                                value={tempConfig.startTime}
                                                onChange={(e) => setTempConfig({...tempConfig, startTime: e.target.value})}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fin</label>
                                            <input 
                                                type="time" 
                                                className="w-full bg-slate-900 text-white border border-slate-700 p-2 rounded-lg outline-none"
                                                value={tempConfig.endTime}
                                                onChange={(e) => setTempConfig({...tempConfig, endTime: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleSaveConfig}
                                        className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg mt-2"
                                    >
                                        Guardar Configuración
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
                                <div className="flex justify-between items-center mb-6">
                                    <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-700 rounded-lg"><ChevronLeft className="w-5 h-5"/></button>
                                    <span className="font-bold text-lg uppercase tracking-wide">{currentMonth.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</span>
                                    <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-700 rounded-lg"><ChevronRight className="w-5 h-5"/></button>
                                </div>
                                <div className="grid grid-cols-7 gap-2">
                                    {['L','M','M','J','V','S','D'].map(d => <div key={d} className="text-center text-xs font-bold text-slate-500 mb-2">{d}</div>)}
                                    {getDaysInMonth(currentMonth).map((day, idx) => {
                                        if (!day) return <div key={idx}></div>;
                                        const dateStr = day.toISOString().split('T')[0];
                                        const isSelected = dateStr === selectedDate;
                                        // Count slots
                                        const slotsCount = appointments.filter(a => ((a as any).doctorUid ?? a.doctorId) === selectedDoctorId && a.date === dateStr).length;
                                        
                                        // Past Day Check
                                        const isPast = day < today;
                                        
                                        return (
                                            <button 
                                                key={idx} 
                                                onClick={() => handleDateClick(day)}
                                                className={`
                                                    h-10 rounded-lg text-sm font-bold relative transition-all
                                                    ${isSelected ? 'bg-indigo-600 text-white shadow-lg scale-110 z-10' : 
                                                      isPast ? 'bg-slate-900/50 text-slate-600 cursor-not-allowed border border-slate-800' :
                                                      'bg-slate-900 text-slate-400 hover:bg-slate-700'}
                                                `}
                                            >
                                                {day.getDate()}
                                                {slotsCount > 0 && !isPast && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full"></div>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                         </div>

                         {/* Main Agenda Grid */}
                         <div className="lg:col-span-8 bg-slate-800 p-8 rounded-3xl border border-slate-700 min-h-[500px]">
                                {selectedDate ? (
                                    <>
                                        <div className="flex justify-between items-center mb-8">
                                            <h3 className="text-2xl font-bold text-white capitalize">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long'})}</h3>
                                            <span className="text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">Haga clic para abrir/cerrar bloques</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-4 gap-4">
                                            {getStandardSlots(selectedDate, selectedDoctorId, tempConfig).map(slot => {
                                                const realSlot = appointments.find(a => ((a as any).doctorUid ?? a.doctorId) === selectedDoctorId && a.date === selectedDate && a.time === slot.time);
                                                const isOpen = !!realSlot;
                                                const isBooked = realSlot?.status === 'booked';
                                                
                                                // Slot past check
                                                const slotDate = new Date(selectedDate + 'T00:00:00');
                                                const isPast = slotDate < today;
                                                
                                                return (
                                                    <div key={slot.time} className="relative group">
                                                        <button 
                                                            onClick={() => toggleSlot(slot.time)}
                                                            disabled={isPast}
                                                            className={`
                                                                w-full py-4 rounded-xl border-2 font-bold text-lg transition-all flex flex-col items-center justify-center
                                                                ${isPast ? 'bg-slate-900/50 border-slate-800 text-slate-700 cursor-not-allowed' :
                                                                  isBooked ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' : 
                                                                  isOpen ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400' : 
                                                                  'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}
                                                            `}
                                                        >
                                                            {slot.time}
                                                            <span className="text-[10px] uppercase mt-1">
                                                                {isPast ? 'Pasado' : isBooked ? 'Paciente' : isOpen ? 'Disponible' : 'Cerrado'}
                                                            </span>
                                                        </button>
                                                        
                                                        {/* Quick Actions for Open Slot */}
                                                        {isOpen && !isBooked && !isPast && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setBookingSlotId(realSlot.id); }}
                                                                className="absolute -top-2 -right-2 bg-white text-slate-900 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-400 hover:text-white"
                                                                title="Agendar Manualmente"
                                                            >
                                                                <Plus className="w-4 h-4"/>
                                                            </button>
                                                        )}
                                                        
                                                        {/* Info for Booked Slot */}
                                                        {isBooked && (
                                                            <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white text-slate-900 p-3 rounded-xl shadow-xl text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                                <p className="font-bold">{realSlot.patientName}</p>
                                                                <p>{realSlot.patientRut}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                        <Calendar className="w-16 h-16 mb-4 opacity-20"/>
                                        <p>Seleccione un día en el calendario.</p>
                                    </div>
                                )}
                         </div>
                    </div>
                )}

                {/* PREADMISSIONS */}
                {activeTab === 'preadmissions' && (
                    <div className="animate-fadeIn">
                        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="font-bold text-white text-2xl flex items-center gap-2">
                                        <User className="w-6 h-6 text-indigo-400"/> Preingresos pendientes
                                    </h3>
                                    <p className="text-slate-400 text-sm mt-2">Solicitudes enviadas sin autenticación o por el equipo.</p>
                                </div>
                                <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                                    Total: {sortedPreadmissions.length}
                                </span>
                            </div>

                            <div className="space-y-4">
                                {sortedPreadmissions.map((item) => {
                                    const date = resolvePreadmissionDate(item);
                                    const contactName = item.contact?.name || item.patientDraft?.fullName || 'Paciente';
                                    const contactRut = item.contact?.rut || item.patientDraft?.rut || '';
                                    const contactPhone = item.contact?.phone || item.patientDraft?.phone || '';
                                    const contactEmail = item.contact?.email || item.patientDraft?.email || '';
                                    const apptDate = item.appointmentDraft?.date;
                                    const apptTime = item.appointmentDraft?.time;
                                    const sourceLabel = item.source === 'staff' ? 'Equipo' : 'Público';

                                    return (
                                        <div key={item.id} className="bg-slate-900/70 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                    <h4 className="text-lg font-bold text-white">{contactName}</h4>
                                                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mt-1">
                                                        {contactRut && <span className="font-mono">{contactRut}</span>}
                                                        {date && <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {date.toLocaleString('es-CL')}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700">
                                                        {sourceLabel}
                                                    </span>
                                                    <button
                                                        onClick={() => onApprovePreadmission(item)}
                                                        disabled={!hasActiveCenter}
                                                        title={hasActiveCenter ? "Aprobar preingreso" : "Selecciona un centro activo"}
                                                        className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Check className="w-4 h-4"/> Aprobar
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <Phone className="w-4 h-4 text-emerald-400"/>
                                                    {contactPhone || 'Sin teléfono'}
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <Mail className="w-4 h-4 text-indigo-400"/>
                                                    {contactEmail || 'Sin email'}
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <Calendar className="w-4 h-4 text-blue-400"/>
                                                    {apptDate ? `${apptDate}${apptTime ? ` · ${apptTime}` : ''}` : 'Sin hora solicitada'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {sortedPreadmissions.length === 0 && (
                                    <div className="text-center text-slate-500 italic py-12">
                                        No hay preingresos pendientes.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* AUDIT LOGS - LAZY LOADED ONLY */}
                {activeTab === 'audit' && isModuleEnabled('audit') && (
                    <div className="animate-fadeIn">
                        {/* ... (Existing Audit Content) ... */}
                        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
                            <h3 className="font-bold text-white text-2xl mb-6 flex items-center gap-2"><FileClock className="w-6 h-6 text-indigo-400"/> Registro de Actividad</h3>
                            <p className="text-slate-400 mb-6">Historial de acciones críticas en la plataforma. Visible solo para administradores.</p>
                            
                            <div className="overflow-hidden rounded-xl border border-slate-700">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="p-4">Fecha / Hora</th>
                                            <th className="p-4">Usuario</th>
                                            <th className="p-4">Acción</th>
                                            <th className="p-4">Detalles</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700 bg-slate-800/50">
                                        {displayLogs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => {
                                            const date = new Date(log.timestamp);
                                            let actionColor = 'bg-slate-700 text-slate-300';
                                            if (log.action === 'create') actionColor = 'bg-green-900/50 text-green-400 border border-green-800';
                                            if (log.action === 'update') actionColor = 'bg-blue-900/50 text-blue-400 border border-blue-800';
                                            if (log.action === 'delete') actionColor = 'bg-red-900/50 text-red-400 border border-red-800';
                                            if (log.action === 'login') actionColor = 'bg-purple-900/50 text-purple-400 border border-purple-800';

                                            return (
                                                <tr key={log.id} className="hover:bg-slate-700/50 transition-colors">
                                                    <td className="p-4 text-slate-300 font-mono text-sm">
                                                        <div className="font-bold text-white">{date.toLocaleDateString()}</div>
                                                        <div className="text-xs opacity-60">{date.toLocaleTimeString()}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-white">{log.actorName}</div>
                                                        <div className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded w-fit mt-1">{log.actorRole}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${actionColor}`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-slate-300 text-sm max-w-md truncate" title={log.details}>
                                                        {log.details}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {displayLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-500 italic">No hay registros de actividad recientes.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MANUAL BOOKING MODAL */}
            {bookingSlotId && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    {/* ... (Existing Manual Booking Modal) ... */}
                    <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-sm w-full">
                        <h3 className="text-xl font-bold mb-4">Agendar Manualmente</h3>
                        <div className="space-y-4">
                            <input className="w-full bg-slate-100 p-3 rounded-lg outline-none border border-slate-200" placeholder="RUT Paciente" value={bookingRut} onChange={e => setBookingRut(formatRUT(e.target.value))}/>
                            <input className="w-full bg-slate-100 p-3 rounded-lg outline-none border border-slate-200" placeholder="Nombre Completo" value={bookingName} onChange={e => setBookingName(e.target.value)}/>
                            <input className="w-full bg-slate-100 p-3 rounded-lg outline-none border border-slate-200" placeholder="Teléfono" value={bookingPhone} onChange={e => setBookingPhone(e.target.value)}/>
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setBookingSlotId(null)} className="flex-1 bg-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-300">Cancelar</button>
                                <button onClick={handleManualBooking} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-lg">Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CANCEL MODAL */}
            {cancelModal.isOpen && cancelModal.appointment && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    {/* ... (Existing Cancel Modal) ... */}
                    <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-md w-full animate-fadeIn">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-amber-600"/>
                        </div>
                        <h3 className="text-xl font-bold text-center mb-2">¿Cancelar Cita?</h3>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-center">
                            <p className="font-bold text-lg">{cancelModal.appointment.patientName}</p>
                            <p className="text-slate-500">{cancelModal.appointment.date} - {cancelModal.appointment.time}</p>
                        </div>
                        <p className="text-sm text-slate-500 text-center mb-6">Esta acción liberará el horario pero eliminará la reserva. Se recomienda avisar al paciente.</p>
                        
                        <div className="space-y-3">
                            <button 
                                onClick={() => handleConfirmCancellation(true)}
                                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                            >
                                <MessageCircle className="w-5 h-5"/> Cancelar y Notificar por WhatsApp
                            </button>
                            <button 
                                onClick={() => handleConfirmCancellation(false)}
                                className="w-full bg-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-300"
                            >
                                Solo Cancelar Cita
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
        </div>
    );
};

export default AdminDashboard;
