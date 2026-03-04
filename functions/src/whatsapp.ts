import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Inicializar admin una sola vez
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const VERIFY_TOKEN = "clavesalud_bot_2026";

// ─── CACHE POR CENTRO (multi-centro) ─────────────────────────────────────────
// Cacheamos por centerId para soportar múltiples centros simultáneamente.
// La clave de entrada es phoneNumberId → busca centerId → guarda en cache.
interface CenterCache {
    center: any;
    staff: any[];
    lastUpdate: number;
}
const centerCache: Record<string, CenterCache> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

/**
 * Obtiene el centro y su staff a partir del phoneNumberId de WhatsApp.
 * Cada número de WA Business corresponde a un centro médico.
 *
 * En Firestore, el centro debe tener:
 *   centers/{centerId}.whatsappConfig.phoneNumberId = "123456789"
 */
async function getCenterByPhoneId(phoneNumberId: string): Promise<{ center: any; staff: any[] } | null> {
    const now = Date.now();

    // Buscar en cache (evitar Firestore reads en cada mensaje)
    for (const cached of Object.values(centerCache)) {
        if (
            cached.center?.whatsappConfig?.phoneNumberId === phoneNumberId &&
            (now - cached.lastUpdate) < CACHE_TTL
        ) {
            return { center: cached.center, staff: cached.staff };
        }
    }

    // Cache miss → consultar Firestore
    try {
        const snap = await db.collection("centers")
            .where("whatsappConfig.phoneNumberId", "==", phoneNumberId)
            .where("isActive", "==", true)
            .limit(1)
            .get();

        if (snap.empty) {
            console.warn(`[Chatbot] No se encontró centro para phoneNumberId=${phoneNumberId}`);
            return null;
        }

        const centerDoc = snap.docs[0];
        const center: any = { id: centerDoc.id, ...centerDoc.data() };

        // Cargar staff visible en agendamiento online
        const staffSnap = await db.collection("centers").doc(center.id)
            .collection("staff")
            .where("visibleInBooking", "==", true)
            .where("active", "==", true)
            .get();
        const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Guardar en cache
        centerCache[center.id] = { center, staff, lastUpdate: now };
        console.log(`[Chatbot] Centro cargado: ${center.name} (${center.id}), staff: ${staff.length}`);
        return { center, staff };
    } catch (error) {
        console.error("[Chatbot] Error cargando centro por phoneNumberId:", error);
        return null;
    }
}

// ─── GESTIÓN DE CONVERSACIÓN (FIRESTORE) ─────────────────────────────────────

type BotState =
    | "IDLE"
    | "CHOOSING_DOCTOR"
    | "CHOOSING_DATE"
    | "CHOOSING_SLOT"
    | "COLLECTING_NAME"
    | "COLLECTING_RUT"
    | "COLLECTING_PHONE"
    | "CONFIRMING"
    | "HANDOFF";

interface Conversation {
    state: BotState;
    centerId?: string;
    centerName?: string;
    selectedStaffId?: string;
    selectedStaffName?: string;
    selectedDate?: string;
    selectedSlotId?: string;
    selectedSlotLabel?: string;
    patientName?: string;
    patientRut?: string;
    patientPhone?: string;
    updatedAt: admin.firestore.FieldValue;
}

async function getConversation(phone: string): Promise<Conversation> {
    const doc = await db.collection("conversations").doc(phone).get();
    if (!doc.exists) {
        return { state: "IDLE", updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    }
    return doc.data() as Conversation;
}

async function setConversation(phone: string, data: Partial<Conversation>) {
    await db.collection("conversations").doc(phone).set(
        { ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
    );
}

export async function _resetConversation(phone: string) {
    await db.collection("conversations").doc(phone).delete();
}

// ─── MENSAJERÍA WHATSAPP ──────────────────────────────────────────────────────

async function sendRawWhatsAppPayload(phoneNumberId: string, payload: any) {
    if (!WHATSAPP_TOKEN || !phoneNumberId) return;
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
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

async function sendButtons(
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
                buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } }))
            }
        }
    });
}

async function sendList(
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
            action: { button: buttonLabel, sections }
        }
    });
}

// ─── SLOTS DISPONIBLES REALES (FIRESTORE) ─────────────────────────────────────

