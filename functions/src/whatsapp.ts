import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  SchemaType,
} from "@google/generative-ai";
import { format } from "date-fns";
import { es } from "date-fns/locale";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const MAX_AGENT_TURNS = 5;
const MAX_HISTORY_MESSAGES = 10;
const CONVERSATION_TTL_HOURS = 4;
const MAX_LOG_ENTRIES = 50;
const MAX_LIST_ROWS = 10;

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY || "";
    if (!key) {
      throw new Error("[Config] GEMINI_API_KEY no disponible — verificar Firebase Secrets");
    }
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

function getWhatsappToken(): string {
  const token = process.env.WHATSAPP_TOKEN || "";
  if (!token) {
    console.error("[Config] WHATSAPP_TOKEN no disponible — verificar Firebase Secrets");
  }
  return token;
}

function normalizePhoneForWhatsapp(phone: string): string {
  let waPhone = (phone || "").replace(/\D/g, "");
  if (waPhone.length === 8) waPhone = `569${waPhone}`;
  else if (waPhone.length === 9 && waPhone.startsWith("9")) waPhone = `56${waPhone}`;
  return waPhone;
}

function parseLocalYmd(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDisplayDate(date: string): string {
  try {
    return format(parseLocalYmd(date), "EEEE d 'de' MMMM", { locale: es });
  } catch {
    return date;
  }
}

function sanitizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function extractRut(text: string): string | null {
  const match = text.match(/\b(\d{1,2}\.?(?:\d{3})\.?(?:\d{3})-[\dkK]|\d{7,8}[\dkK])\b/);
  return match ? match[1].replace(/\./g, "") : null;
}

function extractNameAndRut(text: string): { patientName?: string; patientRut?: string } {
  const patientRut = extractRut(text) || undefined;
  const textWithoutRut = patientRut
    ? text.replace(new RegExp(patientRut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
    : text;

  const candidateName = sanitizeName(
    textWithoutRut
      .replace(/\b(mi nombre es|soy|paciente|nombre|rut|r\.u\.t\.)\b/gi, " ")
      .replace(/[,:;]+/g, " "),
  );

  const patientName = candidateName.length >= 3 ? candidateName : undefined;
  return { patientName, patientRut };
}

function isAffirmativeMessage(text: string): boolean {
  const msg = text.toLowerCase().trim();
  const affirmatives = [
    "sí",
    "si",
    "confirmo",
    "dale",
    "ok",
    "okay",
    "correcto",
    "perfecto",
    "de acuerdo",
    "está bien",
    "esta bien",
    "agendar",
    "reservar",
    "confirmar",
  ];
  return affirmatives.some((value) => msg === value || msg.includes(value));
}

function isCancelMessage(text: string): boolean {
  const msg = text.toLowerCase().trim();
  const cancelWords = ["cancelar", "no", "descartar", "cambiar", "otra hora", "no confirmo"];
  return cancelWords.some((value) => msg === value || msg.includes(value));
}

// ─── CACHE POR CENTRO (multi-centro) ─────────────────────────────────────────
interface CenterCache {
  center: any;
  staff: any[];
  lastUpdate: number;
}

const centerCache: Record<string, CenterCache> = {};
const CACHE_TTL = 10 * 60 * 1000;

async function getCenterByPhoneId(phoneNumberId: string): Promise<{ center: any; staff: any[] } | null> {
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

    const staffSnap = await db
      .collection("centers")
      .doc(center.id)
      .collection("staff")
      .where("visibleInBooking", "==", true)
      .where("active", "==", true)
      .get();

    const staff = staffSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    centerCache[center.id] = { center, staff, lastUpdate: now };
    console.log(`[Chatbot] Centro cargado: ${center.name} (${center.id}), staff: ${staff.length}`);
    return { center, staff };
  } catch (error) {
    console.error("[Chatbot] Error cargando centro por phoneNumberId:", error);
    return null;
  }
}

// ─── CONVERSACIÓN CON MEMORIA (FIRESTORE) ────────────────────────────────────
interface AgentLogEntry {
  turn: number;
  tool: string;
  args: any;
  result: any;
  timestamp: string;
}

interface PendingBooking {
  slotDocId: string;
  staffId: string;
  staffName: string;
  date: string;
  time: string;
  patientName: string;
  patientRut: string;
  confirmedAt?: string;
}

interface AgentConversation {
  centerId?: string;
  centerName?: string;
  contactDisplayName?: string;
  patientName?: string;
  patientRut?: string;
  patientPhone?: string;
  history?: { role: string; text: string }[];
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
  pendingBooking?: PendingBooking | null;
  bookingSuccess?: boolean;
  isRescuingControl?: boolean;
  targetDoctorId?: string;
  targetDoctorName?: string;
  hasPendingExams?: boolean;
  phase: "ACTIVE" | "HANDOFF";
  handoffStatus?: string;
  lastAgentAction?: string;
  agentLog?: AgentLogEntry[];
  updatedAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
}

function convKey(centerId: string, phone: string): string {
  return `${centerId}_${phone}`;
}

async function getConversation(phone: string, centerId?: string): Promise<AgentConversation> {
  if (centerId) {
    const key = convKey(centerId, phone);
    const doc = await db.collection("conversations").doc(key).get();
    if (doc.exists) {
      const conv = doc.data() as AgentConversation;
      return _checkConvExpiry(conv, key);
    }
  }

  const legacyDoc = await db.collection("conversations").doc(phone).get();
  if (legacyDoc.exists) {
    const conv = legacyDoc.data() as AgentConversation;
    return _checkConvExpiry(conv, phone);
  }

  return {
    phase: "ACTIVE",
    history: [],
    flowState: "idle",
    pendingBooking: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function _checkConvExpiry(conv: AgentConversation, docId: string): Promise<AgentConversation> {
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
        pendingBooking: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }
  }

  if (conv.phase === "ACTIVE" && conv.updatedAt) {
    let lastUpdate = new Date();
    if (typeof (conv.updatedAt as any).toDate === "function") {
      lastUpdate = (conv.updatedAt as any).toDate();
    }
    const diffHours = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (diffHours >= CONVERSATION_TTL_HOURS) {
      console.log(`[Agent] Conversación ${docId} expirada por inactividad (${diffHours.toFixed(1)}h).`);
      return {
        phase: "ACTIVE",
        history: [],
        flowState: "idle",
        pendingBooking: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }
  }

  return conv;
}

async function saveConversation(phone: string, data: Partial<AgentConversation>, centerId?: string) {
  const key = centerId ? convKey(centerId, phone) : phone;
  await db
    .collection("conversations")
    .doc(key)
    .set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

export async function resetConversation(phone: string, centerId?: string) {
  const key = centerId ? convKey(centerId, phone) : phone;
  await db.collection("conversations").doc(key).delete();

  if (centerId) {
    const legacyRef = db.collection("conversations").doc(phone);
    const legacySnap = await legacyRef.get();
    if (legacySnap.exists) await legacyRef.delete();
  }
}

// ─── MENSAJERÍA WHATSAPP ──────────────────────────────────────────────────────
async function sendRawWhatsAppPayload(phoneNumberId: string, payload: any) {
  const whatsappToken = getWhatsappToken();
  if (!whatsappToken || !phoneNumberId) return;

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
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
  await sendRawWhatsAppPayload(phoneNumberId, {
    to,
    type: "text",
    text: { body: text },
  });
}

export async function sendButtons(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
) {
  await sendRawWhatsAppPayload(phoneNumberId, {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((button) => ({
          type: "reply",
          reply: { id: button.id, title: button.title },
        })),
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
  sections: any[],
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

// ─── TOOLS / HELPERS DEL AGENTE ──────────────────────────────────────────────
async function getAvailableSlots(
  centerId: string,
  staffId: string,
  date: string,
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

    if (snap.empty) return [];

    const slots = snap.docs.map((doc) => {
      const data = doc.data();
      const time = data.time || "00:00";
      return {
        id: doc.id,
        label: time,
        docId: doc.id,
      };
    });

    slots.sort((a, b) => a.label.localeCompare(b.label));
    return slots;
  } catch (error) {
    console.error("[getAvailableSlots] Error:", error);
    return [];
  }
}

async function getAlternativeDates(
  centerId: string,
  staffId: string,
  startDate: string,
): Promise<{ date: string; label: string; count: number }[]> {
  const alternatives: { date: string; label: string; count: number }[] = [];
  let current = parseLocalYmd(startDate);
  let daysChecked = 0;

  while (daysChecked < 14 && alternatives.length < 5) {
    if (current.getDay() !== 0) {
      const dateStr = format(current, "yyyy-MM-dd");
      const slots = await getAvailableSlots(centerId, staffId, dateStr);
      if (slots.length > 0) {
        alternatives.push({
          date: dateStr,
          label: format(current, "EEEE d 'de' MMMM", { locale: es }),
          count: slots.length,
        });
      }
    }

    current = new Date(current.getTime() + 86400000);
    daysChecked += 1;
  }

  return alternatives;
}

async function getAppointmentSlot(centerId: string, slotDocId: string): Promise<any | null> {
  try {
    const snap = await db
      .collection("centers")
      .doc(centerId)
      .collection("appointments")
      .doc(slotDocId)
      .get();

    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error("[getAppointmentSlot] Error:", error);
    return null;
  }
}

function getProfessionalDisplayName(staffMember: any): string {
  return staffMember?.fullName || staffMember?.name || "Profesional";
}

function isValidRut(rut: string): boolean {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 7 || clean.length > 9) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let mul = 2;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += parseInt(body[i], 10) * mul;
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
  expectedDate?: string,
): Promise<{ success: boolean; error?: string; details?: any }> {
  if (!slotDocId) return { success: false, error: "MISSING_SLOT_ID" };
  if (!centerId) return { success: false, error: "MISSING_CENTER_ID" };
  if (!patientName || sanitizeName(patientName).length < 3) {
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
    const apptRef = db.collection("centers").doc(centerId).collection("appointments").doc(slotDocId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(apptRef);
      if (!snap.exists) {
        return { success: false, error: "SLOT_NOT_FOUND" };
      }

      const slotData = snap.data()!;
      if (slotData.status !== "available") {
        return { success: false, error: "SLOT_TAKEN" };
      }

      if (staffId && slotData.doctorId !== staffId && slotData.doctorUid !== staffId) {
        return {
          success: false,
          error: "STAFF_MISMATCH",
          details: "El slot no pertenece al profesional indicado",
        };
      }

      if (expectedDate && slotData.date !== expectedDate) {
        return {
          success: false,
          error: "DATE_MISMATCH",
          details: `Slot es para ${slotData.date}, no ${expectedDate}`,
        };
      }

      const today = format(new Date(), "yyyy-MM-dd");
      if (slotData.date < today) {
        return { success: false, error: "DATE_IN_PAST" };
      }

      tx.set(
        apptRef,
        {
          patientName: sanitizeName(patientName),
          patientRut: cleanRut,
          patientPhone,
          status: "booked",
          bookedVia: "whatsapp_agent",
          doctorId: slotData.doctorId,
          doctorUid: slotData.doctorUid,
          bookedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
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
      console.log(`[Booking] ✅ Reserva exitosa: centro=${centerId} slot=${slotDocId} paciente=${cleanRut}`);
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
  reason?: string,
): Promise<void> {
  const centerId = center.id;
  const centerName = center.name || "Centro Médico";
  const secretaryPhone = center?.whatsappConfig?.secretaryPhone || "";

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
    const notif =
      `🔔 *Nueva solicitud de atención — ${centerName}*\n\n` +
      `👤 Paciente: ${patientName || "Desconocido"}\n` +
      `📱 Teléfono: +${patientPhone}\n` +
      `💬 Motivo: ${reason || "Solicitud general"}\n\n` +
      `Para atenderle, responda directamente al número del paciente.\n` +
      `_(Registro guardado en el sistema de ${centerName})_`;

    await sendText(phoneNumberId, secretaryPhone, notif);
  } else {
    console.warn(`[Handoff] Centro ${centerId} sin whatsappConfig.secretaryPhone configurado.`);
  }
}

// ─── TOOLS PARA GEMINI ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AGENT_TOOLS: any[] = [
  {
    functionDeclarations: [
      {
        name: "list_professionals",
        description:
          "Lista los profesionales médicos disponibles para agendar en el centro. Úsala cuando el paciente quiere agendar pero no especifica con quién.",
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: "get_available_slots",
        description:
          "Consulta los horarios disponibles para un profesional en una fecha específica. Requiere el ID del profesional y una fecha en formato YYYY-MM-DD.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            staffId: { type: SchemaType.STRING, description: "ID del profesional médico." },
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
        name: "confirm_booking_details",
        description:
          "Presenta un resumen de la reserva al paciente y espera su confirmación explícita. Debe llamarse antes de reservar.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            staffId: { type: SchemaType.STRING, description: "ID del profesional." },
            date: { type: SchemaType.STRING, description: "Fecha de la cita en formato YYYY-MM-DD." },
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
          "Transfiere la conversación a una secretaria humana. Usar cuando el paciente lo pide explícitamente, está frustrado o la consulta es administrativa compleja.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            reason: { type: SchemaType.STRING, description: "Motivo de la transferencia a secretaria." },
          },
          required: ["reason"],
        },
      },
    ],
  },
];

// ─── SYSTEM PROMPT DEL AGENTE ────────────────────────────────────────────────
function buildSystemPrompt(centerName: string, centerId: string, staff: any[], conv: AgentConversation): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const todayReadable = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es });
  const businessHours = "Lunes a Viernes, 08:00 a 18:00";

  let rescueContext = "";
  if (conv.isRescuingControl) {
    rescueContext = `\n\n🔴 CONTEXTO RESCATE DE CONTROL: Este paciente fue contactado proactivamente porque tiene un control médico pendiente con ${
      conv.targetDoctorName || "su médico tratante"
    }. ${
      conv.hasPendingExams
        ? "El sistema indica que TIENE exámenes pendientes por hacerse antes de su control."
        : "No tiene exámenes pendientes."
    } Tu objetivo es ayudarle a agendar su control o derivarlo con secretaría si necesita ayuda con exámenes.`;
  }

  const staffCatalog = JSON.stringify(
    staff.map((member) => ({
      id: member.id,
      name: getProfessionalDisplayName(member),
      specialty: member.specialty || member.clinicalRole || "Profesional de Salud",
    })),
  );

  const pendingSummary = conv.pendingBooking
    ? JSON.stringify({
        professional: conv.pendingBooking.staffName,
        date: conv.pendingBooking.date,
        time: conv.pendingBooking.time,
        patientName: conv.pendingBooking.patientName,
        patientRut: conv.pendingBooking.patientRut,
      })
    : "ninguna";

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
3. NO inventes horarios ni profesionales. Solo usa los que devuelvan las herramientas.
4. Para agendar, SIEMPRE necesitas: profesional, fecha, hora, nombre completo del paciente y RUT.
5. Si el paciente quiere agendar y no especifica médico, llama a list_professionals.
6. Si el paciente ya eligió profesional, privilegia suggest_alternative_dates o get_available_slots usando el estado de conversación.
7. Si hay una reserva pendiente, NO cambies profesional/fecha/hora a menos que el paciente lo pida explícitamente.
8. NUNCA asumas el nombre del paciente desde el perfil de WhatsApp. Solo considera como nombre clínico válido uno entregado explícitamente por el usuario.
9. Para consultas administrativas (valores, Isapre, convenios, reembolsos), usa trigger_handoff.
10. Si el paciente pide persona humana o está frustrado, usa trigger_handoff.
11. No menciones IDs internos al paciente.
12. Si el flujo ya tiene una reserva pendiente de confirmación, tu tarea es solo resumirla y pedir confirmación.

CATÁLOGO DE PROFESIONALES:
${staffCatalog}
${rescueContext}

ESTADO ACTUAL DE CONVERSACIÓN:
- flowState: ${conv.flowState || "idle"}
- selectedStaffId: ${conv.selectedStaffId || "ninguno"}
- selectedStaffName: ${conv.selectedStaffName || "ninguno"}
- selectedDate: ${conv.selectedDate || "ninguna"}
- selectedSlotDocId: ${conv.selectedSlotDocId || "ninguno"}
- selectedSlotTime: ${conv.selectedSlotTime || "ninguna"}
- pendingBooking: ${pendingSummary}

DATOS DEL PACIENTE:
- Nombre confirmado: ${conv.patientName || "No proporcionado"}
- RUT confirmado: ${conv.patientRut || "No proporcionado"}`;
}

// ─── PROCESADOR PRINCIPAL DEL AGENTE ─────────────────────────────────────────
async function processAgentMessage(
  message: string,
  phoneNumberId: string,
  to: string,
  contactName: string,
  center: any,
  staff: any[],
  conv: AgentConversation,
): Promise<{
  responseText: string;
  intent: "GENERAL" | "BOOKING" | "HANDOFF";
  updatedConv: Partial<AgentConversation>;
  interactiveOptions?: any;
}> {
  const centerId = center.id;
  const centerName = center.name || "Centro Médico";

  try {
    const systemPrompt = buildSystemPrompt(centerName, centerId, staff, conv);
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: AGENT_TOOLS,
      generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      systemInstruction: systemPrompt,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    const geminiHistory: any[] = (conv.history || []).slice(-MAX_HISTORY_MESSAGES).map((item) => ({
      role: item.role === "model" ? "model" : "user",
      parts: [{ text: item.text }],
    }));

    const chat = model.startChat({ history: geminiHistory });

    let intent: "GENERAL" | "BOOKING" | "HANDOFF" = "GENERAL";
    const convUpdates: Partial<AgentConversation> = {};
    const agentLog: AgentLogEntry[] = [];
    let turns = 0;
    let interactiveOptions: any = null;

    let result = await chat.sendMessage(message);
    let response = result.response;

    while (response.functionCalls()?.length && turns < MAX_AGENT_TURNS) {
      turns += 1;
      const calls = response.functionCalls()!;
      const functionResponses: any[] = [];

      for (const call of calls) {
        console.log(`[Agent] Turn ${turns}: Tool=${call.name}`, JSON.stringify(call.args));
        let toolResult: any = {};

        if (call.name === "list_professionals") {
          toolResult = {
            professionals: staff.map((member) => ({
              id: member.id,
              name: getProfessionalDisplayName(member),
              specialty: member.specialty || member.clinicalRole || "Profesional de Salud",
            })),
          };
          intent = "BOOKING";
          interactiveOptions = { type: "professionals", data: toolResult.professionals };
        } else if (call.name === "get_available_slots") {
          const args = call.args as any;
          const slots = await getAvailableSlots(centerId, args.staffId, args.date);
          toolResult = {
            date: args.date,
            slots: slots.map((slot) => ({ time: slot.label, docId: slot.docId })),
            count: slots.length,
            message:
              slots.length > 0
                ? `${slots.length} horario(s) disponible(s) para ${args.date}: ${slots.map((slot) => slot.label).join(", ")}`
                : `No hay horarios disponibles para ${args.date}.`,
          };
          convUpdates.selectedStaffId = args.staffId;
          convUpdates.selectedDate = args.date;
          intent = "BOOKING";
          interactiveOptions = { type: "slots", data: [...slots] };
        } else if (call.name === "suggest_alternative_dates") {
          const args = call.args as any;
          const alternatives = await getAlternativeDates(centerId, args.staffId, args.startDate);
          toolResult = {
            alternatives,
            message:
              alternatives.length > 0
                ? `Fechas con disponibilidad: ${alternatives
                    .map((alt) => `${alt.label} (${alt.count} hora${alt.count !== 1 ? "s" : ""})`)
                    .join(", ")}`
                : "No se encontró disponibilidad en los próximos 14 días.",
          };
          intent = "BOOKING";
          interactiveOptions = { type: "dates", data: alternatives };
        } else if (call.name === "confirm_booking_details") {
          const args = call.args as any;
          const slots = await getAvailableSlots(centerId, args.staffId, args.date);
          const matchedSlot = slots.find((slot) => slot.label === args.time || slot.label.startsWith(args.time));

          if (!matchedSlot) {
            toolResult = {
              success: false,
              error: "SLOT_UNAVAILABLE",
              message: `Lo lamento, la hora ${args.time} del ${args.date} ya no está disponible. Por favor, ofrezca otras opciones.`,
            };
          } else {
            const staffMember = staff.find((member) => member.id === args.staffId);
            const staffName = getProfessionalDisplayName(staffMember);
            const pending: PendingBooking = {
              slotDocId: matchedSlot.docId,
              staffId: args.staffId,
              staffName,
              date: args.date,
              time: args.time,
              patientName: sanitizeName(args.patientName),
              patientRut: args.patientRut,
            };

            convUpdates.pendingBooking = pending;
            convUpdates.flowState = "awaiting_confirmation";
            convUpdates.selectedStaffName = staffName;
            convUpdates.selectedStaffId = args.staffId;
            convUpdates.selectedDate = args.date;
            convUpdates.selectedSlotDocId = matchedSlot.docId;
            convUpdates.selectedSlotTime = args.time;

            toolResult = {
              success: true,
              summary: {
                professional: staffName,
                date: args.date,
                time: args.time,
                patientName: sanitizeName(args.patientName),
                patientRut: args.patientRut,
              },
              message: `Resumen de reserva: ${staffName}, ${args.date} a las ${args.time}, paciente ${sanitizeName(
                args.patientName,
              )} (RUT: ${args.patientRut}). Presentar al paciente para confirmación.`,
            };
            intent = "BOOKING";
            interactiveOptions = { type: "confirmation" };
          }
        } else if (call.name === "get_center_info") {
          toolResult = {
            name: centerName,
            address: center.address || "No disponible",
            phone: center.contactPhone || center.phone || "No disponible",
            businessHours: center.businessHours || "Lunes a Viernes, 08:00 a 18:00",
            googleMapsUrl: center.googleMapsUrl || null,
          };
        } else if (call.name === "trigger_handoff") {
          const args = call.args as any;
          await triggerHandoff(phoneNumberId, to, conv.patientName || contactName, center, args.reason);
          convUpdates.phase = "HANDOFF";
          convUpdates.handoffStatus = "pending";
          intent = "HANDOFF";
          toolResult = { success: true, message: "Transferencia a secretaria registrada." };
        }

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
      }

      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    let responseText = "";
    try {
      responseText = response.text() || "";
    } catch {
      // no-op
    }

    if (!responseText && agentLog.length > 0) {
      responseText = agentLog[agentLog.length - 1].result?.message || "";
    }

    responseText = responseText || "Disculpe, ¿podría repetir su consulta?";

    if (agentLog.length > 0) {
      const merged = [...(conv.agentLog || []), ...agentLog].slice(-MAX_LOG_ENTRIES);
      convUpdates.agentLog = merged;
    }

    return { responseText, intent, updatedConv: convUpdates, interactiveOptions };
  } catch (error) {
    console.error("[Agent] Error crítico:", error);
    return {
      responseText: "Lo siento, tuve un problema procesando su solicitud. ¿Podría intentarlo nuevamente?",
      intent: "GENERAL",
      updatedConv: {},
    };
  }
}

async function sendInteractiveOptions(
  phoneNumberId: string,
  to: string,
  responseText: string,
  interactiveOptions: any,
) {
  const interactive = interactiveOptions;

  if (!interactive) {
    await sendText(phoneNumberId, to, responseText);
    return;
  }

  if (interactive.type === "confirmation") {
    await sendButtons(phoneNumberId, to, responseText, [
      { id: "confirmo", title: "✅ Sí, agendar" },
      { id: "cancelar", title: "❌ Cancelar" },
    ]);
    return;
  }

  if (interactive.type === "professionals") {
    const professionals = interactive.data || [];
    if (professionals.length > 0 && professionals.length <= 3) {
      await sendButtons(
        phoneNumberId,
        to,
        responseText,
        professionals.map((professional: any) => ({
          id: `prof_${professional.id}`,
          title: getProfessionalDisplayName(professional).substring(0, 20),
        })),
      );
      return;
    }

    if (professionals.length > 3) {
      const rows = professionals.slice(0, MAX_LIST_ROWS).map((professional: any) => ({
        id: `prof_${professional.id}`,
        title: getProfessionalDisplayName(professional).substring(0, 24),
        description: (professional.specialty || "").substring(0, 72),
      }));
      await sendList(phoneNumberId, to, "Profesionales", responseText, "Ver médicos", [
        { title: "Médicos", rows },
      ]);
      return;
    }
  }

  if (interactive.type === "dates") {
    const dates = interactive.data || [];
    if (dates.length > 0 && dates.length <= 3) {
      await sendButtons(
        phoneNumberId,
        to,
        responseText,
        dates.map((dateItem: any) => ({
          id: `date_${dateItem.date}`,
          title: dateItem.label.substring(0, 20),
        })),
      );
      return;
    }

    if (dates.length > 3) {
      const rows = dates.slice(0, MAX_LIST_ROWS).map((dateItem: any) => ({
        id: `date_${dateItem.date}`,
        title: dateItem.label.substring(0, 24),
        description: `${dateItem.count} hrs disp.`.substring(0, 72),
      }));
      await sendList(phoneNumberId, to, "Fechas", responseText, "Ver fechas", [
        { title: "Próximos días", rows },
      ]);
      return;
    }
  }

  if (interactive.type === "slots") {
    const slots = interactive.data || [];
    if (slots.length > 0 && slots.length <= 3) {
      await sendButtons(
        phoneNumberId,
        to,
        responseText,
        slots.map((slot: any) => ({ id: `slot_${slot.docId}`, title: slot.label.substring(0, 20) })),
      );
      return;
    }

    if (slots.length > 3) {
      const rows = slots.slice(0, MAX_LIST_ROWS).map((slot: any) => ({
        id: `slot_${slot.docId}`,
        title: slot.label.substring(0, 24),
      }));
      await sendList(phoneNumberId, to, "Horarios", responseText, "Ver horarios", [
        { title: "Disponibles", rows },
      ]);
      return;
    }
  }

  await sendText(phoneNumberId, to, responseText);
}

async function buildPendingBookingFromSlot(
  centerId: string,
  staff: any[],
  slotDocId: string,
  patientName: string,
  patientRut: string,
): Promise<PendingBooking | null> {
  const slot = await getAppointmentSlot(centerId, slotDocId);
  if (!slot || slot.status !== "available") return null;

  const staffId = slot.doctorId || slot.doctorUid || "";
  const staffMember = staff.find((member) => member.id === staffId);
  const staffName = getProfessionalDisplayName(staffMember);

  return {
    slotDocId,
    staffId,
    staffName,
    date: slot.date,
    time: slot.time,
    patientName: sanitizeName(patientName),
    patientRut,
  };
}

async function handleProfessionalSelection(
  phoneNumberId: string,
  to: string,
  centerId: string,
  centerName: string,
  staff: any[],
  conv: AgentConversation,
  staffId: string,
) {
  const staffMember = staff.find((member) => member.id === staffId);
  if (!staffMember) {
    await sendText(phoneNumberId, to, "No pude identificar ese profesional. Por favor, intente nuevamente.");
    return;
  }

  const staffName = getProfessionalDisplayName(staffMember);
  const dates = await getAlternativeDates(centerId, staffId, format(new Date(), "yyyy-MM-dd"));

  await saveConversation(
    to,
    {
      centerId,
      centerName,
      selectedStaffId: staffId,
      selectedStaffName: staffName,
      selectedDate: undefined,
      selectedSlotDocId: undefined,
      selectedSlotTime: undefined,
      flowState: "exploring",
      pendingBooking: null,
    },
    centerId,
  );

  if (dates.length === 0) {
    await sendText(
      phoneNumberId,
      to,
      `Por ahora no encontré horarios disponibles con ${staffName} en los próximos 14 días. ¿Desea que la derive a secretaría para ayudarle?`,
    );
    return;
  }

  await sendInteractiveOptions(phoneNumberId, to, `Estos son los próximos días con disponibilidad para ${staffName}:`, {
    type: "dates",
    data: dates,
  });
}

async function handleDateSelection(
  phoneNumberId: string,
  to: string,
  centerId: string,
  centerName: string,
  conv: AgentConversation,
  date: string,
) {
  if (!conv.selectedStaffId) {
    await sendText(
      phoneNumberId,
      to,
      "Necesito que primero seleccione el profesional. Escriba “agendar” y le mostraré las opciones.",
    );
    return;
  }

  const slots = await getAvailableSlots(centerId, conv.selectedStaffId, date);
  await saveConversation(
    to,
    {
      centerId,
      centerName,
      selectedDate: date,
      selectedSlotDocId: undefined,
      selectedSlotTime: undefined,
      flowState: "exploring",
      pendingBooking: null,
    },
    centerId,
  );

  if (slots.length === 0) {
    await sendText(
      phoneNumberId,
      to,
      `No encontré horas disponibles para ${formatDisplayDate(date)}. Puede elegir otra fecha del listado.`,
    );
    return;
  }

  await sendInteractiveOptions(phoneNumberId, to, `Estas son las horas disponibles para ${formatDisplayDate(date)}:`, {
    type: "slots",
    data: slots,
  });
}

async function handleSlotSelection(
  phoneNumberId: string,
  to: string,
  centerId: string,
  centerName: string,
  conv: AgentConversation,
  staff: any[],
  slotDocId: string,
) {
  const slot = await getAppointmentSlot(centerId, slotDocId);
  if (!slot || slot.status !== "available") {
    await sendText(
      phoneNumberId,
      to,
      "Lo lamento, esa hora ya no está disponible. Por favor seleccione otra del listado.",
    );
    return;
  }

  const staffId = slot.doctorId || slot.doctorUid || conv.selectedStaffId || "";
  const staffMember = staff.find((member) => member.id === staffId);
  const staffName = getProfessionalDisplayName(staffMember);

  const updateBase: Partial<AgentConversation> = {
    centerId,
    centerName,
    selectedStaffId: staffId,
    selectedStaffName: staffName,
    selectedDate: slot.date,
    selectedSlotDocId: slotDocId,
    selectedSlotTime: slot.time,
    selectedSlotLabel: slot.time,
    pendingBooking: null,
  };

  if (conv.patientName && conv.patientRut) {
    const pendingBooking = await buildPendingBookingFromSlot(
      centerId,
      staff,
      slotDocId,
      conv.patientName,
      conv.patientRut,
    );

    if (!pendingBooking) {
      await sendText(phoneNumberId, to, "Lo lamento, esa hora ya no está disponible. Por favor elija otra.");
      return;
    }

    await saveConversation(
      to,
      { ...updateBase, flowState: "awaiting_confirmation", pendingBooking },
      centerId,
    );

    const summary =
      `Por favor confirme la reserva:\n` +
      `👨‍⚕️ Profesional: ${pendingBooking.staffName}\n` +
      `📅 Fecha: ${pendingBooking.date}\n` +
      `🕐 Hora: ${pendingBooking.time}\n` +
      `👤 Paciente: ${pendingBooking.patientName}\n` +
      `🪪 RUT: ${pendingBooking.patientRut}`;

    await sendButtons(phoneNumberId, to, summary, [
      { id: "confirmo", title: "✅ Sí, agendar" },
      { id: "cancelar", title: "❌ Cancelar" },
    ]);
    return;
  }

  await saveConversation(to, { ...updateBase, flowState: "awaiting_name" }, centerId);
  await sendText(
    phoneNumberId,
    to,
    `Ha seleccionado ${staffName} el ${slot.date} a las ${slot.time}.\n\nPor favor, indíqueme el nombre completo del paciente y su RUT para continuar.`,
  );
}

async function handleAwaitingPatientData(
  phoneNumberId: string,
  to: string,
  centerId: string,
  centerName: string,
  conv: AgentConversation,
  staff: any[],
  message: string,
): Promise<boolean> {
  if (!conv.selectedSlotDocId) return false;
  if (!["awaiting_name", "awaiting_rut"].includes(conv.flowState || "")) return false;

  const parsed = extractNameAndRut(message);
  const candidateName = parsed.patientName || conv.patientName;
  const candidateRut = parsed.patientRut || conv.patientRut;

  if (!candidateName || !candidateRut) {
    await sendText(
      phoneNumberId,
      to,
      "Para continuar necesito ambos datos: nombre completo del paciente y RUT. Ejemplo: Juan Pérez 12.345.678-5",
    );
    return true;
  }

  if (!isValidRut(candidateRut)) {
    await sendText(phoneNumberId, to, "El RUT ingresado no es válido. Por favor revíselo y envíelo nuevamente.");
    return true;
  }

  const pendingBooking = await buildPendingBookingFromSlot(
    centerId,
    staff,
    conv.selectedSlotDocId,
    candidateName,
    candidateRut,
  );

  if (!pendingBooking) {
    await saveConversation(
      to,
      {
        centerId,
        centerName,
        flowState: "idle",
        pendingBooking: null,
        selectedSlotDocId: undefined,
        selectedSlotTime: undefined,
      },
      centerId,
    );
    await sendText(
      phoneNumberId,
      to,
      "Lo lamento, esa hora dejó de estar disponible. Puedo mostrarle otras opciones si lo desea.",
    );
    return true;
  }

  await saveConversation(
    to,
    {
      centerId,
      centerName,
      patientName: sanitizeName(candidateName),
      patientRut: candidateRut,
      pendingBooking,
      flowState: "awaiting_confirmation",
    },
    centerId,
  );

  const summary =
    `Por favor confirme la reserva:\n` +
    `👨‍⚕️ Profesional: ${pendingBooking.staffName}\n` +
    `📅 Fecha: ${pendingBooking.date}\n` +
    `🕐 Hora: ${pendingBooking.time}\n` +
    `👤 Paciente: ${pendingBooking.patientName}\n` +
    `🪪 RUT: ${pendingBooking.patientRut}`;

  await sendButtons(phoneNumberId, to, summary, [
    { id: "confirmo", title: "✅ Sí, agendar" },
    { id: "cancelar", title: "❌ Cancelar" },
  ]);
  return true;
}

async function handleBookingConfirmation(
  phoneNumberId: string,
  to: string,
  centerId: string,
  centerName: string,
  conv: AgentConversation,
  message: string,
): Promise<boolean> {
  if (conv.flowState !== "awaiting_confirmation" || !conv.pendingBooking) return false;

  if (isCancelMessage(message)) {
    await saveConversation(
      to,
      {
        centerId,
        centerName,
        flowState: "idle",
        pendingBooking: null,
        selectedSlotDocId: undefined,
        selectedSlotTime: undefined,
      },
      centerId,
    );
    await sendText(
      phoneNumberId,
      to,
      "Entendido, cancelé el proceso de reserva. Si desea, puedo mostrarle otras horas.",
    );
    return true;
  }

  if (!isAffirmativeMessage(message)) {
    await sendText(phoneNumberId, to, "Quedo atento. Puede responder “confirmo” para agendar o “cancelar” para detener el proceso.");
    return true;
  }

  const pending = { ...conv.pendingBooking, confirmedAt: new Date().toISOString() };
  const bookResult = await bookAppointmentTool(
    centerId,
    pending.slotDocId,
    pending.patientName,
    pending.patientRut,
    to,
    pending.staffId,
    pending.date,
  );

  const errorMessages: Record<string, string> = {
    SLOT_TAKEN: "ese horario ya fue reservado por otro paciente",
    INVALID_RUT: "el RUT proporcionado no es válido",
    STAFF_MISMATCH: "el slot no corresponde al profesional",
    DATE_MISMATCH: "la fecha del slot no coincide",
    DATE_IN_PAST: "la fecha ya pasó",
    SLOT_NOT_FOUND: "el horario ya no existe",
    MISSING_SLOT_ID: "falta el identificador del horario",
    INVALID_NAME: "el nombre es inválido",
    TECHNICAL_ERROR: "ocurrió un problema técnico",
  };

  if (bookResult.success) {
    await sendText(
      phoneNumberId,
      to,
      `¡Listo! Su cita quedó agendada con ${pending.staffName} para el ${pending.date} a las ${pending.time}. Muchas gracias.`,
    );

    await resetConversation(to, centerId);
    return true;
  }

  await saveConversation(
    to,
    {
      centerId,
      centerName,
      flowState: "idle",
      pendingBooking: null,
      bookingSuccess: false,
    },
    centerId,
  );

  await sendText(
    phoneNumberId,
    to,
    `Lo lamento, no se pudo agendar porque ${errorMessages[bookResult.error || "TECHNICAL_ERROR"]}. ¿Desea buscar otra hora?`,
  );
  return true;
}

// ─── PROCESADOR PRINCIPAL DE MENSAJES ────────────────────────────────────────
async function workerProcessor(
  phoneNumberId: string,
  to: string,
  message: string,
  type: "text" | "interactive",
  interactiveData?: any,
  contactName?: string,
) {
  const centerData = await getCenterByPhoneId(phoneNumberId);
  if (!centerData) {
    await sendText(
      phoneNumberId,
      to,
      "Lo sentimos, no pudimos identificar el centro médico. Por favor contacte directamente.",
    );
    return;
  }

  const { center, staff } = centerData;
  const centerId = center.id;
  const centerName = center.name || "Centro Médico";

  let conv = await getConversation(to, centerId);
  const displayName = contactName || conv.contactDisplayName || "Paciente";

  if (conv.phase === "HANDOFF") {
    await sendText(
      phoneNumberId,
      to,
      `Su solicitud ya está siendo atendida por el equipo de *${conv.centerName || centerName}*. Le contactarán a la brevedad.`,
    );
    return;
  }

  if (type === "interactive" && interactiveData) {
    const iType = interactiveData.type;

    if (iType === "button_reply") {
      const btnId: string = interactiveData.button_reply.id;

      if (btnId === "rescate_agendar") {
        message = conv.targetDoctorId
          ? `Quiero agendar mi control médico con ${conv.targetDoctorName || "mi médico"}`
          : "Quiero agendar una hora médica";
        type = "text";
      } else if (btnId === "rescate_examenes") {
        await sendText(
          phoneNumberId,
          to,
          "¡Entendido! Lo contactaremos para ayudarle con sus exámenes. Opcionalmente, puede enviar una foto de la orden por aquí para agilizar el trámite. 📸",
        );
        await saveConversation(to, { phase: "HANDOFF", centerId, centerName }, centerId);
        await triggerHandoff(
          phoneNumberId,
          to,
          conv.patientName || displayName,
          center,
          "Agendamiento de exámenes previos a control",
        );
        return;
      } else if (btnId === "action_handoff") {
        await sendText(
          phoneNumberId,
          to,
          `Entendido, ${displayName}. ✅\n\nUna secretaria de *${centerName}* se comunicará con usted a la brevedad.`,
        );
        await saveConversation(to, { phase: "HANDOFF", centerId, centerName }, centerId);
        await triggerHandoff(
          phoneNumberId,
          to,
          conv.patientName || displayName,
          center,
          "Solicitud directa del paciente",
        );
        return;
      } else if (btnId === "menu_agendar") {
        message = "Quiero agendar una cita médica";
        type = "text";
      } else if (btnId === "confirmo") {
        const handled = await handleBookingConfirmation(
          phoneNumberId,
          to,
          centerId,
          centerName,
          conv,
          "confirmo",
        );
        if (handled) return;
      } else if (btnId === "cancelar") {
        const handled = await handleBookingConfirmation(
          phoneNumberId,
          to,
          centerId,
          centerName,
          conv,
          "cancelar",
        );
        if (handled) return;
      } else if (btnId.startsWith("prof_")) {
        const staffId = btnId.replace(/^prof_/, "");
        await handleProfessionalSelection(phoneNumberId, to, centerId, centerName, staff, conv, staffId);
        return;
      } else if (btnId.startsWith("date_")) {
        const date = btnId.replace(/^date_/, "");
        await handleDateSelection(phoneNumberId, to, centerId, centerName, conv, date);
        return;
      } else if (btnId.startsWith("slot_")) {
        const slotDocId = btnId.replace(/^slot_/, "");
        await handleSlotSelection(phoneNumberId, to, centerId, centerName, conv, staff, slotDocId);
        return;
      } else {
        message = interactiveData.button_reply.title || btnId;
        type = "text";
      }
    }

    if (iType === "list_reply") {
      const rowId: string = interactiveData.list_reply.id || "";

      if (rowId.startsWith("prof_")) {
        const staffId = rowId.replace(/^prof_/, "");
        await handleProfessionalSelection(phoneNumberId, to, centerId, centerName, staff, conv, staffId);
        return;
      }

      if (rowId.startsWith("date_")) {
        const date = rowId.replace(/^date_/, "");
        await handleDateSelection(phoneNumberId, to, centerId, centerName, conv, date);
        return;
      }

      if (rowId.startsWith("slot_")) {
        const slotDocId = rowId.replace(/^slot_/, "");
        await handleSlotSelection(phoneNumberId, to, centerId, centerName, conv, staff, slotDocId);
        return;
      }

      const title = interactiveData.list_reply.title || "";
      const desc = interactiveData.list_reply.description || "";
      message = `${title}${desc ? ` - ${desc}` : ""}`;
      type = "text";
    }
  }

  if (type === "text" && message) {
    const normalizedMessage = message.toLowerCase().trim();
    const history = [...(conv.history || [])];
    history.push({ role: "user", text: message });

    const asksForMenu = ["menu", "menú", "opciones", "volver al menu", "volver al menú"].includes(
      normalizedMessage,
    );
    const greetings = [
      "hola",
      "buenas",
      "buenos días",
      "buenas tardes",
      "buenas noches",
      "alo",
      "hi",
      "hello",
      "holi",
      "holis",
      "saludos",
    ];
    const isGreeting = greetings.includes(normalizedMessage);
    const isHistoryEmpty = !conv.history || conv.history.length === 0;

    if ((isHistoryEmpty && isGreeting) || asksForMenu) {
      if (asksForMenu) {
        await resetConversation(to, centerId);
        conv = await getConversation(to, centerId);
      }

      await sendButtons(
        phoneNumberId,
        to,
        `¡Hola, ${displayName.split(" ")[0]}! Bienvenido a *${centerName}*.\n\nSoy el asistente virtual del centro médico. Por favor, seleccione una opción:`,
        [
          { id: "menu_agendar", title: "📅 Agendar Cita" },
          { id: "rescate_examenes", title: "🩸 Pedir Exámenes" },
          { id: "action_handoff", title: "👩‍💼 Secretaría" },
        ],
      );

      await saveConversation(
        to,
        {
          centerId,
          centerName,
          contactDisplayName: displayName,
          history: [],
          pendingBooking: null,
          flowState: "idle",
        },
        centerId,
      );
      return;
    }

    const handledAwaitingData = await handleAwaitingPatientData(
      phoneNumberId,
      to,
      centerId,
      centerName,
      conv,
      staff,
      message,
    );
    if (handledAwaitingData) return;

    const handledConfirmation = await handleBookingConfirmation(
      phoneNumberId,
      to,
      centerId,
      centerName,
      conv,
      message,
    );
    if (handledConfirmation) return;

    const agentResult = await processAgentMessage(message, phoneNumberId, to, displayName, center, staff, conv);

    history.push({ role: "model", text: agentResult.responseText });

    await saveConversation(
      to,
      {
        centerId,
        centerName,
        contactDisplayName: displayName,
        history: history.slice(-MAX_HISTORY_MESSAGES),
        ...agentResult.updatedConv,
      },
      centerId,
    );

    if (agentResult.interactiveOptions) {
      await sendInteractiveOptions(phoneNumberId, to, agentResult.responseText, agentResult.interactiveOptions);
    } else if (agentResult.updatedConv?.flowState === "awaiting_confirmation") {
      await sendButtons(phoneNumberId, to, agentResult.responseText, [
        { id: "confirmo", title: "✅ Sí, agendar" },
        { id: "cancelar", title: "❌ Cancelar" },
      ]);
    } else {
      await sendText(phoneNumberId, to, agentResult.responseText);
    }

    if (agentResult.updatedConv.bookingSuccess === true) {
      console.log(`[Agent] Booking exitoso para ${to}. Limpiando conversación.`);
      await resetConversation(to, centerId);
    }
    return;
  }

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
      const incomingMessage = change?.messages?.[0];

      if (incomingMessage) {
        const messageId = incomingMessage.id;
        const from: string = incomingMessage.from;
        const contactName: string = change?.contacts?.[0]?.profile?.name || "Paciente";
        const phoneNumberId: string = change?.metadata?.phone_number_id || "";

        const runWorkerAsync = async () => {
          try {
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

            if (incomingMessage.type === "text") {
              await workerProcessor(phoneNumberId, from, incomingMessage.text.body, "text", undefined, contactName);
            } else if (incomingMessage.type === "interactive") {
              await workerProcessor(
                phoneNumberId,
                from,
                "",
                "interactive",
                incomingMessage.interactive,
                contactName,
              );
            }
          } catch (error) {
            console.error("[Worker] Error no manejado:", error);
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

// ─── TRIGGER: NOTIFICACIÓN AL RESERVAR (WEB → WA) ───────────────────────────
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

    const waPhone = normalizePhoneForWhatsapp(phone);
    if (!waPhone) return;

    const centerId: string = context.params.centerId;
    let phoneNumberId = "";
    try {
      const centerSnap = await db.collection("centers").doc(centerId).get();
      phoneNumberId = centerSnap.data()?.whatsappConfig?.phoneNumberId || "";
    } catch (error) {
      console.error("[onAppointmentBooked] Error leyendo centro:", error);
    }

    if (!phoneNumberId) {
      console.warn(`[onAppointmentBooked] Centro ${centerId} sin whatsappConfig.phoneNumberId`);
      return;
    }

    try {
      let professionalName: string = after.doctorId || "Profesional";
      if (after.doctorId) {
        const staffSnap = await db.collection("centers").doc(centerId).collection("staff").doc(after.doctorId).get();
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
        const serviceSnap = await db.collection("centers").doc(centerId).collection("services").doc(after.serviceId).get();
        if (serviceSnap.exists) {
          const serviceData = serviceSnap.data()!;
          if (serviceData.preparationInstructions?.trim()) {
            await sendText(
              phoneNumberId,
              waPhone,
              `⚠️ *Preparación para ${after.serviceName || "su examen"}:*\n\n${serviceData.preparationInstructions}`,
            );
          }
          if (serviceData.preparationPdfUrl?.trim()) {
            await sendRawWhatsAppPayload(phoneNumberId, {
              to: waPhone,
              type: "document",
              document: {
                link: serviceData.preparationPdfUrl,
                filename: `Preparacion_${(after.serviceName || "Servicio").replace(/\s+/g, "_")}.pdf`,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("[onAppointmentBooked] Error enviando WhatsApp:", error);
    }
  });

// ─── CRON: AUTO-RESCATE DE CONTROLES ─────────────────────────────────────────
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

          const waPhone = normalizePhoneForWhatsapp(phone);
          if (!waPhone || !waPhone.startsWith("56")) continue;

          const activeConsultations = (patient.consultations || []).filter((item: any) => item.active !== false);
          if (activeConsultations.length === 0) continue;

          activeConsultations.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastConsult = activeConsultations[0];

          if (!lastConsult.nextControlDate || lastConsult.nextControlDate !== targetDate) continue;

          const targetDoctorId = lastConsult.professionalId || "";
          const targetDoctorName = lastConsult.professionalName || "su médico tratante";

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
            (prescription: any) =>
              prescription.type === "OrdenExamenes" || prescription.type === "Solicitud de Examen",
          );

          await saveConversation(
            waPhone,
            {
              phase: "ACTIVE",
              centerId,
              centerName,
              contactDisplayName: patient.fullName,
              patientName: patient.fullName,
              patientRut: patient.rut,
              patientPhone: waPhone,
              isRescuingControl: true,
              targetDoctorId,
              targetDoctorName,
              hasPendingExams,
              flowState: "idle",
              history: [],
              pendingBooking: null,
            },
            centerId,
          );

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
