import React from "react";
import { Doctor, ExamProfile, ExamDefinition, ClinicalTemplate } from "../../../types";
import { useToast } from "../../../components/Toast";
import { generateId } from "../../../utils";
import { Activity, Layers, Edit, Trash2, CheckSquare, Square, RefreshCw, TestTube, X, FileText, Book, Shield, KeyRound } from "lucide-react";
import { EXAM_PROFILES } from "../../../constants";
import { DEFAULT_CLINICAL_TEMPLATES } from "../../../constants/clinicalTemplates";

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
            showToast("El perfil debe tener nombre y al menos un examen.", "error"); return;
        }
        let updatedProfiles: ExamProfile[];
        if (isEditingProfileId) {
            updatedProfiles = myExamProfiles.map((p) => p.id === isEditingProfileId ? { ...tempProfile, id: isEditingProfileId } : p);
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
        if (window.confirm("¿Eliminar perfil de exámenes?")) {
            const updated = myExamProfiles.filter((p) => p.id !== id);
            setMyExamProfiles(updated);
            onUpdateDoctor({ id: doctorId, savedExamProfiles: updated });
        }
    };

    const handleResetProfiles = () => {
        if (window.confirm("¿Restaurar los perfiles de exámenes por defecto?")) {
            setMyExamProfiles(EXAM_PROFILES);
            onUpdateDoctor({ id: doctorId, savedExamProfiles: EXAM_PROFILES });
            showToast("Perfiles restaurados.", "success");
        }
    };

    // Custom Exams
    const handleCreateCustomExam = () => {
        if (!newCustomExam.label || !newCustomExam.unit || !newCustomExam.category) {
            showToast("Complete todos los campos del nuevo examen.", "error"); return;
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
        if (window.confirm("¿Eliminar este examen personalizado?")) {
            const updatedCustoms = (currentUser?.customExams || []).filter((e) => e.id !== examId);
            const updatedProfiles = myExamProfiles.map((p) => ({ ...p, exams: p.exams.filter((eid) => eid !== examId) }));
            setMyExamProfiles(updatedProfiles);
            onUpdateDoctor({ id: doctorId, savedExamProfiles: updatedProfiles, customExams: updatedCustoms });
        }
    };

    // Plantillas
    const handleSaveTemplate = () => {
        if (!tempTemplate.title || !tempTemplate.content) return;
        let updatedTemplates: ClinicalTemplate[];
        if (isEditingTemplateId) {
            updatedTemplates = myTemplates.map((t) => t.id === isEditingTemplateId ? { ...tempTemplate, id: isEditingTemplateId, category: t.category } as ClinicalTemplate : t);
            showToast("Plantilla actualizada", "success");
        } else {
            updatedTemplates = [...myTemplates, { ...tempTemplate, id: generateId(), roles: [role] } as ClinicalTemplate];
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
        if (window.confirm("¿Eliminar plantilla?")) {
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
        if (!pwdState.current || !pwdState.new || !pwdState.confirm) { showToast("Complete todos los campos.", "error"); return; }
        if (pwdState.current !== currentUser.password) { showToast("La contraseña actual no es correcta.", "error"); return; }
        if (pwdState.new !== pwdState.confirm) { showToast("Las nuevas contraseñas no coinciden.", "error"); return; }
        if (pwdState.new.length < 4) { showToast("La nueva contraseña es muy corta.", "warning"); return; }

        onUpdateDoctor({ id: doctorId, password: pwdState.new });
        showToast("Contraseña actualizada correctamente.", "success");
        setPwdState({ current: "", new: "", confirm: "" });
        onLogActivity({ action: "update", details: "Usuario cambió su contraseña.", metadata: { scope: "password" } });
    };

    return (
        <div className="w-full animate-fadeIn grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
            <div className="lg:col-span-12 bg-white/90 backdrop-blur-sm p-6 rounded-3xl border border-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-rose-100 text-rose-600 p-3 rounded-2xl"><Activity className="w-6 h-6" /></div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Módulo de Signos Vitales</h3>
                        <p className="text-sm text-slate-500 max-w-xl">Habilita antropometría. <span className="font-bold text-slate-700 ml-1">(Anula la configuración del centro)</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <button onClick={() => onUpdateDoctor({ ...currentUser, preferences: { ...currentUser?.preferences, vitalsEnabled: true } })} className={`px-4 py-2 rounded-lg text-sm font-bold ${moduleGuards.vitals ? "bg-white text-emerald-600 shadow-sm border border-emerald-100" : "text-slate-400"}`}>Activado</button>
                    <button onClick={() => onUpdateDoctor({ ...currentUser, preferences: { ...currentUser?.preferences, vitalsEnabled: false } })} className={`px-4 py-2 rounded-lg text-sm font-bold ${!moduleGuards.vitals ? "bg-white text-rose-600 shadow-sm border border-rose-100" : "text-slate-400"}`}>Desactivado</button>
                </div>
            </div>

            {role === "MEDICO" && (
                <>
                    <div className="lg:col-span-6 bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-lg flex flex-col h-[600px]">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Layers className="w-6 h-6 text-emerald-500" /> Mis Perfiles de Exámenes
                        </h3>
                        <div className="flex-1 overflow-hidden flex flex-col gap-6">
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2 border-b border-slate-100 pb-4">
                                {myExamProfiles.length === 0 && <p className="text-slate-400 italic text-sm text-center py-4">No tiene perfiles configurados.</p>}
                                {myExamProfiles.map((profile) => (
                                    <div key={profile.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 transition-all shadow-sm group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-700 text-sm">{profile.label}</h4>
                                                <p className="text-xs text-slate-400">{profile.description || "Sin descripción"}</p>
                                            </div>
                                            {!isReadOnly && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditProfile(profile)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"><Edit className="w-3 h-3" /></button>
                                                    <button onClick={() => handleDeleteProfile(profile.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 className="w-3 h-3" /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {!isReadOnly && (
                                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="flex gap-2">
                                        <input className="flex-1 p-2 border rounded-lg text-sm" placeholder="Ej: Control Diabetes" value={tempProfile.label} onChange={(e) => setTempProfile({ ...tempProfile, label: e.target.value })} />
                                        <input className="flex-1 p-2 border rounded-lg text-sm" placeholder="Descripción..." value={tempProfile.description} onChange={(e) => setTempProfile({ ...tempProfile, description: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white">
                                        {allExamOptions.filter((e) => !e.readOnly).map((opt) => (
                                            <button key={opt.id} onClick={() => toggleExamInTempProfile(opt.id)} className={`text-xs text-left px-2 py-1 rounded flex items-center gap-2 ${tempProfile.exams.includes(opt.id) ? "bg-emerald-50 text-emerald-700 font-bold" : "text-slate-600"}`}>
                                                {tempProfile.exams.includes(opt.id) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                                                <span className="truncate">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={handleSaveProfile} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 text-sm">{isEditingProfileId ? "Guardar Cambios" : "Crear Perfil"}</button>
                                        {isEditingProfileId && <button onClick={() => setIsEditingProfileId(null)} className="px-3 py-2 bg-slate-200 font-bold rounded-lg text-sm">Cancelar</button>}
                                    </div>
                                    <button onClick={handleResetProfiles} className="w-full text-xs text-slate-400 hover:text-emerald-600 flex justify-center items-center gap-1 mt-1"><RefreshCw className="w-3 h-3" /> Restaurar predeterminados</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-6 space-y-8">
                        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-lg flex flex-col">
                            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><TestTube className="w-6 h-6 text-purple-500" /> Definir Nuevo Examen</h3>
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-3">
                                <div className="flex gap-2">
                                    <input className="flex-1 p-2 border border-purple-200 rounded-lg text-sm outline-none focus:border-purple-500" placeholder="Nombre (ej: Estradiol)" value={newCustomExam.label} onChange={(e) => setNewCustomExam({ ...newCustomExam, label: e.target.value })} />
                                    <input className="w-24 p-2 border border-purple-200 rounded-lg text-sm outline-none focus:border-purple-500" placeholder="Unidad" value={newCustomExam.unit} onChange={(e) => setNewCustomExam({ ...newCustomExam, unit: e.target.value })} />
                                </div>
                                <select className="w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:border-purple-500 bg-white" value={newCustomExam.category} onChange={(e) => setNewCustomExam({ ...newCustomExam, category: e.target.value })}>
                                    <option value="">Seleccione Categoría</option>
                                    <option value="Metabólico">Metabólico</option>
                                    <option value="Hormonal">Hormonal</option>
                                    <option value="Hematológico">Hematológico</option>
                                    <option value="Cardíaco">Cardíaco</option>
                                    <option value="Otro">Otro</option>
                                </select>
                                <button onClick={handleCreateCustomExam} className="w-full bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-700 text-sm">Agregar a la Lista</button>
                            </div>
                            {currentUser?.customExams && currentUser.customExams.length > 0 && (
                                <div className="mt-4 border-t border-slate-100 pt-4"><h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Mis Exámenes Personalizados</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {currentUser.customExams.map((ex) => (
                                            <span key={ex.id} className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full flex items-center gap-1 border border-purple-200">
                                                {ex.label} ({ex.unit})
                                                <button onClick={() => handleDeleteCustomExam(ex.id)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Templates Editor */}
            <div className="lg:col-span-12 bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-lg flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText className="w-6 h-6 text-slate-400" /> Mis Plantillas Clínicas</h3>
                    <button onClick={() => setIsCatalogOpen(true)} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center gap-1 transition-colors"><Book className="w-3 h-3" /> Explorar Catálogo</button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col gap-6">
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 border-b border-slate-100 pb-4 max-h-40">
                        {myTemplates.length === 0 && <p className="text-center text-slate-400 text-sm italic py-4">No tiene plantillas. Importe desde el catálogo o cree una.</p>}
                        {myTemplates.map((t) => (
                            <div key={t.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors group">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-slate-700 text-sm">{t.title}</span>
                                    {!isReadOnly && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditTemplate(t)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"><Edit className="w-3 h-3" /></button>
                                            <button onClick={() => handleDeleteTemplate(t.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-1">{t.content}</p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <input className="w-full p-2 border-2 rounded-lg text-sm" placeholder="Ej: Resfrío Común" value={tempTemplate.title} onChange={(e) => setTempTemplate({ ...tempTemplate, title: e.target.value })} readOnly={isReadOnly} />
                        <textarea className="w-full p-2 border-2 rounded-lg h-16 resize-none text-sm" placeholder="Texto predefinido..." value={tempTemplate.content} onChange={(e) => setTempTemplate({ ...tempTemplate, content: e.target.value })} readOnly={isReadOnly} />
                        {!isReadOnly && (
                            <div className="flex gap-2">
                                <button onClick={handleSaveTemplate} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 text-sm">{isEditingTemplateId ? "Actualizar" : "Crear Nueva"}</button>
                                {isEditingTemplateId && <button onClick={() => { setIsEditingTemplateId(null); setTempTemplate({ id: "", title: "", content: "" }); }} className="px-3 py-2 bg-slate-200 font-bold rounded-lg text-sm">Cancelar</button>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isCatalogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div><h3 className="font-bold text-lg text-slate-800">Catálogo de Plantillas</h3></div>
                            <button onClick={() => setIsCatalogOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                        </div>
                        <div className="p-4 border-b border-slate-100 bg-white space-y-3">
                            <input className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm" placeholder="Escriba para buscar..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} />
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 max-h-64">
                                {DEFAULT_CLINICAL_TEMPLATES.filter((t) => !t.roles || t.roles.includes(role)).map((t) => (
                                    <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                                        <div className="flex justify-between items-start"><span className="font-bold text-slate-800">{t.title}</span><button onClick={() => handleImportTemplate(t)} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold">Importar</button></div>
                                        <p className="text-xs text-slate-500 line-clamp-2">{t.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Contraseña */}
            <div className="lg:col-span-12 bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-lg flex flex-col">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Shield className="w-6 h-6 text-indigo-500" /> Seguridad de la Cuenta</h3>
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="md:w-1/3">
                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-indigo-900">
                            <KeyRound className="w-8 h-8 mb-4 opacity-80" />
                            <h4 className="font-bold text-lg mb-2">Cambiar Contraseña</h4>
                            <p className="text-sm opacity-80 mb-4">Actualice su contraseña periódicamente.</p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-4 max-w-md">
                        <input type="password" placeholder="Contraseña Actual" className="w-full p-3 border rounded-xl" value={pwdState.current} onChange={(e) => setPwdState({ ...pwdState, current: e.target.value })} readOnly={isReadOnly} />
                        <input type="password" placeholder="Nueva Contraseña" className="w-full p-3 border rounded-xl" value={pwdState.new} onChange={(e) => setPwdState({ ...pwdState, new: e.target.value })} readOnly={isReadOnly} />
                        <input type="password" placeholder="Repetir Nueva" className="w-full p-3 border rounded-xl" value={pwdState.confirm} onChange={(e) => setPwdState({ ...pwdState, confirm: e.target.value })} readOnly={isReadOnly} />
                        {!isReadOnly && <button onClick={handleChangePassword} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 w-full md:w-auto">Actualizar Contraseña</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};
