import React, { useMemo, useState } from "react";
import { Prescription } from "../types";
import { generateId } from "../utils";
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
}

const ExamOrderModal: React.FC<ExamOrderModalProps> = ({
  isOpen,
  catalog = DEFAULT_EXAM_ORDER_CATALOG,
  onClose,
  onSave,
  createdBy,
}) => {
  const categories = catalog.categories;
  const [activeCategory, setActiveCategory] = useState<ExamOrderCategory>(
    categories[0]?.id || "lab_general"
  );
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [otherText, setOtherText] = useState("");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const active = categories.find((c) => c.id === activeCategory) || categories[0];

  const isChecked = (item: ExamOrderItem, group?: string) =>
    selected.some(
      (s) =>
        s.category === activeCategory &&
        s.label === item.label &&
        (s.group || "") === (group || "")
    );

  const toggleItem = (item: ExamOrderItem, group?: string) => {
    const exists = isChecked(item, group);
    if (exists) {
      setSelected((prev) =>
        prev.filter(
          (s) =>
            !(
              s.category === activeCategory &&
              s.label === item.label &&
              (s.group || "") === (group || "")
            )
        )
      );
      return;
    }
    setSelected((prev) => [...prev, { ...item, category: activeCategory, group }]);
  };

  const addOther = () => {
    const value = otherText.trim();
    if (!value) return;
    setSelected((prev) => [...prev, { label: value, category: activeCategory, group: "otros" }]);
    setOtherText("");
  };

  const selectedByCategory = useMemo(() => {
    const map = new Map<ExamOrderCategory, SelectedItem[]>();
    selected.forEach((item) => {
      const curr = map.get(item.category) || [];
      curr.push(item);
      map.set(item.category, curr);
    });
    return map;
  }, [selected]);

  const handleSave = () => {
    const docs: Prescription[] = Array.from(selectedByCategory.entries()).map(([category, items]) => {
      const content = [
        `Orden de Exámenes - ${getCategoryLabel(category)}`,
        "",
        ...items.map((item) => {
          const contrast = item.modality === "TC" || item.modality === "RM" ? ` (${item.contrast === "con" ? "con contraste" : "sin contraste"})` : "";
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
    });

    if (docs.length === 0) return;
    onSave(docs);
    onClose();
    setSelected([]);
    setNotes("");
    setOtherText("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
      <div className="w-full max-w-6xl bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Solicitud de exámenes</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 font-bold">
            Cerrar
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold ${
                    activeCategory === category.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {active.groups.map((group) => (
                <div key={group.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-bold text-slate-700 mb-2">{group.label}</p>
                  <div className="grid md:grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const checked = isChecked(item, group.id);
                      return (
                        <label key={`${group.id}-${item.label}`} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg p-2 text-sm">
                          <span>
                            <input
                              type="checkbox"
                              className="mr-2"
                              checked={checked}
                              onChange={() => toggleItem(item, group.id)}
                            />
                            {item.label}
                          </span>
                          {checked && (item.modality === "TC" || item.modality === "RM") && (
                            <select
                              className="text-xs border rounded px-2 py-1"
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
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-bold mb-2">Otros ({getCategoryLabel(activeCategory)})</p>
              <div className="flex gap-2">
                <input
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2"
                  placeholder="Agregar examen no listado"
                />
                <button onClick={addOther} className="px-3 py-2 rounded-lg bg-indigo-600 text-white">
                  Agregar
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="font-bold text-slate-800 mb-2">Seleccionados</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selected.length === 0 && <p className="text-sm text-slate-400">Sin exámenes seleccionados.</p>}
                {selected.map((item) => (
                  <div key={`${item.category}-${item.group}-${item.label}`} className="flex justify-between gap-2 text-sm bg-slate-50 rounded-lg p-2">
                    <span>{item.label} <span className="text-xs text-slate-500">({getCategoryLabel(item.category)})</span></span>
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
                      className="text-red-600 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="font-bold text-slate-800 mb-2">Indicaciones clínicas / sospecha</p>
              <textarea
                className="w-full border rounded-lg px-3 py-2 h-24"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: sospecha de enfermedad autoinmune activa..."
              />
            </div>

            <button
              onClick={handleSave}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700"
            >
              Guardar órdenes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamOrderModal;
