import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  GoogleGenerativeAI,
  SchemaType,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Inicializar admin una sola vez
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const MAX_AGENT_TURNS = 5; // Máximo de tool calls por mensaje (evitar loops)
const MAX_HISTORY_MESSAGES = 10; // Máximo de mensajes previos enviados a Gemini
const CONVERSATION_TTL_HOURS = 4; // Expira conversaciones inactivas

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY || "";
    if (!key) {
      console.error("[Config] GEMINI_API_KEY no disponible — verificar Firebase Secrets");
      // No cachear si no hay key
      return new GoogleGenerativeAI("");
    }
    _genAI = new GoogleGenerativeAI(key); // El SDK por defecto usa v1
  }
  return _genAI;
}
function getWhatsappToken(): string {
  const token = process.env.WHATSAPP_TOKEN || "";
  if (!token) console.error("[Config] WHATSAPP_TOKEN no disponible — verificar Firebase Secrets");
  return token;
}

// ─── CIFRADO AES-256 PARA TOKENS DE META ─────────────────────────────────────
// Los Access Tokens de Meta se cifran antes de almacenar en Firestore.
// La llave simétrica se guarda exclusivamente en Firebase Secrets como
// ENCRYPTION_KEY (64 hex chars = 32 bytes = AES-256).
import * as cryptoNode from "crypto";

const ENCRYPTION_ALGO = "aes-256-cbc" as const;
const IV_LENGTH = 16; // bytes

function getEncryptionKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (!raw || raw.length !== 64) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[Crypto] ENCRYPTION_KEY no configurada o inválida. " +
        "Los tokens se leerán como texto plano (modo compatibilidad)."
      );
    }
    return null;
  }
  return Buffer.from(raw, "hex");
}

/** Cifra un texto y devuelve "iv:ciphertext" en hex. */
export function encryptToken(plainText: string): string {
  const key = getEncryptionKey();
  if (!key) return plainText; // Fallback: devuelve sin cifrar si no hay key
  const iv = cryptoNode.randomBytes(IV_LENGTH);
  const cipher = cryptoNode.createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/** Descifra un valor "iv:ciphertext" o lo devuelve tal cual si no tiene el formato. */
export function decryptToken(storedValue: string): string {
  if (!storedValue) return storedValue;
  // Si no tiene el separador, asumimos texto plano (tokens legacy sin cifrar)
  if (!storedValue.includes(":")) return storedValue;
  const key = getEncryptionKey();
  if (!key) return storedValue; // Sin key no podemos descifrar → devolver raw
  try {
    const [ivHex, encryptedHex] = storedValue.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = cryptoNode.createDecipheriv(ENCRYPTION_ALGO, key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (e) {
    console.error("[Crypto] Error descifrando token:", e);
    return storedValue; // Fallback seguro: devolver el valor almacenado
  }
}

// ─── CACHE POR CENTRO (multi-centro) ─────────────────────────────────────────
interface CenterCache {
  center: any;
  staff: any[];
  lastUpdate: number;
}
const centerCache: Record<string, CenterCache> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

async function getCenterByPhoneId(
  phoneNumberId: string
): Promise<{ center: any; staff: any[] } | null> {
  const now = Date.now();

  for (const cached of Object.values(centerCache)) {
    if (
      cached.center?.whatsappConfig?.phoneNumberId === phoneNumberId &&
      now - cached.lastUpdate < CACHE_TTL
    ) {
      return { center: cached.center, staff: cached.staff };
    }
  }

  const cleanId = phoneNumberId.trim();
  try {
    const snap = await db
      .collection("centers")
      .where("whatsappConfig.phoneNumberId", "==", cleanId)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn(`[Chatbot] No se encontró centro para phoneNumberId=${phoneNumberId}`);
      return null;
    }

    const centerDoc = snap.docs[0];
    const center: any = { id: centerDoc.id, ...centerDoc.data() };

    // Descifrar el Access Token de Meta al cargarlo (compatibilidad con tokens legacy en texto plano)
    if (center.whatsappConfig?.accessToken) {
      center.whatsappConfig = {
        ...center.whatsappConfig,
        accessToken: decryptToken(center.whatsappConfig.accessToken),
      };
    }

    const staffSnap = await db
      .collection("centers")
      .doc(center.id)
      .collection("staff")
      .where("visibleInBooking", "==", true)
      .where("active", "==", true)
      .get();
    const staff = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    centerCache[center.id] = { center, staff, lastUpdate: now };
    console.log(`[Chatbot] Centro cargado: ${center.name} (${center.id}), staff: ${staff.length}`);
    return { center, staff };
  } catch (error) {
    console.error("[Chatbot] Error cargando centro por phoneNumberId:", error);
    return null;
  }
}

// ─── LOOKUP DE STAFF POR TELÉFONO (para Modo Doctor) ─────────────────────────

async function getStaffByPhone(
  senderPhone: string,
  centerId: string
): Promise<{ id: string; name: string; specialty: string } | null> {
  // Normalizar número: WhatsApp siempre envía en formato 569XXXXXXXX (sin +)
  const variants = [
    senderPhone,                              // "56912345678" (como viene de Meta)
    senderPhone.replace(/^56/, ""),           // "912345678" (formato corto)
    senderPhone.length === 8 ? "569" + senderPhone : null, // fallback para 8 dígitos
  ].filter(Boolean) as string[];

  const staffRef = db.collection("centers").doc(centerId).collection("staff");
  for (const variant of variants) {
    const snap = await staffRef.where("phone", "==", variant).where("active", "==", true).limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      return {
        id: snap.docs[0].id,
        name: data.fullName || data.name || "Profesional",
        specialty: data.specialty || data.clinicalRole || "Profesional de Salud",
      };
    }
  }
  return null;
}



interface AgentLogEntry {
  turn: number;
  tool: string;
  args: any;
  result: any;
  timestamp: string;
}

interface AgentConversation {
  centerId?: string;
  centerName?: string;
  patientName?: string;
  patientRut?: string;
  patientPhone?: string;
  // Historial para contexto del agente (últimos N mensajes)
  history?: { role: string; text: string }[];
  // Estado estructurado del flujo de agendamiento
  flowState?:
    | "idle"
    | "exploring"
    | "awaiting_confirmation"
    | "awaiting_rut"
    | "awaiting_name"
    | "booking_completed";
  lastIntent?: string;
  pendingAction?: string;
  selectedStaffId?: string;
  selectedStaffName?: string;
  selectedDate?: string;
  selectedSlotDocId?: string;
  selectedSlotLabel?: string;
  selectedSlotTime?: string;
  // Confirmación estructurada: gate para book_appointment
  pendingBooking?: {
    slotDocId: string;
    staffId: string;
    staffName: string;
    date: string;
    time: string;
    patientName: string;
    patientRut: string;
    confirmedAt?: string; // ISO timestamp de confirmación del paciente
  };
  bookingSuccess?: boolean; // Reserva ejecutada con éxito (cierre determinístico)
  // Auto-Rescate de Controles
  isRescuingControl?: boolean;
  targetDoctorId?: string;
  targetDoctorName?: string;
  hasPendingExams?: boolean;
  // Estado simplificado
  phase: "ACTIVE" | "HANDOFF";
  handoffStatus?: string;
  // Auditoría completa
  lastAgentAction?: string;
  agentLog?: AgentLogEntry[];
  interactiveOptions?: any;
  updatedAt: admin.firestore.FieldValue;
}

function convKey(centerId: string, phone: string): string {
  return `${centerId}_${phone}`;
}

async function getConversation(phone: string, centerId?: string): Promise<AgentConversation> {
  // Intentar con clave multi-centro primero
  if (centerId) {
    const key = convKey(centerId, phone);
    const doc = await db.collection("conversations").doc(key).get();
    if (doc.exists) {
      const conv = doc.data() as AgentConversation;
      return await _checkConvExpiry(conv, key);
    }
  }
  // Fallback: clave legacy (solo phone) — migración suave
  const legacyDoc = await db.collection("conversations").doc(phone).get();
  if (legacyDoc.exists) {
    const conv = legacyDoc.data() as AgentConversation;
    return await _checkConvExpiry(conv, phone);
  }
  return {
    phase: "ACTIVE",
    history: [],
    flowState: "idle",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function _checkConvExpiry(
  conv: AgentConversation,
  docId: string
): Promise<AgentConversation> {
  // Auto-destrabar conversaciones HANDOFF expiradas
  if (conv.phase === "HANDOFF" && conv.updatedAt) {
    let lastUpdate = new Date();
    if (typeof (conv.updatedAt as any).toDate === "function") {
      lastUpdate = (conv.updatedAt as any).toDate();
    }
    const diffHours = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (diffHours >= CONVERSATION_TTL_HOURS * 2) {
      console.log(`[Agent] Reseteando conversación ${docId} atrapada en HANDOFF por >8h.`);
      await db.collection("conversations").doc(docId).delete();
      return {
        phase: "ACTIVE",
        history: [],
        flowState: "idle",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }
  }

  // Auto-expirar conversaciones activas inactivas
  if (conv.phase === "ACTIVE" && conv.updatedAt) {
    let lastUpdate = new Date();
    if (typeof (conv.updatedAt as any).toDate === "function") {
      lastUpdate = (conv.updatedAt as any).toDate();
    }
    const diffHours = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (diffHours >= CONVERSATION_TTL_HOURS) {
      console.log(
        `[Agent] Conversación ${docId} expirada por inactividad (${diffHours.toFixed(1)}h).`
      );
      return {
        phase: "ACTIVE",
        history: [],
        flowState: "idle",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }
  }

  return conv;
}

async function saveConversation(
  phone: string,
  data: Partial<AgentConversation>,
  centerId?: string
) {
  const key = centerId ? convKey(centerId, phone) : phone;
  await db
    .collection("conversations")
    .doc(key)
    .set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

export async function resetConversation(phone: string, centerId?: string) {
  const key = centerId ? convKey(centerId, phone) : phone;
  await db.collection("conversations").doc(key).delete();
  // Limpiar clave legacy si existe
  if (centerId) {
    const legacyRef = db.collection("conversations").doc(phone);
    const legacySnap = await legacyRef.get();
    if (legacySnap.exists) await legacyRef.delete();
  }
}

// ─── MENSAJERÍA WHATSAPP ──────────────────────────────────────────────────────

/**
 * Resuelve el Access Token de WhatsApp correcto para un phoneNumberId dado.
 * Primero busca el token específico del centro en Firestore (multi-centro),
 * y si no existe, usa el token global de Firebase Secrets.
 */
async function resolveWhatsappToken(phoneNumberId: string): Promise<string> {
  const globalToken = getWhatsappToken();
  if (!phoneNumberId) return globalToken;
  try {
    // El center ya debería estar en cache, solo consultamos el accessToken
    const centersSnap = await db
      .collection("centers")
      .where("whatsappConfig.phoneNumberId", "==", phoneNumberId)
      .limit(1)
      .get();
    if (!centersSnap.empty) {
      const centerToken = centersSnap.docs[0].data()?.whatsappConfig?.accessToken;
      if (centerToken) {
        return centerToken; // Token específico del centro
      }
    }
  } catch (e) {
    console.warn("[resolveWhatsappToken] Error al buscar token del centro, usando global:", e);
  }
  return globalToken; // Fallback al token global
}

async function sendRawWhatsAppPayload(phoneNumberId: string, payload: any, overrideToken?: string) {
  const WHATSAPP_TOKEN = overrideToken || await resolveWhatsappToken(phoneNumberId);
  if (!WHATSAPP_TOKEN || !phoneNumberId) return;
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[WA API Error]", res.status, err);
    }
  } catch (err) {
    console.error("[sendRawWhatsAppPayload] Error de red:", err);
  }
}

async function sendText(phoneNumberId: string, to: string, text: string) {
  await sendRawWhatsAppPayload(phoneNumberId, { to, type: "text", text: { body: text } });
}

export async function sendButtons(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  await sendRawWhatsAppPayload(phoneNumberId, {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
      },
    },
  });
}

export async function sendList(
  phoneNumberId: string,
  to: string,
  title: string,
  bodyText: string,
  buttonLabel: string,
  sections: any[]
) {
  await sendRawWhatsAppPayload(phoneNumberId, {
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: title },
      body: { text: bodyText },
      action: { button: buttonLabel, sections },
    },
  });
}

