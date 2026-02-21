import { useState, useMemo } from "react";
import { Patient, Appointment } from "../../types";
import { normalizeRut, formatPersonName } from "../../utils";
import { useAuditLog } from "../useAuditLog";
import { useToast } from "../../components/Toast";

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
    const handleOpenPatientFromAppointment = (appointment: Appointment, setActiveTab: (tab: any) => void) => {
        const foundById = appointment.patientId
            ? patients.find((patient) => patient.id === appointment.patientId)
            : null;
        const appointmentRut = normalizeRut(appointment.patientRut);
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

        showToast("Paciente no encontrado; revisa si fue creado", "warning");
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
