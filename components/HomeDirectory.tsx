import React from "react";
import { Building2, Lock, Stethoscope, Activity, Check, ArrowRight } from "lucide-react";
import { MedicalCenter, ViewMode } from "../types";
import LegalLinks from "./LegalLinks";
import { resolveActiveState } from "../utils/activeState";

interface HomeDirectoryProps {
  centers: MedicalCenter[];
  authUser: any;
  isSuperAdminClaim: boolean;
  bootstrapSuperAdmin: () => void;
  onNavigate: (view: ViewMode) => void;
  onGoogleLogin: (view: ViewMode) => void;
  setLoginViewPreference: (view: ViewMode) => void;
  setActiveCenterId: (id: string) => void;
  openLegal: (page?: "terms" | "privacy") => void;
  startOnboarding: () => void;
  LOGO_SRC: string;
  HOME_BG_SRC: string;
  HOME_BG_FALLBACK_SRC: string;
}

const HomeDirectory: React.FC<HomeDirectoryProps> = ({
  centers,
  authUser,
  isSuperAdminClaim,
  bootstrapSuperAdmin,
  onNavigate,
  onGoogleLogin,
  setLoginViewPreference,
  setActiveCenterId,
  openLegal,
  startOnboarding,
  LOGO_SRC,
  HOME_BG_SRC,
  HOME_BG_FALLBACK_SRC,
}) => {
  return (
    <div
      className="home-hero relative min-h-dvh w-full flex flex-col items-center justify-center px-4 py-10 pb-16 overflow-x-hidden"
      style={
        {
          "--home-hero-image": `image-set(url("${HOME_BG_SRC}") type("image/webp"), url("${HOME_BG_FALLBACK_SRC}") type("image/png"))`,
          backgroundAttachment: "fixed",
        } as React.CSSProperties
      }
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-white/2 to-white/8" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.04),_transparent_55%)]" />
      {authUser && !isSuperAdminClaim && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={bootstrapSuperAdmin}
            className="bg-red-600 text-white px-5 py-3 rounded-xl shadow-xl font-bold hover:bg-red-700"
          >
            Convertirme en SuperAdmin
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => onNavigate("superadmin-login" as ViewMode)}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white/80 backdrop-blur border border-white shadow-lg hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        title="Acceso SuperAdmin"
        aria-label="Acceso SuperAdmin"
      >
        <Lock className="w-5 h-5 text-slate-800" />
      </button>

      <div className="relative z-10 w-full max-w-6xl">
        <div className="text-center mb-10 rounded-3xl bg-white/5 backdrop-blur-md border border-white/15 shadow-[0_24px_50px_rgba(15,23,42,0.12)] px-6 py-10 md:px-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <img
              src={LOGO_SRC}
              alt="ClaveSalud"
              className="h-28 md:h-32 w-auto object-contain drop-shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
            />
            <h1 className="text-4xl md:text-5xl font-extrabold">
              <span className="text-sky-600">Clave</span>
              <span className="text-teal-700">Salud</span>
            </h1>
          </div>
          <p className="text-slate-500 mt-3 text-lg">
            Ficha clínica digital para equipos de salud.
          </p>
          <div className="mt-8 flex flex-col items-center gap-6">
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
              <button
                onClick={() => {
                  setLoginViewPreference("doctor-dashboard" as ViewMode);
                  onGoogleLogin("doctor-dashboard" as ViewMode);
                }}
                className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-bold shadow-xl hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all flex flex-col items-center gap-2 group"
              >
                <div className="bg-emerald-500/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
                  <Stethoscope className="w-6 h-6 text-emerald-400" />
                </div>
                <span className="text-sm">Acceso Profesional</span>
              </button>
              <button
                onClick={() => {
                  setLoginViewPreference("admin-dashboard" as ViewMode);
                  onGoogleLogin("admin-dashboard" as ViewMode);
                }}
                className="flex-1 bg-white border-2 border-slate-200 text-slate-800 p-4 rounded-2xl font-bold shadow-md hover:border-slate-400 hover:scale-[1.02] active:scale-95 transition-all flex flex-col items-center gap-2 group"
              >
                <div className="bg-slate-100 p-2 rounded-xl group-hover:scale-110 transition-transform">
                  <Building2 className="w-6 h-6 text-slate-600" />
                </div>
                <span className="text-sm">Acceso Portal Admin</span>
              </button>
            </div>

            <div className="flex items-center gap-4 w-full max-w-xs">
              <div className="h-[1px] bg-slate-200 flex-1"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                o también
              </span>
              <div className="h-[1px] bg-slate-200 flex-1"></div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate("landing" as ViewMode)}
                className="px-6 py-3 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 font-bold hover:bg-teal-100 transition-colors flex items-center gap-2"
              >
                <Activity className="w-4 h-4" /> Conoce la plataforma
              </button>
              <button
                type="button"
                onClick={() => onNavigate("center-portal" as ViewMode)}
                className="px-6 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:border-slate-400 transition-all flex items-center gap-2"
              >
                <Building2 className="w-4 h-4" /> Ingresar a un portal público
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/5 backdrop-blur-md border border-white/15 shadow-[0_24px_50px_rgba(15,23,42,0.12)] px-5 py-8 md:px-10">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Directorio de centros médicos</h2>
            <p className="text-slate-500 text-sm">
              Selecciona un centro para ingresar a su portal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {centers.map((c) => {
              const isActive = resolveActiveState(c as any);
              if (!isSuperAdminClaim && !isActive) return null;

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCenterId(c.id);
                    onNavigate("center-portal" as ViewMode);
                  }}
                  data-testid={`center-card-${c.slug}`}
                  className={`group bg-white/90 backdrop-blur-sm p-6 rounded-3xl shadow-xl border border-white hover:border-teal-200 hover:shadow-2xl hover:-translate-y-0.5 transition-all text-left relative overflow-hidden flex flex-col h-full ${
                    !isActive ? "opacity-60 grayscale-[0.5]" : ""
                  }`}
                >
                  <div className="absolute top-0 right-0 z-20">
                    {!isActive ? (
                      <div className="bg-slate-800 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                        Inactivo
                      </div>
                    ) : (
                      <div className="bg-teal-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        <Check className="w-2.5 h-2.5" /> Activo
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-110 transition-transform">
                      {(c as any).logoUrl ? (
                        <img
                          src={(c as any).logoUrl}
                          alt={`Logo de ${c.name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-8 h-8 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="font-black text-slate-900 text-lg leading-tight group-hover:text-teal-700 transition-colors">
                        {c.name}
                      </div>
                      <div className="text-slate-400 text-[10px] font-bold uppercase mt-1 tracking-wider">
                        {c.commune || c.region || "Centro de Salud"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-teal-600 transition-colors uppercase tracking-widest flex items-center gap-1">
                      Portal Público <ArrowRight className="w-3 h-3" />
                    </span>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-teal-300"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-teal-300"></div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <footer className="relative z-10 mt-10">
        <div className="flex flex-col items-center gap-3">
          <LegalLinks
            onOpenTerms={() => openLegal("terms")}
            onOpenPrivacy={() => openLegal("privacy")}
          />
          <button
            type="button"
            onClick={startOnboarding}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Reiniciar tutorial
          </button>
        </div>
      </footer>
    </div>
  );
};

export default HomeDirectory;
