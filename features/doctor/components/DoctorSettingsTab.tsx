import React from "react";
import { Doctor, ExamProfile, ExamDefinition, ClinicalTemplate } from "../../../types";
import { useToast } from "../../../components/Toast";
import { generateId } from "../../../utils";
import {
  Activity,
  Layers,
  TestTube,
  X,
  FileText,
  Book,
  Shield,
  KeyRound,
  Search,
} from "lucide-react";
import { EXAM_PROFILES } from "../../../constants";
import { DEFAULT_CLINICAL_TEMPLATES } from "../../../constants/clinicalTemplates";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import Input from "../../../components/ui/Input";
import DoctorTemplatesSection from "../../../components/DoctorTemplatesSection";
import DoctorExamProfilesSection from "../../../components/DoctorExamProfilesSection";

interface DoctorSettingsTabProps {
  currentUser: Doctor | undefined;
  doctorId: string;
  role: string;
  moduleGuards: any;
  isReadOnly: boolean;
  onUpdateDoctor: (doc: any) => void;
  onLogActivity: (log: any) => void;

  // Perfiles
  myExamProfiles: ExamProfile[];
  setMyExamProfiles: (p: ExamProfile[]) => void;
  tempProfile: ExamProfile;
  setTempProfile: (p: ExamProfile) => void;
  isEditingProfileId: string | null;
  setIsEditingProfileId: (id: string | null) => void;
  allExamOptions: ExamDefinition[];

  // Custom Exams
  newCustomExam: { label: string; unit: string; category: string };
  setNewCustomExam: (e: any) => void;

  // Templates
  myTemplates: ClinicalTemplate[];
  setMyTemplates: (t: ClinicalTemplate[]) => void;
  tempTemplate: { id: string; title: string; content: string };
  setTempTemplate: (t: any) => void;
  isEditingTemplateId: string | null;
  setIsEditingTemplateId: (id: string | null) => void;
  isCatalogOpen: boolean;
  setIsCatalogOpen: (op: boolean) => void;
  catalogSearch: string;
  setCatalogSearch: (search: string) => void;

  // Password
  pwdState: { current: string; new: string; confirm: string };
  setPwdState: (state: any) => void;
}

