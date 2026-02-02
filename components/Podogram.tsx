import React, { useState } from "react";
import { NailState } from "../types";
import { Check, X } from "lucide-react";

interface PodogramProps {
    value: NailState[];
    onChange: (value: NailState[]) => void;
    readOnly?: boolean;
}

const NAIL_CONDITIONS = [
    { id: "Sana", color: "bg-white", label: "Sana" },
    { id: "Onicomicosis", color: "bg-yellow-200", label: "Onicomicosis (Hongos)" },
    { id: "Onicocriptosis", color: "bg-red-200", label: "Onicocriptosis (Encarnada)" },
    { id: "Onicogrifosis", color: "bg-amber-400", label: "Onicogrifosis (Engrosada)" },
    { id: "Ausente", color: "bg-slate-800", label: "Ausente / Extirpada" },
    { id: "Atrofica", color: "bg-slate-300", label: "Atrofia Ungueal" },
    { id: "Traumatica", color: "bg-indigo-300", label: "Lesión Traumática" },
];

const Podogram: React.FC<PodogramProps> = ({ value, onChange, readOnly = false }) => {
    const [selectedNail, setSelectedNail] = useState<string | null>(null);
    const [condition, setCondition] = useState<string>("Sana");
    const [note, setNote] = useState("");

    const leftFoot = ["L5", "L4", "L3", "L2", "L1"]; // Little to Big
    const rightFoot = ["R1", "R2", "R3", "R4", "R5"]; // Big to Little

    const getNailData = (id: string) => value.find((t) => t.id === id);

    const handleNailClick = (id: string) => {
        if (readOnly) return;
        const current = getNailData(id);
        setSelectedNail(id);
        setCondition(current?.status || "Sana");
        setNote(current?.notes || "");
    };

    const handleSaveNail = () => {
        if (!selectedNail) return;

        const newEntry: NailState = {
            id: selectedNail,
            status: condition as any,
            notes: note,
        };

        const filtered = value.filter((t) => t.id !== selectedNail);
        onChange([...filtered, newEntry]);

        setSelectedNail(null);
    };

    const renderNail = (id: string) => {
        const data = getNailData(id);
        const conditionConfig = NAIL_CONDITIONS.find((c) => c.id === (data?.status || "Sana"));
        const isSelected = selectedNail === id;

        // Determine size and shape based on id (L1/R1 are bigger)
        const isBigToe = id.includes("1");

        return (
            <button
                key={id}
                type="button"
                onClick={() => handleNailClick(id)}
                className={`
          flex flex-col items-center justify-center p-2 rounded-xl border transition-all
          ${isSelected ? "ring-4 ring-primary-300 z-10 scale-110 border-primary-600 shadow-lg" : "border-slate-200 hover:border-primary-400"}
          ${data?.status === "Ausente" ? "opacity-50" : ""}
        `}
            >
                <div
                    className={`
            ${isBigToe ? "w-12 h-14" : "w-8 h-10"} 
            rounded-t-2xl rounded-b-md border-2 border-slate-300 shadow-inner mb-1 flex items-start justify-center pt-1
            ${conditionConfig?.color}
          `}
                >
                    {/* Visual representation of a nail */}
                    <div className="w-3/4 h-2/3 bg-white/30 rounded-t-lg border border-black/5"></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{id}</span>
            </button>
        );
    };

    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-700 mb-6 text-center uppercase tracking-widest flex items-center justify-center gap-2">
                Mapeo Ungueal (Podograma)
            </h4>

            <div className="flex flex-col md:flex-row gap-12 justify-center items-end">
                {/* Left Foot */}
                <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-400 mb-4 uppercase">Pie Izquierdo</span>
                    <div className="flex gap-2 items-end">
                        {leftFoot.map(renderNail)}
                    </div>
                </div>

                {/* Right Foot */}
                <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-400 mb-4 uppercase">Pie Derecho</span>
                    <div className="flex gap-2 items-end">
                        {rightFoot.map(renderNail)}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-8 flex flex-wrap justify-center gap-4 border-t border-slate-100 pt-6">
                {NAIL_CONDITIONS.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border border-slate-300 ${c.color}`}></div>
                        <span className="text-xs font-medium text-slate-600">{c.label}</span>
                    </div>
                ))}
            </div>

            {/* Modal Editor */}
            {selectedNail && !readOnly && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md animate-slideUp border border-white">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-2xl text-slate-800">Dedo {selectedNail}</h3>
                                <p className="text-sm text-slate-500">Actualizar estado de la uña</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedNail(null)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Hallazgos / Estado</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {NAIL_CONDITIONS.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setCondition(c.id)}
                                            className={`
                        text-sm font-bold p-3 rounded-xl border text-left flex items-center gap-3 transition-all
                        ${condition === c.id ? "bg-primary-50 border-primary-500 text-primary-700 shadow-sm" : "bg-white border-slate-100 text-slate-600 hover:border-slate-300"}
                      `}
                                        >
                                            <div className={`w-4 h-4 rounded border border-slate-300 ${c.color}`}></div>
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Observaciones Específicas</label>
                                <textarea
                                    className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm outline-none focus:border-primary-500 bg-slate-50 focus:bg-white transition-all h-24 resize-none"
                                    placeholder="Ej: Eritema periungueal, onicólisis distal..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveNail}
                                className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Check className="w-5 h-5" /> Aplicar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Podogram;
