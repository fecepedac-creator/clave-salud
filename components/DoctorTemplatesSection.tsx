import React from "react";
import { ClinicalTemplate } from "../types";
import Button from "./ui/Button";
import Card from "./ui/Card";
import { Plus, Trash2, Edit, RotateCcw } from "lucide-react";

interface DoctorTemplatesSectionProps {
  templates: ClinicalTemplate[];
  tempTemplate: { title: string; content: string };
  isEditingId: string | null;
  onTempChange: (temp: { title: string; content: string }) => void;
  onSave: () => void;
  onEdit: (t: ClinicalTemplate) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  onCancel: () => void;
}

const DoctorTemplatesSection: React.FC<DoctorTemplatesSectionProps> = ({
  templates,
  tempTemplate,
  isEditingId,
  onTempChange,
  onSave,
  onEdit,
  onDelete,
  onReset,
  onCancel,
}) => {
  return (
    <div className="space-y-6">
      <Card variant="glass" className="border-emerald-500/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-400" />
            {isEditingId ? "Editar Plantilla" : "Nueva Plantilla Clínica"}
          </h3>
          <Button variant="ghost" size="sm" onClick={onReset} className="text-slate-400">
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Originales
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5 ml-1">Título</label>
            <input
              type="text"
              value={tempTemplate.title}
              onChange={(e) => onTempChange({ ...tempTemplate, title: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
              placeholder="Ej: Evolución Estándar"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5 ml-1">Contenido</label>
            <textarea
              rows={6}
              value={tempTemplate.content}
              onChange={(e) => onTempChange({ ...tempTemplate, content: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
              placeholder="Escribe el cuerpo de la plantilla aquí..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={onSave} className="flex-1">
              {isEditingId ? "Actualizar Plantilla" : "Guardar Plantilla"}
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
        {templates.map((t) => (
          <Card key={t.id} className="hover:border-emerald-500/30 transition-all group">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                {t.title}
              </h4>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => onEdit(t)} className="h-8 w-8 p-0">
                  <Edit className="w-4 h-4 text-emerald-400" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(t.id)} className="h-8 w-8 p-0">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed italic">
              "{t.content}"
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DoctorTemplatesSection;
