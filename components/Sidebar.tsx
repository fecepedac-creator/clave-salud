import React from "react";
import Button from "./ui/Button";

export type SidebarItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** viewMode o ruta interna que tu App entiende */
  target: string;
  /** Si se define, el item se muestra SOLO si modules[moduleKey] === true */
  moduleKey?: string;
  /** Si false, se oculta */
  visible?: boolean;
};

export type CenterModules = Record<string, boolean>;

interface SidebarProps {
  title?: string;
  items: SidebarItem[];
  activeTarget?: string;
  modules?: CenterModules;
  onNavigate: (target: string) => void;
  footer?: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({
  title = "Menú",
  items,
  activeTarget,
  modules,
  onNavigate,
  footer,
}) => {
  const isEnabled = (moduleKey?: string) => {
    if (!moduleKey) return true;
    const v = modules?.[moduleKey];
    return v === undefined ? true : !!v;
  };

  const filtered = items.filter((i) => i.visible !== false).filter((i) => isEnabled(i.moduleKey));

  return (
    <aside className="w-64 bg-slate-950/40 backdrop-blur-md text-slate-200 h-screen fixed left-0 top-0 border-r border-emerald-500/10 flex flex-col z-50">
      <div className="p-8 border-b border-emerald-500/10">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400 font-black">
          {title}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        {filtered.map((i) => {
          const active = activeTarget === i.target;
          return (
            <Button
              key={i.id}
              variant={active ? "glass" : "ghost"}
              onClick={() => onNavigate(i.target)}
              className={`w-full justify-start gap-4 px-4 py-3.5 rounded-2xl transition-all group ${
                active 
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-lg shadow-emerald-950/40" 
                  : "hover:bg-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              {i.icon ? (
                <span className={`shrink-0 transition-transform duration-300 group-hover:scale-110 ${active ? "text-emerald-400" : "opacity-60"}`}>
                  {i.icon}
                </span>
              ) : null}
              <span className={`font-bold tracking-tight text-sm ${active ? "text-emerald-500 shadow-emerald-500/20" : ""}`}>
                {i.label}
              </span>
            </Button>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-sm text-slate-500 p-8 rounded-3xl border border-white/5 bg-white/5 italic text-center">
            No hay módulos habilitados
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-emerald-500/10 bg-slate-950/20">
        {footer}
      </div>
    </aside>
  );
};

export default Sidebar;
