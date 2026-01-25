import React, { useState } from "react";
import { ToothState } from "../types";
import { Check, X } from "lucide-react";

interface OdontogramProps {
  value: ToothState[];
  onChange: (value: ToothState[]) => void;
  readOnly?: boolean;
}

const TOOTH_CONDITIONS = [
  { id: "Sano", color: "bg-white", label: "Sano" },
  { id: "Caries", color: "bg-red-400", label: "Caries" },
  { id: "Obturado", color: "bg-blue-400", label: "Obturado (Tapado)" },
  { id: "Ausente", color: "bg-slate-800", label: "Ausente" },
  { id: "Endodoncia", color: "bg-purple-400", label: "Endodoncia" },
  { id: "Corona", color: "bg-yellow-400", label: "Corona" },
  { id: "Extraccion_Ind", color: "bg-red-600", label: "Extracción Indicada" },
];

const Odontogram: React.FC<OdontogramProps> = ({ value, onChange, readOnly = false }) => {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [condition, setCondition] = useState<string>("Caries");
  const [note, setNote] = useState("");

  // FDI Notation
  const quadrants = [
    [18, 17, 16, 15, 14, 13, 12, 11], // Top Right
    [21, 22, 23, 24, 25, 26, 27, 28], // Top Left
    [48, 47, 46, 45, 44, 43, 42, 41], // Bottom Right
    [31, 32, 33, 34, 35, 36, 37, 38], // Bottom Left
  ];

  const getToothData = (id: number) => value.find((t) => t.id === id);

  const handleToothClick = (id: number) => {
    if (readOnly) return;
    const current = getToothData(id);
    setSelectedTooth(id);
    setCondition(current?.status || "Sano");
    setNote(current?.notes || "");
  };

  const handleSaveTooth = () => {
    if (!selectedTooth) return;

    const newEntry: ToothState = {
      id: selectedTooth,
      status: condition as any,
      notes: note,
    };

    // Remove existing entry for this tooth if exists, then add new one
    const filtered = value.filter((t) => t.id !== selectedTooth);
    onChange([...filtered, newEntry]);

    setSelectedTooth(null);
  };

  const renderTooth = (id: number) => {
    const data = getToothData(id);
    const conditionConfig = TOOTH_CONDITIONS.find((c) => c.id === (data?.status || "Sano"));
    const isSelected = selectedTooth === id;

    return (
      <button
        key={id}
        onClick={() => handleToothClick(id)}
        className={`
                    flex flex-col items-center justify-center p-1 rounded-lg border transition-all
                    ${isSelected ? "ring-4 ring-primary-300 z-10 scale-110 border-primary-600" : "border-slate-200 hover:border-primary-400"}
                    ${data?.status === "Ausente" ? "opacity-50" : ""}
                `}
      >
        <div
          className={`w-8 h-8 md:w-10 md:h-10 rounded border border-slate-300 shadow-sm mb-1 ${conditionConfig?.color} ${data?.status === "Ausente" ? "bg-slate-800" : ""}`}
        ></div>
        <span className="text-xs font-bold text-slate-500">{id}</span>
      </button>
    );
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200">
      <h4 className="font-bold text-slate-700 mb-4 text-center uppercase tracking-widest">
        Odontograma (Adulto)
      </h4>

      {/* Mouth Grid */}
      <div className="flex flex-col gap-4 items-center">
        {/* Upper Jaw */}
        <div className="flex gap-8 border-b-2 border-slate-100 pb-4">
          <div className="flex gap-1 md:gap-2">{quadrants[0].map(renderTooth)}</div>
          <div className="w-px bg-slate-300 h-full mx-2"></div>
          <div className="flex gap-1 md:gap-2">{quadrants[1].map(renderTooth)}</div>
        </div>
        {/* Lower Jaw */}
        <div className="flex gap-8 pt-2">
          <div className="flex gap-1 md:gap-2">{quadrants[2].map(renderTooth)}</div>
          <div className="w-px bg-slate-300 h-full mx-2"></div>
          <div className="flex gap-1 md:gap-2">{quadrants[3].map(renderTooth)}</div>
        </div>
      </div>

      {/* Legend / Status Indicators */}
      <div className="mt-6 flex flex-wrap justify-center gap-4 border-t border-slate-100 pt-4">
        {TOOTH_CONDITIONS.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${c.color} border border-slate-300`}></div>
            <span className="text-xs text-slate-600">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Edit Modal (Inline) */}
      {selectedTooth && !readOnly && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-slideUp">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">Pieza {selectedTooth}</h3>
              <button onClick={() => setSelectedTooth(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Estado</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {TOOTH_CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCondition(c.id)}
                  className={`
                                        text-xs font-bold p-2 rounded-lg border text-left flex items-center gap-2
                                        ${condition === c.id ? "bg-primary-50 border-primary-500 text-primary-700" : "bg-white border-slate-200 text-slate-600"}
                                    `}
                >
                  <div className={`w-3 h-3 rounded-full ${c.color} border border-slate-300`}></div>
                  {c.label}
                </button>
              ))}
            </div>

            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              Observaciones
            </label>
            <textarea
              className="w-full border border-slate-200 rounded-lg p-3 text-sm mb-4 outline-none focus:border-primary-500"
              placeholder="Ej: Dolor al frío, fractura visible..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />

            <button
              onClick={handleSaveTooth}
              className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" /> Confirmar Estado
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Odontogram;
