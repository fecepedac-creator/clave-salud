import React, { useMemo } from "react";
import { Consultation, ExamDefinition, ProfessionalRole } from "../types";
import {
  Activity,
  Zap,
  TestTube,
  Eye,
  Footprints,
  Info,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import VitalsForm from "./VitalsForm";
import { MiniTrendChart, HistoryPoint } from "./MiniTrendChart";
import { calculateAge, calculateMDRD } from "../utils";

interface PSCVFormProps {
  newConsultation: Partial<Consultation>;
  onChange: (field: keyof Consultation, value: any) => void;
  onExamChange: (examId: string, value: string) => void;
  consultationHistory: Consultation[];
  patientBirthDate: string;
  patientGender: string;
  examOptions: ExamDefinition[];
  role: ProfessionalRole;
}

const PSCVForm: React.FC<PSCVFormProps> = ({
  newConsultation,
  onChange,
  onExamChange,
  consultationHistory,
  patientBirthDate,
  patientGender,
  examOptions,
  role,
}) => {
  // --- HELPERS PARA HISTORIAL ---
  const getFieldHistory = (field: string, isExam = false): HistoryPoint[] => {
    return consultationHistory
      .filter((c) => (isExam ? c.exams?.[field] : (c as any)[field]))
      .map((c) => ({
        date: new Date(c.date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }),
        fullDate: c.date,
        value: parseFloat(
          isExam ? c.exams?.[field] || "0" : String((c as any)[field]).replace(/[^0-9.]/g, "")
        ),
      }))
      .filter((p) => !isNaN(p.value));
  };

  const getBPHistory = (): HistoryPoint[] => {
    return consultationHistory
      .filter((c) => c.bloodPressure && c.bloodPressure.includes("/"))
      .map((c) => ({
        date: new Date(c.date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }),
        fullDate: c.date,
        value: parseFloat(c.bloodPressure?.split("/")[0] || "0"), // Sistólica
      }));
  };

  // --- CÁLCULOS DINÁMICOS ---
  const age = calculateAge(patientBirthDate);
  const creatinina = parseFloat(newConsultation.exams?.["creatinina"] || "0");
  const vfg = calculateMDRD(creatinina, age ?? 0, patientGender);

  // --- RENDER INPUT WITH TREND ---
  const FieldWithTrend = ({
    label,
    value,
    field,
    unit,
    isExam = false,
    placeholder = "0.0",
    type = "text",
    testId,
  }: any) => {
    const history = getFieldHistory(field, isExam);
    return (
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-colors">
        <div className="flex justify-between items-center mb-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {label}
          </label>
          {history.length > 0 && (
            <div className="group relative">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500 cursor-help" />
              <div className="hidden group-hover:block absolute bottom-full right-0 mb-2 z-50">
                <MiniTrendChart data={history} label={label} unit={unit} />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-end gap-2">
          <input
            data-testid={testId}
            type={type}
            value={value}
            onChange={(e) =>
              isExam ? onExamChange(field, e.target.value) : onChange(field as any, e.target.value)
            }
            className="w-full text-xl font-bold text-slate-800 outline-none bg-transparent"
            placeholder={placeholder}
          />
          <span className="text-xs font-bold text-slate-400 mb-1">{unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. SECCIÓN: SIGNOS VITALES Y ANTROPOMETRÍA (Especializada PSCV) */}
      <div className="bg-emerald-50/30 p-8 rounded-3xl border border-emerald-100/50">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">Control Metabólico</h3>
            <p className="text-emerald-700 text-sm font-semibold tracking-tight uppercase">
              Signos Vitales y Metas PA
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2">
            <FieldWithTrend
              label="Presión Arterial"
              value={newConsultation.bloodPressure}
              field="bloodPressure"
              placeholder="120/80"
              unit="mmHg"
              testId="pscv-vitals-pa"
            />
            <p className="mt-2 text-[10px] text-slate-500 italic">
              * Meta General: &lt; 140/90 mmHg. Meta DM/ERC: &lt; 130/80 mmHg.
            </p>
          </div>
          <FieldWithTrend
            label="Peso Actual"
            value={newConsultation.weight}
            field="weight"
            unit="kg"
            type="number"
            testId="pscv-vitals-peso"
          />
          <FieldWithTrend
            label="Talla"
            value={newConsultation.height}
            field="height"
            unit="cm"
            type="number"
            placeholder="0"
            testId="pscv-vitals-talla"
          />
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">IMC</span>
            <span
              className={`text-2xl font-black ${Number(newConsultation.bmi) >= 30 ? "text-red-500" : "text-slate-800"}`}
            >
              {newConsultation.bmi || "-"}
            </span>
          </div>
          <FieldWithTrend
            label="Cintura"
            value={newConsultation.waist}
            field="waist"
            unit="cm"
            type="number"
            testId="pscv-vitals-cintura"
          />
          <FieldWithTrend
            label="HGT / Glicemia"
            value={newConsultation.hgt}
            field="hgt"
            unit="mg/dl"
            type="number"
            testId="pscv-vitals-hgt"
          />
          <FieldWithTrend
            label="Frecuencia Card."
            value={newConsultation.heartRate}
            field="heartRate"
            unit="lpm"
            type="number"
            testId="pscv-vitals-fc"
          />
        </div>
      </div>

      {/* 2. SECCIÓN: EXÁMENES DE LABORATORIO (Red Crónicos) */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Zap className="w-24 h-24 text-emerald-500" />
        </div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <TestTube className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">Laboratorio Crónico</h3>
            <p className="text-indigo-600 text-sm font-semibold tracking-tight uppercase">
              Seguimiento Renal y Lipídico
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Renal */}
          <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
              Función Renal
            </h4>
            <FieldWithTrend
              label="Creatinina"
              value={newConsultation.exams?.["creatinina"]}
              field="creatinina"
              isExam={true}
              unit="mg/dl"
              testId="pscv-lab-creatinina"
            />
            <div className="p-4 bg-indigo-600 text-white rounded-xl shadow-md">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase opacity-80">
                  VFG Estimado (CKD-EPI)
                </span>
                <Info className="w-3.5 h-3.5 opacity-80" />
              </div>
              <div className="text-2xl font-black">{vfg ? `${vfg} ml/min` : "---"}</div>
              <div className="text-[10px] mt-1 font-medium italic">
                {vfg && vfg < 60
                  ? "⚠️ Precaución: Daño Renal Moderado/Severo"
                  : "✓ Normal / Daño Leve"}
              </div>
            </div>
            <FieldWithTrend
              label="RAC (Albuminuria)"
              value={newConsultation.exams?.["rac"]}
              field="rac"
              isExam={true}
              unit="mg/g"
              testId="pscv-lab-rac"
            />
          </div>

          {/* Glicémico / Lipídico */}
          <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
              Metabolismo
            </h4>
            <FieldWithTrend
              label="HbA1c (%)"
              value={newConsultation.exams?.["hba1c"]}
              field="hba1c"
              isExam={true}
              unit="%"
              testId="pscv-lab-hba1c"
            />
            <FieldWithTrend
              label="Colest. Total"
              value={newConsultation.exams?.["col_total"]}
              field="col_total"
              isExam={true}
              unit="mg/dl"
              testId="pscv-lab-col"
            />
            <FieldWithTrend
              label="Colest. LDL"
              value={newConsultation.exams?.["ldl"]}
              field="ldl"
              isExam={true}
              unit="mg/dl"
              testId="pscv-lab-ldl"
            />
          </div>

          {/* Otros / Histórico */}
          <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">Tendencia General</p>
            <p className="text-xs text-slate-400 px-4">
              El asistente está analizando los últimos 12 meses de este paciente...
            </p>
            <button className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              Recalcular Riesgo CV
            </button>
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN: EVALUACIÓN DE ÓRGANOS BLANCO (Especializada Chile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Fondo de Ojo */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Eye className="w-6 h-6 text-orange-500" />
            <h4 className="font-bold text-slate-800">Fondo de Ojo</h4>
          </div>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">
                  Fecha realización
                </label>
                <input
                  data-testid="pscv-fondo-ojo-fecha"
                  type="date"
                  value={newConsultation.exams?.["fondo_ojo_fecha"] || ""}
                  onChange={(e) => onExamChange("fondo_ojo_fecha", e.target.value)}
                  className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">
                  Resultado
                </label>
                <select
                  data-testid="pscv-fondo-ojo-resultado"
                  value={newConsultation.exams?.["fondo_ojo_resultado"] || "Sin Retinopatía"}
                  onChange={(e) => onExamChange("fondo_ojo_resultado", e.target.value)}
                  className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-orange-500 font-bold"
                >
                  <option value="Sin Retinopatía">Sin Retinopatía</option>
                  <option value="Retinopatía Leve">Retinopatía Leve</option>
                  <option value="Retinopatía Moderada">Retinopatía Moderada</option>
                  <option value="Retinopatía Severa/Proliferativa">Retinopatía Severa</option>
                </select>
              </div>
            </div>
            <textarea
              data-testid="pscv-fondo-ojo-obs"
              placeholder="Observaciones adicionales..."
              value={newConsultation.exams?.["fondo_ojo_obs"] || ""}
              onChange={(e) => onExamChange("fondo_ojo_obs", e.target.value)}
              className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-orange-500 text-sm h-20"
            />
          </div>
        </div>

        {/* Pie Diabético */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Footprints className="w-6 h-6 text-indigo-500" />
            <h4 className="font-bold text-slate-800">Pie Diabético (Screening)</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">
                Sensibilidad (Monofilamento)
              </label>
              <select
                data-testid="pscv-pie-sensibilidad"
                value={newConsultation.exams?.["pie_sensibilidad"] || ""}
                onChange={(e) => onExamChange("pie_sensibilidad", e.target.value)}
                className={`w-full p-3 border-2 rounded-xl font-bold text-xs transition-all outline-none focus:border-indigo-500 ${newConsultation.exams?.["pie_sensibilidad"] === "Conservada" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : newConsultation.exams?.["pie_sensibilidad"] === "Alterada" ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-slate-100 text-slate-400"}`}
              >
                <option value="">Seleccione...</option>
                <option value="Conservada">Conservada</option>
                <option value="Alterada">Alterada</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">
                Pulsos Pedios / Tibiales
              </label>
              <select
                data-testid="pscv-pie-pulsos"
                value={newConsultation.exams?.["pie_pulsos"] || ""}
                onChange={(e) => onExamChange("pie_pulsos", e.target.value)}
                className={`w-full p-3 border-2 rounded-xl font-bold text-xs transition-all outline-none focus:border-indigo-500 ${newConsultation.exams?.["pie_pulsos"] === "Presentes (+)" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : newConsultation.exams?.["pie_pulsos"] === "Ausentes (-)" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-white border-slate-100 text-slate-400"}`}
              >
                <option value="">Seleccione...</option>
                <option value="Presentes (+)">Presentes (+)</option>
                <option value="Disminuidos (+/-)">Disminuidos (+/-)</option>
                <option value="Ausentes (-)">Ausentes (-)</option>
              </select>
            </div>
          </div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">
            Categoría de Riesgo (Protocolo Chile)
          </label>
          <select
            data-testid="pscv-pie-riesgo"
            value={newConsultation.exams?.["pie_riesgo"] || "Riesgo Bajo (Anual)"}
            onChange={(e) => onExamChange("pie_riesgo", e.target.value)}
            className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm"
          >
            <option value="Riesgo Bajo (Anual)">Riesgo Bajo (Anual)</option>
            <option value="Riesgo Moderado (Trimestral)">Riesgo Moderado (Trimestral)</option>
            <option value="Riesgo Alto (Bimensual)">Riesgo Alto (Bimensual)</option>
            <option value="Máximo Riesgo (Mensual / Derivado)">
              Máximo Riesgo (Mensual / Derivado)
            </option>
          </select>
        </div>
      </div>

      {/* 4. PLAN Y CONDUCTA (Integrado) */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-xl font-bold flex items-center gap-2">
            <ChevronRight className="w-6 h-6 text-emerald-400" /> Plan de Tratamiento y Educación
          </h4>
        </div>
        <div className="space-y-6">
          <textarea
            data-testid="pscv-plan"
            className="w-full h-40 bg-white/10 border border-white/20 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-emerald-500/30 text-emerald-50 placeholder:text-slate-500"
            placeholder="Anote aquí los ajustes de farmacoterapia, consejería antitabaco y acuerdos con el paciente..."
            value={newConsultation.anamnesis}
            onChange={(e) => onChange("anamnesis", e.target.value)}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <p className="text-[10px] font-bold text-emerald-400 uppercase mb-2">
                Educación Realizada
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Cese de Tabaquismo",
                  "Fármaco-Adherencia",
                  "Autocuidado Pie",
                  "Dieta DASH/Chile",
                ].map((tag) => (
                  <button
                    key={tag}
                    className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold border border-emerald-500/30 hover:bg-emerald-500/40"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PSCVForm;