/**
 * Consulta Firestore para obtener los horarios disponibles del médico en la
 * fecha indicada. Reemplaza el stub anterior de horas fijas.
 */
async function getAvailableSlots(
    centerId: string,
    staffId: string,
    date: string
): Promise<{ id: string; label: string; docId: string }[]> {
    try {
        const snap = await db
            .collection("centers").doc(centerId)
            .collection("appointments")
            .where("doctorId", "==", staffId)
            .where("date", "==", date)
            .where("status", "==", "available")
            .orderBy("time", "asc")
            .get();

        if (snap.empty) return [];

        return snap.docs.map(d => {
            const data = d.data();
            const time: string = data.time || "00:00";
            return {
                id: time.replace(":", ""),   // "09:00" → "0900"
                label: time,                  // "09:00"
                docId: d.id
            };
        });
    } catch (error) {
        console.error("[getAvailableSlots] Error:", error);
        return [];
    }
}

// ─── HANDOFF A SECRETARIA REAL ────────────────────────────────────────────────

/**
 * Cuando el paciente quiere hablar con la secretaria:
 * 1. Crea un documento en /centers/{centerId}/handoff_requests (visible en Admin)
 * 2. Envía notificación WhatsApp al número de la secretaria del centro
 */
async function triggerHandoff(
    phoneNumberId: string,
    patientPhone: string,
    conv: Conversation,
    center: any
): Promise<void> {
    const centerId = center.id;
    const centerName: string = center.name || "Centro Médico";
    const secretaryPhone: string = center?.whatsappConfig?.secretaryPhone || "";

    // 1. Guardar en Firestore para que Admin lo vea
    try {
        const handoffRef = db
            .collection("centers").doc(centerId)
            .collection("handoff_requests")
            .doc();

        await handoffRef.set({
            id: handoffRef.id,
            patientPhone,
            patientName: conv.patientName || "Desconocido",
            previousState: conv.state,
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "pending",                // pending | attended | closed
            assignedTo: null,
            conversationSnapshot: conv,
            centerId,
        });
        console.log(`[Handoff] Solicitud creada: ${handoffRef.id} para ${patientPhone}`);
    } catch (error) {
        console.error("[Handoff] Error guardando en Firestore:", error);
    }

    // 2. Notificar a la secretaria por WhatsApp (si tiene número configurado)
    if (secretaryPhone) {
        const notif =
            `🔔 *Nueva solicitud de atención — ${centerName}*\n\n` +
            `👤 Paciente: ${conv.patientName || "Desconocido"}\n` +
            `📱 Teléfono: +${patientPhone}\n` +
            `💬 Contexto: ${getStateLabel(conv.state)}\n\n` +
            `Para atenderle, responda directamente al número del paciente.\n` +
            `_(Registro guardado en el sistema de ${centerName})_`;

        // Nota: usamos el mismo phoneNumberId del centro para notificar a la secretaria
        await sendText(phoneNumberId, secretaryPhone, notif);
    } else {
        console.warn(`[Handoff] Centro ${centerId} no tiene whatsappConfig.secretaryPhone configurado.`);
    }
}

function getStateLabel(state: BotState): string {
    const labels: Record<BotState, string> = {
        IDLE: "inicio de conversación",
        CHOOSING_DOCTOR: "eligiendo profesional",
        CHOOSING_DATE: "eligiendo fecha",
        CHOOSING_SLOT: "eligiendo horario",
        COLLECTING_NAME: "ingresando nombre",
        COLLECTING_RUT: "ingresando RUT",
        COLLECTING_PHONE: "ingresando teléfono",
        CONFIRMING: "confirmando cita",
        HANDOFF: "ya en manos de secretaria",
    };
    return labels[state] || state;
}

// ─── IA (GEMINI) ──────────────────────────────────────────────────────────────

async function processWithAI(message: string, patientName: string, centerName: string) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: { temperature: 0.1, maxOutputTokens: 250 }
        });

        const prompt = `
Eres el asistente formal de "${centerName}".
Paciente: ${patientName}.
Mensaje: "${message}"

Analiza la intención del usuario.
Si quiere AGENDAR una hora/cita, usa intent:"BOOKING".
Si pide hablar con una persona/secretaria o parece frustrado, usa intent:"HANDOFF".
Si es una duda general, usa intent:"GENERAL" y responde formalmente en máximo 3 frases en español.

RESPONDE ÚNICAMENTE CON ESTE JSON (sin markdown, sin backticks):
{"intent":"BOOKING|GENERAL|HANDOFF", "say":"...", "handoff": true|false}
`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON in AI response");
        return JSON.parse(match[0]);
    } catch (e) {
        console.error("[AI] Error:", e);
        return { intent: "GENERAL", say: "Disculpe, ¿podría repetir su consulta de otra forma?", handoff: false };
    }
}

