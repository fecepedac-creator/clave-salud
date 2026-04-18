import React from "react";
import {
  Search,
  Layers,
  History,
  Plus,
  UsersRound,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import { Patient, Doctor } from "../../../types";
import { formatPersonName, generateId, calculateAge } from "../../../utils";
import { useToast } from "../../../components/Toast";
import DrivePicker from "../../../components/DrivePicker";
import OperationalState from "../../../components/ui/OperationalState";

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
  currentPage: number;
  setCurrentPage: (p: number) => void;
  totalPages: number;
  sortBy: "alphabetical" | "recent";
  setSortBy: (s: "alphabetical" | "recent") => void;
  totalCount: number;
  patientsLoading?: boolean;
  patientsError?: string;
  onRetryPatients?: () => void;
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
  currentPage,
  setCurrentPage,
  totalPages,
  sortBy,
  setSortBy,
  totalCount,
  patientsLoading = false,
  patientsError = "",
  onRetryPatients,
}) => {
  const { showToast } = useToast();

  const safeAgeLabel = (birthDate?: string) => {
    if (!birthDate) return "-";
    const age = calculateAge(birthDate);
    return Number.isFinite(age) ? `${age} años` : "-";
  };

  return (
    <div className="h-full rounded-3xl border border-white/50 bg-white/80 shadow-xl backdrop-blur-md overflow-hidden flex flex-col animate-fadeIn">
      <div className="border-b border-slate-100 bg-white/70 p-6 flex flex-col gap-5 flex-shrink-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-health-100 bg-health-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-health-700">
              Pacientes
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-900">Cartera clínica activa</h2>
            <p className="mt-1 text-sm text-slate-500">
              Busca, prioriza próximos controles y entra rápido a la ficha del paciente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Pacientes visibles
              </p>
              <p className="mt-1 text-xl font-black text-slate-800">{totalCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Cartera activa
              </p>
              <p className="mt-1 text-sm font-bold text-slate-700">
                {portfolioMode === "global" ? "Global" : "Este centro"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o RUT..."
              data-testid="patient-search-input"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
              <button
                onClick={() => onSetPortfolioMode?.("global")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  portfolioMode === "global"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Layers className="h-4 w-4" /> Global
              </button>
              <button
                onClick={() => onSetPortfolioMode?.("center")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  portfolioMode === "center"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <History className="h-4 w-4" /> Este centro
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
              <button
                onClick={() => setSortBy("alphabetical")}
                className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${
                  sortBy === "alphabetical"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Nombre (A-Z)
              </button>
              <button
                onClick={() => setSortBy("recent")}
                className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${
                  sortBy === "recent"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Recientes
              </button>
            </div>

            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setFilterNextControl("all")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                  filterNextControl === "all" ? "bg-slate-100 text-slate-700" : "text-slate-400"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterNextControl("week")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                  filterNextControl === "week" ? "bg-slate-100 text-slate-700" : "text-slate-400"
                }`}
              >
                7d
              </button>
              <button
                onClick={() => setFilterNextControl("month")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                  filterNextControl === "month" ? "bg-slate-100 text-slate-700" : "text-slate-400"
                }`}
              >
                30d
              </button>
            </div>

            {!isReadOnly && (
              <>
                <DrivePicker
                  clientId={import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID}
                  apiKey={import.meta.env.VITE_FIREBASE_API_KEY}
                />
                <button
                  onClick={() => {
                    if (!hasActiveCenter) {
                      showToast("Selecciona un centro activo.", "warning");
                      return;
                    }
                    const newPatient: Patient = {
                      id: generateId(),
                      centerId: activeCenterId || "",
                      ownerUid: currentUser?.uid || "",
                      accessControl: {
                        allowedUids: [currentUser?.uid || ""],
                        centerIds: activeCenterId ? [activeCenterId] : [],
                      },
                      rut: "",
                      fullName: "Nuevo Paciente",
                      birthDate: new Date().toISOString(),
                      gender: "Otro",
                      medicalHistory: [],
                      surgicalHistory: [],
                      medications: [],
                      allergies: [],
                      consultations: [],
                      livingWith: [],
                      smokingStatus: "No fumador",
                      alcoholStatus: "No consumo",
                      lastUpdated: new Date().toISOString(),
                      active: true,
                    };
                    setSelectedPatient(newPatient);
                    setIsEditingPatient(true);
                  }}
                  disabled={!hasActiveCenter}
                  data-testid="btn-new-patient"
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white active:scale-95"
                >
                  <Plus className="h-5 w-5" /> Nuevo Paciente
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="hidden flex-1 overflow-auto md:block">
        {patientsLoading ? (
          <div className="p-6">
            <OperationalState
              kind="loading"
              title="Cargando pacientes..."
              description="Estamos sincronizando el panel clínico."
            />
          </div>
        ) : patientsError ? (
          <div className="p-6">
            <OperationalState
              kind="error"
              title="No pudimos cargar pacientes"
              description={patientsError}
              onAction={onRetryPatients}
            />
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-slate-400">
            <UsersRound className="mb-4 h-16 w-16 opacity-20" />
            <p className="font-medium">No se encontraron pacientes</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="border-b border-slate-200 p-5">Paciente</th>
                <th className="border-b border-slate-200 p-5">Edad / RUT</th>
                <th className="border-b border-slate-200 p-5">Última atención</th>
                <th className="border-b border-slate-200 p-5">Próximo control</th>
                <th className="border-b border-slate-200 p-5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((patient) => {
                const patientConsultations = getActiveConsultations(patient);
                const lastConsultation =
                  patientConsultations.length > 0 ? patientConsultations[0] : null;
                const nextControl = getNextControlDateFromPatient(patient);
                const isControlNear =
                  nextControl &&
                  nextControl <= new Date(new Date().setDate(new Date().getDate() + 7));

                return (
                  <tr
                    key={patient.id}
                    data-testid={`patient-row-${patient.rut}`}
                    className="group cursor-pointer transition-colors hover:bg-slate-50/80"
                    onClick={() => handleSelectPatient(patient)}
                  >
                    <td className="p-5">
                      <div className="text-base font-bold text-slate-800">
                        {formatPersonName(patient.fullName)}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="font-medium text-slate-600">
                        {safeAgeLabel(patient.birthDate)}
                      </div>
                      <div className="font-mono text-xs text-slate-400">{patient.rut}</div>
                    </td>
                    <td className="p-5">
                      {lastConsultation ? (
                        <div>
                          <span className="font-medium text-slate-700">
                            {new Date(lastConsultation.date).toLocaleDateString()}
                          </span>
                          <p className="max-w-[150px] truncate text-xs text-slate-400">
                            {lastConsultation.reason}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm italic text-slate-300">Sin historial</span>
                      )}
                    </td>
                    <td className="p-5">
                      {nextControl ? (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            isControlNear
                              ? "bg-orange-100 text-orange-700"
                              : "bg-green-50 text-green-700"
                          }`}
                        >
                          {nextControl.toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="relative p-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(() => {
                          const nextControlDate = getNextControlDateFromPatient(patient);
                          const canWhatsapp = Boolean(nextControlDate) && Boolean(patient.phone);
                          if (!canWhatsapp) return null;
                          return (
                            <div className="relative">
                              <button
                                className="rounded-lg p-2 text-green-700 transition-colors hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWhatsAppMenuForPatientId(
                                    whatsAppMenuForPatientId === patient.id ? null : patient.id
                                  );
                                }}
                              >
                                <MessageCircle className="h-5 w-5" />
                              </button>
                              {whatsAppMenuForPatientId === patient.id && (
                                <div
                                  className="absolute right-0 mt-2 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="bg-slate-50 px-3 py-2 text-xs font-bold">
                                    Plantillas WhatsApp
                                  </div>
                                  <div className="p-1">
                                    {whatsAppTemplates
                                      .filter((template: any) => template.enabled)
                                      .map((template: any) => (
                                        <button
                                          key={template.id}
                                          className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                          onClick={() => {
                                            openWhatsApp(patient, template.body);
                                            setWhatsAppMenuForPatientId(null);
                                          }}
                                        >
                                          {template.title}
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <button className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50">
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filteredPatients.length > 0 && (
        <div className="hidden flex-shrink-0 items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-6 py-4 md:flex">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Mostrando {filteredPatients.length} de {totalCount} pacientes
            {searchTerm && ` (Busca: "${searchTerm}")`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600">
              Pág {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-30"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:hidden">
        {patientsLoading ? (
          <OperationalState kind="loading" title="Cargando pacientes..." compact />
        ) : patientsError ? (
          <OperationalState
            kind="error"
            title="No pudimos cargar pacientes"
            description={patientsError}
            onAction={onRetryPatients}
          />
        ) : filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <p>No se encontraron pacientes</p>
          </div>
        ) : (
          filteredPatients.map((patient) => {
            const patientConsultations = getActiveConsultations(patient);
            const lastConsultation =
              patientConsultations.length > 0 ? patientConsultations[0] : null;
            const nextControl = getNextControlDateFromPatient(patient);
            const isControlNear =
              nextControl &&
              nextControl <= new Date(new Date().setDate(new Date().getDate() + 7));

            return (
              <div
                key={patient.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all active:scale-[0.98] active:bg-slate-50"
                onClick={() => handleSelectPatient(patient)}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-slate-800">
                      {formatPersonName(patient.fullName)}
                    </h4>
                    <p className="font-mono text-xs text-slate-400">
                      {patient.rut} • {safeAgeLabel(patient.birthDate)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {nextControl && (
                    <div
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        isControlNear
                          ? "bg-orange-100 text-orange-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      Control: {nextControl.toLocaleDateString()}
                    </div>
                  )}
                  {lastConsultation && (
                    <div className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600">
                      Última: {new Date(lastConsultation.date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