// ─── TOOLS: FUNCIONES REALES DEL AGENTE ──────────────────────────────────────

async function getAvailableSlots(
  centerId: string,
  staffId: string,
  date: string
): Promise<{ id: string; label: string; docId: string }[]> {
  try {
    let snap = await db
      .collection("centers")
      .doc(centerId)
      .collection("appointments")
      .where("doctorId", "==", staffId)
      .where("date", "==", date)
      .where("status", "==", "available")
      .get();

    // Fallback 1: doctorUid (compatibilidad legado)
    if (snap.empty) {
      snap = await db
        .collection("centers")
        .doc(centerId)
        .collection("appointments")
        .where("doctorUid", "==", staffId)
        .where("date", "==", date)
        .where("status", "==", "available")
        .get();
    }

    // Fallback 2: serviceId (para exámenes/procedimientos)
    if (snap.empty) {
      snap = await db
        .collection("centers")
        .doc(centerId)
        .collection("appointments")
        .where("serviceId", "==", staffId)
        .where("date", "==", date)
        .where("status", "==", "available")
        .get();
    }

    if (snap.empty) return [];

    const slots = snap.docs.map((d) => {
      const data = d.data();
      const time: string = data.time || "00:00";
      return {
        id: time.replace(":", ""),
        label: time,
        docId: d.id,
      };
    });

    slots.sort((a, b) => a.label.localeCompare(b.label));
    return slots;
  } catch (error) {
    console.error("[getAvailableSlots] Error:", error);
    return [];
  }
}

// ─── VALIDACIÓN DE RUT CHILENO ────────────────────────────────────────────────
function isValidRut(rut: string): boolean {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 7 || clean.length > 9) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const expected = 11 - (sum % 11);
  const dvExpected = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);
  return dv === dvExpected;
}

async function bookAppointmentTool(
  centerId: string,
  slotDocId: string,
  patientName: string,
  patientRut: string,
  patientPhone: string,
  staffId?: string,
  expectedDate?: string
): Promise<{ success: boolean; error?: string; details?: any }> {
  // ── Validaciones duras (no confiar en el modelo) ──
  if (!slotDocId) return { success: false, error: "MISSING_SLOT_ID" };
  if (!centerId) return { success: false, error: "MISSING_CENTER_ID" };
  if (!patientName || patientName.trim().length < 3) {
    return {
      success: false,
      error: "INVALID_NAME",
      details: "Nombre debe tener al menos 3 caracteres",
    };
  }
  if (!patientRut) return { success: false, error: "MISSING_RUT" };
  const cleanRut = patientRut.replace(/[^0-9kK-]/g, "").toUpperCase();
  if (!isValidRut(cleanRut)) {
    return {
      success: false,
      error: "INVALID_RUT",
      details: "RUT inválido: dígito verificador no coincide",
    };
  }

  try {
    const apptRef = db
      .collection("centers")
      .doc(centerId)
      .collection("appointments")
      .doc(slotDocId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(apptRef);
      if (!snap.exists) {
        return { success: false, error: "SLOT_NOT_FOUND" };
      }
      const slotData = snap.data()!;

      // Verificar estado
      if (slotData.status !== "available") {
        return { success: false, error: "SLOT_TAKEN" };
      }

      // Verificar que el slot pertenece al staffId esperado
      if (staffId && slotData.doctorId !== staffId && slotData.doctorUid !== staffId) {
        return {
          success: false,
          error: "STAFF_MISMATCH",
          details: "El slot no pertenece al profesional indicado",
        };
      }

      // Verificar fecha si fue proporcionada
      if (expectedDate && slotData.date !== expectedDate) {
        return {
          success: false,
          error: "DATE_MISMATCH",
          details: `Slot es para ${slotData.date}, no ${expectedDate}`,
        };
      }

      // Verificar que la fecha no sea pasada
      const today = format(new Date(), "yyyy-MM-dd");
      if (slotData.date < today) {
        return { success: false, error: "DATE_IN_PAST" };
      }

      tx.set(
        apptRef,
        {
          patientName: patientName.trim(),
          patientRut: cleanRut,
          patientPhone,
          status: "booked",
          bookedVia: "whatsapp_agent",
          doctorId: slotData.doctorId,
          doctorUid: slotData.doctorUid,
          bookedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        success: true,
        details: {
          date: slotData.date,
          time: slotData.time,
          doctorId: slotData.doctorId,
        },
      };
    });

    if (result.success) {
      console.log(
        `[Booking] ✅ Reserva exitosa: centro=${centerId} slot=${slotDocId} paciente=${cleanRut}`
      );
    } else {
      console.warn(`[Booking] ❌ Reserva fallida: ${result.error} slot=${slotDocId}`);
    }

    return result;
  } catch (error) {
    console.error("[bookAppointmentTool] Error:", error);
    return { success: false, error: "TECHNICAL_ERROR" };
  }
}

