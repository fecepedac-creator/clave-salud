import React, { useState } from "react";
import { ExamSheet, ExamProfile, ExamDefinition, Consultation } from "../types";
import { generateId } from "../utils";
import {
    ChevronDown,
    ChevronUp,
    Plus,
    Trash2,
    Calendar,
    TestTube,
    FileSpreadsheet,
    X,
} from "lucide-react";
import { MiniTrendChart, HistoryPoint } from "./MiniTrendChart";

interface ExamSheetsSectionProps {
    examSheets: ExamSheet[];
    onChange: (sheets: ExamSheet[]) => void;
    examOptions: ExamDefinition[];
    availableProfiles: ExamProfile[];
    consultationHistory: Consultation[];
    legacyExams?: Record<string, string>; // For trend calculation (current consultation legacy exams)
}

export const ExamSheetsSection: React.FC<ExamSheetsSectionProps> = ({
    examSheets,
    onChange,
    examOptions,
    availableProfiles,
    consultationHistory,
    legacyExams,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedSheetId, setExpandedSheetId] = useState<string | null>(null);

    const handleAddSheet = () => {
        const newSheet: ExamSheet = {
            id: generateId(),
            date: new Date().toISOString().split("T")[0],
            exams: {},
        };
        onChange([...examSheets, newSheet]);
        setExpandedSheetId(newSheet.id);
        setIsExpanded(true);
    };

    const handleRemoveSheet = (id: string) => {
        if (window.confirm("¿Eliminar esta planilla de exámenes?")) {
            onChange(examSheets.filter((s) => s.id !== id));
        }
    };

    const handleUpdateSheet = (id: string, updates: Partial<ExamSheet>) => {
        onChange(
            examSheets.map((s) => (s.id === id ? { ...s, ...updates } : s))
        );
    };

    const handleAddProfileToSheet = (sheetId: string, profileId: string) => {
        const sheet = examSheets.find((s) => s.id === sheetId);
        const profile = availableProfiles.find((p) => p.id === profileId);
        if (!sheet || !profile) return;

        const newExams = { ...sheet.exams };
        profile.exams.forEach((examId) => {
            if (!newExams[examId]) {
                newExams[examId] = "";
            }
        });
        handleUpdateSheet(sheetId, { exams: newExams });
    };

    const handleAddExamToSheet = (sheetId: string, examId: string) => {
        const sheet = examSheets.find((s) => s.id === sheetId);
        if (!sheet) return;
        if (sheet.exams[examId] !== undefined) return; // Already exists

        handleUpdateSheet(sheetId, {
            exams: { ...sheet.exams, [examId]: "" },
        });
    };

    const handleExamValueChange = (
        sheetId: string,
        examId: string,
        value: string
    ) => {
        const sheet = examSheets.find((s) => s.id === sheetId);
        if (!sheet) return;
        handleUpdateSheet(sheetId, {
            exams: { ...sheet.exams, [examId]: value },
        });
    };

    const handleRemoveExamFromSheet = (sheetId: string, examId: string) => {
        const sheet = examSheets.find((s) => s.id === sheetId);
        if (!sheet) return;
        const newExams = { ...sheet.exams };
        delete newExams[examId];
        handleUpdateSheet(sheetId, { exams: newExams });
    };

    // Helper for trends
    const getExamHistory = (examId: string): HistoryPoint[] => {
        // 1. Historical Consultations (Legacy)
        const history = consultationHistory
            .filter((c) => c.exams && c.exams[examId])
            .map((c) => ({
                date: new Date(c.date).toLocaleDateString("es-CL", {
                    day: "2-digit",
                    month: "2-digit",
                }),
                fullDate: c.date,
                value: parseFloat(c.exams?.[examId] || "0"),
            }));

        // 2. Historical Consultations (New ExamSheets)
        consultationHistory.forEach((c) => {
            if (c.examSheets) {
                c.examSheets.forEach((sheet) => {
                    if (sheet.exams[examId]) {
                        history.push({
                            date: new Date(sheet.date).toLocaleDateString("es-CL", {
                                day: "2-digit",
                                month: "2-digit",
                            }),
                            fullDate: sheet.date,
                            value: parseFloat(sheet.exams[examId]),
                        });
                    }
                });
            }
        });

        return history
            .filter((p) => !isNaN(p.value) && p.value > 0)
            .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
    };

    return (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm animate-fadeIn">
            <div
                className="p-6 flex items-center justify-between cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
                    <div>
                        <h4 className="font-bold text-slate-800 text-lg">Exámenes de Seguimiento</h4>
                        <p className="text-sm text-slate-500">
                            {examSheets.length} planilla{examSheets.length !== 1 ? "s" : ""} registrada{examSheets.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAddSheet();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-bold hover:bg-indigo-200 transition-colors text-sm"
                    >
                        <Plus className="w-4 h-4" /> Nueva Planilla
                    </button>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="p-6 bg-white border-t border-slate-100 space-y-6">
                    {examSheets.length === 0 && (
                        <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                            No hay planillas de exámenes registradas para esta atención.
                            <br />
                            <button
                                onClick={handleAddSheet}
                                className="mt-4 text-indigo-600 font-bold hover:underline"
                            >
                                Crear primera planilla
                            </button>
                        </div>
                    )}

                    {examSheets.map((sheet, index) => (
                        <div key={sheet.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                            {/* Sheet Header */}
                            <div
                                className="bg-slate-50 p-4 flex flex-col md:flex-row items-center justify-between gap-4 cursor-pointer"
                                onClick={() => setExpandedSheetId(expandedSheetId === sheet.id ? null : sheet.id)}
                            >
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <span className="bg-indigo-600 text-white w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <span className="text-xs font-bold text-slate-500 uppercase block">Fecha Toma Muestra</span>
                                        <input
                                            type="date"
                                            value={sheet.date}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleUpdateSheet(sheet.id, { date: e.target.value })}
                                            className="bg-white border border-slate-300 rounded-lg px-3 py-1 text-slate-700 font-bold text-sm outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                    <span className="text-sm font-medium text-slate-600 mr-2">
                                        {Object.keys(sheet.exams).length} exámenes
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveSheet(sheet.id);
                                        }}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {expandedSheetId === sheet.id ? (
                                        <ChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                            </div>

                            {/* Sheet Body */}
                            {expandedSheetId === sheet.id && (
                                <div className="p-4 bg-white animate-fadeIn">
                                    {/* Controls */}
                                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Agregar Perfil</label>
                                            <select
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 font-medium"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleAddProfileToSheet(sheet.id, e.target.value);
                                                        e.target.value = "";
                                                    }
                                                }}
                                            >
                                                <option value="">Seleccionar perfil...</option>
                                                {availableProfiles.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.label} ({p.exams.length})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Agregar Examen</label>
                                            <select
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 font-medium"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleAddExamToSheet(sheet.id, e.target.value);
                                                        e.target.value = "";
                                                    }
                                                }}
                                            >
                                                <option value="">Buscar examen...</option>
                                                {examOptions
                                                    .sort((a, b) => a.label.localeCompare(b.label))
                                                    .map((e) => (
                                                        <option key={e.id} value={e.id}>
                                                            {e.label}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Exams Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.keys(sheet.exams).map((examId) => {
                                            const def = examOptions.find((e) => e.id === examId);
                                            const label = def?.label || examId;
                                            const unit = def?.unit || "";
                                            const history = getExamHistory(examId);

                                            return (
                                                <div key={examId} className="relative group/input">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="group relative inline-block">
                                                            <label
                                                                className={`text-xs font-bold uppercase tracking-wide truncate pr-2 flex items-center gap-1 cursor-help transition-colors ${history.length > 0 ? "text-indigo-600 hover:text-indigo-800" : "text-slate-500"}`}
                                                            >
                                                                {label}
                                                                {history.length > 0 && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded">Hist</span>}
                                                            </label>
                                                            {/* TOOLTIP: THE CHART */}
                                                            {history.length > 0 && (
                                                                <div className="hidden group-hover:block absolute z-50 bottom-full left-0 mb-1 pointer-events-none">
                                                                    <MiniTrendChart data={history} unit={unit} label={label} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button onClick={() => handleRemoveExamFromSheet(sheet.id, examId)} className="text-slate-300 hover:text-red-500">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            value={sheet.exams[examId]}
                                                            onChange={(e) => handleExamValueChange(sheet.id, examId, e.target.value)}
                                                            placeholder="0.0"
                                                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-lg font-bold outline-none focus:border-indigo-500 text-center text-slate-700 placeholder:text-slate-200"
                                                        />
                                                        <span className="absolute right-3 top-3 text-xs text-slate-400 pointer-events-none font-bold">{unit}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {Object.keys(sheet.exams).length === 0 && (
                                        <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                                            <Plus className="w-5 h-5 mx-auto mb-1 opacity-50" />
                                            Agrega exámenes o perfiles para comenzar
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
