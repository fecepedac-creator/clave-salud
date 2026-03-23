import React from "react";
import {
  ShieldCheck,
  UsersRound,
  CalendarCheck,
  TrendingUp,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { RoleId } from "../../../types";

interface DoctorSidebarProps {
  activeTab: "patients" | "agenda" | "reminders" | "settings" | "performance";
  setActiveTab: (tab: "patients" | "agenda" | "reminders" | "settings" | "performance") => void;
  doctorName: string;
  role: RoleId;
  onLogout: () => void;
  onClosePanel?: () => void;
}

const DoctorSidebar: React.FC<DoctorSidebarProps> = ({
  activeTab,
  setActiveTab,
  doctorName,
  role,
  onLogout,
  onClosePanel,
}) => {
  return (
    <aside className="w-full lg:w-72 bg-white/80 backdrop-blur-md border-r border-slate-200/60 sticky top-0 h-screen overflow-y-auto z-20 shadow-sm transition-all duration-300">
      <div className="p-8 border-b border-slate-100/50">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-health-600" />
          ClaveSalud
        </h2>
        <p className="text-[10px] text-health-600 font-bold uppercase tracking-[0.2em] mt-1">
          Professional Portal
        </p>
      </div>
      <div className="p-8">
        <nav data-testid="doctor-tab-bar" className="space-y-2">
          <button
            data-testid="doctor-tab-patients"
            onClick={() => setActiveTab("patients")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full group ${
              activeTab === "patients"
                ? "bg-health-600 text-white shadow-lg shadow-health-200"
                : "text-slate-600 hover:bg-slate-50 hover:text-health-600"
            }`}
          >
            <UsersRound
              className={`w-5 h-5 ${activeTab === "patients" ? "text-white" : "text-slate-400 group-hover:text-health-500"}`}
            />
            Pacientes
          </button>
          <button
            data-testid="doctor-tab-agenda"
            onClick={() => setActiveTab("agenda")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full group ${
              activeTab === "agenda"
                ? "bg-health-600 text-white shadow-lg shadow-health-200"
                : "text-slate-600 hover:bg-slate-50 hover:text-health-600"
            }`}
          >
            <CalendarCheck
              className={`w-5 h-5 ${activeTab === "agenda" ? "text-white" : "text-slate-400 group-hover:text-health-500"}`}
            />
            Agenda
          </button>
          <button
            data-testid="doctor-tab-performance"
            onClick={() => setActiveTab("performance")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full group ${
              activeTab === "performance"
                ? "bg-health-600 text-white shadow-lg shadow-health-200"
                : "text-slate-600 hover:bg-slate-50 hover:text-health-600"
            }`}
          >
            <TrendingUp
              className={`w-5 h-5 ${activeTab === "performance" ? "text-white" : "text-slate-400 group-hover:text-health-500"}`}
            />
            Rendimiento
          </button>
          <button
            data-testid="doctor-tab-settings"
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full group ${
              activeTab === "settings"
                ? "bg-health-600 text-white shadow-lg shadow-health-200"
                : "text-slate-600 hover:bg-slate-50 hover:text-health-600"
            }`}
          >
            <Settings
              className={`w-5 h-5 ${activeTab === "settings" ? "text-white" : "text-slate-400 group-hover:text-health-500"}`}
            />
            Configuración
          </button>
        </nav>

        <div className="mt-8 pt-8 border-t border-slate-100/50">
          <div className="flex items-center gap-3 mb-6 p-2 rounded-2xl bg-slate-50 border border-slate-100/50">
            <div className="w-10 h-10 bg-health-100 rounded-full flex items-center justify-center text-health-600 font-bold text-lg shadow-inner">
              {doctorName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-slate-800 truncate" title={doctorName}>{doctorName}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{role}</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all w-full group"
            >
              <LogOut className="w-5 h-5 text-red-400 group-hover:text-red-500" />
              Cerrar Sesión
            </button>
            {onClosePanel && (
              <button
                onClick={onClosePanel}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all w-full group"
              >
                <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                Cerrar Panel
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DoctorSidebar;
