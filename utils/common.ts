export const generateId = (): string => {
    return Math.random().toString(36).substring(2, 9);
};

export const downloadJSON = (data: object, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
export const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore);
    }

    const newObj: any = {};
    Object.keys(obj).forEach((key) => {
        const val = obj[key];
        if (val !== undefined) {
            newObj[key] = sanitizeForFirestore(val);
        }
    });
    return newObj;
};