async function triggerHandoff(
  phoneNumberId: string,
  patientPhone: string,
  patientName: string,
  center: any,
  reason?: string
): Promise<void> {
  const centerId = center.id;
  const centerName: string = center.name || "Centro Médico";
  const secretaryPhone: string = center?.whatsappConfig?.secretaryPhone || "";

  try {
    const handoffRef = db.collection("centers").doc(centerId).collection("handoff_requests").doc();

    await handoffRef.set({
      id: handoffRef.id,
      patientPhone,
      patientName: patientName || "Desconocido",
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
      assignedTo: null,
      centerId,
      reason: reason || null,
      source: "whatsapp_agent",
    });
    console.log(`[Handoff] Solicitud creada: ${handoffRef.id} para ${patientPhone}`);
  } catch (error) {
    console.error("[Handoff] Error guardando en Firestore:", error);
  }

  if (secretaryPhone) {
    // Generar link directo al historial en el Admin Dashboard
    const dashboardLink = `https://clavesalud-2.web.app/center/${centerId}/admin?tab=whatsapp&chat=${patientPhone}`;
    
    const notif =
      `🔔 *Nueva solicitud de atención — ${centerName}*\n\n` +
      `👤 Paciente: ${patientName || "Desconocido"}\n` +
      `📱 Teléfono: +${patientPhone}\n` +
      `💬 Motivo: ${reason || "Solicitud general"}\n\n` +
      `🔗 *Historial del chat:* ${dashboardLink}\n\n` +
      `Para atenderle, responda directamente al número del paciente.\n` +
      `_(Registro guardado en el sistema de ${centerName})_`;
    await sendText(phoneNumberId, secretaryPhone, notif);
  } else {
    console.warn(`[Handoff] Centro ${centerId} sin whatsappConfig.secretaryPhone configurado.`);
  }
}

// ─── DEFINICIÓN DE TOOLS PARA GEMINI ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AGENT_TOOLS: any[] = [
  {
    functionDeclarations: [
      {
        name: "list_professionals",
        description:
          "Lista los profesionales disponibles. Permite filtrar por tipo: 'medicos' (doctores) o 'otros' (kinesiólogos, psicólogos, etc.).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            category: { type: SchemaType.STRING, enum: ["medicos", "otros"], description: "Categoría de profesional." },
          },
        },
      },
      {
        name: "list_services",
        description:
          "Busca y lista servicios o exámenes disponibles en el centro. Permite filtrar por categoría: 'sangre' (laboratorio), 'eco' (ecotomografía) o 'ginec' (ginecología).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            category: { type: SchemaType.STRING, enum: ["sangre", "eco", "ginec"], description: "Categoría del examen." },
          },
        },
      },
      {
        name: "get_available_slots",
        description:
          "Consulta los horarios disponibles para un profesional O servicio en una fecha específica. Requiere el ID (obtenido de list_professionals o list_services) y una fecha en formato YYYY-MM-DD.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            staffId: { type: SchemaType.STRING, description: "ID del profesional o servicio." },
            date: { type: SchemaType.STRING, description: "Fecha en formato YYYY-MM-DD." },
          },
          required: ["staffId", "date"],
        },
      },
      {
        name: "suggest_alternative_dates",
        description:
          "Busca fechas cercanas con disponibilidad para un profesional cuando la fecha solicitada no tiene horas libres. Busca hasta 14 días hacia adelante.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            staffId: { type: SchemaType.STRING, description: "ID del profesional médico." },
            startDate: {
              type: SchemaType.STRING,
              description: "Fecha de inicio de búsqueda en formato YYYY-MM-DD.",
            },
          },
          required: ["staffId", "startDate"],
        },
      },
      {
        name: "book_appointment",
        description:
          "Confirma y agenda una cita médica. SOLO llamar DESPUÉS de que confirm_booking_details haya sido exitoso. Si no se llamó primero a confirm_booking_details, esta tool será rechazada.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            staffId: { type: SchemaType.STRING, description: "ID del profesional." },
            patientName: { type: SchemaType.STRING, description: "Nombre completo del paciente." },
            patientRut: {
              type: SchemaType.STRING,
              description: "RUT del paciente (formato: 12345678-9).",
            },
          },
          required: ["patientName", "patientRut"],
        },
      },
      {
        name: "confirm_booking_details",
        description:
          "Presenta un resumen de la reserva al paciente y espera su confirmación EXPLÍCITA (ej: 'sí', 'confirmo'). DEBE llamarse ANTES de book_appointment. Devuelve un resumen con los datos para que el paciente revise.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            staffId: { type: SchemaType.STRING, description: "ID del profesional." },
            date: {
              type: SchemaType.STRING,
              description: "Fecha de la cita en formato YYYY-MM-DD.",
            },
            time: { type: SchemaType.STRING, description: "Hora de la cita (ej: 09:00)." },
            patientName: { type: SchemaType.STRING, description: "Nombre completo del paciente." },
            patientRut: { type: SchemaType.STRING, description: "RUT del paciente." },
          },
          required: ["staffId", "date", "time", "patientName", "patientRut"],
        },
      },
      {
        name: "get_center_info",
        description:
          "Obtiene información del centro médico: nombre, dirección, horarios de atención y teléfono de contacto.",
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: "trigger_handoff",
        description:
          "Transfiere la conversación a una secretaria humana. Usar cuando: el paciente lo pide explícitamente, está frustrado, o la consulta es administrativa compleja (reembolsos, Isapre, convenios).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            reason: {
              type: SchemaType.STRING,
              description: "Motivo de la transferencia a secretaria.",
            },
          },
          required: ["reason"],
        },
      },
      {
        name: "cancel_appointment",
        description:
          "Cancela una cita agendada del paciente. Requiere el RUT del paciente para verificar identidad. Úsala SOLO cuando el paciente explícitamente solicite cancelar o anular una cita.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            patientRut: {
              type: SchemaType.STRING,
              description: "RUT del paciente (sin puntos, con guión). Ej: 12345678-9.",
            },
            date: {
              type: SchemaType.STRING,
              description: "Fecha de la cita a cancelar en formato YYYY-MM-DD. Si el paciente no la recuerda, busca la próxima cita activa.",
            },
            reason: {
              type: SchemaType.STRING,
              description: "Motivo de cancelación expresado por el paciente.",
            },
          },
          required: ["patientRut"],
        },
      },
    ],
  },
];

// ─── TOOLS DEL MODO DOCTOR ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DOCTOR_TOOLS: any[] = [
  {
    functionDeclarations: [
      {
        name: "get_my_agenda",
        description:
          "Obtiene la agenda de citas del profesional para una fecha dada. Incluye número de pacientes, horarios, nombres y tipo de consulta.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            date: {
              type: SchemaType.STRING,
              description: "Fecha en formato YYYY-MM-DD. Usa 'hoy' o 'mañana' si el profesional lo indica.",
            },
          },
          required: ["date"],
        },
      },
    ],
  },
];

function buildDoctorSystemPrompt(
  doctorName: string,
  specialty: string,
  centerName: string
): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const todayReadable = format(new Date(), "eeee d 'de' MMMM yyyy", { locale: es }).replace(
    /^\w/,
    (c) => c.toUpperCase()
  );
  const tomorrow = format(
    new Date(new Date().setDate(new Date().getDate() + 1)),
    "yyyy-MM-dd"
  );

  return `Eres el asistente de agenda personal de ${doctorName} (${specialty}) en "${centerName}".
Fecha de hoy: ${todayReadable} (${today}).
Fecha de mañana: ${tomorrow}.

IDENTIDAD:
- Solo atiendes consultas de agenda del propio profesional.
- Tono: Profesional, directo y conciso.
- Máximo 3 frases de texto propio por respuesta; el resto son datos.

REGLAS:
1. Cuando te pregunten por la agenda, SIEMPRE llama a get_my_agenda con la fecha correcta.
2. Si el profesional dice "hoy", usa ${today}. Si dice "mañana", usa ${tomorrow}.
3. NUNCA inventes datos de pacientes. Solo muestra lo que devuelva get_my_agenda.
4. Si no hay pacientes, di que la agenda está libre ese día.
5. No puedes agendar ni cancelar citas en este canal — solo consultar.
6. Formato de respuesta: número total de pacientes + lista ordenada por hora.`;
}



