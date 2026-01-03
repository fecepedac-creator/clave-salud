
import React, { useState } from 'react';
import { Patient, Attachment, Medication, Allergy, ExamProfile, ExamDefinition } from '../types';
import { MEDICAL_HISTORY_OPTIONS, SURGICAL_HISTORY_OPTIONS, LIVING_WITH_OPTIONS, MAULE_COMMUNES, COMMON_MEDICATIONS } from '../constants';
import { generateId } from '../utils';
import { Users, Activity, Scissors, FileImage, Plus, Eye, File, Pill, X, AlertCircle, TrendingUp, CheckCircle, Layers } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';

interface PatientSidebarProps {
    selectedPatient: Patient;
    isEditingPatient: boolean;
    toggleEditPatient: () => void;
    handleEditPatientField: (field: keyof Patient, value: any) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onPreviewFile: (file: Attachment) => void;
    readOnly?: boolean;
    availableProfiles?: ExamProfile[]; // NEW PROP
    examOptions?: ExamDefinition[]; // NEW PROP
}

const PatientSidebar: React.FC<PatientSidebarProps> = ({ 
    selectedPatient, isEditingPatient, toggleEditPatient, handleEditPatientField, onFileUpload, onPreviewFile, readOnly = false, availableProfiles = [], examOptions = []
}) => {
    // Local state for temporary inputs (adding list items)
    const [tempMedication, setTempMedication] = useState<Partial<Medication>>({ name: '', dose: '', frequency: '' });
    const [tempAllergy, setTempAllergy] = useState('');

    // Safety accessors
    const livingWith = selectedPatient.livingWith || [];
    const medicalHistory = selectedPatient.medicalHistory || [];
    const surgicalHistory = selectedPatient.surgicalHistory || [];
    const medications = selectedPatient.medications || [];
    const allergies = selectedPatient.allergies || [];
    const attachments = selectedPatient.attachments || [];
    const activeExams = selectedPatient.activeExams || [];

    const handleAddSocial = (value: string) => {
        if (!value) return;
        if (!livingWith.includes(value)) {
            handleEditPatientField('livingWith', [...livingWith, value]);
        }
    };
  
    const handleAddHistory = (type: 'medical' | 'surgical', value: string) => {
        if (!value) return;
        if (type === 'medical') {
            if (!medicalHistory.includes(value)) {
                handleEditPatientField('medicalHistory', [...medicalHistory, value]);
            }
        } else {
            if (!surgicalHistory.includes(value)) {
                handleEditPatientField('surgicalHistory', [...surgicalHistory, value]);
            }
        }
    };
  
    const handleAddMedication = () => {
        if (!tempMedication.name) return;
        const newMed: Medication = {
            id: generateId(),
            name: tempMedication.name,
            dose: tempMedication.dose || '',
            frequency: tempMedication.frequency || ''
        };
        handleEditPatientField('medications', [...medications, newMed]);
        setTempMedication({ name: '', dose: '', frequency: '' });
    };
  
    const handleAddAllergy = () => {
        if (!tempAllergy) return;
        const newAllergy: Allergy = {
            id: generateId(),
            type: 'Otro',
            substance: tempAllergy,
            reaction: ''
        };
        handleEditPatientField('allergies', [...allergies, newAllergy]);
        setTempAllergy('');
    };

    const toggleActiveExam = (examId: string) => {
        if (activeExams.includes(examId)) {
            handleEditPatientField('activeExams', activeExams.filter(id => id !== examId));
        } else {
            handleEditPatientField('activeExams', [...activeExams, examId]);
        }
    };

    // New Function to Apply Profiles
    const applyProfile = (profileId: string) => {
        const profile = availableProfiles.find(p => p.id === profileId);
        if (!profile) return;

        // Merge existing exams with profile exams, removing duplicates
        const mergedExams = Array.from(new Set([...activeExams, ...profile.exams]));
        handleEditPatientField('activeExams', mergedExams);
    };

    return (
        <aside className="lg:col-span-3 h-full overflow-y-auto bg-white border-r border-slate-200 p-6 space-y-8">
            {/* Header with Edit Toggle */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-500 text-sm uppercase tracking-wider">Ficha Clínica</h3>
                {!readOnly && (
                    <button 
                        onClick={toggleEditPatient} 
                        className={`text-sm px-4 py-2 rounded-full font-bold transition-all ${isEditingPatient ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        {isEditingPatient ? 'Guardar Cambios' : 'Editar Datos'}
                    </button>
                )}
            </div>

            {/* SEGUIMIENTO BIOLÓGICO (BIO-MARKERS) */}
            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Evolución de Exámenes</h4>
                {isEditingPatient && !readOnly ? (
                    <div className="space-y-4">
                         {/* Profile Quick Select */}
                         <div>
                             <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1"><Layers className="w-3 h-3"/> Aplicación Rápida de Perfiles</p>
                             {availableProfiles.length > 0 ? (
                                 <select 
                                    className="w-full text-xs p-2 rounded-lg border border-emerald-300 bg-white text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-200"
                                    onChange={(e) => { applyProfile(e.target.value); e.target.value = ''; }}
                                 >
                                     <option value="">+ Seleccionar Grupo...</option>
                                     {availableProfiles.map(p => (
                                         <option key={p.id} value={p.id}>{p.label}</option>
                                     ))}
                                 </select>
                             ) : (
                                 <p className="text-[10px] text-emerald-600 italic">Configure perfiles en "Configuración"</p>
                             )}
                         </div>

                         <div className="space-y-2">
                             <p className="text-xs text-emerald-600 mb-2">O selección individual:</p>
                             <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                {examOptions.filter(e => !e.readOnly).map(exam => (
                                    <button 
                                        key={exam.id} 
                                        onClick={() => toggleActiveExam(exam.id)}
                                        className={`text-xs p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${activeExams.includes(exam.id) ? 'bg-white border-emerald-400 text-emerald-700 shadow-sm' : 'bg-emerald-50/50 border-emerald-200 text-emerald-600 hover:bg-white'}`}
                                    >
                                        {exam.label}
                                        {activeExams.includes(exam.id) && <CheckCircle className="w-3 h-3 text-emerald-500"/>}
                                    </button>
                                ))}
                             </div>
                         </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {activeExams.length > 0 ? (
                            activeExams.map(id => {
                                const def = examOptions.find(e => e.id === id);
                                if(!def) return null;
                                return (
                                    <span key={id} className="text-xs bg-white text-emerald-700 px-2 py-1 rounded border border-emerald-200 font-bold">{def.label.split('(')[0]}</span>
                                )
                            })
                        ) : (
                            <p className="text-xs text-emerald-600/70 italic">No hay marcadores activos.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Social Data */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 transition-all hover:shadow-md">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Users className="w-4 h-4"/> Social</h4>
                <div className="space-y-3">
                    <div className="text-base text-slate-700">
                        <span className="font-bold block text-xs text-slate-400 uppercase">Ocupación</span>
                        {isEditingPatient && !readOnly ? (
                            <input 
                                className="w-full mt-1 p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white" 
                                value={selectedPatient.occupation || ''}
                                onChange={e => handleEditPatientField('occupation', e.target.value)}
                            />
                        ) : (
                            <span>{selectedPatient.occupation || 'No registrada'}</span>
                        )}
                    </div>
                    
                    <div className="text-base text-slate-700">
                        <span className="font-bold block text-xs text-slate-400 uppercase">Dirección</span>
                        {isEditingPatient && !readOnly ? (
                            <input 
                                className="w-full mt-1 p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white" 
                                value={selectedPatient.address || ''}
                                onChange={e => handleEditPatientField('address', e.target.value)}
                            />
                        ) : (
                            <span>{selectedPatient.address || 'No registrada'}</span>
                        )}
                    </div>

                    <div className="text-base text-slate-700">
                        <span className="font-bold block text-xs text-slate-400 uppercase">Comuna</span>
                        {isEditingPatient && !readOnly ? (
                            <select 
                                className="w-full mt-1 p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
                                value={selectedPatient.commune || ''}
                                onChange={e => handleEditPatientField('commune', e.target.value)}
                            >
                                <option value="">Seleccione...</option>
                                {MAULE_COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        ) : (
                            <span>{selectedPatient.commune || '-'}</span>
                        )}
                    </div>

                    <div className="text-base text-slate-700">
                        <span className="font-bold block text-xs text-slate-400 uppercase">Teléfono</span>
                        {isEditingPatient && !readOnly ? (
                            <input 
                                className="w-full mt-1 p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white" 
                                value={selectedPatient.phone || ''}
                                onChange={e => handleEditPatientField('phone', e.target.value)}
                            />
                        ) : (
                            <span>{selectedPatient.phone || '-'}</span>
                        )}
                    </div>

                    <div className="text-base text-slate-700">
                        <span className="font-bold block text-xs text-slate-400 uppercase">Vive Con</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {livingWith.map((person, idx) => (
                                <span key={idx} className="bg-slate-200 px-2 py-1 rounded text-xs font-bold text-slate-700 flex items-center gap-1">
                                    {person}
                                    {isEditingPatient && !readOnly && (
                                        <button onClick={() => handleEditPatientField('livingWith', livingWith.filter((_, i) => i !== idx))} className="hover:text-red-500"><X className="w-3 h-3"/></button>
                                    )}
                                </span>
                            ))}
                            {livingWith.length === 0 && <span className="text-slate-400 italic">No especificado</span>}
                        </div>
                        {isEditingPatient && !readOnly && (
                            <select 
                                className="w-full mt-2 p-2 text-sm border border-slate-300 rounded-lg bg-white outline-none focus:border-blue-500"
                                onChange={(e) => { handleAddSocial(e.target.value); e.target.value = ''; }}
                            >
                                <option value="">+ Agregar persona...</option>
                                {LIVING_WITH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        )}
                    </div>
                </div>
            </div>

            {/* Antecedentes Mórbidos */}
            <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Activity className="w-4 h-4 text-red-500"/> Patologías</h4>
                <div className="flex flex-wrap gap-2">
                    {medicalHistory.map(h => (
                        <span key={h} className="px-3 py-1.5 bg-red-50 text-red-700 text-sm font-bold rounded-lg border border-red-100 flex items-center gap-2">
                            {MEDICAL_HISTORY_OPTIONS.find(opt => opt.id === h)?.label || h}
                            {isEditingPatient && !readOnly && (
                                <button 
                                    onClick={() => handleEditPatientField('medicalHistory', medicalHistory.filter(item => item !== h))}
                                    className="text-red-500 hover:bg-red-200 rounded-full p-0.5"
                                >
                                    <X className="w-3 h-3"/>
                                </button>
                            )}
                        </span>
                    ))}
                    {!medicalHistory.length && <p className="text-sm text-slate-400 italic">Sin antecedentes.</p>}
                </div>
                {isEditingPatient && !readOnly && (
                    <select 
                        className="w-full mt-2 p-2 text-sm border border-slate-300 rounded-lg bg-white outline-none focus:border-red-500"
                        onChange={(e) => { handleAddHistory('medical', e.target.value); e.target.value = ''; }}
                    >
                        <option value="">+ Agregar Patología...</option>
                        {MEDICAL_HISTORY_OPTIONS.filter(opt => !medicalHistory.includes(opt.id)).map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Consumo de Drogas */}
            {selectedPatient.drugUse === 'Si' && (
                <div className="space-y-2 p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <h4 className="text-sm font-bold text-purple-900 flex items-center gap-2">Consumo de Drogas</h4>
                    <p className="text-slate-700 font-medium">{selectedPatient.drugDetails}</p>
                </div>
            )}

            {/* Antecedentes Quirúrgicos */}
            <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Scissors className="w-4 h-4 text-indigo-500"/> Cirugías</h4>
                <div className="flex flex-wrap gap-2">
                    {surgicalHistory.map(h => (
                        <span key={h} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-lg border border-indigo-100 flex items-center gap-2">
                            {SURGICAL_HISTORY_OPTIONS.find(opt => opt.id === h)?.label || h}
                            {isEditingPatient && !readOnly && (
                                <button 
                                    onClick={() => handleEditPatientField('surgicalHistory', surgicalHistory.filter(item => item !== h))}
                                    className="text-indigo-500 hover:bg-indigo-200 rounded-full p-0.5"
                                >
                                    <X className="w-3 h-3"/>
                                </button>
                            )}
                        </span>
                    ))}
                    {!surgicalHistory.length && <p className="text-sm text-slate-400 italic">Sin cirugías.</p>}
                </div>
                {isEditingPatient && !readOnly && (
                    <select 
                        className="w-full mt-2 p-2 text-sm border border-slate-300 rounded-lg bg-white outline-none focus:border-indigo-500"
                        onChange={(e) => { handleAddHistory('surgical', e.target.value); e.target.value = ''; }}
                    >
                        <option value="">+ Agregar Cirugía...</option>
                        {SURGICAL_HISTORY_OPTIONS.filter(opt => !surgicalHistory.includes(opt.id)).map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Archivos */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FileImage className="w-4 h-4 text-purple-500"/> Exámenes / Archivos
                    </h4>
                    {!readOnly && (
                        <label className="cursor-pointer text-purple-600 hover:text-purple-800">
                            <Plus className="w-5 h-5" />
                            <input type="file" className="hidden" onChange={onFileUpload} />
                        </label>
                    )}
                </div>
                <ul className="space-y-2">
                    {attachments.map(att => (
                        <li key={att.id} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-purple-50 rounded-lg border border-slate-100 group transition-colors">
                            <div className="flex items-center gap-2 overflow-hidden">
                                {att.type === 'image' ? <FileImage className="w-5 h-5 text-purple-500"/> : <File className="w-5 h-5 text-purple-500"/>}
                                <span className="truncate text-sm text-slate-600 w-32">{att.name}</span>
                            </div>
                            <button onClick={() => onPreviewFile(att)} className="text-slate-400 hover:text-purple-600">
                                <Eye className="w-5 h-5"/>
                            </button>
                        </li>
                    ))}
                    {!attachments.length && <p className="text-sm text-slate-400 italic">No hay archivos.</p>}
                </ul>
            </div>

            {/* Medicamentos */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Pill className="w-4 h-4 text-blue-500"/> Fármacos en uso</h4>
                <ul className="space-y-3">
                {medications.map(m => (
                    <li key={m.id} className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 relative group/med">
                        <span className="font-bold text-slate-700 block text-base">{m.name}</span>
                        <span className="text-slate-500">{m.dose} • {m.frequency}</span>
                        {isEditingPatient && !readOnly && (
                            <button 
                                onClick={() => handleEditPatientField('medications', medications.filter(med => med.id !== m.id))}
                                className="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1 bg-white rounded-full shadow-sm"
                            >
                                <X className="w-4 h-4"/>
                            </button>
                        )}
                    </li>
                ))}
                </ul>
                {isEditingPatient && !readOnly && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-2">
                        <p className="text-xs font-bold text-blue-800 mb-2">Agregar Medicamento:</p>
                        <AutocompleteInput 
                            value={tempMedication.name || ''} 
                            onChange={val => setTempMedication({...tempMedication, name: val})}
                            options={COMMON_MEDICATIONS}
                            placeholder="Nombre Fármaco"
                            className="w-full p-2 text-sm border border-blue-200 rounded mb-2 outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-2 mb-2">
                            <input className="w-1/2 p-2 text-sm border border-blue-200 rounded" placeholder="Dosis" value={tempMedication.dose} onChange={e => setTempMedication({...tempMedication, dose: e.target.value})} />
                            <input className="w-1/2 p-2 text-sm border border-blue-200 rounded" placeholder="Frecuencia" value={tempMedication.frequency} onChange={e => setTempMedication({...tempMedication, frequency: e.target.value})} />
                        </div>
                        <button onClick={handleAddMedication} className="w-full bg-blue-600 text-white py-1 rounded text-sm font-bold hover:bg-blue-700">Agregar</button>
                    </div>
                )}
            </div>
             {/* Alergias */}
             <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-yellow-600"/> Alergias</h4>
                <div className="flex flex-wrap gap-2">
                    {allergies.map(a => (
                        <span key={a.id} className="px-3 py-1.5 bg-yellow-50 text-yellow-700 text-sm font-bold rounded-lg border border-yellow-100 flex items-center gap-2" title={a.reaction}>
                            {a.substance}
                            {isEditingPatient && !readOnly && (
                                <button 
                                    onClick={() => handleEditPatientField('allergies', allergies.filter(al => al.id !== a.id))}
                                    className="text-yellow-800 hover:bg-yellow-200 rounded-full p-0.5"
                                >
                                    <X className="w-3 h-3"/>
                                </button>
                            )}
                        </span>
                    ))}
                    {!allergies.length && <p className="text-sm text-slate-400 italic">Sin alergias.</p>}
                </div>
                {isEditingPatient && !readOnly && (
                    <div className="flex gap-2 mt-2">
                        <input 
                            className="flex-1 p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-yellow-500" 
                            placeholder="Nueva alergia..."
                            value={tempAllergy}
                            onChange={e => setTempAllergy(e.target.value)}
                        />
                        <button onClick={handleAddAllergy} className="bg-yellow-500 text-white px-3 py-1 rounded-lg text-sm font-bold hover:bg-yellow-600">+</button>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default PatientSidebar;
