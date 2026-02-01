
import React, { useState, useEffect } from "react";
import {
    X,
    Activity,
    CalendarCheck,
    CheckCircle,
    AlertCircle,
    Thermometer,
    Wind,
    Save,
    Play,
    ClipboardList
} from "lucide-react";
import { KinesiologyProgram, KinesiologySession } from "../types";
import { generateId } from "../utils";

interface StartProgramModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (program: Partial<KinesiologyProgram>) => void;
}

export const StartProgramModal: React.FC<StartProgramModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
}) => {
    const [type, setType] = useState<"Kinesioterapia motora" | "Kinesioterapia respiratoria">(
        "Kinesioterapia motora"
    );
    const [diagnosis, setDiagnosis] = useState("");
    const [condition, setCondition] = useState("");
    const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
    const [sessions, setSessions] = useState(10);

    const OBJECTIVES_MOTORA = [
        "Analgesia",
        "Rango articular / movilidad",
        "Fortalecimiento",
        "Funcionalidad / marcha",
        "Educación",
    ];

    const OBJECTIVES_RESPIRATORIA = [
        "Higiene bronquial",
        "Mejora ventilatoria",
        "Disminuir trabajo respiratorio",
        "Educación respiratoria",
    ];

    const currentObjectives =
        type === "Kinesioterapia motora" ? OBJECTIVES_MOTORA : OBJECTIVES_RESPIRATORIA;

    useEffect(() => {
        setSelectedObjectives([]);
    }, [type]);

    const toggleObjective = (obj: string) => {
        if (selectedObjectives.includes(obj)) {
            setSelectedObjectives(selectedObjectives.filter((o) => o !== obj));
        } else {
            setSelectedObjectives([...selectedObjectives, obj]);
        }
    };

    const handleConfirm = () => {
        if (!diagnosis) return;
        onConfirm({
            type,
            diagnosis,
            clinicalCondition: condition,
            objectives: selectedObjectives,
            totalSessions: sessions,
            createdAt: new Date().toISOString(),
            status: "active",
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                        <Play className="w-5 h-5 text-indigo-600" /> Iniciar Nuevo Programa
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Step 1: Type */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                            1. Tipo de Programa
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setType("Kinesioterapia motora")}
                                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${type === "Kinesioterapia motora"
                                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                    : "border-slate-200 text-slate-500 hover:border-indigo-200"
                                    }`}
                            >
                                <Activity className="w-8 h-8" />
                                <span className="font-bold">Motora</span>
                            </button>
                            <button
                                onClick={() => setType("Kinesioterapia respiratoria")}
                                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${type === "Kinesioterapia respiratoria"
                                    ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                                    : "border-slate-200 text-slate-500 hover:border-cyan-200"
                                    }`}
                            >
                                <Wind className="w-8 h-8" />
                                <span className="font-bold">Respiratoria</span>
                            </button>
                        </div>
                    </div>

                    {/* Step 2: Diagnosis */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                            2. Diagnóstico Principal
                        </label>
                        <input
                            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-700"
                            placeholder="Ej: Esguince de tobillo derecho"
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Step 3: Clinicial Condition */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                            3. Condición Clínica Inicial
                        </label>
                        <textarea
                            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-slate-600 h-20 resize-none"
                            placeholder="Ej: Edema periarticular, dolor moderado, limitación funcional..."
                            value={condition}
                            onChange={(e) => setCondition(e.target.value)}
                        />
                    </div>

                    {/* Step 4: Objectives */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                            4. Objetivos Terapéuticos
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {currentObjectives.map((obj) => (
                                <button
                                    key={obj}
                                    onClick={() => toggleObjective(obj)}
                                    className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedObjectives.includes(obj)
                                        ? "bg-slate-800 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                >
                                    {selectedObjectives.includes(obj) ? (
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <span className="w-4 h-4 rounded-full border border-slate-400" />
                                    )}
                                    {obj}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 5: Sessions */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                            5. Sesiones Programadas
                        </label>
                        <select
                            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 bg-white font-bold text-slate-700"
                            value={sessions}
                            onChange={(e) => setSessions(Number(e.target.value))}
                        >
                            {[5, 10, 15, 20].map((n) => (
                                <option key={n} value={n}>
                                    {n} Sesiones
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <button
                        onClick={handleConfirm}
                        disabled={!diagnosis}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirmar e Iniciar Programa
                    </button>
                </div>
            </div>
        </div>
    );
};

interface SessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    program: KinesiologyProgram;
    sessionNumber: number;
    onSave: (session: Partial<KinesiologySession>) => void;
}

export const SessionModal: React.FC<SessionModalProps> = ({
    isOpen,
    onClose,
    program,
    sessionNumber,
    onSave,
}) => {
    const [techniques, setTechniques] = useState<string[]>([]);
    const [tolerance, setTolerance] = useState<"Buena" | "Regular" | "Mala">("Buena");
    const [response, setResponse] = useState<"Mejoría" | "Igual" | "Empeora">("Mejoría");
    const [observations, setObservations] = useState("");
    const [customTechnique, setCustomTechnique] = useState("");

    // Vitals State
    const [showVitals, setShowVitals] = useState(false);
    const [vitals, setVitals] = useState({
        pre: { pa: "", fc: "" },
        post: { pa: "", fc: "" }
    });

    // Oxygenation State (Resp)
    const [showOxy, setShowOxy] = useState(false);
    const [oxy, setOxy] = useState({
        pre: { sat: "", fc: "" },
        post: { sat: "", fc: "" }
    });

    const TECHNIQUES_MOTORA = [
        "Crioterapia",
        "TENS",
        "IF / CHC",
        "Ultrasonido",
        "Masoterapia",
        "Movilización pasiva",
        "Reeducación motriz",
        "Fortalecimiento",
        "Funcional / marcha",
    ];

    const TECHNIQUES_RESPIRATORIA = [
        "Ejercicios respiratorios",
        "Educación técnica inhalatoria",
        "Drenaje bronquial",
        "Espiración lenta prolongada",
        "Entrenamiento muscular respiratorio",
    ];

    const currentTechniques =
        program.type === "Kinesioterapia motora"
            ? TECHNIQUES_MOTORA
            : TECHNIQUES_RESPIRATORIA;

    const toggleTechnique = (t: string) => {
        if (techniques.includes(t)) {
            setTechniques(techniques.filter((item) => item !== t));
        } else {
            setTechniques([...techniques, t]);
        }
    };

    const handleSave = () => {
        const finalTechniques = customTechnique.trim()
            ? [...techniques, customTechnique.trim()]
            : techniques;

        onSave({
            date: new Date().toISOString(),
            sessionNumber,
            techniques: finalTechniques,
            tolerance,
            response,
            observations,
            vitals: program.type === "Kinesioterapia motora" ? vitals : undefined,
            oxygenation: program.type === "Kinesioterapia respiratoria" ? oxy : undefined
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-emerald-600" /> Sesión {sessionNumber} de {program.totalSessions}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">{program.type}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-6">

                    {/* Techniques */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Técnicas Realizadas
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {currentTechniques.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => toggleTechnique(t)}
                                    className={`text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${techniques.includes(t)
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                        : "bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100"
                                        }`}
                                >
                                    {techniques.includes(t) && <CheckCircle className="w-3 h-3" />}
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* Custom Technique Input */}
                        <div className="pt-2">
                            <input
                                className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-emerald-50 transition-colors"
                                placeholder="Otra técnica (ej: Acupuntura, Punción seca...)"
                                value={customTechnique}
                                onChange={(e) => setCustomTechnique(e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400 mt-1 pl-1">
                                * Escriba aquí si utilizó una técnica no listada.
                            </p>
                        </div>
                    </div>

                    {/* Collapsible Vitals (Motora) */}
                    {program.type === "Kinesioterapia motora" && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setShowVitals(!showVitals)}
                                className="w-full px-4 py-3 bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-rose-500" /> Signos Vitales (Opcional)
                                </div>
                                <span>{showVitals ? "Ocultar" : "Mostrar"}</span>
                            </button>

                            {showVitals && (
                                <div className="p-4 grid grid-cols-2 gap-4 bg-white">
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Pre Terapia</p>
                                        <div className="space-y-1">
                                            <input
                                                placeholder="PA (ej: 120/80)"
                                                className="w-full text-xs p-2 border rounded"
                                                value={vitals.pre.pa}
                                                onChange={e => setVitals({ ...vitals, pre: { ...vitals.pre, pa: e.target.value } })}
                                            />
                                            <input
                                                placeholder="FC (lpm)"
                                                className="w-full text-xs p-2 border rounded"
                                                value={vitals.pre.fc}
                                                onChange={e => setVitals({ ...vitals, pre: { ...vitals.pre, fc: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Post Terapia</p>
                                        <div className="space-y-1">
                                            <input
                                                placeholder="PA"
                                                className="w-full text-xs p-2 border rounded"
                                                value={vitals.post.pa}
                                                onChange={e => setVitals({ ...vitals, post: { ...vitals.post, pa: e.target.value } })}
                                            />
                                            <input
                                                placeholder="FC"
                                                className="w-full text-xs p-2 border rounded"
                                                value={vitals.post.fc}
                                                onChange={e => setVitals({ ...vitals, post: { ...vitals.post, fc: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Collapsible Oxygenation (Respiratoria) */}
                    {program.type === "Kinesioterapia respiratoria" && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setShowOxy(!showOxy)}
                                className="w-full px-4 py-3 bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-cyan-500" /> Oxigenación (Opcional)
                                </div>
                                <span>{showOxy ? "Ocultar" : "Mostrar"}</span>
                            </button>

                            {showOxy && (
                                <div className="p-4 grid grid-cols-2 gap-4 bg-white">
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Pre Terapia</p>
                                        <div className="space-y-1">
                                            <input
                                                placeholder="SatO2 %"
                                                className="w-full text-xs p-2 border rounded"
                                                value={oxy.pre.sat}
                                                onChange={e => setOxy({ ...oxy, pre: { ...oxy.pre, sat: e.target.value } })}
                                            />
                                            <input
                                                placeholder="FC"
                                                className="w-full text-xs p-2 border rounded"
                                                value={oxy.pre.fc}
                                                onChange={e => setOxy({ ...oxy, pre: { ...oxy.pre, fc: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Post Terapia</p>
                                        <div className="space-y-1">
                                            <input
                                                placeholder="SatO2 %"
                                                className="w-full text-xs p-2 border rounded"
                                                value={oxy.post.sat}
                                                onChange={e => setOxy({ ...oxy, post: { ...oxy.post, sat: e.target.value } })}
                                            />
                                            <input
                                                placeholder="FC"
                                                className="w-full text-xs p-2 border rounded"
                                                value={oxy.post.fc}
                                                onChange={e => setOxy({ ...oxy, post: { ...oxy.post, fc: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Outcomes */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Tolerancia</label>
                            <div className="flex flex-col gap-1">
                                {["Buena", "Regular", "Mala"].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setTolerance(opt as any)}
                                        className={`text-xs px-3 py-2 rounded-lg border transition-all ${tolerance === opt
                                            ? "bg-slate-800 text-white border-slate-800"
                                            : "bg-white text-slate-600 border-slate-200"
                                            }`}
                                    >
                                        {opt === "Buena" && "🙂"} {opt === "Regular" && "😐"} {opt === "Mala" && "😖"} {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Respuesta Inmediata</label>
                            <div className="flex flex-col gap-1">
                                {["Mejoría", "Igual", "Empeora"].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setResponse(opt as any)}
                                        className={`text-xs px-3 py-2 rounded-lg border transition-all ${response === opt
                                            ? "bg-indigo-100 text-indigo-700 border-indigo-500 font-bold"
                                            : "bg-white text-slate-600 border-slate-200"
                                            }`}
                                    >
                                        {opt === "Mejoría" && "⬆"} {opt === "Igual" && "➡"} {opt === "Empeora" && "⬇"} {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Observaciones</label>
                        <textarea
                            className="w-full text-xs p-3 border border-slate-200 rounded-xl h-16 resize-none focus:border-indigo-500 outline-none"
                            placeholder="Comentarios adicionales..."
                            value={observations}
                            onChange={e => setObservations(e.target.value)}
                        />
                    </div>

                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50">
                    <button
                        onClick={handleSave}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                    >
                        <Save className="w-5 h-5" /> Guardar Sesión
                    </button>
                </div>
            </div>
        </div>
    );
};
