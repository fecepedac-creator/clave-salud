import { AgendaConfig } from "../types";
import { generateId } from "./common";

/** Genera un ID determinista para un bloque de agenda. */
export const generateSlotId = (centerId: string, doctorId: string, date: string, time: string): string => {
    // Formato: slot_centerId_doctorId_date_time
    // Reemplazamos caracteres que puedan dar problemas en IDs si es necesario, 
    // aunque Firestore acepta casi todo.
    return `slot_${centerId}_${doctorId}_${date}_${time.replace(":", "")}`;
};

export const calculateAge = (birthDate?: string | null): number | null => {
    if (!birthDate) return null;

    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

export const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = [];
    for (let i = 0; i < startingDay; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }
    return days;
};

// Returns fixed slots based on config
export const getStandardSlots = (
    date: string,
    doctorId: string,
    centerId: string, // Added centerId for deterministic IDs
    config?: AgendaConfig
): any[] => {
    // Defaults range widened to 08:00 - 21:00 per requirement
    const startStr = config?.startTime || "08:00";
    const endStr = config?.endTime || "21:00";
    const interval = config?.slotDuration || 20;

    const times: string[] = [];

    // Create Date objects for comparison using arbitrary date
    const current = new Date(`2000-01-01T${startStr}:00`);
    const end = new Date(`2000-01-01T${endStr}:00`);

    while (current < end) {
        const hours = current.getHours().toString().padStart(2, "0");
        const minutes = current.getMinutes().toString().padStart(2, "0");
        times.push(`${hours}:${minutes}`);

        // Add interval
        current.setMinutes(current.getMinutes() + interval);
    }

    return times.map((time) => ({
        id: generateSlotId(centerId, doctorId, date, time),
        doctorId,
        date,
        time,
        status: "available",
        patientName: "",
        patientRut: "",
    }));
};
