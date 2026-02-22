import React, { useState, useMemo } from "react";
import { X, Check, Search, Copy } from "lucide-react";
import { EXAM_MODULES, QUICK_PROFILES } from "../constants/examCatalog";

interface ExamSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedExams: string[], otherText: string) => void;
    initialSelection?: string[];
}

const ExamSelectionModal: React.FC<ExamSelectionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    initialSelection = [],
}) => {
    // Safety check for empty modules
    const defaultModuleId = EXAM_MODULES.length > 0 ? EXAM_MODULES[0].id : "";
    const [activeModuleId, setActiveModuleId] = useState<string>(defaultModuleId);
    const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set(initialSelection));
    const [otherText, setOtherText] = useState("");
    const [searchTerm, setSearchTerm] = useState("");



    const [contrastExams, setContrastExams] = useState<Set<string>>(new Set());
    const [customGroupExams, setCustomGroupExams] = useState<Record<string, string>>({});

    const toggleContrast = (exam: string) => {
        const next = new Set(contrastExams);
        if (next.has(exam)) {
            next.delete(exam);
        } else {
            next.add(exam);
        }
        setContrastExams(next);
    };

    const handleCustomGroupChange = (groupLabel: string, value: string) => {
        setCustomGroupExams(prev => ({
            ...prev,
            [groupLabel]: value
        }));
    };

    const toggleExam = (exam: string) => {
        const next = new Set(selectedExams);
        if (next.has(exam)) {
            next.delete(exam);
            // Also remove from contrast if present
            if (contrastExams.has(exam)) {
                const nextContrast = new Set(contrastExams);
                nextContrast.delete(exam);
                setContrastExams(nextContrast);
            }
        } else {
            next.add(exam);
        }
        setSelectedExams(next);
    };

    const applyProfile = (exams: string[]) => {
        const next = new Set(selectedExams);
        exams.forEach((e) => next.add(e));
        setSelectedExams(next);
    };

    const activeModule = EXAM_MODULES.find((m) => m.id === activeModuleId);

    // Filter logic
    const filteredModules = useMemo(() => {
        if (!searchTerm) return EXAM_MODULES;
        const lower = searchTerm.toLowerCase();

        // Return modules that have at least one matching item
        return EXAM_MODULES.map(m => ({
            ...m,
            groups: m.groups.map(g => ({
                ...g,
                items: g.items.filter(i => i.toLowerCase().includes(lower))
            })).filter(g => g.items.length > 0)
        })).filter(m => m.groups.length > 0);
    }, [searchTerm]);

    const handleConfirm = () => {
        // Process selected exams with contrast
        const finalSelection = Array.from(selectedExams).map(exam => {
            if (contrastExams.has(exam)) {
                return `${exam} con Contraste`;
            }
            return exam;
        });

        // Add custom group exams
        Object.entries(customGroupExams).forEach(([group, text]) => {
            if (typeof text === 'string' && text.trim()) {
                // Formatting: "Radiografías: Tobillo derecho" or just the text?
                // User asked for "box that says other". usually implies just adding the item.
                // But context helps. Let's send it as "Otro (Group): Text" or just Text if it's clear.
                // Let's format nicely: "[Group] Otro: Value" to avoid confusion if mixed in list.
                // Or maybe just the text is fine if the user writes "Ry de tobillo".
                // Let's assume user writes the full exam name.
                // But to be safe, I'll append it to otherText global?
                // The prompt says "return them as items".
                // Let's add them to the array.
                finalSelection.push(`${text} (${group})`);
            }
        });

        onConfirm(finalSelection, otherText);
        onClose();
    };

    if (!isOpen) return null;

    // Helper to check if group needs "Other" field
    const isImageGroup = (label: string) =>
        ["Radiografías", "Ecografías", "Tomografía (TC/Scanner)", "Resonancia (RNM)"].includes(label);

    // Helper to check if group needs Contrast toggle
    const isContrastGroup = (label: string) =>
        ["Tomografía (TC/Scanner)", "Resonancia (RNM)"].includes(label);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Seleccionar Exámenes</h2>
                        <p className="text-sm text-slate-500">Marque los exámenes que desea solicitar</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Quick Profiles Bar */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 whitespace-nowrap text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 flex-shrink-0">
                        <Copy className="w-4 h-4" /> Perfiles Rápidos:
                    </div>
                    {QUICK_PROFILES.map((profile) => (
                        <button
                            key={profile.id}
                            onClick={() => applyProfile(profile.exams)}
                            className="flex-shrink-0 bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center justify-center"
                        >
                            {profile.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-100 relative">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none"
                            placeholder="Buscar examen..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Body grid */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Modules */}
                    <div className="w-48 bg-slate-50 border-r border-slate-100 overflow-y-auto hidden md:block">
                        <div className="p-2 space-y-1">
                            {EXAM_MODULES.map((mod) => (
                                <button
                                    key={mod.id}
                                    onClick={() => {
                                        setActiveModuleId(mod.id);
                                        setSearchTerm(""); // Reset search on module switch if desired
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeModuleId === mod.id && !searchTerm
                                        ? "bg-indigo-100 text-indigo-700 font-bold"
                                        : "text-slate-600 hover:bg-slate-100"
                                        }`}
                                >
                                    {mod.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Exam List */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                        {(searchTerm ? filteredModules : (activeModule ? [activeModule] : [])).map((mod) => (
                            <div key={mod.id} className="mb-8">
                                {/* Show module title if searching or just for structure */}
                                <h3 className="text-lg font-bold text-indigo-900 mb-4 border-b border-indigo-100 pb-2">{mod.label}</h3>
                                <div className="grid grid-cols-1 gap-6">
                                    {mod.groups.map((group) => (
                                        <div key={group.label} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                            <h4 className="font-bold text-slate-700 text-sm mb-3 uppercase tracking-wide">
                                                {group.label}
                                            </h4>
                                            {/* Refactored to Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                                                {group.items.map((exam) => (
                                                    <div key={exam} className="flex flex-col gap-1">
                                                        <label
                                                            className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${selectedExams.has(exam) ? "bg-indigo-50 border border-indigo-100" : "hover:bg-slate-50 border border-transparent"
                                                                }`}
                                                        >
                                                            <div className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${selectedExams.has(exam) ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-300"
                                                                }`}>
                                                                {selectedExams.has(exam) && <Check className="w-2.5 h-2.5" />}
                                                            </div>
                                                            <input
                                                                type="checkbox"
                                                                className="hidden"
                                                                checked={selectedExams.has(exam)}
                                                                onChange={() => toggleExam(exam)}
                                                            />
                                                            <span className={`text-xs leading-tight ${selectedExams.has(exam) ? "text-indigo-900 font-medium" : "text-slate-600"}`}>
                                                                {exam}
                                                            </span>
                                                        </label>
                                                        {selectedExams.has(exam) && isContrastGroup(group.label) && (
                                                            <button
                                                                onClick={() => toggleContrast(exam)}
                                                                className={`text-[10px] ml-6 px-2 py-0.5 rounded-full border transition-all w-fit ${contrastExams.has(exam)
                                                                    ? "bg-amber-100 text-amber-700 border-amber-200 font-bold"
                                                                    : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                                                                    }`}
                                                            >
                                                                {contrastExams.has(exam) ? "Con Contraste" : "Sin Contraste"}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {isImageGroup(group.label) && (
                                                <div className="mt-3 pt-2 border-t border-slate-50">
                                                    <input
                                                        type="text"
                                                        placeholder={`Otro en ${group.label}...`}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-200 outline-none transition-all"
                                                        value={customGroupExams[group.label] || ""}
                                                        onChange={(e) => handleCustomGroupChange(group.label, e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {(searchTerm && filteredModules.length === 0) && (
                            <div className="text-center py-10 text-slate-400">
                                No se encontraron exámenes con "{searchTerm}"
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer with "Other" items */}
                <div className="p-6 border-t border-slate-100 bg-white">
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            Otros (Escriba uno por línea)
                        </label>
                        <textarea
                            className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none resize-none h-20"
                            placeholder="Exámenes adicionales no listados..."
                            value={otherText}
                            onChange={e => setOtherText(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="text-sm font-medium text-slate-600">
                            {selectedExams.size} exámenes seleccionados
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors"
                            >
                                Aplicar Selección
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExamSelectionModal;
