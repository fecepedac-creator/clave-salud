import { useState, useEffect, useCallback } from "react";
import { Consultation, Patient, AuditLogEntry, MedicalCenter, ProfessionalRole } from "../../types";
import { generateId, sanitizeForFirestore } from "../../utils";
import { useToast } from "../../components/Toast";
import { db, auth } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface UseConsultationLogicProps {
    selectedPatient: Patient | null;
    activeCenterId: string | null;
    activeCenter?: MedicalCenter | null;
    hasActiveCenter: boolean;
    doctorId: string;
    doctorName: string;
    role: ProfessionalRole;
    onUpdatePatient: (patient: Patient) => void;
    onLogActivity: (action: any, details: string, targetId?: string) => void;
    setActiveTab: (tab: any) => void;
}

export const useConsultationLogic = ({
    selectedPatient,
    activeCenterId,
    activeCenter,
    hasActiveCenter,
    doctorId,
    doctorName,
    role,
    onUpdatePatient,
    onLogActivity,
    setActiveTab,
}: UseConsultationLogicProps) => {
    const { showToast } = useToast();

    const getEmptyConsultation = (): Partial<Consultation> => ({
        weight: "",
        height: "",
        bmi: "",
        bloodPressure: "",
        hgt: "",
        waist: "",
        hip: "",
        reason: "",
        anamnesis: "",
        physicalExam: "",
        diagnosis: "",
        prescriptions: [],
        dentalMap: [],
        exams: {},
        examSheets: [],
        nextControlDate: "",
        nextControlReason: "",
        reminderActive: false,
    });

    const [newConsultation, setNewConsultation] = useState<Partial<Consultation>>(getEmptyConsultation());
    const [isCreatingConsultation, setIsCreatingConsultation] = useState(false);

    // Auto-Save Draft Logic
    const DRAFT_KEY = selectedPatient ? `consultation_draft_${selectedPatient.id}` : null;

    useEffect(() => {
        // Cargar draft inicial si existe
        if (DRAFT_KEY) {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft);
                    // Solo restaurar si tiene al menos algun campo con datos relevantes
                    if (parsed.reason || parsed.anamnesis || parsed.physicalExam || parsed.diagnosis) {
                        setNewConsultation(parsed);
                        showToast("Borrador recuperado", "info");
                    }
                } catch (e) {
                    console.error("Error parseando borrador", e);
                }
            }
        }
    }, [DRAFT_KEY]);

    // Usar timeout para debouncing del guardado local
    useEffect(() => {
        if (!DRAFT_KEY) return;
        const handler = setTimeout(() => {
            // Guardar solo si hay algo escrito que valga la pena (motivo, anamnesis, diagnostico)
            if (newConsultation.reason || newConsultation.anamnesis || newConsultation.diagnosis) {
                localStorage.setItem(DRAFT_KEY, JSON.stringify(newConsultation));
            }
        }, 1500); // 1.5s de inactividad para guardar

        return () => clearTimeout(handler);
    }, [newConsultation, DRAFT_KEY]);

    const clearDraft = useCallback(() => {
        if (DRAFT_KEY) {
            localStorage.removeItem(DRAFT_KEY);
        }
    }, [DRAFT_KEY]);

    // Vitals logic
    const handleVitalsChange = (field: keyof Consultation, value: string) => {
        let finalValue = value;

        if (field === "bloodPressure") {
            const rawNumbers = value.replace(/\D/g, "");
            if (rawNumbers.length > 6) return;
            if (rawNumbers.length >= 4) {
                finalValue = `${rawNumbers.slice(0, -2)}/${rawNumbers.slice(-2)}`;
            } else {
                finalValue = rawNumbers;
            }
        }

        setNewConsultation((prev) => {
            const updated = { ...prev, [field]: finalValue };
            if (field === "weight" || field === "height") {
                const weight = parseFloat(updated.weight || "0");
                const height = parseFloat(updated.height || "0") / 100;
                if (weight > 0 && height > 0) {
                    updated.bmi = (weight / (height * height)).toFixed(1);
                }
            }
            return updated;
        });
    };

    const handleExamChange = (examId: string, value: string) => {
        setNewConsultation((prev) => ({
            ...prev,
            exams: { ...prev.exams, [examId]: value },
        }));
    };

    const addPrescription = (doc: any) => {
        setNewConsultation((prev) => ({
            ...prev,
            prescriptions: [...(prev.prescriptions || []), doc],
        }));
    };

    const removePrescription = (id: string) => {
        setNewConsultation((prev) => ({
            ...prev,
            prescriptions: prev.prescriptions?.filter((p) => p.id !== id),
        }));
    };

    const handleCreateConsultation = async () => {
        if (!selectedPatient) return;

        if (!hasActiveCenter) {
            showToast("Selecciona un centro activo antes de guardar.", "warning");
            return;
        }

        // Construye un objeto consulta (local + nube) con mapeo explícito para evitar undefined
        const currentUid = auth.currentUser?.uid || doctorId;
        const consultation: Consultation = {
            id: generateId(),
            date: new Date().toISOString(),
            // Vitals & Anthropometry
            weight: newConsultation.weight || "",
            height: newConsultation.height || "",
            bmi: newConsultation.bmi || "",
            bloodPressure: newConsultation.bloodPressure || "",
            heartRate: newConsultation.heartRate || "",
            hgt: newConsultation.hgt || "",
            waist: newConsultation.waist || "",
            hip: newConsultation.hip || "",

            // Clinical Data
            reason: newConsultation.reason || "",
            anamnesis: newConsultation.anamnesis || "",
            physicalExam: newConsultation.physicalExam || "",
            diagnosis: newConsultation.diagnosis || "",

            // Special Modules
            prescriptions: (newConsultation.prescriptions || []) as any,
            dentalMap: (newConsultation.dentalMap || []) as any,
            podogram: (newConsultation.podogram || []) as any,
            exams: (newConsultation.exams || {}) as any,
            examSheets: (newConsultation.examSheets || []) as any,

            // Control
            nextControlDate: newConsultation.nextControlDate || "",
            nextControlReason: newConsultation.nextControlReason || "",
            reminderActive: Boolean(newConsultation.reminderActive),

            // Context
            patientId: selectedPatient.id,
            centerId: activeCenterId || "",
            centerName: activeCenter?.name || "", // NEW
            professionalName: doctorName || "Profesional",
            professionalId: currentUid,
            professionalRole: role,
        } as any;

        // 1) Guardar en Firestore (colección "consultations")
        try {
            if (!selectedPatient?.id) throw new Error("Paciente no seleccionado");
            await addDoc(collection(db, "patients", selectedPatient.id, "consultations"), sanitizeForFirestore({
                ...consultation,
                centerId: activeCenterId,
                patientId: selectedPatient?.id ?? null,
                createdByUid: currentUid,
                createdAt: serverTimestamp(),
            }));
            showToast("Atención guardada correctamente en la nube", "success");
        } catch (error) {
            console.error(error);
            showToast("Error al guardar en la nube (se guardó localmente)", "error");
        }

        // 2) Actualizar estado local (lista de pacientes)
        // Ensure professional is in care team and allowedUids
        const careTeamUids = Array.from(new Set([...(selectedPatient.careTeamUids || []), currentUid]));
        const allowedUids = Array.from(new Set([...(selectedPatient.accessControl?.allowedUids || []), currentUid]));
        const centerIds = Array.from(new Set([...(selectedPatient.accessControl?.centerIds || []), activeCenterId as string]));

        const updatedPatient: Patient = sanitizeForFirestore({
            ...selectedPatient,
            careTeamUids,
            accessControl: {
                ...selectedPatient.accessControl,
                allowedUids,
                centerIds
            },
            consultations: [consultation, ...(selectedPatient.consultations || [])],
            lastUpdated: new Date().toISOString(),
        });

        onUpdatePatient(updatedPatient);

        // 3) Auditoría
        try {
            onLogActivity(
                "create",
                `Creó atención para ${selectedPatient.fullName}. Motivo: ${(consultation as any).reason || ""}`,
                selectedPatient.id
            );
        } catch {
            // no-op
        }

        // 4) Reset UI & Clear Draft
        clearDraft();
        setIsCreatingConsultation(false);
        setNewConsultation(getEmptyConsultation());
        setActiveTab("patients");

        return updatedPatient; // Return so the consumer can update selectedPatient
    };

    return {
        newConsultation,
        setNewConsultation,
        isCreatingConsultation,
        setIsCreatingConsultation,
        handleVitalsChange,
        handleExamChange,
        addPrescription,
        removePrescription,
        handleCreateConsultation,
        getEmptyConsultation,
        clearDraft,
    };
};