function buildSystemPrompt(
  centerName: string,
  centerId: string,
  staff: any[],
  conv: AgentConversation,
  centerBusinessHours?: string
): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const todayReadable = format(new Date(), "eeee d 'de' MMMM yyyy", { locale: es }).replace(
    /^\w/,
    (c) => c.toUpperCase()
  );
  // Usa los horarios reales del centro si están configurados; de lo contrario, fallback genérico.
  const businessHours = centerBusinessHours || "Lunes a Viernes, 08:00 a 18:00";

  let rescueContext = "";
  if (conv.isRescuingControl) {
    rescueContext = `\n\n🔴 CONTEXTO RESCATE DE CONTROL: Este paciente fue contactado proactivamente porque tiene un control médico pendiente con ${conv.targetDoctorName || "su médico tratante"}. ${conv.hasPendingExams ? "El sistema indica que TIENE exámenes pendientes por hacerse antes de su control." : "No tiene exámenes pendientes."} Tu objetivo es ayudarle a agendar su control o derivarlo con secretaría si necesita ayuda con exámenes.`;
  }

  const staffCatalog = JSON.stringify(
    staff.map((s) => ({
      id: s.id,
      name: s.fullName || s.name,
      specialty: s.specialty || s.clinicalRole || "Profesional de Salud",
    }))
  );

  return `Eres el Asistente Inteligente de "${centerName}".
Fecha de hoy: ${todayReadable} (${today}).
Horario de atención: ${businessHours}.
Centro ID: ${centerId}.

IDENTIDAD:
- Representas exclusivamente a "${centerName}".
- Tono: Formal (usted), empático, breve y resolutivo.
- Máximo 3 frases por respuesta. Los mensajes de WhatsApp deben ser concisos.
- Usa emojis moderadamente (1-2 por mensaje máximo).

REGLAS ESTRICTAS:
1. NO des diagnósticos, recomendaciones médicas ni sugerencias de medicamentos. NUNCA.
2. Si detectas una urgencia médica (dolor de pecho, dificultad respiratoria, trauma grave), indica al paciente que llame al 131 (SAMU) e inmediatamente usa trigger_handoff.
3. CLASIFICACIÓN DE CITAS:
   - Si el usuario quiere una "Cita Médica", usa "list_professionals" con category="medicos". Al responder, usa el término "Médicos" o "Doctores".
   - Si quiere "Otros Profesionales" (Kinesiólogo, Psicólogo, etc.), usa "list_professionals" con category="otros". Al responder, usa el término "Profesionales" o la especialidad específica (Kinesiólogos, etc.), NUNCA digas "Médicos" para esta categoría.
   - Si quiere un "Examen", usa "list_services" con la categoría adecuada ('sangre', 'eco' o 'ginec').

4. REGLAS CRÍTICAS DE RESERVA:
   - Para agendar, SIEMPRE necesitas: profesional/servicio, fecha, hora, nombre completo del paciente y RUT.
   - PROACTIVIDAD: Si el usuario selecciona una categoría del menú, llama INMEDIATAMENTE a la herramienta correspondiente (list_professionals o list_services).
   - EXÁMENES: Si el usuario agenda un examen (sangre, orina, ecotomografía, ecografía ginecológica), el flujo terminará automáticamente con una derivación a secretaría para indicaciones de preparación. Tú solo confirma la reserva.

5. PRIORIDAD VISUAL: Si muestras horarios de un día específico, NO muestres botones de otras fechas al mismo tiempo. El paciente debe elegir una hora primero.
6. VERACIDAD: Nunca inventes horarios ni nombres. Usa solo lo que devuelvan las herramientas.
7. COMPORTAMIENTO: Sé formal, amable y resolutivo. Usa emojis discretos. NO mezcles categorías en una sola respuesta a menos que sea estrictamente necesario.

CATÁLOGO DE PROFESIONALES:
${staffCatalog}
${rescueContext}

DATOS DEL PACIENTE (si ya los conoces):
- Nombre: ${conv.patientName || "No proporcionado"}
- RUT: ${conv.patientRut || "No proporcionado"}`;
}

// ─── PROCESADOR PRINCIPAL DEL AGENTE ──────────────────────────────────────────

