import React from "react";
import { ExamProfile, ExamDefinition } from "../types";
import Button from "./ui/Button";
import Card from "./ui/Card";
import { Search, Plus, Trash2, Edit, RotateCcw, TestTube } from "lucide-react";

interface DoctorExamProfilesSectionProps {
  profiles: ExamProfile[];
  allExamOptions: ExamDefinition[];
  tempProfile: ExamProfile;
  isEditingId: string | null;
  onTempChange: (temp: ExamProfile) => void;
  onSave: () => void;
  onEdit: (p: ExamProfile) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  onCancel: () => void;
  onToggleExam: (examId: string) => void;
}

const DoctorExamProfilesSection: React.FC<DoctorExamProfilesSectionProps> = ({
  profiles,
  allExamOptions,
  tempProfile,
  isEditingId,
  onTempChange,
  onSave,
  onEdit,
  onDelete,
  onReset,
  onCancel,
  onToggleExam,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredExams = allExamOptions.filter(
    (e) =>
      e.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card variant="glass" className="border-emerald-500/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <TestTube className="w-5 h-5 text-emerald-400" />
            {isEditingId ? "Editar Pack de Exámenes" : "Nuevo Pack de Exámenes"}
          </h3>
          <Button variant="ghost" size="sm" onClick={onReset} className="text-slate-400">
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Originales
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5 ml-1">
              Nombre del Pack
            </label>
            <input
              type="text"
              value={tempProfile.label}
              onChange={(e) => onTempChange({ ...tempProfile, label: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
              placeholder="Ej: Perfil Bioquímico"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">
              Seleccionar Exámenes
            </label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar examen por nombre o categoría..."
                className="w-full bg-slate-900/40 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            <div className="max-h-60 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-slate-900/60 rounded-2xl border border-slate-800 custom-scrollbar">
              {filteredExams.map((e) => {
                const isSelected = tempProfile.exams.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onToggleExam(e.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      isSelected
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isSelected ? "bg-emerald-500 border-emerald-500" : "border-slate-600"
                      }`}
                    >
                      {isSelected && <Plus className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs">{e.label}</div>
                      <div className="text-[10px] opacity-60 uppercase tracking-tighter">
                        {e.category}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={onSave} className="flex-1" disabled={tempProfile.exams.length === 0}>
              {isEditingId ? "Actualizar Pack" : "Guardar Pack"}
            </Button>
            {isEditingId && (
              <Button variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map((p) => (
          <Card key={p.id} className="hover:border-emerald-500/30 transition-all group">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                  {p.label}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {p.exams.length} {p.exams.length === 1 ? "examen" : "exámenes"}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => onEdit(p)} className="h-8 w-8 p-0">
                  <Edit className="w-4 h-4 text-emerald-400" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(p.id)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {p.exams.slice(0, 5).map((eid) => {
                const ex = allExamOptions.find((o) => o.id === eid);
                return (
                  <span
                    key={eid}
                    className="px-2 py-0.5 bg-slate-700/50 text-slate-400 text-[10px] font-bold rounded-lg border border-slate-700"
                  >
                    {ex?.label || eid}
                  </span>
                );
              })}
              {p.exams.length > 5 && (
                <span className="px-2 py-0.5 bg-slate-700/50 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-700">
                  +{p.exams.length - 5} más
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DoctorExamProfilesSection;
