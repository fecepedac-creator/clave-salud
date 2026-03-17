import React, { useMemo, useState } from "react";
import { Prescription } from "../types";
import { generateId } from "../utils";
import { Sparkles, Trash2 } from "lucide-react";
import {
  DEFAULT_EXAM_ORDER_CATALOG,
  ExamOrderCatalog,
  ExamOrderCategory,
  ExamOrderItem,
  getCategoryLabel,
} from "../utils/examOrderCatalog";

type SelectedItem = ExamOrderItem & { category: ExamOrderCategory; group?: string };

interface ExamOrderModalProps {
  isOpen: boolean;
  catalog?: ExamOrderCatalog;
  onClose: () => void;
  onSave: (docs: Prescription[]) => void;
  createdBy?: string;
  onSaveProfile?: (profile: { label: string; exams: string[] }) => void;
  onDeleteProfile?: (id: string) => void;
  customProfiles?: Array<{ id: string; label: string; exams: string[] }>;
}

const ExamOrderModal: React.FC<ExamOrderModalProps> = ({
  isOpen,
  catalog = DEFAULT_EXAM_ORDER_CATALOG,
  onClose,
  onSave,
  createdBy,
  onSaveProfile,
  onDeleteProfile,
  customProfiles = [],
}) => {
  const categories = catalog?.categories || [];

  const [activeCategory, setActiveCategory] = useState<ExamOrderCategory>(
    categories[0]?.id || "lab_general"
  );
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [otherText, setOtherText] = useState("");
  const [notes, setNotes] = useState("");

  const active = useMemo(
    () => categories.find((c) => c.id === activeCategory) || categories[0],
    [categories, activeCategory]
  );

  const combinedProfiles = useMemo(() => {
    const global = catalog?.profiles || [];
    return [...global, ...customProfiles];
  }, [catalog?.profiles, customProfiles]);

  const [isNamingProfile, setIsNamingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  const selectedByCategory = useMemo(() => {
    const map = new Map<ExamOrderCategory, SelectedItem[]>();
    selected.forEach((item) => {
      const curr = map.get(item.category) || [];
      curr.push(item);
      map.set(item.category, curr);
    });
    return map;
  }, [selected]);

  const isChecked = (item: ExamOrderItem, group?: string) =>
    selected.some(
      (s) =>
        s.category === activeCategory && s.label === item.label && (s.group || "") === (group || "")
    );

  const toggleItem = (
    item: ExamOrderItem,
    category: ExamOrderCategory = activeCategory,
    group?: string
  ) => {
    const exists = selected.some(
      (s) => s.category === category && s.label === item.label && (s.group || "") === (group || "")
    );

    if (exists) {
      setSelected((prev) =>
        prev.filter(
          (s) =>
            !(
              s.category === category &&
              s.label === item.label &&
              (s.group || "") === (group || "")
            )
        )
      );
      return;
    }
    setSelected((prev) => [...prev, { ...item, category, group }]);
  };

  const applyProfile = (profileExams: string[]) => {
    const newItems: SelectedItem[] = [];

    profileExams.forEach((examLabel) => {
      // Find the exam in catalog to get its category/group
      let found = false;
      for (const cat of categories) {
        for (const grp of cat.groups || []) {
          const item = grp.items.find((i) => i.label === examLabel);
          if (item) {
            newItems.push({ ...item, category: cat.id as ExamOrderCategory, group: grp.id });
            found = true;
            break;
          }
        }
        if (found) break;

        // Fallback for flat exams if they exist
        const flatItem = (cat as any).exams?.find((i: any) => i.label === examLabel);
        if (flatItem) {
          newItems.push({ ...flatItem, category: cat.id as ExamOrderCategory });
          found = true;
          break;
        }
      }

      // If not in catalog, add to "otros" in active category
      if (!found) {
        newItems.push({ label: examLabel, category: activeCategory, group: "otros" });
      }
    });

    setSelected((prev) => {
      const merged = [...prev];
      newItems.forEach((ni) => {
        const alreadyIn = merged.some((m) => m.label === ni.label && m.category === ni.category);
        if (!alreadyIn) merged.push(ni);
      });
      return merged;
    });
  };

  const handleSavePersonalProfile = () => {
    if (!newProfileName.trim() || selected.length === 0) return;
    onSaveProfile?.({
      label: newProfileName.trim(),
      exams: selected.map((s) => s.label),
    });
    setIsNamingProfile(false);
    setNewProfileName("");
  };

  const addOther = () => {
    const value = otherText.trim();
    if (!value) return;
    setSelected((prev) => [...prev, { label: value, category: activeCategory, group: "otros" }]);
    setOtherText("");
  };

  const handleSave = () => {
    const docs: Prescription[] = Array.from(selectedByCategory.entries()).map(
      ([category, items]) => {
        const content = [
          `Orden de Exámenes - ${getCategoryLabel(category)}`,
          "",
          ...items.map((item) => {
            const contrast =
              item.modality === "TC" || item.modality === "RM"
                ? ` (${item.contrast === "con" ? "con contraste" : "sin contraste"})`
                : "";
            return `• ${item.label}${item.modality ? ` [${item.modality}]` : ""}${contrast}`;
          }),
          notes ? `\nIndicaciones clínicas: ${notes}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        return {
          id: generateId(),
          type: "OrdenExamenes",
          content,
          createdAt: new Date().toISOString(),
          category,
          items: items.map((i) => ({
            label: i.label,
            code: i.code,
            modality: i.modality ?? null,
            contrast: i.contrast ?? null,
          })),
          notes,
          createdBy,
          status: "final",
        };
      }
    );

    if (docs.length === 0) return;
    onSave(docs);
    onClose();
    setSelected([]);
    setNotes("");
    setOtherText("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
      <div className="w-full max-w-6xl h-[95vh] flex flex-col bg-slate-50 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0 shadow-sm z-10">
          <h3 className="text-xl font-bold text-slate-900">Solicitud de exámenes</h3>
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row p-5 gap-5 overflow-hidden">
          {/* Left Panel - Categories and Exams - Scrollable */}
          <div className="lg:w-2/3 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:flex-shrink-0 font-sans">
            {/* Quick Profiles - The "Paks" */}
            {combinedProfiles.length > 0 && (
              <div className="p-4 border-b border-slate-100 bg-indigo-50/40">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                  <p className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                    Perfiles Rápidos (Packs)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {combinedProfiles.map((profile) => {
                    const isCustom = customProfiles.some((cp) => cp.id === profile.id);
                    return (
                      <div key={profile.id} className="group relative flex items-center">
                        <button
                          onClick={() => applyProfile(profile.exams)}
                          title={(profile as any).description}
                          className={`pl-4 pr-10 py-2 border-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2 ${
                            isCustom
                              ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                              : "bg-white border-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600"
                          }`}
                        >
                          {isCustom && <Sparkles className="w-3 h-3" />}+ {profile.label}
                        </button>
                        {isCustom && onDeleteProfile && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`¿Eliminar el pack "${profile.label}"?`)) {
                                onDeleteProfile(profile.id);
                              }
                            }}
                            className="absolute right-2 p-1.5 text-amber-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar pack"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Categories */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0 overflow-x-auto custom-scrollbar">
              <div className="flex gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                      activeCategory === category.id
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105"
                        : "bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {getCategoryLabel(category.id)}
                  </button>
                ))}
              </div>
            </div>

            {/* Exam List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {(active?.groups || []).map((group: any) => (
                <div
                  key={group.id}
                  className="rounded-xl border border-slate-200 overflow-hidden bg-white"
                >
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <p className="text-sm font-bold text-slate-700">{group.label}</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 p-3">
                    {group.items.map((item) => {
                      const checked = isChecked(item, group.id);
                      return (
                        <label
                          key={`${group.id}-${item.label}`}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl p-3 text-sm transition-colors cursor-pointer border ${checked ? "bg-indigo-50/50 border-indigo-200" : "bg-slate-50 border-transparent hover:border-indigo-100"}`}
                        >
                          <span className="flex items-start sm:items-center gap-3 font-medium text-slate-700">
                            <input
                              type="checkbox"
                              className="mt-0.5 sm:mt-0 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 transition-transform active:scale-95"
                              checked={checked}
                              onChange={() => toggleItem(item, group.id)}
                            />
                            <span className="leading-tight">{item.label}</span>
                          </span>
                          {checked && (item.modality === "TC" || item.modality === "RM") && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <select
                                className="text-xs border border-indigo-200 text-indigo-700 font-bold rounded-lg px-2 py-1 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white w-full sm:w-auto mt-2 sm:mt-0"
                                value={
                                  selected.find(
                                    (s) =>
                                      s.category === activeCategory &&
                                      s.label === item.label &&
                                      (s.group || "") === group.id
                                  )?.contrast || "sin"
                                }
                                onChange={(e) => {
                                  const value = e.target.value as "con" | "sin";
                                  setSelected((prev) =>
                                    prev.map((s) =>
                                      s.category === activeCategory &&
                                      s.label === item.label &&
                                      (s.group || "") === group.id
                                        ? { ...s, contrast: value }
                                        : s
                                    )
                                  );
                                }}
                              >
                                <option value="sin">Sin contraste</option>
                                <option value="con">Con contraste</option>
                              </select>
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {!(active as any)?.groups && (active as any)?.exams && (
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <p className="text-sm font-bold text-slate-700">Exámenes</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 p-3">
                    {(active as any).exams.map((item: any) => {
                      const checked = isChecked(item);
                      return (
                        <label
                          key={item.id || item.label}
                          className={`flex items-center justify-between gap-2 rounded-xl p-3 text-sm transition-colors cursor-pointer border ${checked ? "bg-indigo-50/50 border-indigo-200" : "bg-slate-50 border-transparent hover:border-indigo-100"}`}
                        >
                          <span className="flex items-center gap-3 font-medium text-slate-700">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 transition-transform active:scale-95"
                              checked={checked}
                              onChange={() => toggleItem(item)}
                            />
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <p className="text-sm font-bold text-slate-700">
                    Otros ({getCategoryLabel(activeCategory)})
                  </p>
                </div>
                <div className="p-3 flex gap-2">
                  <input
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                    placeholder="Agregar examen no listado (Ej: Perfil bioquímico...)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addOther();
                    }}
                  />
                  <button
                    onClick={addOther}
                    disabled={!otherText.trim()}
                    className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95 shadow-sm"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Sticky / Fixed constraints */}
          <div className="lg:w-1/3 flex flex-col gap-4 flex-shrink-0 overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-5 overflow-hidden">
              {/* Added items list */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
                <p className="font-bold text-slate-800 text-lg">Seleccionados</p>
                <span className="text-sm font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-full shadow-inner">
                  {selected.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar relative">
                {selected.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center opacity-50">
                    <p className="text-sm font-bold text-slate-600 mb-1">Lista vacía</p>
                    <p className="text-xs text-slate-500">
                      Selecciona exámenes a la izquierda para agregarlos a la orden.
                    </p>
                  </div>
                )}
                {selected.map((item) => (
                  <div
                    key={`${item.category}-${item.group}-${item.label}`}
                    className="flex justify-between items-start gap-3 text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm animate-fadeIn"
                  >
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 leading-tight">
                        {item.label}
                        {item.contrast && (item.modality === "TC" || item.modality === "RM") ? (
                          <span className="text-indigo-600 ml-1">({item.contrast})</span>
                        ) : (
                          ""
                        )}
                      </p>
                      <p className="text-xs font-bold text-indigo-500 mt-1.5 uppercase tracking-wide">
                        {getCategoryLabel(item.category)}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setSelected((prev) =>
                          prev.filter(
                            (s) =>
                              !(
                                s.category === item.category &&
                                s.label === item.label &&
                                (s.group || "") === (item.group || "")
                              )
                          )
                        )
                      }
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors font-bold text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Personal Profile Creation */}
              {selected.length > 0 && onSaveProfile && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  {isNamingProfile ? (
                    <div className="flex flex-col gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-scaleIn">
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-tighter">
                        Nombre del nuevo Pack
                      </p>
                      <input
                        autoFocus
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        className="bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                        placeholder="Ej: Mi Perfil Renal..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSavePersonalProfile}
                          disabled={!newProfileName.trim()}
                          className="flex-1 bg-amber-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                          Guardar Pack
                        </button>
                        <button
                          onClick={() => setIsNamingProfile(false)}
                          className="px-3 bg-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsNamingProfile(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-xs font-bold"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Guardar como Pack Personal
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="flex-shrink-0 border-t border-slate-100 pt-4 mt-2">
              <div className="flex justify-between items-end mb-2">
                <p className="font-bold text-slate-800 text-sm">Indicaciones / Sospecha Clínica</p>
              </div>
              <textarea
                className="w-full border border-slate-300 rounded-xl px-4 py-3 h-28 text-sm outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 resize-none text-slate-700 font-medium"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Sospecha de enfermedad autoinmune activa. Favor priorizar..."
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={selected.length === 0}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 shadow-xl shadow-emerald-200 flex-shrink-0 text-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-emerald-500"
          >
            Guardar {selected.length} órdenes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamOrderModal;