// ─── FLUJO DE AGENDAMIENTO ────────────────────────────────────────────────────

async function offerInitialMenu(phoneNumberId: string, to: string, name: string, centerName: string) {
    await sendButtons(phoneNumberId, to,
        `Hola ${name}, bienvenido a *${centerName}*. ¿En qué podemos ayudarle?`,
        [
            { id: "action_book", title: "📅 Agendar hora" },
            { id: "action_info", title: "ℹ️ Información" },
            { id: "action_handoff", title: "👤 Hablar con secretaria" }
        ]
    );
}

async function startBookingFlow(phoneNumberId: string, to: string, centerId: string, staff: any[]) {
    if (staff.length === 0) {
        await sendText(phoneNumberId, to, "Lo sentimos, no hay profesionales disponibles para agendar en este momento.");
        return;
    }

    const rows = staff.map(s => ({
        id: `staff_${s.id}`,
        title: (s.fullName || s.name || "Profesional").substring(0, 24),
        description: (s.specialty || s.clinicalRole || "Especialista").substring(0, 72)
    }));

    await sendList(phoneNumberId, to,
        "Agendamiento en línea",
        "Seleccione el profesional con quien desea atenderse:",
        "Ver Profesionales",
        [{ title: "Profesionales disponibles", rows }]
    );
    await setConversation(to, { state: "CHOOSING_DOCTOR", centerId });
}

async function offerDates(phoneNumberId: string, to: string, staffName: string) {
    const today = new Date();
    // Ofrecer los próximos 5 días hábiles
    const dates: { id: string; title: string; description: string }[] = [];
    let d = new Date(today);
    while (dates.length < 5) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0) { // excluir domingo (0)
            const dateStr = format(d, "yyyy-MM-dd");
            const label = dates.length === 0 ? "Hoy" : dates.length === 1 ? "Mañana" : format(d, "EEEE d MMM", { locale: es });
            dates.push({
                id: `date_${dateStr}`,
                title: label.charAt(0).toUpperCase() + label.slice(1),
                description: format(d, "d 'de' MMMM", { locale: es })
            });
        }
        d = new Date(d.getTime() + 86400000);
    }

    await sendList(phoneNumberId, to,
        `Fecha para ${staffName}`,
        "Seleccione la fecha que prefiere:",
        "Ver Fechas",
        [{ title: "Días disponibles", rows: dates }]
    );
}

// ─── RESERVA TRANSACCIONAL ────────────────────────────────────────────────────

async function bookAppointment(phone: string, conv: Conversation) {
    try {
        const centerId = conv.centerId || "";
        const appointmentId = `appt_${conv.selectedStaffId}_${conv.selectedDate}_${conv.selectedSlotId}`;
        const apptRef = db.collection("centers").doc(centerId)
            .collection("appointments").doc(appointmentId);

        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(apptRef);
            if (snap.exists && snap.data()?.status === "booked") {
                return { success: false, error: "SLOT_TAKEN" };
            }

            tx.set(apptRef, {
                id: appointmentId,
                centerId,
                doctorId: conv.selectedStaffId,
                patientName: conv.patientName,
                patientRut: conv.patientRut,
                patientPhone: conv.patientPhone || phone,
                date: conv.selectedDate,
                time: conv.selectedSlotLabel,
                status: "booked",
                attendanceStatus: null,
                billable: null,
                bookedVia: "whatsapp",
                bookedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: snap.exists
                    ? (snap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp())
                    : admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            return { success: true };
        });

        return result;
    } catch (error) {
        console.error("[bookAppointment] Error:", error);
        return { success: false, error: "TECHNICAL_ERROR" };
    }
}

// ─── PROCESADOR PRINCIPAL ─────────────────────────────────────────────────────

