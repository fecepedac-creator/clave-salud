import React, { useEffect } from "react";
import {
  UsersRound,
  CalendarCheck,
  TrendingUp,
  Settings,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { RoleId } from "../../../types";
import { CORPORATE_LOGO, CORPORATE_ICON } from "../../../constants";

interface DoctorSidebarProps {
  activeTab: "patients" | "agenda" | "reminders" | "settings" | "performance";
  setActiveTab: (tab: "patients" | "agenda" | "reminders" | "settings" | "performance") => void;
  doctorName: string;
  role: RoleId;
  onLogout: () => void;
  onClosePanel?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const DoctorSidebar: React.FC<DoctorSidebarProps> = ({
  activeTab,
  setActiveTab,
  doctorName,
  role,
  onLogout,
  onClosePanel,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--doctor-sidebar-width",
      isCollapsed ? "5rem" : "18rem"
    );
    return () => document.documentElement.style.removeProperty("--doctor-sidebar-width");
  }, [isCollapsed]);

  const primaryNav = [
    { id: "patients", label: "Pacientes", helper: "Cartera clínica y ficha", icon: UsersRound },
    { id: "agenda", label: "Agenda", helper: "Citas, cupos y día clínico", icon: CalendarCheck },
  ] as const;

  const secondaryNav = [
    { id: "performance", label: "Rendimiento", helper: "Métricas y exportes", icon: TrendingUp },
    { id: "settings", label: "Configuración", helper: "Plantillas y perfil", icon: Settings },
  ] as const;

  return (
    <aside
      className={`relative ${isCollapsed ? "lg:w-20" : "lg:w-72"} w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] backdrop-blur-md border-r border-slate-200/70 sticky top-0 h-screen overflow-y-auto overflow-x-hidden z-20 shadow-[0_8px_40px_-24px_rgba(15,23,42,0.35)] transition-all duration-300 ease-in-out`}
    >
      <div
        className={`p-6 border-b border-slate-100/80 flex flex-col gap-4 sticky top-0 bg-white/95 backdrop-blur-md z-30 ${isCollapsed ? "items-center" : ""}`}
      >
        <div
          className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between w-full"}`}
        >
          <div className="flex items-center">
            <img
              src={isCollapsed ? CORPORATE_ICON : CORPORATE_LOGO}
              alt="ClaveSalud"
              className={`${isCollapsed ? "w-10 h-10" : "h-12 w-auto"} shrink-0 object-contain transition-all duration-300`}
            />
          </div>
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex bg-slate-100 border border-slate-200 rounded-lg p-1.5 shadow-sm hover:bg-slate-200 transition-colors shrink-0"
            title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
        {!isCollapsed && (
          <>
            <div className="inline-flex w-fit items-center rounded-full bg-health-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-health-700 border border-health-100">
              Espacio clínico
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
              <p className="text-xs font-bold text-slate-800">Workspace profesional</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Prioriza pacientes y agenda. Usa rendimiento y configuración como apoyo.
              </p>
            </div>
          </>
        )}
      </div>

      <div className={`${isCollapsed ? "p-4" : "p-8"}`}>
        <nav data-testid="doctor-tab-bar" className="space-y-6">
          <div className="space-y-3">
            {!isCollapsed && (
              <p className="px-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Trabajo diario
              </p>
            )}
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  data-testid={`doctor-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 rounded-2xl text-sm font-bold transition-all w-full group border ${
                    isActive
                      ? "bg-health-600 text-white border-health-600 shadow-[0_14px_30px_-18px_rgba(14,165,233,0.75)]"
                      : "bg-white text-slate-700 border-slate-200 hover:border-health-200 hover:bg-health-50/60"
                  } ${isCollapsed ? "justify-center px-0 py-4" : "px-4 py-4"}`}
                  title={isCollapsed ? item.label : ""}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? "text-white" : "text-health-600 group-hover:text-health-700"
                    }`}
                  />
                  {!isCollapsed && (
                    <div className="min-w-0 text-left">
                      <p className="truncate">{item.label}</p>
                      <p
                        className={`mt-0.5 text-[11px] font-medium ${
                          isActive ? "text-white/80" : "text-slate-500"
                        }`}
                      >
                        {item.helper}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            {!isCollapsed && (
              <p className="px-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Mi espacio
              </p>
            )}
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  data-testid={`doctor-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 rounded-xl text-sm font-bold transition-all w-full group ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  } ${isCollapsed ? "justify-center px-0 py-3" : "px-4 py-3"}`}
                  title={isCollapsed ? item.label : ""}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  {!isCollapsed && (
                    <div className="min-w-0 text-left">
                      <p className="truncate">{item.label}</p>
                      <p
                        className={`mt-0.5 text-[11px] font-medium ${
                          isActive ? "text-white/75" : "text-slate-500"
                        }`}
                      >
                        {item.helper}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div
          className={`mt-8 pt-8 border-t border-slate-100/50 ${isCollapsed ? "flex flex-col items-center" : ""}`}
        >
          <div
            className={`flex items-center gap-3 mb-6 p-2 rounded-2xl bg-slate-50 border border-slate-100/50 ${isCollapsed ? "justify-center w-12 h-12 p-0 rounded-full" : ""}`}
          >
            <div
              className={`w-10 h-10 bg-health-100 rounded-full flex items-center justify-center text-health-600 font-bold text-lg shadow-inner shrink-0 ${isCollapsed ? "w-12 h-12" : ""}`}
            >
              {doctorName.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="font-bold text-slate-800 truncate" title={doctorName}>
                  {doctorName}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">
                  {role}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1 w-full">
            <button
              onClick={onLogout}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all w-full group ${isCollapsed ? "justify-center px-0" : ""}`}
              title={isCollapsed ? "Cerrar sesión" : ""}
            >
              <LogOut
                className={`w-5 h-5 shrink-0 ${isCollapsed ? "" : "text-red-400 group-hover:text-red-500"}`}
              />
              {!isCollapsed && <span>Cerrar sesión</span>}
            </button>
            {onClosePanel && (
              <button
                onClick={onClosePanel}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all w-full group ${isCollapsed ? "justify-center px-0" : ""}`}
                title={isCollapsed ? "Cerrar panel" : ""}
              >
                <X
                  className={`w-5 h-5 shrink-0 ${isCollapsed ? "" : "text-slate-400 group-hover:text-slate-600"}`}
                />
                {!isCollapsed && <span>Cerrar panel</span>}
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DoctorSidebar;
