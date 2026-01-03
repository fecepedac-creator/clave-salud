import React from "react";

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
    <aside className="w-64 bg-slate-900 text-slate-200 h-screen fixed left-0 top-0 border-r border-slate-800 flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">{title}</div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {filtered.map((i) => {
          const active = activeTarget === i.target;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => onNavigate(i.target)}
              className={[
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
                active ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-800",
              ].join(" ")}
            >
              {i.icon ? <span className="shrink-0">{i.icon}</span> : null}
              <span className="font-semibold">{i.label}</span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-sm text-slate-400 p-4 rounded-xl border border-slate-800">
            No hay módulos habilitados para este centro.
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">{footer}</div>
    </aside>
  );
};

export default Sidebar;
