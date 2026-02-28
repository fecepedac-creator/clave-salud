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

// CONFIGURACIÓN
const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const VERIFY_TOKEN = "clavesalud_bot_2026";

// CACHE EN MEMORIA (RAM TTL)
let cachedCenter: any = null;
let cachedStaff: any[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// --- UTILIDADES DE CACHE ---

async function refreshCacheIfNeeded() {
    const now = Date.now();
    if (cachedCenter && (now - lastCacheUpdate < CACHE_TTL)) return;

    try {
        console.log("Actualizando caché de centros y staff...");
        const centersSnap = await db.collection("centers").where("isActive", "==", true).limit(1).get();
        if (!centersSnap.empty) {
            cachedCenter = { id: centersSnap.docs[0].id, ...centersSnap.docs[0].data() };
            const staffSnap = await db.collection("centers").doc(cachedCenter.id).collection("staff")
                .where("visibleInBooking", "==", true)
                .where("active", "==", true)
                .get();
            cachedStaff = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            lastCacheUpdate = now;
        }
    } catch (error) {
        console.error("Error actualizando caché:", error);
    }
}

// --- GESTIÓN DE CONVERSACIÓN (FIRESTORE) ---

type BotState = "IDLE" | "CHOOSING_DOCTOR" | "CHOOSING_DATE" | "CHOOSING_SLOT" | "COLLECTING_NAME" | "COLLECTING_RUT" | "COLLECTING_PHONE" | "CONFIRMING" | "HANDOFF";

interface Conversation {
    state: BotState;
    selectedCenterId?: string;
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
    await db.collection("conversations").doc(phone).set({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

export async function _resetConversation(phone: string) {
    await db.collection("conversations").doc(phone).delete();
}

// --- MENSAJERÍA WHATSAPP ---

async function sendRawWhatsAppPayload(payload: any) {
    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) return;
    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`;
    try {
        await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
        });
    } catch (err) {
        console.error("Error en sendRawWhatsAppPayload", err);
    }
}

async function sendWhatsAppText(to: string, text: string) {
    await sendRawWhatsAppPayload({ to, type: "text", text: { body: text } });
}

async function sendWhatsAppButtons(to: string, bodyText: string, buttons: { id: string, title: string }[]) {
    await sendRawWhatsAppPayload({
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

async function sendWhatsAppList(to: string, title: string, bodyText: string, buttonLabel: string, sections: any[]) {
    await sendRawWhatsAppPayload({
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

// --- LÓGICA DE DERECHO Y AGENDAMIENTO ---

async function offerInitialMenu(to: string, name: string) {
    const text = `Hola ${name}, bienvenido al Centro Médico Los Andes. ¿Cómo podemos ayudarle hoy?`;
    await sendWhatsAppButtons(to, text, [
        { id: "action_book", title: "📅 Agendar hora" },
        { id: "action_info", title: "ℹ️ Información" },
        { id: "action_handoff", title: "👤 Hablar con persona" }
    ]);
}

async function startBookingFlow(to: string) {
    await refreshCacheIfNeeded();
    if (cachedStaff.length === 0) {
        await sendWhatsAppText(to, "Lo sentimos, no hay profesionales disponibles para agendar en este momento.");
        return;
    }

    const rows = cachedStaff.map(s => ({
        id: `staff_${s.id}`,
        title: s.fullName.substring(0, 24),
        description: s.specialty || "Especialista"
    }));

    await sendWhatsAppList(to, "Agendamiento", "Seleccione el profesional con quien desea atenderse:", "Ver Médicos", [
        { title: "Profesionales", rows }
    ]);
    await setConversation(to, { state: "CHOOSING_DOCTOR", selectedCenterId: cachedCenter?.id });
}

// Stubs para lógica futura
async function getAvailableSlots(_staffId: string, _date: string) {
    // Si estuviéramos en un sistema real, aquí consultaríamos la colección appointments con status available
    return [
        { id: "slot_0900", label: "09:00 AM" },
        { id: "slot_1030", label: "10:30 AM" },
        { id: "slot_1500", label: "15:00 PM" }
    ];
}

async function bookAppointment(phone: string, conv: Conversation) {
    try {
        const centerId = conv.selectedCenterId || "LosAndes";
        const patientId = `p_${(conv.patientRut || "unknown").replace(/\./g, "").replace(/-/g, "").toLowerCase()}`;

        // El ID de la cita debería ser real si viniera de la base de datos, 
        // para este demo crearemos un ID único basado en staff+fecha+hora
        const appointmentId = conv.selectedSlotId?.startsWith("slot_")
            ? `${conv.selectedStaffId}_${conv.selectedDate}_${conv.selectedSlotId.replace("slot_", "")}`
            : (conv.selectedSlotId || Date.now().toString());

        const apptRef = db.collection("centers").doc(centerId).collection("appointments").doc(appointmentId);

        await apptRef.set({
            id: appointmentId,
            centerId,
            staffId: conv.selectedStaffId,
            staffName: conv.selectedStaffName,
            date: conv.selectedDate,
            startTime: conv.selectedSlotLabel,
            status: "booked",
            patientId,
            patientName: conv.patientName,
            patientRut: conv.patientRut,
            patientPhone: conv.patientPhone,
            bookedVia: "whatsapp",
            bookedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return true;
    } catch (error) {
        console.error("Error booking appointment:", error);
        return false;
    }
}

// --- PROCESADOR IA (GEMINI) ---

async function processWithAI(message: string, patientName: string) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: { temperature: 0.2, maxOutputTokens: 250 }
        });

        const prompt = `
        Eres el asistente formal de "Centro Médico Los Andes". 
        Paciente: ${patientName}.
        Mensaje: "${message}"

        Analiza la intención del usuario. 
        Si quiere agendar, usa intent:"BOOKING".
        Si pide hablar con un humano o parece frustrado, usa intent:"HANDOFF".
        Si es una duda general, usa intent:"GENERAL" y responde formalmente en máximo 3 frases.

        RESPONDE ÚNICAMENTE CON ESTE JSON:
        {"intent":"BOOKING|GENERAL|HANDOFF", "say":"...", "handoff": true|false}
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonStr = responseText.replace(/```json|```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Error AI:", e);
        return { intent: "GENERAL", say: "Disculpe, ¿podría repetir su consulta de otra forma?", handoff: false };
    }
}

// --- WORKER / PROCESADOR PRINCIPAL ---

async function workerProcessor(to: string, message: string, type: "text" | "interactive", interactiveData?: any, contactName?: string) {
    const conv = await getConversation(to);
    const name = contactName || conv.patientName || "Paciente";

    // 1. Manejo de Interacciones (Botones/Listas)
    if (type === "interactive" && interactiveData) {
        const iType = interactiveData.type;

        if (iType === "button_reply") {
            const btnId = interactiveData.button_reply.id;
            if (btnId === "action_book") { await startBookingFlow(to); return; }
            if (btnId === "action_handoff") {
                await sendWhatsAppText(to, "Entendido. Un ejecutivo se contactará con usted a la brevedad. Muchas gracias por su paciencia.");
                await setConversation(to, { state: "HANDOFF" });
                return;
            }
            if (btnId === "action_info") {
                await sendWhatsAppText(to, "Somos Centro Médico Los Andes. Atendemos de Lunes a Viernes de 08:00 a 20:00.");
                return;
            }
            if (btnId === "confirm_yes") {
                const success = await bookAppointment(to, conv);
                if (success) {
                    await sendWhatsAppText(to, `¡Cita confirmada exitosamente! ✅\n\nResumen:\n- Profesional: ${conv.selectedStaffName}\n- Fecha: ${conv.selectedDate}\n- Hora: ${conv.selectedSlotLabel}\n- Paciente: ${conv.patientName}\n\nYa puede visualizar su cita en nuestro sistema. Gracias por confiar en Centro Médico Los Andes.`);
                } else {
                    await sendWhatsAppText(to, "Lo sentimos, hubo un error técnico al registrar su cita. Por favor, reintente en unos minutos o hable con un ejecutivo.");
                }
                await _resetConversation(to);
                return;
            }
            if (btnId === "confirm_no") {
                await sendWhatsAppText(to, "Agendamiento cancelado. ¿Hay algo más en lo que podamos asistirle?");
                await _resetConversation(to);
                await offerInitialMenu(to, name);
                return;
            }
        }

        if (iType === "list_reply") {
            const listId = interactiveData.list_reply.id;

            if (listId.startsWith("staff_")) {
                const staffId = listId.replace("staff_", "");
                await refreshCacheIfNeeded();
                const staff = cachedStaff.find(s => s.id === staffId);
                await setConversation(to, {
                    state: "CHOOSING_DATE",
                    selectedStaffId: staffId,
                    selectedStaffName: staff?.fullName
                });
                const dates = [
                    { id: "date_today", title: "Hoy", description: format(new Date(), "PP", { locale: es }) },
                    { id: "date_tomorrow", title: "Mañana", description: format(new Date(Date.now() + 86400000), "PP", { locale: es }) }
                ];
                await sendWhatsAppList(to, "Fecha", `Profesional: ${staff?.fullName}. Seleccione una fecha:`, "Ver Fechas", [
                    { title: "Disponibilidad", rows: dates }
                ]);
                return;
            }

            if (listId.startsWith("date_")) {
                const dateStr = listId === "date_today" ? format(new Date(), "yyyy-MM-dd") : format(new Date(Date.now() + 86400000), "yyyy-MM-dd");
                await setConversation(to, { state: "CHOOSING_SLOT", selectedDate: dateStr });
                const slots = await getAvailableSlots(conv.selectedStaffId!, dateStr);
                await sendWhatsAppList(to, "Horario", "Seleccione el bloque horario:", "Ver Horas", [
                    { title: "Horarios Disponibles", rows: slots.map(s => ({ id: `slot_${s.id}`, title: s.label })) }
                ]);
                return;
            }

            if (listId.startsWith("slot_")) {
                const slotLabel = interactiveData.list_reply.title;
                await setConversation(to, {
                    state: "COLLECTING_NAME",
                    selectedSlotId: listId,
                    selectedSlotLabel: slotLabel
                });
                await sendWhatsAppText(to, "Perfecto. Para formalizar el agendamiento, por favor ingrese su NOMBRE COMPLETO:");
                return;
            }
        }
    }

    // 2. Manejo de Texto
    if (conv.state === "IDLE") {
        const ai = await processWithAI(message, name);
        if (ai.intent === "BOOKING") { await startBookingFlow(to); return; }
        if (ai.intent === "HANDOFF") {
            await sendWhatsAppText(to, "Estimado/a, le derivamos con un asistente humano. En breve le contactarán.");
            await setConversation(to, { state: "HANDOFF" });
        } else {
            await sendWhatsAppText(to, ai.say);
            await offerInitialMenu(to, name);
        }
    } else if (conv.state === "COLLECTING_NAME") {
        await setConversation(to, { state: "COLLECTING_RUT", patientName: message });
        await sendWhatsAppText(to, `Gracias ${message}. Ahora, por favor ingrese su RUT (con guion y dígito verificador):`);
    } else if (conv.state === "COLLECTING_RUT") {
        await setConversation(to, { state: "COLLECTING_PHONE", patientRut: message });
        await sendWhatsAppText(to, "Finalmente, ingrese un número de TELÉFONO de contacto:");
    } else if (conv.state === "COLLECTING_PHONE") {
        await setConversation(to, { state: "CONFIRMING", patientPhone: message });
        const summary = `POR FAVOR CONFIRME SUS DATOS:\n\n- Profesional: ${conv.selectedStaffName}\n- Fecha: ${conv.selectedDate}\n- Hora: ${conv.selectedSlotLabel}\n- Paciente: ${conv.patientName}\n- RUT: ${conv.patientRut}\n- Teléfono: ${message}`;
        await sendWhatsAppButtons(to, summary, [
            { id: "confirm_yes", title: "✅ Confirmar Cita" },
            { id: "confirm_no", title: "❌ Cancelar" }
        ]);
    } else {
        if (conv.state !== "HANDOFF") {
            await sendWhatsAppText(to, "Por favor, siga las instrucciones o escriba 'Información' para volver al inicio.");
        }
    }
}

// --- WEBHOOK ---

export const whatsappWebhook = functions.https.onRequest(async (req, res) => {
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
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (message) {
            const from = message.from;
            const contactName = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name || "Paciente";

            res.status(200).send("EVENT_RECEIVED");

            (async () => {
                try {
                    if (message.type === "text") {
                        await workerProcessor(from, message.text.body, "text", null, contactName);
                    } else if (message.type === "interactive") {
                        await workerProcessor(from, "", "interactive", message.interactive, contactName);
                    }
                } catch (e) {
                    console.error("Worker Error:", e);
                }
            })();
            return;
        }

        res.status(200).send("OK");
        return;
    }

    res.status(405).send("Method Not Allowed");
});
