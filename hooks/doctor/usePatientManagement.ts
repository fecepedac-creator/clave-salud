import { useState, useMemo } from "react";
import { Patient, Appointment } from "../../types";
import { normalizeRut, formatPersonName, getPatientIdByRut } from "../../utils";
import { useAuditLog } from "../useAuditLog";
import { useToast } from "../../components/Toast";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

interface UsePatientManagementProps {
    patients: Patient[];
    activeCenterId: string | null;
    onUpdatePatient: (patient: Patient) => void;
    onLogActivity: (action: any, details: string, targetId?: string) => void;
    filterNextControl?: "all" | "week" | "month";
}

export const usePatientManagement = ({
    patients,
    activeCenterId,
    onUpdatePatient,
    onLogActivity,
    filterNextControl,
}: UsePatientManagementProps) => {
    const { showToast } = useToast();
    const { logAccess } = useAuditLog();

    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [isEditingPatient, setIsEditingPatient] = useState(false);

    // Filter Patients
    const filteredPatients = useMemo(() => {
        let result = patients;

        // 1. Next Control Filter
        if (filterNextControl && filterNextControl !== "all") {
            const now = new Date();
            const horizon = new Date();
            if (filterNextControl === "week") horizon.setDate(now.getDate() + 7);
            else if (filterNextControl === "month") horizon.setDate(now.getDate() + 30);

            result = result.filter((p) => {
                const lastConsult = p.consultations?.[0]; // Assumes sorted by sync or logic
                if (!lastConsult?.nextControlDate) return false;
                const nextDate = new Date(lastConsult.nextControlDate + "T12:00:00");
                return nextDate >= now && nextDate <= horizon;
            });
        }

        // 2. Search Filter
        if (!searchTerm) return result;
        const lower = searchTerm.toLowerCase();
        return result.filter((p) =>
            (p.fullName?.toLowerCase() || "").includes(lower) ||
            (p.rut?.toLowerCase() || "").includes(lower) ||
            (p.email?.toLowerCase() || "").includes(lower)
        );
    }, [patients, searchTerm, filterNextControl]);

    // Handle Patient Selection with Audit Log
    const handleSelectPatient = async (patient: Patient) => {
        setSelectedPatient(patient);

        // Log patient access for audit trail (DS 41 MINSAL)
        if (activeCenterId && patient.id) {
            try {
                await logAccess({
                    centerId: activeCenterId,
                    resourceType: "patient",
                    resourcePath: `patients/${patient.id}`,
                    patientId: patient.id,
                });
            } catch (error) {
                // Silently fail - audit logging should not block user workflow
                console.error("Failed to log patient access:", error);
            }
        }
    };

    // Handle Saving Patient Changes
    const handleSavePatient = () => {
        if (!selectedPatient) return;
        try {
            onUpdatePatient(selectedPatient);
            onLogActivity(
                "update",
                `Actualizó datos ficha de ${selectedPatient.fullName}`,
                selectedPatient.id
            );
            showToast("Datos guardados correctamente.", "success");
        } catch (err) {
            console.error("Error saving patient:", err);
            showToast("Error al guardar (revise consola)", "error");
        }
        setIsEditingPatient(false);
    };

    // Logic to open patient from an appointment click
    const handleOpenPatientFromAppointment = async (appointment: Appointment, setActiveTab: (tab: any) => void) => {
        const foundById = appointment.patientId
            ? patients.find((patient) => patient.id === appointment.patientId)
            : null;

        const appointmentRut = normalizeRut(appointment.patientRut);
        const deterministicId = getPatientIdByRut(appointmentRut);

        const foundByRut =
            !foundById && appointmentRut
                ? patients.find((patient) => normalizeRut(patient.rut) === appointmentRut)
                : null;

        const resolvedPatient = foundById ?? foundByRut ?? null;

        if (resolvedPatient) {
            handleSelectPatient(resolvedPatient);
            setActiveTab("patients");
            return;
        }

        // IMPROVEMENT: If not found in local list, attempt to link/fetch it
        if (activeCenterId && appointmentRut) {
            const patientId = appointment.patientId || deterministicId;
            showToast("Sincronizando acceso a ficha...", "info");

            try {
                const functions = getFunctions();
                const linkFn = httpsCallable(functions, "linkPatientToProfessional");
                await linkFn({ centerId: activeCenterId, patientId });

                // If link successful, try getting the doc (professional should have access now)
                const patSnap = await getDoc(doc(db, "patients", patientId));
                if (patSnap.exists()) {
                    const linkedPatient = { id: patSnap.id, ...(patSnap.data() as any) };
                    // Optionally update local state or just select it
                    handleSelectPatient(linkedPatient);
                    setActiveTab("patients");
                    showToast("Acceso sincronizado correctamente.", "success");
                    return;
                }
            } catch (err) {
                console.error("Link patient failed:", err);
            }
        }

        showToast("Paciente no encontrado; contacta soporte si el problema persiste", "warning");
    };

    return {
        selectedPatient,
        setSelectedPatient,
        searchTerm,
        setSearchTerm,
        isEditingPatient,
        setIsEditingPatient,
        filteredPatients,
        handleSelectPatient,
        handleSavePatient,
        handleOpenPatientFromAppointment,
    };
};
