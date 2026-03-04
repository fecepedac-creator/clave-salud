export const formatRUT = (rut: string): string => {
    const cleanRut = rut.replace(/[^0-9kK]/g, "");
    if (cleanRut.length < 2) return cleanRut;

    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1).toUpperCase();

    // Format with dots
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    return `${formattedBody}-${dv}`;
};

export const normalizeRut = (value?: string | null) =>
    String(value ?? "")
        .replace(/[^0-9kK]/g, "")
        .toUpperCase();

export const getPatientIdByRut = (rut: string): string => {
    const clean = normalizeRut(rut);
    return clean ? `p_${clean}` : "";
};

export const formatChileanPhone = (digits: string): string => {
    const clean = digits.replace(/\D/g, "").slice(0, 8);
    return clean ? `+569${clean}` : "";
};

export const extractChileanPhoneDigits = (phone: string): string => {
    const clean = phone.replace(/\D/g, "");
    if (!clean) return "";
    if (clean.startsWith("56")) {
        const rest = clean.slice(2);
        if (rest.startsWith("9")) return rest.slice(1, 9);
        return rest.slice(0, 8);
    }
    if (clean.startsWith("9") && clean.length >= 9) {
        return clean.slice(1, 9);
    }
    return clean.slice(-8);
};

export const capitalizeWords = (str: string | undefined): string => {
    if (!str) return "";
    return str.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
        return a.toUpperCase();
    });
};

/**
 * Formatea un nombre de persona con iniciales mayúsculas
 * Ejemplo: "JUAN PABLO PEREZ" -> "Juan Pablo Perez"
 * Ejemplo: "maría josé" -> "María José"
 */
export const formatPersonName = (value?: string | null): string => {
    if (!value) return "";
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/\b([a-záéíóúñü])/g, (match) => match.toUpperCase());
};

export const normalizePhone = (phone: string): string => {
    if (!phone) return "";
    // Remove spaces, dashes, parentheses
    const clean = phone.replace(/[\s\-\(\)]/g, "");

    // Basic validation/formatting for Chile (+569)
    // If user enters 912345678, make it +56912345678
    if (clean.length === 9 && clean.startsWith("9")) {
        return "+56" + clean;
    }
    // If user enters 56912345678, make it +56912345678
    if (clean.length === 11 && clean.startsWith("569")) {
        return "+" + clean;
    }

    return clean;
};

export const sanitizeText = (text: string | undefined): string => {
    if (!text) return "";
    // Removes null bytes and trims whitespace.
    return text.replace(/\u0000/g, "").trim();
};

export const getProfessionalPrefix = (role?: string): string => {
    if (!role) return "Dr(a).";
    const r = role.toUpperCase();
    if (r === "MEDICO") return "Dr(a).";
    if (r === "ODONTOLOGO") return "Dr(a).";
    if (r === "NUTRICIONISTA") return "Nut.";
    if (r === "KINESIOLOGO") return "Klgo/a.";
    if (r === "ENFERMERA" || r === "ENFERMERO") return "Enf.";
    if (r === "MATRONA" || r === "MATRON") return "Mat.";
    if (r === "PSICOLOGO") return "Ps.";
    if (r === "FONOAUDIOLOGO") return "Flgo/a.";
    if (r === "TERAPEUTA_OCUPACIONAL") return "T.O.";
    if (r === "PODOLOGO") return "Pod.";
    if (r === "PREPARADOR_FISICO") return "Prof.";
    if (r === "TECNOLOGO_MEDICO") return "T.M.";
    if (r === "QUIMICO_FARMACEUTICO") return "Q.F.";
    if (r === "ASISTENTE_SOCIAL") return "A.S.";
    if (r === "TENS") return "TENS";
    if (r.startsWith("ADMIN")) return "Admin.";
    return "Sr(a).";
};
