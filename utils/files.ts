/**
 * Optimizes file handling:
 * 1. Compresses Images (Resize + JPEG Quality) to prevent huge DB payloads.
 * 2. Checks PDF size limits (Max 0.8MB to fit in 1MB Firestore Doc).
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        // 1. Handle PDFs (Strict Size Limit for Firestore)
        if (file.type === "application/pdf") {
            // Firestore limit is 1MB total. Base64 adds ~33%.
            // So 0.8MB file becomes ~1.06MB string (danger zone).
            // Let's set it to roughly 750KB to be safe with other data.
            const MAX_PDF_SIZE = 750 * 1024; // ~750KB

            if (file.size > MAX_PDF_SIZE) {
                reject(
                    new Error(
                        "El PDF es muy pesado. Si es un escaneo, por favor suba fotos (JPG) en su lugar, o comprima el PDF a menos de 750KB."
                    )
                );
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
            return;
        }

        // 2. Handle Images (Compression)
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    // Create canvas for resizing
                    const canvas = document.createElement("canvas");
                    const MAX_WIDTH = 1024; // Max width reasonable for docs
                    const scaleSize = MAX_WIDTH / img.width;

                    // Calculate new dimensions
                    const newWidth = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
                    const newHeight = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;

                    canvas.width = newWidth;
                    canvas.height = newHeight;

                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        // Fill with white background first to handle transparency in PNGs
                        ctx.fillStyle = "#FFFFFF";
                        ctx.fillRect(0, 0, newWidth, newHeight);

                        ctx.drawImage(img, 0, 0, newWidth, newHeight);
                        // Compress to JPEG at 70% quality
                        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
                        resolve(compressedDataUrl);
                    } else {
                        reject(new Error("Error al procesar imagen."));
                    }
                };
                img.onerror = () => reject(new Error("Error al cargar la imagen."));
            };
            reader.onerror = (error) => reject(error);
            return;
        }

        // Fallback for other files
        reject(new Error("Formato no soportado. Solo PDF o Imágenes."));
    });
};

/**
 * Converts a Base64 string back into a Blob object.
 * This allows creating safe Object URLs (blob:...) that Chrome doesn't block.
 */
export const base64ToBlob = (dataURI: string): Blob => {
    try {
        // Split metadata from data (e.g. "data:application/pdf;base64," from "JVBER...")
        const split = dataURI.split(",");
        const byteString = atob(split[1]);
        const mimeString = split[0].split(":")[1].split(";")[0];

        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    } catch (e) {
        console.error("Error converting Base64 to Blob", e);
        return new Blob([]);
    }
};
