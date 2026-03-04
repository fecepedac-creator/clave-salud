import React from "react";
import { Search, Layers, History, Plus, UsersRound, ChevronRight, MessageCircle } from "lucide-react";
import { Patient, Doctor } from "../../../types";
import { formatPersonName, generateId, calculateAge } from "../../../utils";
import { useToast } from "../../../components/Toast";
import DrivePicker from "../../../components/DrivePicker";

interface DoctorPatientsListTabProps {
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    filteredPatients: Patient[];
    handleSelectPatient: (p: Patient) => void;
    onSetPortfolioMode?: (mode: "global" | "center") => void;
    portfolioMode: "global" | "center";
    setFilterNextControl: (filter: "all" | "week" | "month") => void;
    filterNextControl: "all" | "week" | "month";
    isReadOnly: boolean;
    hasActiveCenter: boolean;
    activeCenterId: string | undefined;
    currentUser: Doctor | undefined;
    setSelectedPatient: (p: Patient) => void;
    setIsEditingPatient: (state: boolean) => void;
    getActiveConsultations: (p: Patient) => any[];
    getNextControlDateFromPatient: (p: Patient) => Date | null;
    setWhatsAppMenuForPatientId: (id: string | null) => void;
    whatsAppMenuForPatientId: string | null;
    whatsAppTemplates: any[];
    openWhatsApp: (p: Patient, t: string) => void;
}

