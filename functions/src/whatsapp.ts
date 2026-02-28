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

// Stubs para lógica futura - IDs LIMPIOS (0900 en lugar de slot_0900)
async function getAvailableSlots(_staffId: string, _date: string) {
    return [
        { id: "0900", label: "09:00 AM" },
        { id: "1030", label: "10:30 AM" },
        { id: "1500", label: "15:00 PM" }
    ];
}

/**
 * Reservar cita de forma TRANSACCIONAL para evitar colisiones
 */
async function bookAppointment(phone: string, conv: Conversation) {
    try {
        const centerId = conv.selectedCenterId || "LosAndes";
        const patientId = `p_${(conv.patientRut || "unknown").replace(/\./g, "").replace(/-/g, "").toLowerCase()}`;

        // ID determinista: centro_staff_fecha_hora
        const appointmentId = `appt_${conv.selectedStaffId}_${conv.selectedDate}_${conv.selectedSlotId}`;
        const apptRef = db.collection("centers").doc(centerId).collection("appointments").doc(appointmentId);

        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(apptRef);
            if (snap.exists && snap.data()?.status === "booked") {
                return { success: false, error: "SLOT_TAKEN" };
            }

            const apptData = {
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
                createdAt: snap.exists ? (snap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()) : admin.firestore.FieldValue.serverTimestamp(),
            };

            tx.set(apptRef, apptData, { merge: true });
            return { success: true };
        });

        return result;
    } catch (error) {
        console.error("Error booking appointment (transaction):", error);
        return { success: false, error: "TECHNICAL_ERROR" };
    }
}

// --- PROCESADOR IA (GEMINI) ---

async function processWithAI(message: string, patientName: string) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: { temperature: 0.1, maxOutputTokens: 250 }
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

        // Extractor Robusto de JSON
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON found in response");
        return JSON.parse(match[0]);
    } catch (e) {
        console.error("Error AI Robust Parsing:", e);
        return { intent: "GENERAL", say: "Disculpe, ¿podría repetir su consulta de otra forma?", handoff: false };
    }
}

// --- WORKER / PROCESADOR PRINCIPAL ---

async function workerProcessor(to: string, message: string, type: "text" | "interactive", interactiveData?: any, contactName?: string) {
    // Leemos el estado al inicio
    let conv = await getConversation(to);
    const name = contactName || conv.patientName || "Paciente";

    // 1. Manejo de Interacciones (Botones/Listas)
    if (type === "interactive" && interactiveData) {
        const iType = interactiveData.type;

        if (iType === "button_reply") {
            const btnId = interactiveData.button_reply.id;
            if (btnId === "action_book") { await startBookingFlow(to); return; }
            if (btnId === "action_handoff") {
                await sendWhatsAppText(to, "Entendido. Un ejecutivo se contactará con usted a la brevedad.");
                await setConversation(to, { state: "HANDOFF" });
                return;
            }
            if (btnId === "action_info") {
                await sendWhatsAppText(to, "Somos Centro Médico Los Andes. Atendemos de Lunes a Viernes.");
                return;
            }
            if (btnId === "confirm_yes") {
                const result = await bookAppointment(to, conv);
                if (result.success) {
                    await sendWhatsAppText(to, `¡Cita confirmada exitosamente! ✅\n\nResumen:\n- Profesional: ${conv.selectedStaffName}\n- Fecha: ${conv.selectedDate}\n- Hora: ${conv.selectedSlotLabel}\n- Paciente: ${conv.patientName}\n\nGracias por confiar en Centro Médico Los Andes.`);
                } else if (result.error === "SLOT_TAKEN") {
                    await sendWhatsAppText(to, "Lo sentimos, alguien acaba de reservar ese horario. Por favor, seleccione otro bloque.");
                    // Reiniciar al paso de elegir hora
                    const slots = await getAvailableSlots(conv.selectedStaffId!, conv.selectedDate!);
                    await sendWhatsAppList(to, "Horario", "Elija un nuevo horario disponible:", "Ver Horas", [
                        { title: "Nueva Disponibilidad", rows: slots.map(s => ({ id: `slot_${s.id}`, title: s.label })) }
                    ]);
                    await setConversation(to, { state: "CHOOSING_SLOT" });
                    return;
                } else {
                    await sendWhatsAppText(to, "Hubo un error técnico. Por favor, intente más tarde.");
                }
                await _resetConversation(to);
                return;
            }
            if (btnId === "confirm_no") {
                await sendWhatsAppText(to, "Agendamiento cancelado.");
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
                await sendWhatsAppList(to, "Fecha", `Seleccione fecha para ${staff?.fullName}:`, "Ver Fechas", [
                    { title: "Disponibilidad", rows: dates }
                ]);
                return;
            }

            if (listId.startsWith("date_")) {
                const dateStr = listId === "date_today" ? format(new Date(), "yyyy-MM-dd") : format(new Date(Date.now() + 86400000), "yyyy-MM-dd");
                await setConversation(to, { state: "CHOOSING_SLOT", selectedDate: dateStr });
                const slots = await getAvailableSlots(conv.selectedStaffId!, dateStr);
                await sendWhatsAppList(to, "Horario", "Seleccione el bloque horario:", "Ver Horas", [
                    { title: "Horarios", rows: slots.map(s => ({ id: `slot_${s.id}`, title: s.label })) }
                ]);
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
                await sendWhatsAppText(to, "Perfecto. Por favor, ingrese su NOMBRE COMPLETO:");
                return;
            }
        }
    }

    // 2. Manejo de Texto
    if (conv.state === "IDLE") {
        const ai = await processWithAI(message, name);
        if (ai.intent === "BOOKING") { await startBookingFlow(to); return; }
        if (ai.intent === "HANDOFF") {
            await sendWhatsAppText(to, "Estimado/a, le derivamos con soporte. En breve contactarán.");
            await setConversation(to, { state: "HANDOFF" });
        } else {
            await sendWhatsAppText(to, ai.say);
            await offerInitialMenu(to, name);
        }
    } else if (conv.state === "COLLECTING_NAME") {
        await setConversation(to, { state: "COLLECTING_RUT", patientName: message });
        await sendWhatsAppText(to, `Gracias ${message}. Ingrese su RUT (con guion):`);
    } else if (conv.state === "COLLECTING_RUT") {
        await setConversation(to, { state: "COLLECTING_PHONE", patientRut: message });
        await sendWhatsAppText(to, "Ingrese su TELÉFONO de contacto:");
    } else if (conv.state === "COLLECTING_PHONE") {
        // ACTUALIZACIÓN DE ESTADO Y RESUMEN ROBUSTO (No stale)
        await setConversation(to, { state: "CONFIRMING", patientPhone: message });

        // Recargar conv para tener los datos frescos
        const freshConv = await getConversation(to);

        const summary = `POR FAVOR CONFIRME SUS DATOS:\n\n` +
            `- Profesional: ${freshConv.selectedStaffName}\n` +
            `- Fecha: ${freshConv.selectedDate}\n` +
            `- Hora: ${freshConv.selectedSlotLabel}\n` +
            `- Paciente: ${freshConv.patientName}\n` +
            `- RUT: ${freshConv.patientRut}\n` +
            `- Teléfono: ${message}`;

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

// Mayor tiempo de ejecución para el worker asíncrono en Gen1
export const whatsappWebhook = functions
    .runWith({ timeoutSeconds: 60, memory: "512MB" })
    .https.onRequest(async (req, res) => {
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
