import React from "react";
import { AlertCircle, ArrowLeft, Building2, Lock, Stethoscope, UserRound, LogOut } from "lucide-react";
import { MedicalCenter } from "../../types";
import LegalLinks from "../LegalLinks";

export const CenterPortalView: React.FC<{
  activeCenterId: string;
  activeCenter: MedicalCenter | null;
  isLoadingCenters: boolean;
  isAgentTest: boolean;
  onBackHome: () => void;
  onPatientMenu: () => void;
  onDoctorLogin: () => void;
  onAdminLogin: () => void;
  renderCenterBackdrop: (children: React.ReactNode) => React.ReactNode;
}> = ({
  activeCenterId,
  activeCenter,
  isLoadingCenters,
  isAgentTest,
  onBackHome,
  onPatientMenu,
  onDoctorLogin,
  onAdminLogin,
  renderCenterBackdrop,
}) => {
  if (isLoadingCenters && activeCenterId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">
          Sincronizando Centro Médico...
        </p>
      </div>
    );
  }

  if (!activeCenterId || (!activeCenter && !isAgentTest)) {
    if (activeCenterId && !isLoadingCenters) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] bg-slate-50 p-6 text-center">
          <div className="bg-red-50 p-6 rounded-[2.5rem] border border-red-100 shadow-xl max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-slate-800 mb-2">Centro No Encontrado</h2>
            <p className="text-slate-500 mb-8 font-medium">
              No hemos podido localizar el centro médico solicitado o no posees los permisos
              necesarios para visualizarlo.
            </p>
            <button
              onClick={onBackHome}
              className="w-full bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-lg"
            >
              Volver al Directorio
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  return renderCenterBackdrop(
    <div className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-4xl mb-6 flex justify-start">
        <button
          onClick={onBackHome}
          className="px-4 py-2 rounded-xl bg-white/80 hover:bg-white shadow border border-white text-slate-700 font-bold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a ClaveSalud
        </button>
      </div>

      <div className="text-center mb-10">
        <div className="w-24 h-24 bg-blue-50 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-lg overflow-hidden">
          {(activeCenter as any)?.logoUrl ? (
            <img
              src={(activeCenter as any).logoUrl}
              alt={`Logo de ${activeCenter?.name}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className="w-12 h-12 text-blue-600" />
          )}
        </div>
        <h1 className="text-5xl font-extrabold text-slate-800 tracking-tight drop-shadow-sm">
          {activeCenter?.name}
        </h1>
        <p className="text-slate-500 mt-3 text-xl font-medium">Plataforma Integral de Salud</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
        <button
          onClick={onPatientMenu}
          className="bg-white/80 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-blue-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-blue-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
            <UserRound className="w-12 h-12 text-blue-600" />
          </div>
          <h3 className="font-bold text-3xl text-slate-800">Soy Paciente</h3>
          <p className="text-slate-500 mt-2 font-medium text-lg">
            Reserva de horas y ficha clínica
          </p>
        </button>

        <button
          onClick={onDoctorLogin}
          className="bg-white/80 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-white hover:border-emerald-300 hover:shadow-2xl hover:-translate-y-1 transition-all group text-center flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-emerald-50/80 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
            <Stethoscope className="w-12 h-12 text-emerald-600" />
          </div>
          <h3 className="font-bold text-3xl text-slate-800">Soy Profesional</h3>
          <p className="text-slate-500 mt-2 font-medium text-lg">Acceso para equipos de salud</p>
        </button>
      </div>

      <button
        type="button"
        onClick={onAdminLogin}
        className="fixed top-4 right-4 p-3 rounded-full bg-slate-900/80 text-white shadow-xl hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
        title="Acceso Administrador"
        aria-label="Acceso Administrador"
      >
        <Lock className="w-5 h-5" />
      </button>
    </div>
  );
};

export const SelectCenterView: React.FC<{
  centers: MedicalCenter[];
  onSelect: (centerId: string) => void;
  onLogout: () => void;
}> = ({ centers, onSelect, onLogout }) => (
  <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-200 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200 rounded-full blur-[120px]" />
    </div>

    <div className="w-full max-w-3xl bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_rgba(0,0,0,0.08)] border border-white p-8 sm:p-12 relative z-10">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Selecciona un centro</h2>
          <p className="text-slate-500 font-medium">Elige el lugar de trabajo para comenzar</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 transition-all flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>

      {centers.length === 0 ? (
        <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-xl p-4 text-sm">
          Tu usuario no tiene centros asignados. Pide a SuperAdmin que te asigne un centro.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {centers.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="p-5 rounded-2xl border border-slate-100 hover:border-sky-300 hover:shadow-md transition-all text-left bg-white"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center">
                  {(c as any).logoUrl ? (
                    <img
                      src={(c as any).logoUrl}
                      alt={`Logo de ${c.name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-6 h-6 text-slate-700" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-slate-900">{c.name}</div>
                  <div className="text-slate-500 text-sm">{c.commune ?? c.region ?? "Chile"}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

export const LegalPageView: React.FC<{
  title: string;
  body: string;
  onBack: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  renderHomeBackdrop: (children: React.ReactNode) => React.ReactNode;
}> = ({ title, body, onBack, onOpenTerms, onOpenPrivacy, renderHomeBackdrop }) =>
  renderHomeBackdrop(
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-white p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Volver
          </button>
        </div>
        <div className="prose prose-slate max-w-none text-sm md:text-base whitespace-pre-wrap">
          {body}
        </div>
        <div className="pt-4 border-t border-slate-200">
          <LegalLinks onOpenTerms={onOpenTerms} onOpenPrivacy={onOpenPrivacy} />
        </div>
      </div>
    </div>
  );