async function workerProcessor(
    phoneNumberId: string,
    to: string,
    message: string,
    type: "text" | "interactive",
    interactiveData?: any,
    contactName?: string
) {
    // Resolver centro a partir del número de WhatsApp que recibió el mensaje
    const centerData = await getCenterByPhoneId(phoneNumberId);
    if (!centerData) {
        await sendText(phoneNumberId, to,
            "Lo sentimos, no pudimos identificar el centro médico. Por favor contacte directamente."
        );
        return;
    }
    const { center, staff } = centerData;
    const centerId: string = center.id;
    const centerName: string = center.name || "Centro Médico";

    let conv = await getConversation(to);
    const name = contactName || conv.patientName || "Paciente";

    // ── Interacciones (botones y listas) ─────────────────────────────────────
    if (type === "interactive" && interactiveData) {
        const iType = interactiveData.type;

        // ── Botones ──────────────────────────────────────────────────────────
        if (iType === "button_reply") {
            const btnId: string = interactiveData.button_reply.id;

            if (btnId === "action_book") {
                await startBookingFlow(phoneNumberId, to, centerId, staff);
                return;
            }

            if (btnId === "action_info") {
                const hours = center?.businessHours || "Lunes a Viernes, 08:00 a 18:00";
                await sendText(phoneNumberId, to,
                    `*${centerName}*\n\n🕐 Horario de atención: ${hours}\n\nPara agendar una hora, seleccione la opción correspondiente.`
                );
                await offerInitialMenu(phoneNumberId, to, name, centerName);
                return;
            }

            if (btnId === "action_handoff") {
                await sendText(phoneNumberId, to,
                    `Entendido, ${name}. ✅\n\nUna secretaria de *${centerName}* se comunicará con usted a la brevedad a este mismo número.\n\n_Gracias por su paciencia._`
                );
                await setConversation(to, { state: "HANDOFF", centerId, centerName });
                await triggerHandoff(phoneNumberId, to, { ...conv, patientName: conv.patientName || name }, center);
                return;
            }

            if (btnId === "confirm_yes") {
                const result = await bookAppointment(to, conv);
                if (result.success) {
                    await sendText(phoneNumberId, to,
                        `¡Cita confirmada exitosamente! ✅\n\n` +
                        `📋 *Resumen de su reserva:*\n` +
                        `👨‍⚕️ Profesional: ${conv.selectedStaffName}\n` +
                        `📅 Fecha: ${conv.selectedDate}\n` +
                        `🕐 Hora: ${conv.selectedSlotLabel}\n` +
                        `👤 Paciente: ${conv.patientName}\n` +
                        `🔖 RUT: ${conv.patientRut}\n\n` +
                        `Gracias por confiar en *${centerName}*. ¡Hasta pronto!`
                    );
                    await _resetConversation(to);
                } else if (result.error === "SLOT_TAKEN") {
                    await sendText(phoneNumberId, to,
                        "Lo sentimos, alguien acaba de reservar ese horario. Le mostramos la disponibilidad actualizada:"
                    );
                    const slots = await getAvailableSlots(centerId, conv.selectedStaffId!, conv.selectedDate!);
                    if (slots.length === 0) {
                        await sendText(phoneNumberId, to, "Ya no hay horarios disponibles para esa fecha. Por favor elija otro día.");
                        await offerDates(phoneNumberId, to, conv.selectedStaffName || "el profesional");
                        await setConversation(to, { state: "CHOOSING_DATE" });
                    } else {
                        await sendList(phoneNumberId, to, "Horarios", "Elija un nuevo horario disponible:", "Ver Horas", [
                            { title: "Horarios disponibles", rows: slots.map(s => ({ id: `slot_${s.id}`, title: s.label })) }
                        ]);
                        await setConversation(to, { state: "CHOOSING_SLOT" });
                    }
                } else {
                    await sendText(phoneNumberId, to,
                        "Hubo un error técnico. Por favor intente más tarde o escríbanos nuevamente."
                    );
                    await _resetConversation(to);
                }
                return;
            }

            if (btnId === "confirm_no") {
                await sendText(phoneNumberId, to, "Entendido. Su solicitud fue cancelada.");
                await _resetConversation(to);
                await offerInitialMenu(phoneNumberId, to, name, centerName);
                return;
            }
        }

        // ── Listas ──────────────────────────────────────────────────────────
        if (iType === "list_reply") {
            const listId: string = interactiveData.list_reply.id;

            if (listId.startsWith("staff_")) {
                const staffId = listId.replace("staff_", "");
                const staffMember = staff.find(s => s.id === staffId);
                const staffName = staffMember?.fullName || staffMember?.name || "el profesional";
                await setConversation(to, {
                    state: "CHOOSING_DATE",
                    centerId,
                    selectedStaffId: staffId,
                    selectedStaffName: staffName
                });
                await offerDates(phoneNumberId, to, staffName);
                return;
            }

            if (listId.startsWith("date_")) {
                const dateStr = listId.replace("date_", "");
                const slots = await getAvailableSlots(centerId, conv.selectedStaffId!, dateStr);
                if (slots.length === 0) {
                    await sendText(phoneNumberId, to,
                        `Lo sentimos, no hay horarios disponibles para ${conv.selectedStaffName} el ${dateStr}. Elija otra fecha:`
                    );
                    await offerDates(phoneNumberId, to, conv.selectedStaffName || "el profesional");
                    return;
                }
                await setConversation(to, { state: "CHOOSING_SLOT", selectedDate: dateStr });
                await sendList(phoneNumberId, to,
                    `Horarios - ${dateStr}`,
                    `Seleccione el bloque horario para ${conv.selectedStaffName}:`,
                    "Ver Horas",
                    [{ title: "Horarios disponibles", rows: slots.map(s => ({ id: `slot_${s.id}`, title: s.label })) }]
                );
                return;
            }

            if (listId.startsWith("slot_")) {
                const cleanId = listId.replace("slot_", "");
                const slotLabel = interactiveData.list_reply.title;
                await setConversation(to, {
                    state: "COLLECTING_NAME",
                    selectedSlotId: cleanId,
                    selectedSlotLabel: slotLabel
                });
                await sendText(phoneNumberId, to,
                    "Perfecto. Para completar la reserva, ingrese su *NOMBRE COMPLETO*:"
                );
                return;
            }
        }
    }

    // ── Texto libre ──────────────────────────────────────────────────────────
    if (conv.state === "IDLE") {
        const ai = await processWithAI(message, name, centerName);
        if (ai.intent === "BOOKING") {
            await startBookingFlow(phoneNumberId, to, centerId, staff);
        } else if (ai.intent === "HANDOFF") {
            await sendText(phoneNumberId, to,
                `Entendido. Una secretaria de *${centerName}* lo contactará a la brevedad. ✅`
            );
            await setConversation(to, { state: "HANDOFF", centerId, centerName });
            await triggerHandoff(phoneNumberId, to, { ...conv, patientName: name }, center);
        } else {
            await sendText(phoneNumberId, to, ai.say);
            await offerInitialMenu(phoneNumberId, to, name, centerName);
        }
        return;
    }

    if (conv.state === "COLLECTING_NAME") {
        await setConversation(to, { state: "COLLECTING_RUT", patientName: message });
        await sendText(phoneNumberId, to,
            `Gracias *${message}*. Ahora ingrese su *RUT* (con guion, ej: 12.345.678-9):`
        );
        return;
    }

    if (conv.state === "COLLECTING_RUT") {
        await setConversation(to, { state: "COLLECTING_PHONE", patientRut: message });
        await sendText(phoneNumberId, to,
            "Ingrese su *TELÉFONO* de contacto (ej: 912345678):"
        );
        return;
    }

    if (conv.state === "COLLECTING_PHONE") {
        await setConversation(to, { state: "CONFIRMING", patientPhone: message });

        // Recargar estado para tener datos frescos (evitar stale reads)
        const freshConv = await getConversation(to);

        const summary =
            `*Por favor confirme su reserva:*\n\n` +
            `👨‍⚕️ Profesional: ${freshConv.selectedStaffName}\n` +
            `📅 Fecha: ${freshConv.selectedDate}\n` +
            `🕐 Hora: ${freshConv.selectedSlotLabel}\n` +
            `👤 Nombre: ${freshConv.patientName}\n` +
            `🔖 RUT: ${freshConv.patientRut}\n` +
            `📱 Teléfono: ${message}`;

        await sendButtons(phoneNumberId, to, summary, [
            { id: "confirm_yes", title: "✅ Confirmar cita" },
            { id: "confirm_no", title: "❌ Cancelar" }
        ]);
        return;
    }

    if (conv.state === "HANDOFF") {
        // Paciente esperando secretaria — no interrumpir
        await sendText(phoneNumberId, to,
            `Su solicitud ya está siendo atendida por el equipo de *${conv.centerName || centerName}*. Le contactarán a la brevedad.`
        );
        return;
    }

    // Estado inesperado — resetear
    await sendText(phoneNumberId, to,
        "Escriba *Hola* para iniciar de nuevo."
    );
}

