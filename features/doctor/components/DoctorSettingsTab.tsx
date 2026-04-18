import React from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as updateFirebasePassword,
} from "firebase/auth";
import { Doctor, ExamProfile, ExamDefinition, ClinicalTemplate } from "../../../types";
import { auth } from "../../../firebase";
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
  myExamProfiles: ExamProfile[];
  setMyExamProfiles: (p: ExamProfile[]) => void;
  tempProfile: ExamProfile;
  setTempProfile: (p: ExamProfile) => void;
  isEditingProfileId: string | null;
  setIsEditingProfileId: (id: string | null) => void;
  allExamOptions: ExamDefinition[];
  newCustomExam: { label: string; unit: string; category: string };
  setNewCustomExam: (e: any) => void;
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
      updatedProfiles = myExamProfiles.map((profile) =>
        profile.id === isEditingProfileId ? { ...tempProfile, id: isEditingProfileId } : profile
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

  const handleEditProfile = (profile: ExamProfile) => {
    setTempProfile({
      label: profile.label,
      exams: profile.exams,
      description: profile.description,
      id: profile.id,
    });
    setIsEditingProfileId(profile.id);
  };

  const handleDeleteProfile = (id: string) => {
    if (globalThis.confirm("¿Eliminar perfil de exámenes?")) {
      const updated = myExamProfiles.filter((profile) => profile.id !== id);
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

  const handleCreateCustomExam = () => {
    if (!newCustomExam.label || !newCustomExam.unit || !newCustomExam.category) {
      showToast("Completa todos los campos del nuevo examen.", "error");
      return;
    }
    const newDefinition: ExamDefinition = {
      id: `custom_${generateId()}`,
      label: newCustomExam.label,
      unit: newCustomExam.unit,
      category: newCustomExam.category,
    };
    const updatedCustoms = [...(currentUser?.customExams || []), newDefinition];
    onUpdateDoctor({ id: doctorId, customExams: updatedCustoms });
    setNewCustomExam({ label: "", unit: "", category: "" });
    showToast("Nuevo examen creado exitosamente.", "success");
  };

  const handleDeleteCustomExam = (examId: string) => {
    if (globalThis.confirm("¿Eliminar este examen personalizado?")) {
      const updatedCustoms = (currentUser?.customExams || []).filter((exam) => exam.id !== examId);
      const updatedProfiles = myExamProfiles.map((profile) => ({
        ...profile,
        exams: profile.exams.filter((id) => id !== examId),
      }));
      setMyExamProfiles(updatedProfiles);
      onUpdateDoctor({
        id: doctorId,
        savedExamProfiles: updatedProfiles,
        customExams: updatedCustoms,
      });
    }
  };

  const handleSaveTemplate = () => {
    if (!tempTemplate.title || !tempTemplate.content) return;
    let updatedTemplates: ClinicalTemplate[];
    if (isEditingTemplateId) {
      updatedTemplates = myTemplates.map((template) =>
        template.id === isEditingTemplateId
          ? ({
              ...tempTemplate,
              id: isEditingTemplateId,
              category: template.category,
            } as ClinicalTemplate)
          : template
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

  const handleEditTemplate = (template: ClinicalTemplate) => {
    setTempTemplate({ title: template.title, content: template.content, id: template.id });
    setIsEditingTemplateId(template.id);
  };

  const handleDeleteTemplate = (id: string) => {
    if (globalThis.confirm("¿Eliminar plantilla?")) {
      const updated = myTemplates.filter((template) => template.id !== id);
      setMyTemplates(updated);
      onUpdateDoctor({ id: doctorId, savedTemplates: updated });
    }
  };

  const handleImportTemplate = (template: ClinicalTemplate) => {
    if (!currentUser || !currentUser.id) return;
    const newTemplate: ClinicalTemplate = {
      id: generateId(),
      userId: currentUser.id,
      title: template.title,
      content: template.content,
      category: template.category,
      createdAt: new Date().toISOString(),
    };
    const updatedTemplates = [...(currentUser.savedTemplates || []), newTemplate];
    onUpdateDoctor({ ...currentUser, savedTemplates: updatedTemplates });
    setMyTemplates(updatedTemplates);
    showToast("Plantilla importada", "success");
    setIsCatalogOpen(false);
  };

  const handleChangePassword = async () => {
    const authUser = auth.currentUser;
    const authEmail = authUser?.email || currentUser?.email || "";
    if (!currentUser || !authUser || !authEmail) {
      showToast("No pudimos validar la sesión actual. Vuelve a iniciar sesión.", "error");
      return;
    }
    if (!pwdState.current || !pwdState.new || !pwdState.confirm) {
      showToast("Completa todos los campos.", "error");
      return;
    }
    if (pwdState.new !== pwdState.confirm) {
      showToast("Las nuevas contraseñas no coinciden.", "error");
      return;
    }
    if (pwdState.new.length < 6) {
      showToast("La nueva contraseña debe tener al menos 6 caracteres.", "warning");
      return;
    }
    if (pwdState.current === pwdState.new) {
      showToast("La nueva contraseña debe ser distinta a la actual.", "warning");
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(authEmail, pwdState.current);
      await reauthenticateWithCredential(authUser, credential);
      await updateFirebasePassword(authUser, pwdState.new);

      showToast("Contraseña actualizada correctamente.", "success");
      setPwdState({ current: "", new: "", confirm: "" });
      onLogActivity({
        action: "update",
        details: "Usuario cambió su contraseña.",
        metadata: { scope: "password", provider: "firebase-auth" },
      });
    } catch (error: any) {
      const code = String(error?.code || "");
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        showToast("La contraseña actual no es correcta.", "error");
        return;
      }
      if (code === "auth/too-many-requests") {
        showToast("Demasiados intentos. Espera un momento e inténtalo de nuevo.", "warning");
        return;
      }
      if (code === "auth/requires-recent-login") {
        showToast("Por seguridad, vuelve a iniciar sesión antes de cambiar la contraseña.", "warning");
        return;
      }
      console.error("Error updating professional password:", error);
      showToast("No pudimos actualizar tu contraseña. Intenta nuevamente.", "error");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-20 animate-fadeIn">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card variant="glass" className="border-emerald-500/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-500">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-400">
                  Preferencias clínicas
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-white">
                  Configuración del trabajo diario
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                  Ajusta cómo quieres trabajar tu ficha, tus plantillas y tus herramientas
                  personales. La idea es mantener lo clínico al frente y lo técnico ordenado.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Signos vitales
                </p>
                <p className="mt-2 text-sm font-bold text-white">
                  {moduleGuards.vitals ? "Activos" : "Desactivados"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Perfiles guardados
                </p>
                <p className="mt-2 text-sm font-bold text-white">{myExamProfiles.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Plantillas propias
                </p>
                <p className="mt-2 text-sm font-bold text-white">{myTemplates.length}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card variant="glass" className="border-indigo-500/20">
          <div className="flex h-full flex-col justify-between gap-5">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-400">
                    Seguridad personal
                  </p>
                  <h3 className="mt-1 text-xl font-black text-white">Cuenta y acceso</h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Mantén tus credenciales al día y revisa tus preferencias personales sin mezclar
                esta zona con tus herramientas clínicas.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Recomendación
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Usa esta sección para ajustes personales. Deja los perfiles y plantillas en las
                áreas clínicas para encontrarlos más rápido.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <Card variant="glass" className="border-emerald-500/20">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Preferencia personal
                </p>
                <h3 className="text-lg font-bold uppercase tracking-wider text-white">
                  Signos vitales
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/50 p-1.5">
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
          </div>
          <p className="text-sm leading-relaxed text-slate-400">
            Habilita o deshabilita la sección de antropometría y parámetros clínicos para tu flujo
            personal. Esta preferencia anula la configuración global del centro.
          </p>
        </Card>

        <Card variant="glass" className="border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-3 text-slate-300">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Orden sugerido
              </p>
              <h3 className="text-lg font-bold text-white">Cómo usar esta pantalla</h3>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <p>1. Ajusta tus herramientas clínicas primero.</p>
            <p>2. Mantén tus plantillas y catálogos listos para consulta rápida.</p>
            <p>3. Deja seguridad y acceso como una tarea separada.</p>
          </div>
        </Card>
      </div>

      {role === "MEDICO" && (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Layers className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Herramienta clínica
                </p>
                <h3 className="text-lg font-bold uppercase tracking-wider text-white">
                  Perfiles y packs de exámenes
                </h3>
              </div>
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
              <TestTube className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Catálogo personal
                </p>
                <h3 className="text-lg font-bold uppercase tracking-wider text-white">
                  Exámenes personalizados
                </h3>
              </div>
            </div>
            <Card variant="glass" className="border-purple-500/20">
              <p className="mb-6 text-sm text-slate-400">
                Define exámenes específicos que no estén en el catálogo nacional.
              </p>
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2.5 font-medium text-white outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  value={newCustomExam.category}
                  onChange={(e) => setNewCustomExam({ ...newCustomExam, category: e.target.value })}
                >
                  <option value="">Selecciona categoría</option>
                  <option value="Metabólico">Metabólico</option>
                  <option value="Hormonal">Hormonal</option>
                  <option value="Hematológico">Hematológico</option>
                  <option value="Cardíaco">Cardíaco</option>
                  <option value="Otro">Otro</option>
                </select>
                <Button
                  variant="primary"
                  className="w-full bg-purple-600 shadow-purple-900/20 hover:bg-purple-700"
                  onClick={handleCreateCustomExam}
                >
                  Agregar a mi lista
                </Button>
              </div>

              {currentUser?.customExams && currentUser.customExams.length > 0 && (
                <div className="mt-8 border-t border-white/5 pt-6">
                  <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Mis exámenes personales
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {currentUser.customExams.map((exam) => (
                      <span
                        key={exam.id}
                        className="group flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-400"
                      >
                        {exam.label} ({exam.unit})
                        <button
                          onClick={() => handleDeleteCustomExam(exam.id)}
                          className="transition-colors hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
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

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Herramienta clínica
              </p>
              <h3 className="text-lg font-bold uppercase tracking-wider text-white">
                Plantillas clínicas
              </h3>
            </div>
          </div>
          <Button variant="glass" size="sm" onClick={() => setIsCatalogOpen(true)}>
            <Book className="mr-2 h-4 w-4" /> Explorar catálogo
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
          onReset={() => {}}
          onCancel={() => {
            setIsEditingTemplateId(null);
            setTempTemplate({ id: "", title: "", content: "" });
          }}
        />
      </div>

      <Card variant="glass" className="border-indigo-500/20">
        <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-indigo-500/10 bg-indigo-500/5 p-6">
            <KeyRound className="mb-4 h-10 w-10 text-indigo-400" />
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-400">
              Seguridad personal
            </p>
            <h4 className="mt-2 text-lg font-bold text-white">Cambiar contraseña</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Actualiza tu contraseña periódicamente para mantener tu cuenta protegida.
            </p>
          </div>
          <div className="max-w-md space-y-4">
            <Input
              type="password"
              label="Contraseña actual"
              value={pwdState.current}
              onChange={(e) => setPwdState({ ...pwdState, current: e.target.value })}
              readOnly={isReadOnly}
            />
            <Input
              type="password"
              label="Nueva contraseña"
              value={pwdState.new}
              onChange={(e) => setPwdState({ ...pwdState, new: e.target.value })}
              readOnly={isReadOnly}
            />
            <Input
              type="password"
              label="Confirmar nueva"
              value={pwdState.confirm}
              onChange={(e) => setPwdState({ ...pwdState, confirm: e.target.value })}
              readOnly={isReadOnly}
            />
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={handleChangePassword}
                className="w-full bg-indigo-600 shadow-indigo-900/20 hover:bg-indigo-700 md:w-auto"
              >
                Actualizar contraseña
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setIsCatalogOpen(false)}
          />
          <Card
            variant="glass"
            className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden border-emerald-500/30 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <h3 className="text-xl font-bold text-white">Catálogo de plantillas</h3>
              <button
                onClick={() => setIsCatalogOpen(false)}
                className="rounded-full p-2 transition-colors hover:bg-white/10"
              >
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <div className="flex flex-1 flex-col space-y-4 p-6">
              <Input
                icon={<Search className="h-4 w-4" />}
                placeholder="Buscar por título o contenido..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
              <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
                {DEFAULT_CLINICAL_TEMPLATES.filter((template) =>
                  !template.roles || template.roles.includes(role)
                )
                  .filter(
                    (template) =>
                      template.title.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                      template.content.toLowerCase().includes(catalogSearch.toLowerCase())
                  )
                  .map((template) => (
                    <div
                      key={template.id}
                      className="group rounded-2xl border border-white/5 bg-slate-900/40 p-5 transition-all hover:border-emerald-500/30"
                    >
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <span className="font-bold text-white transition-colors group-hover:text-emerald-400">
                          {template.title}
                        </span>
                        <Button variant="glass" size="sm" onClick={() => handleImportTemplate(template)}>
                          Importar
                        </Button>
                      </div>
                      <p className="line-clamp-2 text-xs italic leading-relaxed text-slate-500">
                        "{template.content}"
                      </p>
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
