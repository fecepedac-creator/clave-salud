import React, { useState } from 'react';
import { Upload, Check, AlertCircle, Loader, FileJson } from 'lucide-react';
import { collection, doc, setDoc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Patient, Consultation, MedicalCenter } from '../types';
import { generateId } from '../utils';

interface MigrationModalProps {
    center: MedicalCenter;
    onClose: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({ center, onClose }) => {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, msg].slice(-10)); // Keep last 10 logs

    const processImport = async () => {
        if (!file || !center.id) return;

        setStatus('processing');
        setLogs(['Leyendo archivo JSON...']);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonContent = event.target?.result as string;
                const data = JSON.parse(jsonContent);

                if (!Array.isArray(data)) {
                    throw new Error("El formato del JSON no es válido (debe ser un array).");
                }

                setProgress({ current: 0, total: data.length });
                const batchSize = 500; // Firestore batch limit is 500, but we process one by one for safety or use small batches

                // We will process one by one to avoid complexity with large batches across patients + subcollections
                let count = 0;

                for (const item of data) {
                    const pData = item.patient;
                    const cDataList = item.consultations || [];

                    // 1. Create Patient
                    const patientId = generateId();
                    const patientRef = doc(db, "patients", patientId);

                    const consultationsForPatientArray: Consultation[] = [];

                    // Prepare Consultations
                    for (const c of cDataList) {
                        const consultId = generateId();
                        const consult: Consultation = {
                            id: consultId,
                            date: c.date === 'Unknown' ? new Date().toISOString() : new Date(c.date).toISOString(),
                            reason: c.reason || "Consulta Migrada",
                            anamnesis: c.anamnesis || "",
                            physicalExam: c.physicalExam || "",
                            diagnosis: c.diagnosis || "",
                            plan: c.plan || "",
                            exams: {}, // Map from string array if needed, logic complicated, skipping for now
                            prescriptions: [],
                            professionalName: "Migración",
                            professionalId: "migration-bot",
                            professionalRole: "MEDICO",
                            centerId: center.id,
                            patientId: patientId,
                        } as any;

                        // Add to subcollection
                        await setDoc(doc(db, "patients", patientId, "consultations", consultId), {
                            ...consult,
                            createdAt: serverTimestamp(),
                            createdByUid: auth.currentUser?.uid || 'migration'
                        });

                        consultationsForPatientArray.push(consult);
                    }

                    // Save Patient document
                    const patient: Patient = {
                        id: patientId,
                        ownerUid: auth.currentUser?.uid || "migration",
                        accessControl: {
                            allowedUids: [auth.currentUser?.uid || "migration"],
                            centerIds: center.id ? [center.id] : [],
                        },
                        centerId: center.id,
                        rut: pData.rut || "SIN-RUT",
                        fullName: pData.fullName || "Sin Nombre",
                        birthDate: pData.birthDate || "",
                        // Default fields
                        gender: "Otro",
                        medicalHistory: pData.background?.morbid || [],
                        surgicalHistory: pData.background?.surgical || [],
                        medications: pData.medications?.map((m: any) => ({
                            id: generateId(),
                            name: m.name,
                            dose: m.dose || "",
                            frequency: m.frequency || ""
                        })) || [],
                        allergies: pData.background?.allergies ? [{ id: generateId(), type: "Otro", substance: pData.background.allergies, reaction: "" }] : [],
                        consultations: consultationsForPatientArray,
                        attachments: [],
                        lastUpdated: new Date().toISOString(),
                        smokingStatus: "No fumador",
                        alcoholStatus: "No consumo",
                    } as any;

                    await setDoc(patientRef, {
                        ...patient,
                        createdAt: serverTimestamp()
                    });

                    count++;
                    setProgress({ current: count, total: data.length });
                    addLog(`✅ Importado: ${patient.fullName}`);
                }

                setStatus('success');
                addLog('🎉 ¡Migración completada!');

            } catch (error: any) {
                console.error(error);
                setStatus('error');
                addLog(`❌ Error: ${error.message}`);
            }
        };

        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        Migración de Fichas
                    </h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <Check className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto">

                    {status === 'idle' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold mb-1">Instrucciones:</p>
                                    <p>Sube el archivo <code>extracted_data.json</code> generado por el piloto.</p>
                                </div>
                            </div>

                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <FileJson className={`w-12 h-12 mb-3 ${file ? 'text-green-500' : 'text-gray-400'}`} />
                                {file ? (
                                    <div>
                                        <p className="font-medium text-gray-900">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-medium text-gray-900">Haz clic para subir JSON</p>
                                        <p className="text-xs text-gray-500">o arrastra el archivo aquí</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={processImport}
                                disabled={!file}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Comenzar Importación
                            </button>
                        </div>
                    )}

                    {status === 'processing' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <Loader className="w-10 h-10 text-blue-600 animate-spin" />
                            <div className="text-center">
                                <p className="text-lg font-semibold text-gray-900">Procesando Fichas...</p>
                                <p className="text-sm text-gray-500">{progress.current} de {progress.total}</p>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                                ></div>
                            </div>

                            <div className="w-full bg-black/80 rounded-lg p-3 font-mono text-xs text-green-400 h-32 overflow-y-auto">
                                {logs.map((log, i) => (
                                    <div key={i}>{log}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                <Check className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">¡Importación Exitosa!</h3>
                            <p className="text-gray-500 text-center">
                                Se han migrado {progress.total} pacientes correctamente a la base de datos.
                            </p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                                <AlertCircle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Error en la Importación</h3>
                            <p className="text-red-600 text-center p-3 bg-red-50 rounded-lg w-full">
                                {logs[logs.length - 1]}
                            </p>
                            <button
                                onClick={() => setStatus('idle')}
                                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
