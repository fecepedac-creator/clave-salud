import React from "react";
import { ChevronRight, Home, Building2, UserRound, Stethoscope, Lock } from "lucide-react";
import { ViewMode } from "../types";

interface BreadcrumbsProps {
  view: ViewMode;
  centerName?: string;
  onNavigate: (view: ViewMode) => void;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ view, centerName, onNavigate }) => {
  const getBreadcrumbs = () => {
    const items = [{ label: "Inicio", view: "home" as ViewMode, icon: Home }];

    if (view === "home") return items;

    // Center Portal path
    if (centerName) {
      items.push({
        label: centerName,
        view: "center-portal" as ViewMode,
        icon: Building2,
      });
    }

    // Specific Views
    if (view === "doctor-dashboard") {
      items.push({ label: "Profesional", view: "doctor-dashboard" as ViewMode, icon: Stethoscope });
    } else if (view === "admin-dashboard") {
      items.push({ label: "Administración", view: "admin-dashboard" as ViewMode, icon: Lock });
    } else if (view === "patient-menu") {
      items.push({ label: "Pacientes", view: "patient-menu" as ViewMode, icon: UserRound });
    } else if (view === "patient-booking") {
      items.push({ label: "Pacientes", view: "patient-menu" as ViewMode, icon: UserRound });
      items.push({ label: "Reserva", view: "patient-booking" as ViewMode, icon: null });
    } else if (view === "patient-form") {
      items.push({ label: "Pacientes", view: "patient-menu" as ViewMode, icon: UserRound });
      items.push({ label: "Antecedentes", view: "patient-form" as ViewMode, icon: null });
    } else if (view === "patient-cancel") {
      items.push({ label: "Pacientes", view: "patient-menu" as ViewMode, icon: UserRound });
      items.push({ label: "Anulaciones", view: "patient-cancel" as ViewMode, icon: null });
    } else if (view === "superadmin-dashboard") {
      items.push({ label: "SuperAdmin", view: "superadmin-dashboard" as ViewMode, icon: Lock });
    } else if (view === "select-center") {
      items.push({
        label: "Seleccionar Centro",
        view: "select-center" as ViewMode,
        icon: Building2,
      });
    }

    return items;
  };

  const items = getBreadcrumbs();

  if (items.length <= 1) return null;

  return (
    <nav
      className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-slate-500 mb-6 bg-white/60 backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl border border-white/50 shadow-sm w-fit transition-all hover:bg-white/80 animate-fadeIn"
      data-testid="breadcrumbs-nav"
    >
      {/* Desktop View */}
      <div className="hidden md:flex items-center space-x-1 sm:space-x-2">
        {items.map((item, index) => (
          <React.Fragment key={`${item.view}-desktop-${index}`}>
            {index > 0 && <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-300" />}
            <button
              onClick={() => onNavigate(item.view)}
              className={`flex items-center gap-1.5 sm:gap-2 hover:text-sky-600 transition-colors px-1 sm:px-2 py-1 rounded-lg hover:bg-sky-50/50 ${
                index === items.length - 1 ? "font-extrabold text-slate-800" : "font-medium"
              }`}
              data-testid={`breadcrumb-item-${item.view}`}
            >
              {item.icon && <item.icon className="w-3 h-3 sm:w-4 sm:h-4" />}
              <span>{item.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Mobile View: Show only the last two items or just "Back" */}
      <div className="flex md:hidden items-center space-x-2">
        {items.length > 1 && (
          <button
            onClick={() => onNavigate(items[items.length - 2].view)}
            className="flex items-center gap-2 font-bold text-slate-700 active:scale-95 transition-transform"
            data-testid="breadcrumb-mobile-back"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span>{items[items.length - 2].label}</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Breadcrumbs;
