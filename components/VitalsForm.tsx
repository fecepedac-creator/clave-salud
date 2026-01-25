import React from "react";
import { Consultation, ExamDefinition, ProfessionalRole } from "../types";
import { calculateMDRD, calculateAge } from "../utils";
import { Activity, TestTube, TrendingUp, ArrowUp, ArrowDown, Minus, Ruler } from "lucide-react";

interface VitalsFormProps {
  newConsultation: Partial<Consultation>;
  onChange: (field: keyof Consultation, value: string) => void;
  onExamChange: (examId: string, value: string) => void;
  consultationHistory: Consultation[];
  activeExams?: string[];
  patientBirthDate: string;
  patientGender: string;
  examOptions?: ExamDefinition[];
  role?: ProfessionalRole; // Added Role to condition visibility
}

// Data shape for the chart
interface HistoryPoint {
  date: string;
  fullDate: string;
  value: number;
}

// --- MINI CHART COMPONENT (SVG) ---
const MiniTrendChart = ({
  data,
  unit,
  label,
}: {
  data: HistoryPoint[];
  unit?: string;
  label: string;
}) => {
  if (!data || data.length === 0)
    return <p className="text-xs text-slate-400 italic p-2">Sin historial suficiente.</p>;

  // Sort data just in case
  const sortedData = [...data].sort(
    (a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()
  ); // Oldest first
  const lastPoint = sortedData[sortedData.length - 1];
  const prevPoint = sortedData.length > 1 ? sortedData[sortedData.length - 2] : null;

  // Trend Logic
  let trend = "stable";
  if (prevPoint) {
    if (lastPoint.value > prevPoint.value) trend = "up";
    else if (lastPoint.value < prevPoint.value) trend = "down";
  }

  // Scaling Logic
  const values = sortedData.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  let range = maxVal - minVal;
  if (range === 0) range = maxVal * 0.1 || 1;

  // 20% Padding
  const yMin = minVal - range * 0.2;
  const yMax = maxVal + range * 0.2;
  const yRange = yMax - yMin;

  const width = 240;
  const height = 80;

  const points = sortedData.map((p, i) => {
    const x = (i / (sortedData.length - 1 || 1)) * width;
    const y = height - ((p.value - yMin) / yRange) * height;
    return { x, y, value: p.value, date: p.date };
  });

  const pathData =
    points.length > 1 ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") : "";

  return (
    <div className="w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-sm animate-fadeIn z-50">
      <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
        <span className="font-bold text-slate-700 text-xs uppercase">{label}</span>
        <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
          <span className="font-bold text-slate-800 text-xs">
            {lastPoint.value} {unit}
          </span>
          {trend === "up" && <ArrowUp className="w-3 h-3 text-red-400" />}
          {trend === "down" && <ArrowDown className="w-3 h-3 text-green-400" />}
          {trend === "stable" && <Minus className="w-3 h-3 text-slate-300" />}
        </div>
      </div>

      <div className="relative h-[80px] w-full bg-slate-50/50 rounded-lg border border-slate-100 overflow-hidden mb-2">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Grid Line */}
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="#e2e8f0"
            strokeDasharray="4"
            strokeWidth="1"
          />
          {/* Path */}
          {points.length > 1 && (
            <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" />
          )}
          {/* Dots */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="3" fill="white" stroke="#2563eb" strokeWidth="2" />
              {/* Label Last Point */}
              {idx === points.length - 1 && (
                <text
                  x={p.x}
                  y={p.y - 6}
                  fontSize="9"
                  fill="#2563eb"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {p.value}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
        <span>Min: {minVal}</span>
        <span>Max: {maxVal}</span>
      </div>
      <p className="text-[10px] text-center text-slate-400 mt-1">
        Última medición: {sortedData[sortedData.length - 1].date}
      </p>
    </div>
  );
};

// --- VITALS INPUT COMPONENT ---
interface VitalsInputProps {
  label: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  unit?: string;
  historyData?: HistoryPoint[];
  type?: string;
  readOnly?: boolean;
  maxLength?: number;
}

const VitalsInput: React.FC<VitalsInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  unit,
  historyData,
  type = "text",
  readOnly = false,
  maxLength,
}) => {
  return (
    <div className="relative group/input">
      <div className="flex justify-between items-center mb-2">
        {/* LABEL WITH HOVER CHART */}
        <div className="group relative inline-block">
          <label
            className={`text-sm md:text-base font-bold uppercase tracking-wide truncate pr-2 flex items-center gap-1 cursor-help transition-colors ${historyData && historyData.length > 0 ? "text-blue-600 hover:text-blue-800" : "text-slate-600"}`}
            title={label}
          >
            {label}
            {historyData && historyData.length > 0 && (
              <TrendingUp className="w-3 h-3 text-blue-400 opacity-50 group-hover:opacity-100" />
            )}
          </label>

          {/* TOOLTIP: THE CHART */}
          {historyData && historyData.length > 0 && (
            <div className="hidden group-hover:block absolute z-50 bottom-full left-0 mb-1 pointer-events-none">
              <MiniTrendChart data={historyData} unit={unit} label={label} />
            </div>
          )}
        </div>
      </div>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          maxLength={maxLength}
          className={`w-full p-4 border-2 rounded-xl text-xl font-bold outline-none transition-all text-center placeholder:text-slate-300 shadow-sm ${readOnly ? "bg-slate-100 border-slate-200 text-slate-500" : "bg-white border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-slate-800"}`}
          placeholder={placeholder}
        />
        {unit && (
          <span className="absolute right-2 top-4 text-xs text-slate-400 pointer-events-none font-bold">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

const VitalsForm: React.FC<VitalsFormProps> = ({
  newConsultation,
  onChange,
  onExamChange,
  consultationHistory = [],
  activeExams = [],
  patientBirthDate,
  patientGender,
  examOptions = [],
  role,
}) => {
  // Auto-Calculate VFG if Creatinine is present
  const creatinina = parseFloat(newConsultation.exams?.["creatinina"] || "0");
  const age = calculateAge(patientBirthDate);
  const vfg = calculateMDRD(creatinina, age, patientGender);

  const displayedVFG = vfg ? vfg.toString() : "";

  const handleExamInputChange = (examId: string, val: string) => {
    if (examId === "hba1c") {
      const regex = /^\d*\.?\d{0,2}$/;
      if (regex.test(val)) onExamChange(examId, val);
    } else {
      onExamChange(examId, val);
    }
  };

  // Helper to extract history for a standard field
  const getStandardHistory = (field: keyof Consultation): HistoryPoint[] => {
    if (!consultationHistory) return [];
    return consultationHistory
      .filter((c) => c[field])
      .map((c) => ({
        date: new Date(c.date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }),
        fullDate: c.date,
        value: parseFloat(String(c[field]).replace(/[^0-9.]/g, "")), // Clean non-numeric
      }))
      .filter((p) => !isNaN(p.value));
  };

  // Helper to extract history for dynamic exams
  const getExamHistory = (examId: string): HistoryPoint[] => {
    if (!consultationHistory) return [];
    return consultationHistory
      .filter((c) => c.exams && c.exams[examId])
      .map((c) => ({
        date: new Date(c.date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }),
        fullDate: c.date,
        value: parseFloat(c.exams?.[examId] || "0"),
      }))
      .filter((p) => !isNaN(p.value) && p.value > 0);
  };

  const getBPHistory = (): HistoryPoint[] => {
    if (!consultationHistory) return [];
    return consultationHistory
      .filter((c) => c.bloodPressure && c.bloodPressure.includes("/"))
      .map((c) => {
        const sys = c.bloodPressure?.split("/")[0];
        return {
          date: new Date(c.date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }),
          fullDate: c.date,
          value: parseFloat(sys || "0"),
        };
      })
      .filter((p) => !isNaN(p.value) && p.value > 0);
  };

  // Visibility for Anthropometry
  const showAnthropometry = ["Nutricionista", "Medico", "Enfermera"].includes(role || "");

  return (
    <div className="flex flex-col gap-6">
      {/* Standard Vitals */}
      <div className="bg-blue-50/50 p-8 rounded-3xl border border-blue-100">
        <h4 className="text-blue-900 font-bold text-lg uppercase tracking-wider mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5" /> Signos Vitales y Antropometría
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <VitalsInput
            label="Peso"
            value={newConsultation.weight}
            onChange={(e) => onChange("weight", e.target.value)}
            placeholder="00"
            unit="kg"
            historyData={getStandardHistory("weight")}
            type="number"
          />
          <VitalsInput
            label="Talla"
            value={newConsultation.height}
            onChange={(e) => onChange("height", e.target.value)}
            placeholder="000"
            unit="cm"
            historyData={getStandardHistory("height")}
            type="number"
          />

          <div className="bg-white border-2 border-slate-200 rounded-xl flex flex-col justify-center items-center h-[66px] mt-8 shadow-sm">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">
              IMC
            </span>
            <span
              className={`font-bold text-xl leading-none ${Number(newConsultation.bmi) > 25 ? "text-orange-500" : "text-slate-800"}`}
            >
              {newConsultation.bmi || "-"}
            </span>
          </div>

          {/* BP Chart uses Systolic only for trend */}
          <VitalsInput
            label="P. Arterial"
            maxLength={7}
            value={newConsultation.bloodPressure}
            onChange={(e) => onChange("bloodPressure", e.target.value)}
            placeholder="120/80"
            historyData={getBPHistory()}
          />

          {/* Show HGT if not Nutritionist (usually they focus on anthro, but can keep it) OR explicitly for diabetic checks */}
          <VitalsInput
            label="HGT"
            value={newConsultation.hgt}
            onChange={(e) => onChange("hgt", e.target.value)}
            placeholder="mg/dl"
            unit="mg/dl"
            historyData={getStandardHistory("hgt")}
            type="number"
          />
        </div>

        {/* Extended Anthropometry for Nutritionists */}
        {showAnthropometry && (
          <div className="mt-8 pt-6 border-t border-blue-200/50">
            <div className="flex items-center gap-2 mb-4 text-blue-800 font-bold text-sm uppercase">
              <Ruler className="w-4 h-4" /> Mediciones Adicionales
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <VitalsInput
                label="Circ. Cintura"
                value={newConsultation.waist}
                onChange={(e) => onChange("waist", e.target.value)}
                placeholder="00"
                unit="cm"
                historyData={getStandardHistory("waist")}
                type="number"
              />
              <VitalsInput
                label="Circ. Cadera"
                value={newConsultation.hip}
                onChange={(e) => onChange("hip", e.target.value)}
                placeholder="00"
                unit="cm"
                historyData={getStandardHistory("hip")}
                type="number"
              />
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Bio-Exams Section */}
      {activeExams && activeExams.length > 0 && (
        <div className="bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100 animate-fadeIn">
          <h4 className="text-emerald-900 font-bold text-lg uppercase tracking-wider mb-6 flex items-center gap-2">
            <TestTube className="w-5 h-5" /> Evolución de Exámenes
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {activeExams.map((examId) => {
              // Search in merged options
              const config = examOptions.find((e) => e.id === examId);
              if (!config) return null;

              // Handle calculated fields
              if (examId === "vfg") {
                return (
                  <VitalsInput
                    key={examId}
                    label={config.label}
                    value={displayedVFG}
                    onChange={() => {}}
                    unit={config.unit}
                    readOnly={true}
                    historyData={getExamHistory("vfg")}
                  />
                );
              }

              return (
                <VitalsInput
                  key={examId}
                  label={config.label}
                  value={newConsultation.exams?.[examId] || ""}
                  onChange={(e) => handleExamInputChange(examId, e.target.value)}
                  placeholder="0.0"
                  unit={config.unit}
                  type="text"
                  historyData={getExamHistory(examId)} // Pass calculated history
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalsForm;