export const DoctorPatientsListTab: React.FC<DoctorPatientsListTabProps> = ({
    searchTerm,
    setSearchTerm,
    filteredPatients,
    handleSelectPatient,
    onSetPortfolioMode,
    portfolioMode,
    setFilterNextControl,
    filterNextControl,
    isReadOnly,
    hasActiveCenter,
    activeCenterId,
    currentUser,
    setSelectedPatient,
    setIsEditingPatient,
    getActiveConsultations,
    getNextControlDateFromPatient,
    setWhatsAppMenuForPatientId,
    whatsAppMenuForPatientId,
    whatsAppTemplates,
    openWhatsApp,
}) => {
    const { showToast } = useToast();

    const safeAgeLabel = (birthDate?: string) => {
        if (!birthDate) return "-";
        const age = calculateAge(birthDate);
        return Number.isFinite(age) ? `${age} años` : "-";
    };

    return (
        <div className="h-full bg-white/80 backdrop-blur-md rounded-3xl border border-white/50 shadow-xl overflow-hidden flex flex-col animate-fadeIn">
            {/* Toolbar */}
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 flex-shrink-0">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o RUT..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium text-slate-700 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full justify-between">
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <button
                            onClick={() => onSetPortfolioMode?.("global")}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${portfolioMode === "global" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            <Layers className="w-4 h-4" /> Global
                        </button>
                        <button
                            onClick={() => onSetPortfolioMode?.("center")}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${portfolioMode === "center" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            <History className="w-4 h-4" /> Este Centro
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                            <button onClick={() => setFilterNextControl("all")} className={`px-3 py-1.5 text-xs font-bold rounded-md ${filterNextControl === "all" ? "bg-slate-100 text-slate-700" : "text-slate-400"}`}>Todos</button>
                            <button onClick={() => setFilterNextControl("week")} className={`px-3 py-1.5 text-xs font-bold rounded-md ${filterNextControl === "week" ? "bg-slate-100 text-slate-700" : "text-slate-400"}`}>7d</button>
                            <button onClick={() => setFilterNextControl("month")} className={`px-3 py-1.5 text-xs font-bold rounded-md ${filterNextControl === "month" ? "bg-slate-100 text-slate-700" : "text-slate-400"}`}>30d</button>
                        </div>
                        {!isReadOnly && (
                            <>
                                <DrivePicker clientId={import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID} apiKey={import.meta.env.VITE_FIREBASE_API_KEY} />
                                <button
                                    onClick={() => {
                                        if (!hasActiveCenter) { showToast("Selecciona un centro activo.", "warning"); return; }
                                        const newP: Patient = {
                                            id: generateId(), centerId: activeCenterId || "", ownerUid: currentUser?.uid || "",
                                            accessControl: { allowedUids: [currentUser?.uid || ""], centerIds: activeCenterId ? [activeCenterId] : [] },
                                            rut: "", fullName: "Nuevo Paciente", birthDate: new Date().toISOString(), gender: "Otro",
                                            medicalHistory: [], surgicalHistory: [], medications: [], allergies: [], consultations: [], attachments: [], livingWith: [],
                                            smokingStatus: "No fumador", alcoholStatus: "No consumo", lastUpdated: new Date().toISOString(), active: true,
                                        };
                                        setSelectedPatient(newP);
                                        setIsEditingPatient(true);
                                    }}
                                    disabled={!hasActiveCenter}
                                    className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 active:scale-95"
                                >
                                    <Plus className="w-5 h-5" /> Nuevo Paciente
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
                {filteredPatients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <UsersRound className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-medium">No se encontraron pacientes</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 sticky top-0 z-10 text-slate-500 text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="p-5 border-b border-slate-200">Paciente</th>
                                <th className="p-5 border-b border-slate-200 hidden md:table-cell">Edad / RUT</th>
                                <th className="p-5 border-b border-slate-200 hidden md:table-cell">Última Atención</th>
                                <th className="p-5 border-b border-slate-200">Próximo Control</th>
                                <th className="p-5 border-b border-slate-200 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredPatients.map((p) => {
                                const patientConsultations = getActiveConsultations(p);
                                const lastConsult = patientConsultations.length > 0 ? patientConsultations[0] : null;
                                const nextCtrl = lastConsult?.nextControlDate ? new Date(lastConsult.nextControlDate + "T12:00:00") : null;
                                const isControlNear = nextCtrl && nextCtrl <= new Date(new Date().setDate(new Date().getDate() + 7));

                                return (
                                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => handleSelectPatient(p)}>
                                        <td className="p-5">
                                            <div className="font-bold text-slate-800 text-base">{formatPersonName(p.fullName)}</div>
                                            <div className="text-xs text-slate-400 font-medium md:hidden">{p.rut}</div>
                                        </td>
                                        <td className="p-5 hidden md:table-cell">
                                            <div className="text-slate-600 font-medium">{safeAgeLabel(p.birthDate)}</div>
                                            <div className="text-xs text-slate-400 font-mono">{p.rut}</div>
                                        </td>
                                        <td className="p-5 hidden md:table-cell">
                                            {lastConsult ? (
                                                <div>
                                                    <span className="text-slate-700 font-medium">{new Date(lastConsult.date).toLocaleDateString()}</span>
                                                    <p className="text-xs text-slate-400 truncate max-w-[150px]">{lastConsult.reason}</p>
                                                </div>
                                            ) : <span className="text-slate-300 italic text-sm">Sin historial</span>}
                                        </td>
                                        <td className="p-5">
                                            {nextCtrl ? (
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${isControlNear ? "bg-orange-100 text-orange-700" : "bg-green-50 text-green-700"}`}>{nextCtrl.toLocaleDateString()}</span>
                                            ) : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="p-5 text-right relative">
                                            <div className="flex items-center justify-end gap-2">
                                                {(() => {
                                                    const ctrl = getNextControlDateFromPatient(p);
                                                    const canWhatsapp = Boolean(ctrl) && Boolean(p.phone);
                                                    if (!canWhatsapp) return null;
                                                    return (
                                                        <div className="relative">
                                                            <button
                                                                className="text-green-700 hover:bg-green-50 p-2 rounded-lg transition-colors"
                                                                onClick={(e) => { e.stopPropagation(); setWhatsAppMenuForPatientId(whatsAppMenuForPatientId === p.id ? null : p.id); }}
                                                            >
                                                                <MessageCircle className="w-5 h-5" />
                                                            </button>
                                                            {whatsAppMenuForPatientId === p.id && (
                                                                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="px-3 py-2 text-xs font-bold bg-slate-50">Plantillas WhatsApp</div>
                                                                    <div className="p-1">
                                                                        {whatsAppTemplates.filter((t) => t.enabled).map((t) => (
                                                                            <button key={t.id} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => { openWhatsApp(p, t.body); setWhatsAppMenuForPatientId(null); }}>{t.title}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
