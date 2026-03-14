# Propuesta técnica: WhatsApp Agent V2 (mezcla recomendada)

## Objetivo
Tener una **versión mejorada** del bot que combine:

1. La base estable del repo en `functions/src/whatsapp.ts`.
2. El flujo avanzado con Gemini + herramientas + memoria conversacional compartido en el análisis.
3. Hardening de seguridad/fiabilidad para producción clínica.

---

## Qué mantener del código actual del repo

- Integración Firestore + WhatsApp ya desplegada.
- Estructura de webhook y utilidades de envío (`sendText`, `sendButtons`, `sendList`).
- Resolución de centro por `phoneNumberId`.
- Trigger `onAppointmentBooked` y procesos de rescate, pero con controles de seguridad extra.

---

## Qué incorporar del diseño avanzado (recomendado)

- Estado conversacional más expresivo (`flowState`, `pendingBooking`, `phase`).
- Confirmación explícita previa a reserva.
- Lógica de idempotencia por `messageId`.
- Tooling declarativo para Gemini (listar profesionales, slots, sugerencias, handoff).
- TTL y limpieza de conversaciones para evitar estados “atascados”.

---

## Cambios P0 (antes de reemplazar en producción)

### 1) Validar firma HMAC del webhook (Meta)
Agregar verificación en `POST` además del challenge GET.

```ts
import crypto from "crypto";

function verifyMetaSignature(rawBody: string, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const received = signatureHeader.slice("sha256=".length);
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}
```

Uso recomendado en webhook:

```ts
const appSecret = process.env.WA_APP_SECRET || "";
const signature = req.header("X-Hub-Signature-256");
const rawBody = (req as any).rawBody?.toString("utf8") || "";

if (!appSecret || !verifyMetaSignature(rawBody, signature, appSecret)) {
  res.status(403).send("Invalid signature");
  return;
}
```

---

### 2) Restringir seguridad del modelo + guardrail server-side
No usar todo en `BLOCK_NONE` para salud; además filtrar en backend antes de responder.

```ts
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
];
```

Guardrail mínimo:

```ts
function enforceClinicalGuardrail(text: string): string {
  const risky = /(tome|tomar|dosis|medicamento|ibuprofeno|antibi[oó]tico|diagn[oó]stico)/i;
  if (risky.test(text)) {
    return "Por seguridad, no puedo entregar indicaciones médicas por este canal. Puedo ayudarle a agendar o derivarle con secretaría.";
  }
  return text;
}
```

---

### 3) No exponer PII en logs

```ts
function maskRut(rut?: string): string {
  if (!rut) return "";
  const clean = rut.replace(/[^0-9kK]/g, "");
  if (clean.length < 3) return "***";
  return `${clean.slice(0, 2)}***${clean.slice(-1)}`;
}

function maskPhone(phone?: string): string {
  if (!phone) return "";
  const clean = phone.replace(/\D/g, "");
  if (clean.length <= 4) return "****";
  return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
}
```

---

### 4) Retry/backoff para WA API

```ts
async function sendWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  let lastError: any;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (![429, 500, 502, 503, 504].includes(res.status)) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }

    const wait = Math.min(1500 * 2 ** attempt, 8000);
    await new Promise((r) => setTimeout(r, wait));
    attempt += 1;
  }

  throw lastError;
}
```

---

## Cambios P1 (fortalecimiento)

### 5) Cliente Gemini lazy + fail-fast de secretos

```ts
let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (_genAI) return _genAI;
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  _genAI = new GoogleGenerativeAI(key);
  return _genAI;
}
```

### 6) Consolidar conversación por `convKey(centerId, phone)`
Evita colisiones multi-centro y estados cruzados entre números.

### 7) Métricas operativas mínimas
Registrar en `events_metrics`:
- `intent`
- `tool_calls`
- `booking_success`
- `handoff_triggered`
- `latency_ms`

---

## Cambios P2 (calidad y mantenibilidad)

- Reducir `any` con interfaces (`CenterConfig`, `StaffMember`, `AppointmentSlot`).
- Tests unitarios:
  - `isValidRut`
  - `extractNameAndRut`
  - `isAffirmativeMessage`/`isCancelMessage`
  - expiración TTL de conversación
- Tests de integración (happy-path):
  1. saludo → menú
  2. selección profesional → fecha → slot
  3. confirmación → reserva transaccional

---

## Diseño final recomendado (sin romper producción)

### Fase 1: Hardening sin cambiar UX
- Firma webhook.
- Retry WA API.
- Enmascaramiento de logs.
- Fail-fast secretos.

### Fase 2: Estado conversacional mejorado
- Introducir `flowState` y `pendingBooking`.
- Mantener interoperable con estado legacy (`state`) durante migración.

### Fase 3: Tools Gemini + controles
- Activar tool-calls para decisiones de agenda.
- Mantener rutas de fallback deterministas si el modelo falla.

### Fase 4: Operación y observabilidad
- Dashboard de tasas: respuesta, reservas, handoff, errores WA.
- Alertas por error rate y latencia.

---

## Entregable sugerido para implementar

1. Mantener `functions/src/whatsapp.ts` como entrypoint.
2. Crear módulos internos:
   - `functions/src/whatsapp/security.ts`
   - `functions/src/whatsapp/conversation.ts`
   - `functions/src/whatsapp/geminiAgent.ts`
   - `functions/src/whatsapp/messaging.ts`
3. Migrar lógica por etapas con feature flag:

```ts
const USE_AGENT_V2 = process.env.WA_AGENT_V2 === "1";
```

Si `USE_AGENT_V2=0`, se usa flujo actual.
Si `USE_AGENT_V2=1`, se usa flujo mejorado.

---

## Conclusión
No conviene reemplazar “todo de una”.
Conviene una **mezcla controlada**: conservar infraestructura actual y sumar hardening + flujo avanzado por etapas.

Este enfoque reduce riesgo operativo y permite medir impacto real antes de una migración completa.
