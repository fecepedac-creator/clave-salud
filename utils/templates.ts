export const WHATSAPP_TEMPLATE_PLACEHOLDERS = [
    "{patientName}",
    "{nextControlDate}",
    "{centerName}",
] as const;

export const extractTemplatePlaceholders = (text: string): string[] => {
    if (!text) return [];
    return text.match(/\{[^}]+\}/g) ?? [];
};

export const getInvalidWhatsappPlaceholders = (text: string): string[] => {
    const allowed = new Set(WHATSAPP_TEMPLATE_PLACEHOLDERS);
    return extractTemplatePlaceholders(text).filter(
        (placeholder) => !allowed.has(placeholder as (typeof WHATSAPP_TEMPLATE_PLACEHOLDERS)[number])
    );
};

export const applyWhatsappTemplate = (
    text: string,
    values: { patientName?: string; nextControlDate?: string; centerName?: string }
): string => {
    return text
        .replace(/\{patientName\}/g, values.patientName ?? "")
        .replace(/\{nextControlDate\}/g, values.nextControlDate ?? "")
        .replace(/\{centerName\}/g, values.centerName ?? "");
};
