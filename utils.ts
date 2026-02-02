import { AgendaConfig } from "./types";

export const formatRUT = (rut: string): string => {
  const cleanRut = rut.replace(/[^0-9kK]/g, "");
  if (cleanRut.length < 2) return cleanRut;

  const body = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1).toUpperCase();

  // Format with dots
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${formattedBody}-${dv}`;
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

export const validateRUT = (rut: string): boolean => {
  if (!rut) return false;

  const cleanRut = rut.replace(/[^0-9kK]/g, "");
  if (cleanRut.length < 2) return false;

  const body = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1).toUpperCase();

  // Validate body is a number
  if (!/^\d+$/.test(body)) return false;

  let suma = 0;
  let multiplo = 2;

  for (let i = 1; i <= body.length; i++) {
    const index = multiplo * parseInt(body.charAt(body.length - i));
    suma = suma + index;
    if (multiplo < 7) {
      multiplo = multiplo + 1;
    } else {
      multiplo = 2;
    }
  }

  const dvEsperado = 11 - (suma % 11);
  let dvCalculado = "";

  if (dvEsperado === 11) {
    dvCalculado = "0";
  } else if (dvEsperado === 10) {
    dvCalculado = "K";
  } else {
    dvCalculado = dvEsperado.toString();
  }

  return dv === dvCalculado;
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

// --- MEDICAL CALCULATIONS ---

/**
 * Calculates Estimated GFR using MDRD Formula
 * GFR = 175 × (Scr)^-1.154 × (Age)^-0.203 × (0.742 if female) × (1.212 if African American)
 */
export const calculateMDRD = (creatinine: number, age: number, gender: string): number | null => {
  if (!creatinine || creatinine <= 0 || !age) return null;

  let gfr = 175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203);

  if (gender === "Femenino") {
    gfr *= 0.742;
  }

  return parseFloat(gfr.toFixed(1));
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
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

// --- AGENDA HELPERS ---

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
export const getStandardSlots = (date: string, doctorId: string, config?: AgendaConfig): any[] => {
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
    id: generateId(),
    doctorId,
    date,
    time,
    status: "available",
    patientName: "",
    patientRut: "",
  }));
};

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

// --------------------
// Roles / permisos
// --------------------
import type { AnyRole, CanonicalRole } from "./types";

export function normalizeRole(role: unknown): CanonicalRole | null {
  if (!role) return null;
  const r = String(role).trim();

  // Canonical
  if (r === "super_admin" || r === "center_admin" || r === "admin" || r === "doctor")
    return r as CanonicalRole;

  // Common legacy variants
  const upper = r.toUpperCase();
  if (upper === "SUPERADMIN" || upper === "SUPER_ADMIN") return "super_admin";
  if (upper === "CENTER_ADMIN" || upper === "ADMIN_CENTRO") return "center_admin";
  if (upper === "ADMIN" || upper === "ADMINISTRADOR") return "admin";
  if (upper === "MEDICO") return "doctor";

  return null;
}

export function normalizeRoles(input: unknown): CanonicalRole[] {
  const arr = Array.isArray(input) ? input : input ? [input] : [];
  const out: CanonicalRole[] = [];
  for (const x of arr) {
    const n = normalizeRole(x);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export function hasRole(
  roles: AnyRole[] | CanonicalRole[] | undefined | null,
  required: CanonicalRole
): boolean {
  if (!roles) return false;
  const norm = normalizeRoles(roles as any);
  return norm.includes(required);
}

// --------------------
// Email helpers (Gmail compose + mailto fallback)
// --------------------

export function buildMailtoUrl(params: {
  to?: string;
  subject?: string;
  body?: string;
}): string {
  const to = (params.to || "").trim();
  const qs = new URLSearchParams();
  if (params.subject) qs.set("subject", params.subject);
  if (params.body) qs.set("body", params.body);
  const q = qs.toString();
  return `mailto:${encodeURIComponent(to)}${q ? `?${q}` : ""}`;
}

export function buildGmailComposeUrl(params: {
  to?: string;
  subject?: string;
  body?: string;
}): string {
  const qs = new URLSearchParams();
  // Gmail supports: view=cm, fs=1, to, su, body
  qs.set("view", "cm");
  qs.set("fs", "1");
  if (params.to) qs.set("to", params.to);
  if (params.subject) qs.set("su", params.subject);
  if (params.body) qs.set("body", params.body);
  return `https://mail.google.com/mail/?${qs.toString()}`;
}

/**
 * Tries to open Gmail compose in a new tab, with mailto fallback.
 * Returns true if it likely opened a new window/tab.
 */
export function openEmailCompose(params: {
  to?: string;
  subject?: string;
  body?: string;
}): boolean {
  try {
    const gmailUrl = buildGmailComposeUrl(params);
    const w = window.open(gmailUrl, "_blank", "noopener,noreferrer");
    if (w) return true;
  } catch {
    // ignore
  }

  try {
    window.location.href = buildMailtoUrl(params);
    return true;
  } catch {
    return false;
  }
}

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