// ─── WEBHOOK ─────────────────────────────────────────────────────────────────

export const whatsappWebhook = functions
    .runWith({ timeoutSeconds: 60, memory: "512MB" })
    .https.onRequest(async (req, res) => {

        // GET — verificación del webhook por Meta
        if (req.method === "GET") {
            const mode = req.query["hub.mode"];
            const token = req.query["hub.verify_token"];
            if (mode === "subscribe" && token === VERIFY_TOKEN) {
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
                const from: string = message.from;
                const contactName: string = change?.contacts?.[0]?.profile?.name || "Paciente";
                // ← CLAVE MULTI-CENTRO: el número WA que recibió el mensaje
                const phoneNumberId: string = change?.metadata?.phone_number_id || "";

                // Responder 200 inmediatamente (Meta requiere < 5s)
                res.status(200).send("EVENT_RECEIVED");

                // Procesar de forma asíncrona
                (async () => {
                    try {
                        if (message.type === "text") {
                            await workerProcessor(phoneNumberId, from, message.text.body, "text", undefined, contactName);
                        } else if (message.type === "interactive") {
                            await workerProcessor(phoneNumberId, from, "", "interactive", message.interactive, contactName);
                        }
                    } catch (e) {
                        console.error("[Worker] Error no manejado:", e);
                    }
                })();
                return;
            }

            res.status(200).send("OK");
            return;
        }

        res.status(405).send("Method Not Allowed");
    });

