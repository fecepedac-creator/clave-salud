import QRCode from 'qrcode';
import { MedicalCenter, Doctor, Appointment } from '../types';

export type FlyerFormat = 'instagram-post' | 'instagram-story' | 'facebook-post';
export type FlyerType = 'platform' | 'center' | 'professional';

export interface FlyerDimensions {
    width: number;
    height: number;
}

export const FLYER_DIMENSIONS: Record<FlyerFormat, FlyerDimensions> = {
    'instagram-post': { width: 1080, height: 1080 },
    'instagram-story': { width: 1080, height: 1920 },
    'facebook-post': { width: 1200, height: 630 },
};

export const LEGAL_DISCLAIMER = 'Atención sujeta a disponibilidad de horas. Agenda con anticipación.';

/**
 * Genera un código QR como Data URL
 */
export async function generateQRCode(url: string): Promise<string> {
    try {
        return await QRCode.toDataURL(url, {
            width: 200,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
        });
    } catch (error) {
        console.error('Error generating QR code:', error);
        return '';
    }
}

/**
 * Genera hashtags relevantes basados en especialidades
 */
export function generateHashtags(
    type: FlyerType,
    specialty?: string,
    centerName?: string
): string[] {
    const baseHashtags = ['#Salud', '#Bienestar', '#ClaveSalud'];

    if (type === 'platform') {
        return [...baseHashtags, '#FichaDigital', '#TecnologíaMédica', '#SaludDigital'];
    }

    const specialtyHashtags: Record<string, string[]> = {
        'Médico': ['#MedicinaGeneral', '#Médico'],
        'Kinesiólogo': ['#Kinesiología', '#RehabilitaciónFísica'],
        'Psicólogo': ['#Psicología', '#SaludMental'],
        'Nutricionista': ['#Nutrición', '#AlimentaciónSaludable'],
        'Odontólogo': ['#Odontología', '#SaludDental'],
        'Podólogo': ['#Podología', '#SaludPodal'],
        'Enfermera': ['#Enfermería', '#CuidadoProfesional'],
        'TENS': ['#TENS', '#TécnicoEnfermería'],
        'Fonoaudiólogo': ['#Fonoaudiología', '#Lenguaje'],
        'Terapeuta Ocupacional': ['#TerapiaOcupacional'],
        'Tecnólogo Médico': ['#TecnologíaMédica'],
        'Asistente Social': ['#AsistenciaSocial'],
        'Preparador Físico': ['#PreparaciónFísica', '#Deporte'],
        'Matrona': ['#Maternidad', '#SaludFemenina'],
        'Químico Farmacéutico': ['#Farmacia', '#Medicamentos'],
    };

    const tags = [...baseHashtags];

    if (specialty && specialtyHashtags[specialty]) {
        tags.push(...specialtyHashtags[specialty]);
    }

    if (type === 'center') {
        tags.push('#CentroMédico', '#AtenciónProfesional');
    } else if (type === 'professional') {
        tags.push('#AgendaTuHora', '#AtenciónPersonalizada');
    }

    return tags.slice(0, 10); // Máximo 10 hashtags
}

/**
 * Genera el caption automático para redes sociales
 */
export function generateCaption(params: {
    type: FlyerType;
    centerName?: string;
    centerPhone?: string;
    centerAddress?: string;
    specialties?: string[];
    doctorName?: string;
    doctorSpecialty?: string;
    availableDates?: { date: string; times: string[] }[];
    url: string;
}): string {
    const { type, centerName, centerPhone, centerAddress, specialties, doctorName, doctorSpecialty, availableDates, url } = params;

    if (type === 'platform') {
        return `🏥 ClaveSalud - Plataforma de Ficha Clínica Digital

Moderniza la gestión de tu centro médico con:
✅ Fichas clínicas digitales
✅ Agenda inteligente
✅ Recetas electrónicas
✅ Gestión multi-profesional

👉 Más info: ${url}

${generateHashtags(type).join(' ')}`;
    }

    if (type === 'center' && centerName) {
        const specialtyList = specialties && specialties.length > 0
            ? specialties.map(s => `✅ ${s}`).join('\n')
            : '';

        return `🏥 ${centerName}

${centerName === 'Centro Médico' ? 'Tu salud, nuestra prioridad' : ''}${specialtyList ? '\n\nContamos con:\n' + specialtyList : ''}${centerPhone ? '\n\n📞 Contacto: ' + centerPhone : ''}${centerAddress ? '\n📍 Ubicación: ' + centerAddress : ''}

👉 Agenda tu hora aquí: ${url}

${generateHashtags(type, specialties?.[0], centerName).join(' ')}`;
    }

    if (type === 'professional' && doctorName && doctorSpecialty) {
        const datesList = availableDates && availableDates.length > 0
            ? availableDates
                .slice(0, 3)
                .map(d => `📅 ${d.date} → ${d.times.join(', ')}`)
                .join('\n')
            : '';

        return `👨‍⚕️ ${doctorName}
${doctorSpecialty}

🗓️ HORAS DISPONIBLES:${datesList ? '\n' + datesList : ' Consulta disponibilidad actualizada'}

${centerName ? `📍 ${centerName}\n` : ''}👉 Agenda ahora: ${url}

${generateHashtags(type, doctorSpecialty).join(' ')}`;
    }

    return `Agenda tu hora en:\n${url}\n\n${generateHashtags(type).join(' ')}`;
}

/**
 * Genera la URL de agendamiento según el contexto
 */
export function generateBookingURL(centerId: string, doctorId?: string): string {
    const baseURL = 'https://clavesalud-2.web.app';

    if (doctorId) {
        return `${baseURL}?center=${centerId}&doctor=${doctorId}`;
    }

    return `${baseURL}?center=${centerId}`;
}

/**
 * Obtiene horas disponibles de un profesional agrupadas por fecha
 */
export function getAvailableSlots(
    appointments: Appointment[],
    doctorId: string
): { date: string; times: string[] }[] {
    const slots = appointments
        .filter(apt => apt.doctorId === doctorId && apt.status === 'available')
        .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });

    const grouped: Record<string, string[]> = {};

    slots.forEach(slot => {
        if (!grouped[slot.date]) {
            grouped[slot.date] = [];
        }
        grouped[slot.date].push(slot.time);
    });

    return Object.entries(grouped)
        .slice(0, 5) // Máximo 5 fechas
        .map(([date, times]) => ({
            date: formatDate(date),
            times: times.slice(0, 4), // Máximo 4 horas por fecha
        }));
}

/**
 * Formatea fecha YYYY-MM-DD a "Lunes 17 Feb"
 */
function formatDate(dateStr: string): string {
    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);

        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        return `${dayNames[date.getDay()]} ${day} ${monthNames[month - 1]}`;
    } catch {
        return dateStr;
    }
}

/**
 * Extrae especialidades únicas de la lista de doctores
 */
export function extractSpecialties(doctors: Doctor[]): string[] {
    const specialties = new Set(doctors.map(d => d.specialty).filter(Boolean));
    return Array.from(specialties).sort();
}