async function processAgentMessage(
  message: string,
  phoneNumberId: string,
  to: string,
  contactName: string,
  center: any,
  staff: any[],
  conv: AgentConversation
): Promise<{
  responseText: string;
  intent: "GENERAL" | "BOOKING" | "HANDOFF";
  updatedConv: Partial<AgentConversation>;
  interactiveOptions?: any;
}> {
  const centerId: string = center.id;
  const centerName: string = center.name || "Centro Médico";

  try {
    const systemPrompt = buildSystemPrompt(
      centerName,
      centerId,
      staff,
      conv,
      center.businessHours || undefined
    );

    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.0-flash",
      tools: AGENT_TOOLS,
      generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      systemInstruction: systemPrompt,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    // Construir historial de chat desde la memoria
    const geminiHistory: any[] = (conv.history || []).slice(-MAX_HISTORY_MESSAGES).map((h) => ({
      role: h.role === "model" ? "model" : "user",
      parts: [{ text: h.text }],
    }));

    const chat = model.startChat({
      history: geminiHistory,
    });

    let intent: "GENERAL" | "BOOKING" | "HANDOFF" = "GENERAL";
    const convUpdates: Partial<AgentConversation> = {};
    const agentLog: AgentLogEntry[] = [];
    let turns = 0;
    let interactiveOptions: any = null;

    // Enviar mensaje del usuario
    let result = await chat.sendMessage(message);
    let response = result.response;

    // Loop de tool calling (multi-turn, procesa TODAS las calls por turno)
    while (response.functionCalls()?.length && turns < MAX_AGENT_TURNS) {
      turns++;
      const calls = response.functionCalls()!;
      const functionResponses: any[] = [];

      for (const call of calls) {
        console.log(`[Agent] Turn ${turns}: Tool=${call.name}`, JSON.stringify(call.args));

        let toolResult: any = {};

        // ── TOOL: list_professionals ──
        if (call.name === "list_professionals") {
          const args = call.args as any;
          const category = args.category; // 'medicos' o 'otros'

          let filtered = [...staff];
          if (category === "medicos") {
            filtered = staff.filter(
              (s) =>
                (s.clinicalRole || "").toLowerCase().includes("medico") ||
                (s.fullName || "").toLowerCase().includes("dr")
            );
          } else if (category === "otros") {
            filtered = staff.filter(
              (s) =>
                !(s.clinicalRole || "").toLowerCase().includes("medico") &&
                !(s.fullName || "").toLowerCase().includes("dr")
            );
          }

          const toolResultAny: any = {
            professionals: filtered.map((s) => ({
              id: s.id,
              name: s.fullName || s.name,
              specialty: s.specialty || s.clinicalRole || "Profesional de Salud",
            })),
            count: filtered.length,
          };
          toolResult = toolResultAny;
          intent = "BOOKING";
          interactiveOptions = { type: "professionals", data: toolResultAny.professionals };
        }
        // ── TOOL: list_services (NUEVA) ──
        else if (call.name === "list_services") {
          const args = call.args as any;
          const category = args.category; // 'sangre', 'eco', 'ginec'

          const servicesSnap = await db
            .collection("centers")
            .doc(centerId)
            .collection("services")
            .get();
          const allServices = servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

          let filtered = allServices;
          if (category === "sangre") {
            filtered = allServices.filter((s) =>
              /sangre|orina|perfil|hemograma|glucosa|lab/i.test(s.name)
            );
          } else if (category === "eco") {
            filtered = allServices.filter((s) =>
              /ecotomografía|abdominal|renal|doppler/i.test(s.name)
            );
          } else if (category === "ginec") {
            filtered = allServices.filter((s) =>
              /ginecológica|transvaginal|obstétrica|mama|embarazo/i.test(s.name)
            );
          }

          const toolResultAny: any = {
            services: filtered.map((s) => ({
              id: s.id,
              name: s.name,
              price: s.price,
            })),
            count: filtered.length,
          };
          toolResult = toolResultAny;
          intent = "BOOKING";
          // Reutilizamos el tipo 'professionals' para mostrar la lista de servicios en la UI
          interactiveOptions = {
            type: "professionals",
            data: filtered.map((s) => ({
              id: s.id,
              name: s.name,
              specialty: "Examen/Procedimiento",
            })),
          };
        }

        // ── TOOL: get_available_slots ──
        else if (call.name === "get_available_slots") {
          const args = call.args as any;
          const slots = await getAvailableSlots(centerId, args.staffId, args.date);
          toolResult = {
            date: args.date,
            slots: slots.map((s) => ({ time: s.label, docId: s.docId })),
            count: slots.length,
            message:
              slots.length > 0
                ? `${slots.length} horario(s) disponible(s) para ${args.date}: ${slots.map((s) => s.label).join(", ")}`
                : `No hay horarios disponibles para ${args.date}.`,
          };
          // Guardar staff seleccionado en la conversación
          convUpdates.selectedStaffId = args.staffId;
          convUpdates.selectedDate = args.date;
          intent = "BOOKING";
          // Prioridad: los slots (horas) ganan sobre fechas alternativas
          interactiveOptions = { type: "slots", data: [...slots] };
        }

        // ── TOOL: suggest_alternative_dates ──
        else if (call.name === "suggest_alternative_dates") {
          const args = call.args as any;
          const alternatives: { date: string; label: string; count: number }[] = [];
          let d = new Date(args.startDate);
          let daysChecked = 0;

          while (daysChecked < 14 && alternatives.length < 5) {
            if (d.getDay() !== 0) {
              // Excluir domingos
              const dateStr = format(d, "yyyy-MM-dd");
              const slots = await getAvailableSlots(centerId, args.staffId, dateStr);
              if (slots.length > 0) {
                alternatives.push({
                  date: dateStr,
                  label: format(d, "eeee d 'de' MMMM", { locale: es }).replace(/^\w/, (c) =>
                    c.toUpperCase()
                  ),
                  count: slots.length,
                });
              }
            }
            d = new Date(d.getTime() + 86400000);
            daysChecked++;
          }

          toolResult = {
            alternatives,
            message:
              alternatives.length > 0
                ? `Fechas con disponibilidad: ${alternatives.map((a) => `${a.label} (${a.count} hora${a.count !== 1 ? "s" : ""})`).join(", ")}`
                : "No se encontró disponibilidad en los próximos 14 días.",
          };
          intent = "BOOKING";
          // SOLO poner fechas si NO tenemos ya slots (horas) específicos para mostrar
          if (!interactiveOptions || (interactiveOptions.type !== "slots" && interactiveOptions.type !== "professionals")) {
            interactiveOptions = { type: "dates", data: alternatives };
          }
        }

        // ── TOOL: confirm_booking_details (GATE para book_appointment) ──
        else if (call.name === "confirm_booking_details") {
          const args = call.args as any;

          // Buscar si la hora solicitada REALMENTE existe actualmente
          const slots = await getAvailableSlots(centerId, args.staffId, args.date);
          const matchedSlot = slots.find(
            (s) => s.label === args.time || s.label.startsWith(args.time)
          );

          if (!matchedSlot) {
            toolResult = {
              success: false,
              error: "SLOT_UNAVAILABLE",
              message: `Lo lamento, la hora ${args.time} del ${args.date} ya no está disponible. Por favor, ofrezca otras opciones.`,
            };
          } else {
            // Resolver nombre real del profesional
            const staffMember = staff.find((s) => s.id === args.staffId);
            const staffName = staffMember?.fullName || staffMember?.name || "Profesional";

            // Persistir como pendingBooking (gate para book_appointment)
            const pending = {
              slotDocId: matchedSlot.docId, // Recuperado desde la DB dinámicamente
              staffId: args.staffId,
              staffName,
              date: args.date,
              time: args.time,
              patientName: args.patientName,
              patientRut: args.patientRut,
            };
            convUpdates.pendingBooking = pending;
            convUpdates.flowState = "awaiting_confirmation";
            convUpdates.selectedStaffName = staffName;

            toolResult = {
              success: true,
              summary: {
                professional: staffName,
                date: args.date,
                time: args.time,
                patientName: args.patientName,
                patientRut: args.patientRut,
              },
              message: `Resumen de reserva: ${staffName}, ${args.date} a las ${args.time}, paciente ${args.patientName} (RUT: ${args.patientRut}). Presentar al paciente para confirmación.`,
            };
            intent = "BOOKING";
            interactiveOptions = { type: "confirmation" };
          }
        }

        // ── TOOL: book_appointment (requiere pendingBooking CON confirmedAt de turno anterior) ──
        else if (call.name === "book_appointment") {
          // GATE 1: verificar que confirm_booking_details fue llamado previamente
          const pending = conv.pendingBooking; // Solo de turno anterior (no de convUpdates)
          if (!pending || !pending.slotDocId) {
            toolResult = {
              success: false,
              error: "CONFIRMATION_REQUIRED",
              message:
                "Debe llamar a confirm_booking_details primero y obtener la confirmación explícita del paciente antes de reservar.",
            };
          } else if (!pending.confirmedAt) {
            // GATE 2: confirmedAt debe existir (paciente dijo 'sí' en un mensaje anterior)
            toolResult = {
              success: false,
              error: "PATIENT_NOT_CONFIRMED",
              message:
                "El paciente aún no ha confirmado explícitamente. Debe esperar su respuesta afirmativa ('sí', 'confirmo', etc.) antes de reservar.",
            };
          } else {
            // Usar datos del pendingBooking (verificados) en vez de confiar en args
            const bookResult = await bookAppointmentTool(
              centerId,
              pending.slotDocId,
              pending.patientName,
              pending.patientRut,
              to,
              pending.staffId,
              pending.date
            );

            // Resolver nombre real del profesional para la respuesta
            const staffMember = staff.find((s) => s.id === pending.staffId);
            const staffName = staffMember?.fullName || staffMember?.name || pending.staffName;

            const errorMessages: Record<string, string> = {
              SLOT_TAKEN: "ese horario ya fue reservado por otro paciente",
              INVALID_RUT: "el RUT proporcionado no es válido",
              STAFF_MISMATCH: "el slot no corresponde al profesional",
              DATE_MISMATCH: "la fecha del slot no coincide",
              DATE_IN_PAST: "la fecha ya pasó",
              SLOT_NOT_FOUND: "el horario ya no existe",
              MISSING_SLOT_ID: "falta el ID del horario",
              INVALID_NAME: "nombre inválido",
            };

            toolResult = {
              success: bookResult.success,
              error: bookResult.error || null,
              details: bookResult.success
                ? {
                    professionalName: staffName,
                    date: pending.date,
                    time: pending.time,
                    patientName: pending.patientName,
                  }
                : null,
              message: bookResult.success
                ? `Cita agendada correctamente con ${staffName} el ${pending.date} a las ${pending.time}.`
                : `No se pudo agendar: ${errorMessages[bookResult.error || ""] || "error técnico"}.`,
            };

            if (bookResult.success) {
              convUpdates.patientName = pending.patientName;
              convUpdates.patientRut = pending.patientRut;
              convUpdates.bookingSuccess = true;
              convUpdates.flowState = "booking_completed";
              convUpdates.selectedStaffName = staffName;
            }
          }
          intent = "BOOKING";
        }

        // ── TOOL: get_center_info ──
        else if (call.name === "get_center_info") {
          toolResult = {
            name: centerName,
            address: center.address || "No disponible",
            phone: center.contactPhone || center.phone || "No disponible",
            businessHours: center.businessHours || "Lunes a Viernes, 08:00 a 18:00",
            googleMapsUrl: center.googleMapsUrl || null,
          };
        }

        // ── TOOL: cancel_appointment ──
        else if (call.name === "cancel_appointment") {
          const args = call.args as any;
          const cancelRut: string = (args.patientRut || "").trim();
          const cancelDate: string = args.date || "";

          if (!cancelRut) {
            toolResult = {
              success: false,
              error: "MISSING_RUT",
              message: "Necesito el RUT del paciente para verificar la cita y cancelarla.",
            };
          } else {
            // Buscar la cita por RUT + estado booked.
            // Si viene fecha, la filtramos; de lo contrario traemos la próxima activa.
            let apptQuery: FirebaseFirestore.Query = db
              .collection("centers")
              .doc(centerId)
              .collection("appointments")
              .where("patientRut", "==", cancelRut)
              .where("status", "==", "booked");

            if (cancelDate) {
              apptQuery = apptQuery.where("date", "==", cancelDate);
            } else {
              // Ordenar por fecha ascendente para cancelar la próxima
              apptQuery = apptQuery.orderBy("date", "asc");
            }

            const apptSnap = await apptQuery.limit(1).get();

            if (apptSnap.empty) {
              toolResult = {
                success: false,
                error: "NOT_FOUND",
                message: cancelDate
                  ? `No encontré una cita agendada para el ${cancelDate} con ese RUT.`
                  : "No encontré citas próximas agendadas con ese RUT.",
              };
            } else {
              const apptDoc = apptSnap.docs[0];
              const apptData = apptDoc.data();
              await apptDoc.ref.update({
                status: "cancelled",
                cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                cancelledBy: "patient_whatsapp",
                cancellationReason: args.reason || "Solicitud del paciente vía WhatsApp",
              });
              console.log(`[Agent] Cita cancelada: ${apptDoc.id} (RUT ${cancelRut})`);
              toolResult = {
                success: true,
                appointment: {
                  date: apptData.date,
                  time: apptData.time,
                  professional: apptData.staffName || apptData.doctorName || "su profesional",
                },
                message: `Cita del ${apptData.date} a las ${apptData.time} con ${
                  apptData.staffName || "su médico"
                } ha sido cancelada exitosamente.`,
              };
              convUpdates.flowState = "idle";
            }
          }
        }

        // ── TOOL: trigger_handoff ──
        else if (call.name === "trigger_handoff") {
          const args = call.args as any;
          await triggerHandoff(
            phoneNumberId,
            to,
            conv.patientName || contactName,
            center,
            args.reason
          );
          convUpdates.phase = "HANDOFF";
          convUpdates.handoffStatus = "pending";
          intent = "HANDOFF";
          toolResult = { success: true, message: "Transferencia a secretaria registrada." };
        }

        // Registrar en log de auditoría
        agentLog.push({
          turn: turns,
          tool: call.name,
          args: call.args,
          result: toolResult,
          timestamp: new Date().toISOString(),
        });
        convUpdates.lastAgentAction = `${call.name}(${JSON.stringify(call.args).substring(0, 200)})`;

        functionResponses.push({
          functionResponse: { name: call.name, response: toolResult },
        });
      } // end for (const call of calls)

      // Enviar TODOS los resultados de tools de vuelta a Gemini
      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    // Extraer texto final del agente
    let responseText = "";
    try {
      responseText = response.text() || "";
    } catch (e) {}

    if (!responseText && agentLog.length > 0) {
      responseText = agentLog[agentLog.length - 1].result?.message || "";
    }

    responseText = responseText || "Disculpe, ¿podría repetir su consulta?";

    // Guardar log de auditoría ACUMULATIVO (cap 50 entries)
    if (agentLog.length > 0) {
      const MAX_LOG_ENTRIES = 50;
      const existingLog = conv.agentLog || [];
      const merged = [...existingLog, ...agentLog].slice(-MAX_LOG_ENTRIES);
      convUpdates.agentLog = merged;
    }

    return {
      responseText,
      intent,
      updatedConv: { ...convUpdates, interactiveOptions },
      interactiveOptions,
    };
  } catch (e) {
    console.error("[Agent] Error crítico:", e);
    return {
      responseText:
        "Lo siento, tuve un problema procesando su solicitud. ¿Podría intentarlo nuevamente?",
      intent: "GENERAL",
      updatedConv: {},
    };
  }
}

// ─── MODO DOCTOR: procesador de mensajes para profesionales ──────────────────

async function processDoctorMessage(
  message: string,
  phoneNumberId: string,
  to: string,
  doctor: { id: string; name: string; specialty: string },
  center: any
): Promise<void> {
  const centerId: string = center.id;
  const centerName: string = center.name || "Centro Médico";
  const systemPrompt = buildDoctorSystemPrompt(doctor.name, doctor.specialty, centerName);

  try {
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.0-flash",
      tools: DOCTOR_TOOLS,
      generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({ history: [] });
    let result = await chat.sendMessage(message);
    let response = result.response;
    let turns = 0;

    // Loop de tool calling
    while (response.functionCalls()?.length && turns < 3) {
      turns++;
      const calls = response.functionCalls()!;
      const functionResponses: any[] = [];

      for (const call of calls) {
        console.log(`[Doctor] Tool=${call.name}`, JSON.stringify(call.args));
        let toolResult: any = {};

        if (call.name === "get_my_agenda") {
          const args = call.args as any;
          const date: string = args.date;

          // Consultar citas agendadas del doctor para esa fecha
          let snap = await db
            .collection("centers").doc(centerId)
            .collection("appointments")
            .where("doctorId", "==", doctor.id)
            .where("date", "==", date)
            .where("status", "==", "booked")
            .get();

          // Fallback: doctorUid
          if (snap.empty) {
            snap = await db
              .collection("centers").doc(centerId)
              .collection("appointments")
              .where("doctorUid", "==", doctor.id)
              .where("date", "==", date)
              .where("status", "==", "booked")
              .get();
          }

          const patients = snap.docs
            .map((d) => ({
              time: d.data().time || "--:--",
              patientName: d.data().patientName || "Sin registrar",
              consultationType: d.data().consultationType || "Consulta",
            }))
            .sort((a, b) => a.time.localeCompare(b.time));

          toolResult = {
            date,
            center: centerName,
            totalPatients: patients.length,
            patients,
            message:
              patients.length > 0
                ? `${patients.length} paciente(s) agendado(s) para ${date}.`
                : `No hay pacientes agendados para ${date}.`,
          };
        }

        functionResponses.push({
          functionResponse: { name: call.name, response: toolResult },
        });
      }

      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    let responseText = "";
    try {
      responseText = response.text() || "";
    } catch (_) {}
    responseText = responseText || "Su agenda no pudo ser consultada en este momento. Intente nuevamente.";

    await sendText(phoneNumberId, to, responseText);
    console.log(`[Doctor] Respuesta enviada a ${to} (${doctor.name}): ${responseText.substring(0, 100)}`);
  } catch (e) {
    console.error("[Doctor] Error procesando mensaje:", e);
    await sendText(phoneNumberId, to, "Disculpe, tuve un inconveniente consultando su agenda. Por favor intente nuevamente.");
  }
}

// ─── PROCESADOR PRINCIPAL DE MENSAJES ─────────────────────────────────────────

async function workerProcessor(
  phoneNumberId: string,
  to: string,
  message: string,
  type: "text" | "interactive",
  interactiveData?: any,
  contactName?: string
) {
  // Resolver centro
  const centerData = await getCenterByPhoneId(phoneNumberId);
  if (!centerData) {
    await sendText(
      phoneNumberId,
      to,
      "Lo sentimos, no pudimos identificar el centro médico. Por favor contacte directamente."
    );
    return;
  }
  const { center, staff } = centerData;
  const centerId: string = center.id;
  const centerName: string = center.name || "Centro Médico";

  // ── DETECCIÓN DE ROL: ¿Doctor o Paciente? ────────────────────────────────────
  // Si el número del remitente está registrado como staff activo del centro,
  // lo atendemos con el flujo de consulta de agenda (Modo Doctor).
  const staffMember = await getStaffByPhone(to, centerId);
  if (staffMember) {
    console.log(`[Doctor] Modo Doctor activado para ${staffMember.name} (${to})`);
    await processDoctorMessage(
      type === "text" ? message : (interactiveData?.button_reply?.title || message),
      phoneNumberId,
      to,
      staffMember,
      center
    );
    return;
  }
  // ── FIN DETECCIÓN DE ROL ─────────────────────────────────────────────────────

  let conv = await getConversation(to, centerId);
  const name = contactName || conv.patientName || "Paciente";
  const firstName = name.split(" ")[0];

  // ── HANDOFF activo: no interrumpir ──
  if (conv.phase === "HANDOFF") {
    await sendText(
      phoneNumberId,
      to,
      `Su solicitud ya está siendo atendida por el equipo de *${conv.centerName || centerName}*. Le contactarán a la brevedad.`
    );
    return;
  }

  // ── Interacciones con botones (Menús Multinivel) ──
  if (type === "interactive" && interactiveData) {
    const iType = interactiveData.type;

    if (iType === "button_reply") {
      const btnId: string = interactiveData.button_reply.id;

      // --- NIVEL 1: MENÚ PRINCIPAL ---
      if (btnId === "menu_agendar") {
        await sendButtons(phoneNumberId, to, "¿Qué tipo de cita desea agendar?", [
          { id: "sub_medicos", title: "🩺 Médicos" },
          { id: "sub_otros", title: "🤝 Otros Prof." },
        ]);
        return;
      }
      if (btnId === "menu_examenes") {
        await sendButtons(phoneNumberId, to, "Selecciona la categoría del examen:", [
          { id: "exam_sangre", title: "🩸 Sangre u Orina" },
          { id: "exam_eco", title: "🖥️ Ecotomografía" },
          { id: "exam_ginec", title: "🤰 Eco Ginecolog." },
        ]);
        return;
      }

      // --- NIVEL 2: FILTROS ACTIVOS ---
      if (btnId === "sub_medicos") {
        message = "Quiero ver la lista de Médicos";
        type = "text";
      } else if (btnId === "sub_otros") {
        message = "Quiero ver otros profesionales (no médicos)";
        type = "text";
      } else if (btnId === "exam_sangre") {
        message = "Quiero agendar un examen de Sangre u Orina";
        type = "text";
      } else if (btnId === "exam_eco") {
        message = "Quiero agendar una Ecotomografía";
        type = "text";
      } else if (btnId === "exam_ginec") {
        message = "Quiero agendar una Ecografía Ginecológica";
        type = "text";
      }

      // Botón: "Secretaria"
      else if (btnId === "action_handoff") {
        await sendText(
          phoneNumberId,
          to,
          `Entendido, ${name.split(" ")[0]}. ✅\n\nUna secretaria de *${centerName}* se comunicará con usted a la brevedad.\n\n_Gracias por su paciencia._`
        );
        await saveConversation(to, { phase: "HANDOFF", centerId, centerName }, centerId);
        await triggerHandoff(
          phoneNumberId,
          to,
          conv.patientName || name,
          center,
          "Solicitud directa del paciente"
        );
        return;
      }

      // Compatibilidad con Rescate (si existiera)
      else if (btnId === "rescate_agendar") {
        message = "Quiero agendar mi control";
        type = "text";
      }

      // Cualquier otro botón: convertir a texto para el agente
      else {
        const title = interactiveData.button_reply.title || btnId;
        message = title;
        type = "text";
      }
    }

    if (iType === "list_reply") {
      const title = interactiveData.list_reply.title || "";
      const desc = interactiveData.list_reply.description || "";
      message = `${title}${desc ? ` - ${desc}` : ""}`;
      type = "text";
    }
  }

  // ── AGENTE PRINCIPAL: procesar texto libre ──
  if (type === "text" && message) {
    // ── MENÚ PRINCIPAL INTERACTIVO ──
    const testMsg = message.toLowerCase().trim();
    const greetings = [
      "hola",
      "buenas",
      "buenos",
      "buenas tardes",
      "buenas noches",
      "alo",
      "hi",
      "hello",
      "holi",
      "holis",
      "saludos",
    ];
    const isGreeting =
      greetings.some((g) => testMsg.startsWith(g)) && testMsg.split(" ").length < 4;
    const asksForMenu =
      testMsg === "menu" ||
      testMsg === "menú" ||
      testMsg === "opciones" ||
      testMsg === "volver al menu";

    if ((!conv.history?.length && isGreeting) || asksForMenu || (isGreeting && testMsg === "hola")) {
      if (conv.history?.length) await resetConversation(to, centerId);

      await sendButtons(
        phoneNumberId,
        to,
        `¡Hola, ${firstName}! Bienvenido a *${centerName}*.\n\nSoy el asistente virtual. ¿En qué le puedo ayudar hoy?`,
        [
          { id: "menu_agendar", title: "📅 Agendar Cita" },
          { id: "menu_examenes", title: "🔬 Agendar Examen" },
          { id: "action_handoff", title: "👩‍💼 Secretaría" },
        ]
      );

      await saveConversation(to, { centerId, centerName, patientName: name, history: [] }, centerId);
      return;
    }

    // Agregar el message al historial (optimista)
    const history = [...(conv.history || [])];
    history.push({ role: "user", text: message });

    let agentResult: any;

    // ── Detección de confirmación explícita del paciente ──
    if (
      conv.flowState === "awaiting_confirmation" &&
      conv.pendingBooking &&
      !conv.pendingBooking.confirmedAt
    ) {
      const msgLower = message.toLowerCase().trim();
      const affirmatives = [
        "sí",
        "si",
        "confirmo",
        "dale",
        "ok",
        "está bien",
        "esta bien",
        "correcto",
        "perfecto",
        "sí, confirmo",
        "si confirmo",
        "de acuerdo",
        "agendar",
        "reservar",
        "confirmar",
      ];
      const isConfirmation = affirmatives.some((a) => msgLower.includes(a));
      const isCancel = ["cancelar", "no", "descartar", "cambiar", "otra hora"].some((a) =>
        msgLower.includes(a)
      );

      if (isConfirmation) {
        const pending = conv.pendingBooking;
        console.log(
          `[Agent] Confirmación explícita programática detectada para ${to}. Ejecutando reserva...`
        );

        const bookResult = await bookAppointmentTool(
          centerId,
          pending.slotDocId,
          pending.patientName,
          pending.patientRut,
          to,
          pending.staffId,
          pending.date
        );

        const isSuccess = bookResult.success;
        const staffName = pending.staffName || "el profesional";

        if (isSuccess) {
          const responseText = `¡Listo! Su reserva ha sido agendada con éxito para el ${pending.date} a las ${pending.time}.\n\n¡Que tenga un excelente día! 😊`;
          
          await sendText(phoneNumberId, to, responseText);
          
          // --- DERIVACIÓN AUTOMÁTICA POST-EXAMEN ---
          // Si el nombre del profesional o servicio sugiere un examen, mandamos a secretaría
          const searchIn = (staffName + " " + (pending.staffId || "")).toLowerCase();
          const isExam = ["examen", "eco", "toma de muestra", "sangre", "orina", "perfil", "lab", "ecografía", "ecotomografia", "radiografía"].some(k => searchIn.includes(k));

          if (isExam) {
            await sendText(phoneNumberId, to, "_Le derivaré ahora con secretaría para que le brinden las indicaciones de preparación para su examen (Ayuno, etc)._ 👩‍💼");
            await saveConversation(to, { phase: "HANDOFF", centerId, centerName, lastAgentAction: "POST_EXAM_HANDOFF" }, centerId);
            await triggerHandoff(phoneNumberId, to, name, center, `Paciente agendó examen/procedimiento: ${staffName}`);
          } else {
             // Cierre normal
             await resetConversation(to, centerId);
          }
          return;
        } else {
          agentResult = {
            responseText: `Lo lamento, no se pudo agendar la cita: ${bookResult.error}. ¿Desea intentar con otro horario?`,
            intent: "BOOKING",
            updatedConv: { flowState: "idle" },
            interactiveOptions: null,
          };
        }
      } else if (isCancel) {
        agentResult = {
          responseText:
            "Entendido, he cancelado el proceso de reserva. ¿Desea buscar otro horario o consultar otra cosa?",
          intent: "GENERAL",
          updatedConv: { flowState: "idle", pendingBooking: null, interactiveOptions: null },
          interactiveOptions: null,
        };
      }
    }

    // Si no se resolvió programáticamente (no fue confirmación explícita), usar Gemini
    if (!agentResult) {
      agentResult = await processAgentMessage(
        message,
        phoneNumberId,
        to,
        name,
        center,
        staff,
        conv
      );
    }

    // Agregar respuesta al historial
    history.push({ role: "model", text: agentResult.responseText });

    // Guardar conversación actualizada
    await saveConversation(
      to,
      {
        centerId,
        centerName,
        patientName: conv.patientName || (name !== "Paciente" ? name : undefined),
        history: history.slice(-MAX_HISTORY_MESSAGES),
        interactiveOptions: agentResult.interactiveOptions,
        ...agentResult.updatedConv,
      },
      centerId
    );

    // Enviar respuesta (usando botones iteractivos si corresponden)
    const currentInteractive = agentResult.interactiveOptions;
    if (currentInteractive) {
      const i = currentInteractive;
      if (i.type === "confirmation") {
        await sendButtons(phoneNumberId, to, agentResult.responseText, [
          { id: "confirmo", title: "✅ Sí, agendar" },
          { id: "cancelar", title: "❌ Cancelar" },
        ]);
      } else if (i.type === "professionals") {
        const profs = i.data || [];
        if (profs.length > 0 && profs.length <= 3) {
          await sendButtons(
            phoneNumberId,
            to,
            agentResult.responseText,
            profs.map((p: any) => ({ id: `prof_${p.id}`, title: p.name.substring(0, 20) }))
          );
        } else if (profs.length > 3) {
          const rows = profs.slice(0, 10).map((p: any) => ({
            id: `prof_${p.id}`,
            title: p.name.substring(0, 24),
            description: (p.specialty || "").substring(0, 72),
          }));
          const listHeader = agentResult.responseText.toLowerCase().includes("médico") || agentResult.responseText.toLowerCase().includes("doctor") ? "Médicos" : "Profesionales";
          const listButton = agentResult.responseText.toLowerCase().includes("médico") || agentResult.responseText.toLowerCase().includes("doctor") ? "Ver médicos" : "Ver profesionales";
          
          await sendList(phoneNumberId, to, listHeader, agentResult.responseText, listButton, [
            { title: listHeader, rows },
          ]);
        } else {
          await sendText(phoneNumberId, to, agentResult.responseText);
        }
      } else if (i.type === "slots") {
        const slots = i.data || [];
        if (slots.length > 0 && slots.length <= 3) {
          await sendButtons(
            phoneNumberId,
            to,
            agentResult.responseText,
            slots.map((s: any) => ({ id: `slot_${s.id}`, title: s.label }))
          );
        } else if (slots.length > 3) {
          const rows = slots.slice(0, 10).map((s: any) => ({ id: `slot_${s.id}`, title: s.label }));
          await sendList(
            phoneNumberId,
            to,
            "Disponibles",
            agentResult.responseText,
            "Ver horarios",
            [{ title: "Horarios", rows }]
          );
        } else {
          await sendText(phoneNumberId, to, agentResult.responseText);
        }
      } else if (i.type === "dates") {
        const dates = i.data || [];
        if (dates.length > 0 && dates.length <= 3) {
          await sendButtons(
            phoneNumberId,
            to,
            agentResult.responseText,
            dates.map((d: any) => ({ id: `date_${d.date}`, title: d.label.substring(0, 20) }))
          );
        } else if (dates.length > 3) {
          const rows = dates.slice(0, 10).map((d: any) => ({
            id: `date_${d.date}`,
            title: d.label.substring(0, 24),
            description: `${d.count} hr${d.count !== 1 ? "s" : ""} disponible${d.count !== 1 ? "s" : ""}`,
          }));
          await sendList(
            phoneNumberId,
            to,
            "Cupos",
            agentResult.responseText,
            "Seleccionar Fecha",
            [{ title: "Próximas Fechas", rows }]
          );
        } else {
          await sendText(phoneNumberId, to, agentResult.responseText);
        }
      } else {
        await sendText(phoneNumberId, to, agentResult.responseText);
      }
    } else if (agentResult.updatedConv?.flowState === "awaiting_confirmation") {
      await sendButtons(phoneNumberId, to, agentResult.responseText, [
        { id: "confirmo", title: "✅ Sí, agendar" },
        { id: "cancelar", title: "❌ Cancelar" },
      ]);
    } else {
      await sendText(phoneNumberId, to, agentResult.responseText);
    }

    // Cierre DETERMINÍSTICO: solo limpiar si bookingSuccess fue true (no por texto)
    if (agentResult.updatedConv.bookingSuccess === true) {
      console.log(`[Agent] Booking exitoso para ${to}. Limpiando conversación.`);
      await resetConversation(to, centerId);
    }
    return;
  }

  // Fallback
  await sendText(phoneNumberId, to, `Bienvenido a *${centerName}*. ¿En qué puedo ayudarle?`);
}

// ─── WEBHOOK ─────────────────────────────────────────────────────────────────

export const whatsappWebhook = functions
  .runWith({
    timeoutSeconds: 60,
    memory: "512MB",
    secrets: ["GEMINI_API_KEY", "WHATSAPP_TOKEN", "WA_VERIFY_TOKEN"],
  })
  .https.onRequest(async (req, res) => {
    // GET — verificación del webhook por Meta
    if (req.method === "GET") {
      const verifyToken = process.env.WA_VERIFY_TOKEN || "";
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      if (mode === "subscribe" && token === verifyToken) {
        res.status(200).send(req.query["hub.challenge"]);
        return;
      }
      res.status(403).send("Forbidden");
      return;
    }

    if (req.method === "POST") {
      const body = req.body;
      const change = body.entry?.[0]?.changes?.[0]?.value;
      const message = change?.messages?.[0];

      if (message) {
        const messageId = message.id;
        const from: string = message.from;
        const contactName: string = change?.contacts?.[0]?.profile?.name || "Paciente";
        const phoneNumberId: string = change?.metadata?.phone_number_id || "";

        // Para asegurar que el webhook procese el mensaje sin que la Cloud Function se congele,
        // debemos hacer await del trabajo antes de devolver 200.
        const runWorkerAsync = async () => {
          try {
            // Idempotencia
            const idempotencyRef = db.collection("events").doc(messageId);
            const docEvent = await idempotencyRef.get();
            if (docEvent.exists) {
              console.log(`[Idempotencia] Mensaje ${messageId} ya procesado.`);
              return;
            }
            await idempotencyRef.set({
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              from,
            });

            if (message.type === "text") {
              await workerProcessor(
                phoneNumberId,
                from,
                message.text.body,
                "text",
                undefined,
                contactName
              );
            } else if (message.type === "interactive") {
              await workerProcessor(
                phoneNumberId,
                from,
                "",
                "interactive",
                message.interactive,
                contactName
              );
            }
          } catch (e) {
            console.error("[Worker] Error no manejado:", e);
          }
        };

        await runWorkerAsync();
        res.status(200).send("EVENT_RECEIVED");
        return;
      }

      res.status(200).send("OK");
      return;
    }

    res.status(405).send("Method Not Allowed");
  });

// ─── TRIGGER: NOTIFICACIÓN AL RESERVAR (WEB → WA) ────────────────────────────

export const onAppointmentBooked = functions
  .runWith({ secrets: ["WHATSAPP_TOKEN"] })
  .firestore.document("centers/{centerId}/appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === "booked" || after.status !== "booked") return;
    if (after.bookedVia === "whatsapp" || after.bookedVia === "whatsapp_agent") return;

    const phone: string = after.patientPhone || "";
    if (!phone) return;

    let waPhone = phone.replace(/\D/g, "");
    if (waPhone.length === 8) waPhone = "569" + waPhone;
    else if (waPhone.length === 9 && waPhone.startsWith("9")) waPhone = "56" + waPhone;

    const centerId: string = context.params.centerId;
    let phoneNumberId = "";
    try {
      const centerSnap = await db.collection("centers").doc(centerId).get();
      phoneNumberId = centerSnap.data()?.whatsappConfig?.phoneNumberId || "";
    } catch (e) {
      console.error("[onAppointmentBooked] Error leyendo centro:", e);
    }

    if (!phoneNumberId) {
      console.warn(`[onAppointmentBooked] Centro ${centerId} sin whatsappConfig.phoneNumberId`);
      return;
    }

    try {
      // Resolver nombre real del profesional
      let professionalName: string = after.doctorId || "Profesional";
      if (after.doctorId) {
        const staffSnap = await db
          .collection("centers")
          .doc(centerId)
          .collection("staff")
          .doc(after.doctorId)
          .get();
        if (staffSnap.exists) {
          const staffData = staffSnap.data()!;
          professionalName = staffData.fullName || staffData.name || after.doctorId;
        }
      }

      const text =
        `¡Hola *${after.patientName}*! ✅\n\n` +
        `Tu reserva está confirmada:\n` +
        `👨‍⚕️ Profesional: ${professionalName}\n` +
        `📅 Fecha: ${after.date}\n` +
        `🕐 Hora: ${after.time}\n\n` +
        `Gracias por elegirnos.`;
      await sendText(phoneNumberId, waPhone, text);

      if (after.serviceId) {
        const serviceSnap = await db
          .collection("centers")
          .doc(centerId)
          .collection("services")
          .doc(after.serviceId)
          .get();
        if (serviceSnap.exists) {
          const svc = serviceSnap.data()!;
          if (svc.preparationInstructions?.trim()) {
            await sendText(
              phoneNumberId,
              waPhone,
              `⚠️ *Preparación para ${after.serviceName || "su examen"}:*\n\n${svc.preparationInstructions}`
            );
          }
          if (svc.preparationPdfUrl?.trim()) {
            await sendRawWhatsAppPayload(phoneNumberId, {
              to: waPhone,
              type: "document",
              document: {
                link: svc.preparationPdfUrl,
                filename: `Preparacion_${(after.serviceName || "Servicio").replace(/\s+/g, "_")}.pdf`,
              },
            });
          }
        }
      }
    } catch (err) {
      console.error("[onAppointmentBooked] Error enviando WhatsApp:", err);
    }
  });

// ─── CRON: AUTO-RESCATE DE CONTROLES ──────────────────────────────────────────

export const dailyControlRescuer = functions
  .runWith({ secrets: ["WHATSAPP_TOKEN"], timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("30 9 * * *")
  .timeZone("America/Santiago")
  .onRun(async () => {
    console.log("[AutoRescate] Iniciando búsqueda de pacientes con control a 7 días...");
    const targetDate = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");

    try {
      const centersSnap = await db.collection("centers").where("isActive", "==", true).get();
      for (const centerDoc of centersSnap.docs) {
        const center = centerDoc.data();
        const centerId = centerDoc.id;
        const centerName = center.name || "Centro Médico";
        const phoneNumberId = center.whatsappConfig?.phoneNumberId;
        if (!phoneNumberId) continue;

        const patientsSnap = await db
          .collection("patients")
          .where("accessControl.centerIds", "array-contains", centerId)
          .where("active", "==", true)
          .get();

        console.log(`[AutoRescate] Revisando ${patientsSnap.size} pacientes en centro ${centerId}`);

        for (const patientDoc of patientsSnap.docs) {
          const patient = patientDoc.data();
          const phone = patient.phone;
          if (!phone) continue;

          let waPhone = phone.replace(/\D/g, "");
          if (waPhone.length === 8) waPhone = "569" + waPhone;
          else if (waPhone.length === 9 && waPhone.startsWith("9")) waPhone = "56" + waPhone;
          else if (waPhone.length === 11 && waPhone.startsWith("569")) {
          } else continue;

          const activeConsultations = (patient.consultations || []).filter(
            (c: any) => c.active !== false
          );
          if (activeConsultations.length === 0) continue;

          activeConsultations.sort(
            (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const lastConsult = activeConsultations[0];

          if (!lastConsult.nextControlDate || lastConsult.nextControlDate !== targetDate) continue;

          const targetDoctorId = lastConsult.professionalId || "";
          const targetDoctorName = lastConsult.professionalName || "su médico tratante";

          // Verificar si ya tiene cita futura
          if (targetDoctorId) {
            const existingApps = await db
              .collection("centers")
              .doc(centerId)
              .collection("appointments")
              .where("patientRut", "==", patient.rut)
              .where("status", "==", "booked")
              .where("date", ">=", format(new Date(), "yyyy-MM-dd"))
              .get();

            if (existingApps.docs.some((doc) => doc.data().doctorId === targetDoctorId)) {
              console.log(`[AutoRescate] Paciente ${patient.id} ya tiene cita futura.`);
              continue;
            }
          }

          const hasPendingExams = (lastConsult.prescriptions || []).some(
            (p: any) => p.type === "OrdenExamenes" || p.type === "Solicitud de Examen"
          );

          // Inicializar conversación de rescate con contexto para el agente
          await saveConversation(
            waPhone,
            {
              phase: "ACTIVE",
              centerId,
              centerName,
              patientName: patient.fullName,
              patientRut: patient.rut,
              patientPhone: waPhone,
              isRescuingControl: true,
              targetDoctorId,
              targetDoctorName,
              hasPendingExams,
              flowState: "idle",
              history: [],
            },
            centerId
          );

          // Enviar Template de Rescate
          const parameters = [
            { type: "text", text: patient.fullName?.split(" ")[0] || "Paciente" },
            { type: "text", text: centerName },
            { type: "text", text: targetDoctorName },
            {
              type: "text",
              text: hasPendingExams
                ? "Vimos que el doctor le solicitó exámenes en su última consulta."
                : " ",
            },
          ];

          await sendRawWhatsAppPayload(phoneNumberId, {
            to: waPhone,
            type: "template",
            template: {
              name: "recordatorio_control_asistido",
              language: { code: "es" },
              components: [
                { type: "body", parameters },
                {
                  type: "button",
                  sub_type: "quick_reply",
                  index: "0",
                  parameters: [{ type: "payload", payload: "rescate_agendar" }],
                },
                {
                  type: "button",
                  sub_type: "quick_reply",
                  index: "1",
                  parameters: [{ type: "payload", payload: "rescate_examenes" }],
                },
                {
                  type: "button",
                  sub_type: "quick_reply",
                  index: "2",
                  parameters: [{ type: "payload", payload: "action_handoff" }],
                },
              ],
            },
          });
          console.log(`[AutoRescate] Template enviado a ${waPhone}`);
        }
      }
      console.log("[AutoRescate] Proceso finalizado.");
    } catch (error) {
      console.error("[AutoRescate] Error en el cron job:", error);
    }
  });
