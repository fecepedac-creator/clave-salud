import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { AlertTriangle, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { WhatsappTemplate } from "../types";
import {
  generateId,
  getInvalidWhatsappPlaceholders,
  WHATSAPP_TEMPLATE_PLACEHOLDERS,
} from "../utils";
import { useToast } from "./Toast";

interface WhatsappTemplatesManagerProps {
  centerId: string;
  centerName: string;
}

const WhatsappTemplatesManager: React.FC<WhatsappTemplatesManagerProps> = ({
  centerId,
  centerName,
}) => {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasDoc, setHasDoc] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    title: "",
    body: "",
    enabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!centerId || !db) {
      setTemplates([]);
      setHasDoc(false);
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    const docRef = doc(db, "centers", centerId, "settings", "whatsapp");
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const data = snapshot.data();
        setHasDoc(snapshot.exists());
        setTemplates(Array.isArray(data?.templates) ? (data?.templates as WhatsappTemplate[]) : []);
        setLoadError(null);
        setIsLoading(false);
      },
      (error) => {
        const message =
          error.code === "permission-denied"
            ? "Sin permisos para leer las plantillas de WhatsApp."
            : "Error cargando las plantillas de WhatsApp.";
        setLoadError(message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [centerId]);

  const invalidPlaceholders = useMemo(
    () => getInvalidWhatsappPlaceholders(formState.body),
    [formState.body]
  );

  const canSave =
    formState.title.trim().length > 0 &&
    formState.body.trim().length > 0 &&
    invalidPlaceholders.length === 0 &&
    !isSaving;

  const startCreate = () => {
    setEditingId("new");
    setFormState({ title: "", body: "", enabled: true });
  };

  const startEdit = (template: WhatsappTemplate) => {
    setEditingId(template.id);
    setFormState({
      title: template.title,
      body: template.body,
      enabled: template.enabled,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormState({ title: "", body: "", enabled: true });
  };

  const persistTemplates = async (nextTemplates: WhatsappTemplate[]) => {
    if (!db || !centerId) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, "centers", centerId, "settings", "whatsapp");
      await setDoc(docRef, { templates: nextTemplates }, { merge: true });
      showToast("Plantillas de WhatsApp actualizadas.", "success");
      setEditingId(null);
    } catch (error: any) {
      const message =
        error?.code === "permission-denied"
          ? "Sin permisos para actualizar plantillas."
          : "No se pudo guardar la plantilla.";
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    const nextTemplates =
      editingId && editingId !== "new"
        ? templates.map((template) =>
            template.id === editingId
              ? { ...template, ...formState }
              : template
          )
        : [...templates, { id: generateId(), ...formState }];
    await persistTemplates(nextTemplates);
  };

  const handleToggle = async (template: WhatsappTemplate) => {
    const nextTemplates = templates.map((item) =>
      item.id === template.id ? { ...item, enabled: !item.enabled } : item
    );
    await persistTemplates(nextTemplates);
  };

  const handleDelete = async (template: WhatsappTemplate) => {
    const nextTemplates = templates.filter((item) => item.id !== template.id);
    await persistTemplates(nextTemplates);
  };

  if (!centerId) {
    return (
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-slate-300">
        Selecciona un centro activo para administrar plantillas de WhatsApp.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">Plantillas WhatsApp</h3>
            <p className="text-sm text-slate-400 mt-1">
              Configura los mensajes que el equipo enviará desde {centerName}.
            </p>
          </div>
          <button
            onClick={startCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Nueva plantilla
          </button>
        </div>
      </div>

      {loadError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> {loadError}
        </div>
      )}

      {isLoading && (
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-slate-300">
          Cargando plantillas...
        </div>
      )}

      {!isLoading && templates.length === 0 && !loadError && (
        <div className="bg-slate-800 p-6 rounded-2xl border border-dashed border-slate-600 text-center">
          <p className="text-slate-300 font-semibold">Aún no hay plantillas.</p>
          <p className="text-slate-500 text-sm mt-2">
            {hasDoc
              ? "Puedes crear tu primera plantilla para enviar mensajes personalizados."
              : "No existe configuración de WhatsApp para este centro."}
          </p>
          <button
            onClick={startCreate}
            className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Crear primera plantilla
          </button>
        </div>
      )}

      {templates.length > 0 && (
        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-slate-800 p-6 rounded-2xl border border-slate-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-white">{template.title}</h4>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${
                        template.enabled
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {template.enabled ? "Habilitada" : "Deshabilitada"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2 whitespace-pre-wrap">
                    {template.body}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(template)}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
                    title={template.enabled ? "Deshabilitar" : "Habilitar"}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startEdit(template)}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-indigo-600 text-white"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-red-600 text-white"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId && (
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h4 className="text-lg font-bold text-white mb-4">
            {editingId === "new" ? "Nueva plantilla" : "Editar plantilla"}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Título</label>
              <input
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                placeholder="Ej: Confirmación de hora"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">
                Mensaje
              </label>
              <textarea
                value={formState.body}
                onChange={(event) => setFormState({ ...formState, body: event.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white min-h-[140px]"
                placeholder="Escribe el mensaje que se enviará por WhatsApp"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                id="template-enabled"
                type="checkbox"
                checked={formState.enabled}
                onChange={(event) =>
                  setFormState({ ...formState, enabled: event.target.checked })
                }
                className="h-4 w-4"
              />
              <label htmlFor="template-enabled" className="text-sm text-slate-300">
                Plantilla habilitada
              </label>
            </div>
            <div className="text-xs text-slate-400">
              Placeholders permitidos: {WHATSAPP_TEMPLATE_PLACEHOLDERS.join(", ")}
            </div>
            {invalidPlaceholders.length > 0 && (
              <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
                Placeholders no soportados: {invalidPlaceholders.join(", ")}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                onClick={cancelEdit}
                className="text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsappTemplatesManager;
