import { useState, useEffect, useCallback } from "react";
import { Consultation, Patient, MedicalCenter, ProfessionalRole, SnomedConcept } from "../../types";
import { generateId, sanitizeForFirestore } from "../../utils";
import { useToast } from "../../components/Toast";
import { db, auth } from "../../firebase";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { buildClinicalVersionRecord } from "../../utils/clinicalVersioning";

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
    diagnoses: [],
    prescriptions: [],
    dentalMap: [],
    exams: {},
    examSheets: [],
    nextControlDate: "",
    nextControlReason: "",
    reminderActive: false,
    consultationType: "morbidity", // Default to morbidity
  });

  const [newConsultation, setNewConsultation] =
    useState<Partial<Consultation>>(getEmptyConsultation());
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
      if (
        newConsultation.reason ||
        newConsultation.anamnesis ||
        newConsultation.diagnosis ||
        (newConsultation.diagnoses?.length || 0) > 0
      ) {
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

  const addDiagnosis = (diag: string | SnomedConcept) => {
    if (!diag) return;
    setNewConsultation((prev) => {
      const currentDiagnoses = prev.diagnoses || [];

      // Check if already exists (by code or by label)
      const exists = currentDiagnoses.some((d) => {
        if (typeof diag === "string") return d.display.toLowerCase() === diag.toLowerCase();
        return d.code === diag.code;
      });

      if (exists) return prev;

      const newConcept: SnomedConcept =
        typeof diag === "string" ? { code: "free-text", display: diag } : diag;
      const updated = [...currentDiagnoses, newConcept];

      return {
        ...prev,
        diagnoses: updated,
        diagnosis: updated.map((d) => d.display).join(" • "), // Sync with legacy string
      };
    });
  };

  const removeDiagnosis = (diag: SnomedConcept) => {
    setNewConsultation((prev) => {
      const updated = (prev.diagnoses || []).filter(
        (d) => d.code !== diag.code || d.display !== diag.display
      );
      return {
        ...prev,
        diagnoses: updated,
        diagnosis: updated.map((d) => d.display).join(" • "), // Sync with legacy string
      };
    });
  };

  const pinDiagnosis = (diag: SnomedConcept) => {
    if (!selectedPatient || !diag) return;

    const currentHistory = selectedPatient.medicalHistory || [];
    // Check if already exists (by code or by display)
    const exists = currentHistory.some((item) => {
      if (typeof item === "string") return item.toLowerCase() === diag.display.toLowerCase();
      return item.code === diag.code;
    });

    if (exists) {
      showToast("Este diagnóstico ya está en los antecedentes", "info");
      return;
    }

    const updatedPatient: Patient = {
      ...selectedPatient,
      medicalHistory: [...currentHistory, diag],
      lastUpdated: new Date().toISOString(),
    };

    onUpdatePatient(updatedPatient);
    showToast("Agregado a antecedentes morbidos", "success");
    onLogActivity(
      "update",
      `Agregó ${diag.display} a antecedentes de ${selectedPatient.fullName}`,
      selectedPatient.id
    );
  };

  const toggleChronicDiagnosis = (diag: SnomedConcept) => {
    setNewConsultation((prev) => {
      const currentDiagnoses = prev.diagnoses || [];
      const updated = currentDiagnoses.map((d) => {
        if (d.code === diag.code && d.display === diag.display) {
          return { ...d, isChronic: !d.isChronic };
        }
        return d;
      });
      return {
        ...prev,
        diagnoses: updated,
      };
    });
  };

  const handleCreateConsultation = async () => {
    console.log("💾 handleCreateConsultation called...");
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
      version: 1 as any,
      consultationType: newConsultation.consultationType || "morbidity",
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
      diagnoses: newConsultation.diagnoses || [],

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
      const consultationRef = doc(db, "patients", selectedPatient.id, "consultations", consultation.id);
      const persistedConsultation = sanitizeForFirestore({
        ...consultation,
        centerId: activeCenterId,
        patientId: selectedPatient?.id ?? null,
        createdByUid: currentUid,
        createdAt: serverTimestamp(),
      });
      await setDoc(consultationRef, persistedConsultation);
      await setDoc(
        doc(db, "patients", selectedPatient.id, "consultations", consultation.id, "versions", generateId()),
        {
          ...buildClinicalVersionRecord({
            entityType: "consultation",
            entityId: consultation.id,
            patientId: selectedPatient.id,
            centerId: activeCenterId || undefined,
            version: 1,
            actorUid: currentUid,
            actorName: doctorName || "Profesional",
            summary: "Creacion de atencion clinica",
            snapshot: sanitizeForFirestore({
              ...consultation,
              centerId: activeCenterId,
              patientId: selectedPatient.id,
              createdByUid: currentUid,
              createdAt: consultation.date,
            }),
          }),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log("✅ Consultation saved to Firestore");
      showToast("Atención guardada correctamente en la nube", "success");
    } catch (error) {
      console.error(error);
      showToast("Error al guardar en la nube (se guardó localmente)", "error");
    }

    // 2) Actualizar estado local (lista de pacientes)
    // Ensure professional is in care team and allowedUids
    const careTeamUids = Array.from(new Set([...(selectedPatient.careTeamUids || []), currentUid]));
    const allowedUids = Array.from(
      new Set([...(selectedPatient.accessControl?.allowedUids || []), currentUid])
    );
    const centerIds = Array.from(
      new Set([...(selectedPatient.accessControl?.centerIds || []), activeCenterId as string])
    );

    const updatedPatient: Patient = sanitizeForFirestore({
      ...selectedPatient,
      careTeamUids,
      accessControl: {
        ...selectedPatient.accessControl,
        allowedUids,
        centerIds,
      },
      lastConsultationAt: consultation.date,
      lastConsultationReason: consultation.reason || "",
      nextControlDate: consultation.nextControlDate || "",
      nextControlReason: consultation.nextControlReason || "",
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
    addDiagnosis,
    removeDiagnosis,
    pinDiagnosis,
    toggleChronicDiagnosis,
    handleCreateConsultation,
    getEmptyConsultation,
    clearDraft,
  };
};