// ─── TRIGGER: NOTIFICACIÓN AL RESERVAR (WEB → WA) ────────────────────────────

/**
 * Cuando se reserva una cita desde la web pública (no desde WhatsApp),
 * envía confirmación y — si aplica — instrucciones de preparación del servicio.
 */
export const onAppointmentBooked = functions.firestore
    .document("centers/{centerId}/appointments/{appointmentId}")
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Solo actuar cuando cambia a "booked"
        if (before.status === "booked" || after.status !== "booked") return;
        // No duplicar si vino de WhatsApp (ya enviamos confirmación en el flow)
        if (after.bookedVia === "whatsapp") return;

        const phone: string = after.patientPhone || "";
        if (!phone) return;

        // Normalizar número para Chile (+56XXXXXXXXX)
        let waPhone = phone.replace(/\D/g, "");
        if (waPhone.length === 8) waPhone = "569" + waPhone;
        else if (waPhone.length === 9 && waPhone.startsWith("9")) waPhone = "56" + waPhone;

        // Obtener phoneNumberId del centro para enviar desde el número correcto
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
            // Confirmación de reserva
            const text =
                `¡Hola *${after.patientName}*! ✅\n\n` +
                `Tu reserva está confirmada:\n` +
                `👨‍⚕️ Profesional: ${after.doctorId || "Profesional"}\n` +
                `📅 Fecha: ${after.date}\n` +
                `🕐 Hora: ${after.time}\n\n` +
                `Gracias por elegirnos.`;
            await sendText(phoneNumberId, waPhone, text);

            // Instrucciones de preparación (si el appointment es un servicio)
            if (after.serviceId) {
                const serviceSnap = await db.collection("centers").doc(centerId)
                    .collection("services").doc(after.serviceId).get();
                if (serviceSnap.exists) {
                    const svc = serviceSnap.data()!;
                    if (svc.preparationInstructions?.trim()) {
                        await sendText(phoneNumberId, waPhone,
                            `⚠️ *Preparación para ${after.serviceName || "su examen"}:*\n\n${svc.preparationInstructions}`
                        );
                    }
                    if (svc.preparationPdfUrl?.trim()) {
                        await sendRawWhatsAppPayload(phoneNumberId, {
                            to: waPhone,
                            type: "document",
                            document: {
                                link: svc.preparationPdfUrl,
                                filename: `Preparacion_${(after.serviceName || "Servicio").replace(/\s+/g, "_")}.pdf`
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error("[onAppointmentBooked] Error enviando WhatsApp:", err);
        }
    });