export const DoctorSettingsTab: React.FC<DoctorSettingsTabProps> = ({
  currentUser,
  doctorId,
  role,
  moduleGuards,
  isReadOnly,
  onUpdateDoctor,
  onLogActivity,
  myExamProfiles,
  setMyExamProfiles,
  tempProfile,
  setTempProfile,
  isEditingProfileId,
  setIsEditingProfileId,
  allExamOptions,
  newCustomExam,
  setNewCustomExam,
  myTemplates,
  setMyTemplates,
  tempTemplate,
  setTempTemplate,
  isEditingTemplateId,
  setIsEditingTemplateId,
  isCatalogOpen,
  setIsCatalogOpen,
  catalogSearch,
  setCatalogSearch,
  pwdState,
  setPwdState,
}) => {
  const { showToast } = useToast();

  // Handlers para Perfiles
  const toggleExamInTempProfile = (examId: string) => {
    if (tempProfile.exams.includes(examId)) {
      setTempProfile({ ...tempProfile, exams: tempProfile.exams.filter((id) => id !== examId) });
    } else {
      setTempProfile({ ...tempProfile, exams: [...tempProfile.exams, examId] });
    }
  };

  const handleSaveProfile = () => {
    if (!tempProfile.label || tempProfile.exams.length === 0) {
      showToast("El perfil debe tener nombre y al menos un examen.", "error");
      return;
    }
    let updatedProfiles: ExamProfile[];
    if (isEditingProfileId) {
      updatedProfiles = myExamProfiles.map((p) =>
        p.id === isEditingProfileId ? { ...tempProfile, id: isEditingProfileId } : p
      );
      showToast("Perfil actualizado", "success");
    } else {
      updatedProfiles = [...myExamProfiles, { ...tempProfile, id: generateId() }];
      showToast("Perfil creado", "success");
    }
    setMyExamProfiles(updatedProfiles);
    setTempProfile({ id: "", label: "", exams: [], description: "" });
    setIsEditingProfileId(null);
    onUpdateDoctor({ id: doctorId, savedExamProfiles: updatedProfiles });
  };

  const handleEditProfile = (p: ExamProfile) => {
    setTempProfile({ label: p.label, exams: p.exams, description: p.description, id: p.id });
    setIsEditingProfileId(p.id);
  };

  const handleDeleteProfile = (id: string) => {
    if (globalThis.confirm("¿Eliminar perfil de exámenes?")) {
      const updated = myExamProfiles.filter((p) => p.id !== id);
      setMyExamProfiles(updated);
      onUpdateDoctor({ id: doctorId, savedExamProfiles: updated });
    }
  };

  const handleResetProfiles = () => {
    if (globalThis.confirm("¿Restaurar los perfiles de exámenes por defecto?")) {
      setMyExamProfiles(EXAM_PROFILES);
      onUpdateDoctor({ id: doctorId, savedExamProfiles: EXAM_PROFILES });
      showToast("Perfiles restaurados.", "success");
    }
  };

  // Custom Exams
  const handleCreateCustomExam = () => {
    if (!newCustomExam.label || !newCustomExam.unit || !newCustomExam.category) {
      showToast("Complete todos los campos del nuevo examen.", "error");
      return;
    }
    const newDef: ExamDefinition = {
      id: `custom_${generateId()}`,
      label: newCustomExam.label,
      unit: newCustomExam.unit,
      category: newCustomExam.category,
    };
    const updatedCustoms = [...(currentUser?.customExams || []), newDef];
    onUpdateDoctor({ id: doctorId, customExams: updatedCustoms });
    setNewCustomExam({ label: "", unit: "", category: "" });
    showToast("Nuevo examen creado exitosamente.", "success");
  };

  const handleDeleteCustomExam = (examId: string) => {
    if (globalThis.confirm("¿Eliminar este examen personalizado?")) {
      const updatedCustoms = (currentUser?.customExams || []).filter((e) => e.id !== examId);
      const updatedProfiles = myExamProfiles.map((p) => ({
        ...p,
        exams: p.exams.filter((eid) => eid !== examId),
      }));
      setMyExamProfiles(updatedProfiles);
      onUpdateDoctor({
        id: doctorId,
        savedExamProfiles: updatedProfiles,
        customExams: updatedCustoms,
      });
    }
  };

  // Plantillas
  const handleSaveTemplate = () => {
    if (!tempTemplate.title || !tempTemplate.content) return;
    let updatedTemplates: ClinicalTemplate[];
    if (isEditingTemplateId) {
      updatedTemplates = myTemplates.map((t) =>
        t.id === isEditingTemplateId
          ? ({ ...tempTemplate, id: isEditingTemplateId, category: t.category } as ClinicalTemplate)
          : t
      );
      showToast("Plantilla actualizada", "success");
    } else {
      updatedTemplates = [
        ...myTemplates,
        { ...tempTemplate, id: generateId(), roles: [role] } as ClinicalTemplate,
      ];
      showToast("Plantilla creada", "success");
    }
    setMyTemplates(updatedTemplates);
    setTempTemplate({ id: "", title: "", content: "" });
    setIsEditingTemplateId(null);
    onUpdateDoctor({ id: doctorId, savedTemplates: updatedTemplates });
  };

  const handleEditTemplate = (t: ClinicalTemplate) => {
    setTempTemplate({ title: t.title, content: t.content, id: t.id });
    setIsEditingTemplateId(t.id);
  };

  const handleDeleteTemplate = (id: string) => {
    if (globalThis.confirm("¿Eliminar plantilla?")) {
      const updated = myTemplates.filter((t) => t.id !== id);
      setMyTemplates(updated);
      onUpdateDoctor({ id: doctorId, savedTemplates: updated });
    }
  };

  const handleImportTemplate = (template: ClinicalTemplate) => {
    if (!currentUser || !currentUser.id) return;
    const newT: ClinicalTemplate = {
      id: generateId(),
      userId: currentUser.id,
      title: template.title,
      content: template.content,
      category: template.category,
      createdAt: new Date().toISOString(),
    };
    const updatedTemplates = [...(currentUser.savedTemplates || []), newT];
    onUpdateDoctor({ ...currentUser, savedTemplates: updatedTemplates });
    setMyTemplates(updatedTemplates);
    showToast("Plantilla importada", "success");
    setIsCatalogOpen(false);
  };

  const handleChangePassword = () => {
    if (!currentUser) return;
    if (!pwdState.current || !pwdState.new || !pwdState.confirm) {
      showToast("Complete todos los campos.", "error");
      return;
    }
    if (pwdState.current !== currentUser.password) {
      showToast("La contraseña actual no es correcta.", "error");
      return;
    }
    if (pwdState.new !== pwdState.confirm) {
      showToast("Las nuevas contraseñas no coinciden.", "error");
      return;
    }
    if (pwdState.new.length < 4) {
      showToast("La nueva contraseña es muy corta.", "warning");
      return;
    }

    onUpdateDoctor({ id: doctorId, password: pwdState.new });
    showToast("Contraseña actualizada correctamente.", "success");
    setPwdState({ current: "", new: "", confirm: "" });
    onLogActivity({
      action: "update",
      details: "Usuario cambió su contraseña.",
      metadata: { scope: "password" },
    });
  };

  return (
    <div className="w-full animate-fadeIn flex flex-col gap-8 pb-20 max-w-6xl mx-auto">
      {/* Vitals Toggle */}
      <Card variant="glass" className="flex flex-col md:flex-row justify-between items-center gap-6 border-emerald-500/20">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-2xl border border-emerald-500/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Módulo de Signos Vitales</h3>
            <p className="text-sm text-slate-400 max-w-xl">
              Habilita la sección de antropometría y parámetros clínicos.{" "}
              <span className="font-bold text-emerald-400 ml-1">
                (Esta preferencia anula la configuración global del centro)
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700">
          <Button
            variant={moduleGuards.vitals ? "primary" : "ghost"}
            size="sm"
            onClick={() =>
              onUpdateDoctor({
                ...currentUser,
                preferences: { ...currentUser?.preferences, vitalsEnabled: true },
              })
            }
            className={`rounded-xl px-6 ${moduleGuards.vitals ? "shadow-emerald-900/40" : ""}`}
          >
            Activado
          </Button>
          <Button
            variant={!moduleGuards.vitals ? "danger" : "ghost"}
            size="sm"
            onClick={() =>
              onUpdateDoctor({
                ...currentUser,
                preferences: { ...currentUser?.preferences, vitalsEnabled: false },
              })
            }
            className={`rounded-xl px-6 ${!moduleGuards.vitals ? "shadow-red-900/40" : ""}`}
          >
            Desactivado
          </Button>
        </div>
      </Card>

      {role === "MEDICO" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Perfiles y Packs</h3>
            </div>
            <DoctorExamProfilesSection
              profiles={myExamProfiles}
              allExamOptions={allExamOptions}
              tempProfile={tempProfile}
              isEditingId={isEditingProfileId}
              onTempChange={setTempProfile}
              onSave={handleSaveProfile}
              onEdit={handleEditProfile}
              onDelete={handleDeleteProfile}
              onReset={handleResetProfiles}
              onCancel={() => setIsEditingProfileId(null)}
              onToggleExam={toggleExamInTempProfile}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <TestTube className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Exámenes Personalizados</h3>
            </div>
            <Card variant="glass" className="border-purple-500/20">
              <p className="text-sm text-slate-400 mb-6">Define exámenes específicos que no estén en el catálogo nacional.</p>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Nombre (ej: Estradiol)"
                    value={newCustomExam.label}
                    onChange={(e) => setNewCustomExam({ ...newCustomExam, label: e.target.value })}
                  />
                  <Input
                    placeholder="Unidad"
                    className="w-24"
                    value={newCustomExam.unit}
                    onChange={(e) => setNewCustomExam({ ...newCustomExam, unit: e.target.value })}
                  />
                </div>
                <select
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                  value={newCustomExam.category}
                  onChange={(e) => setNewCustomExam({ ...newCustomExam, category: e.target.value })}
                >
                  <option value="">Seleccione Categoría</option>
                  <option value="Metabólico">Metabólico</option>
                  <option value="Hormonal">Hormonal</option>
                  <option value="Hematológico">Hematológico</option>
                  <option value="Cardíaco">Cardíaco</option>
                  <option value="Otro">Otro</option>
                </select>
                <Button variant="primary" className="w-full bg-purple-600 hover:bg-purple-700 shadow-purple-900/20" onClick={handleCreateCustomExam}>
                  Agregar a mi Lista
                </Button>
              </div>

              {currentUser?.customExams && currentUser.customExams.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Mis Exámenes Personales</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentUser.customExams.map((ex) => (
                      <span
                        key={ex.id}
                        className="bg-purple-500/10 text-purple-400 text-xs font-bold px-3 py-1.5 rounded-full border border-purple-500/20 flex items-center gap-2 group"
                      >
                        {ex.label} ({ex.unit})
                        <button
                          onClick={() => handleDeleteCustomExam(ex.id)}
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Templates Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Plantillas Clínicas</h3>
          </div>
          <Button variant="glass" size="sm" onClick={() => setIsCatalogOpen(true)}>
            <Book className="w-4 h-4 mr-2" /> Explorar Catálogo
          </Button>
        </div>
        <DoctorTemplatesSection
          templates={myTemplates}
          tempTemplate={tempTemplate}
          isEditingId={isEditingTemplateId}
          onTempChange={setTempTemplate}
          onSave={handleSaveTemplate}
          onEdit={handleEditTemplate}
          onDelete={handleDeleteTemplate}
          onReset={() => {}} // Se puede implementar si se desea
          onCancel={() => {
            setIsEditingTemplateId(null);
            setTempTemplate({ id: "", title: "", content: "" });
          }}
        />
      </div>

      {/* Seguridad */}
      <Card variant="glass" className="border-indigo-500/20">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-400" /> Seguridad de la Cuenta
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/10">
            <KeyRound className="w-10 h-10 text-indigo-400 mb-4" />
            <h4 className="font-bold text-lg text-white mb-2">Cambiar Contraseña</h4>
            <p className="text-sm text-slate-400 leading-relaxed">Actualice su contraseña periódicamente para mantener su cuenta protegida.</p>
          </div>
          <div className="md:col-span-2 space-y-4 max-w-md">
            <Input
              type="password"
              label="Contraseña Actual"
              value={pwdState.current}
              onChange={(e) => setPwdState({ ...pwdState, current: e.target.value })}
              readOnly={isReadOnly}
            />
            <Input
              type="password"
              label="Nueva Contraseña"
              value={pwdState.new}
              onChange={(e) => setPwdState({ ...pwdState, new: e.target.value })}
              readOnly={isReadOnly}
            />
            <Input
              type="password"
              label="Confirmar Nueva"
              value={pwdState.confirm}
              onChange={(e) => setPwdState({ ...pwdState, confirm: e.target.value })}
              readOnly={isReadOnly}
            />
            <div className="pt-2">
              <Button variant="primary" onClick={handleChangePassword} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20">
                Actualizar Contraseña
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Catálogo Modal */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsCatalogOpen(false)} />
          <Card variant="glass" className="w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden relative border-emerald-500/30 shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-xl text-white">Catálogo de Plantillas</h3>
              <button onClick={() => setIsCatalogOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 flex-1 flex flex-col">
              <Input
                icon={<Search className="w-4 h-4" />}
                placeholder="Buscar por título o contenido..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {DEFAULT_CLINICAL_TEMPLATES
                  .filter((t) => !t.roles || t.roles.includes(role))
                  .filter((t) => t.title.toLowerCase().includes(catalogSearch.toLowerCase()) || t.content.toLowerCase().includes(catalogSearch.toLowerCase()))
                  .map((t) => (
                    <div
                      key={t.id}
                      className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-bold text-white group-hover:text-emerald-400 transition-colors">{t.title}</span>
                        <Button variant="glass" size="sm" onClick={() => handleImportTemplate(t)}>
                          Importar
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed italic line-clamp-2">"{t.content}"</p>
                    </div>
                  ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
