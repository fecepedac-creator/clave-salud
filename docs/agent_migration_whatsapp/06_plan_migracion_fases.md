# Plan de Migración por Etapas: Agente ClaveSalud V2

## ✅ Estado: TODAS las fases están implementadas en código

Las 6 fases han sido consolidadas en un **rewrite completo** de `functions/src/whatsapp.ts`.
El código compila sin errores y está listo para deploy.

---

## 🔹 Fase 0: Diagnóstico y Preparación ✅
- **Objetivo**: Auditar el estado actual del chatbot y diseñar la arquitectura.
- **Entregables**:
  - `docs/agent_migration_whatsapp/01_estado_actual_chatbgoot.md` — Auditoría del bot de estados.
  - `docs/agent_migration_whatsapp/02_arquitectura_objetivo.md` — Diseño del agente.
  - `docs/agent_migration_whatsapp/03_tools_del_agente.md` — Especificación de herramientas.
- **Criterio de Éxito**: ✅ Documentación generada, código auditado.

## 🔹 Fase 1: Agente Clasificador ✅
- **Objetivo**: Reemplazar `processWithAI` (clasificador JSON) por `processAgentMessage` con Gemini Function Calling.
- **Cambios Técnicos**:
  - Eliminada la función `processWithAI` que devolvía JSON crudo.
  - Nuevo `processAgentMessage` con system prompt enriquecido y loop multi-turn.
  - Import de `SchemaType` desde `@google/generative-ai`.
- **Archivo**: `functions/src/whatsapp.ts` líneas 490-600.

## 🔹 Fase 2: Agente Consultor (Búsqueda de Disponibilidad) ✅
- **Objetivo**: El agente consulta la agenda real de Firestore.
- **Tools Implementadas**:
  - `list_professionals` — Lista médicos visibles del centro.
  - `get_available_slots(staffId, date)` — Slots `available` en Firestore.
  - `suggest_alternative_dates(staffId, startDate)` — Busca hasta 14 días con disponibilidad. *(NUEVA)*
  - `get_center_info` — Info del centro (dirección, horarios). *(NUEVA)*
- **Archivo**: `functions/src/whatsapp.ts`, constante `AGENT_TOOLS` y handlers en `processAgentMessage`.

## 🔹 Fase 3: Agente Transaccional (Reserva Controlada) ✅
- **Objetivo**: El agente ejecuta reservas reales con transacciones Firestore.
- **Tool Implementada**:
  - `book_appointment(slotDocId, staffId, patientName, patientRut)` — Reserva atómica con `db.runTransaction`.
- **Controles de Seguridad**:
  - Confirmación explícita del paciente antes de ejecutar (instrucción en el system prompt).
  - Double-check de estado `available` dentro de la transacción.
  - Campo `bookedVia: "whatsapp_agent"` para auditoría.
- **Archivo**: `bookAppointmentTool()` en `whatsapp.ts`.

## 🔹 Fase 4: Handoff Inteligente y Observabilidad ✅
- **Objetivo**: Escalación automática a humana con logging.
- **Tool Implementada**:
  - `trigger_handoff(reason)` — Crea `handoff_requests` y notifica a secretaría por WhatsApp.
- **Observabilidad**:
  - `lastAgentAction` en la conversación (auditoría de qué tool llamó el agente).
  - `console.log` con `[Agent] Turn N: Tool=xxx` para Cloud Logging.
  - `MAX_AGENT_TURNS = 5` — Límite de tool calls por mensaje (evita loops infinitos).
- **Archivo**: `processAgentMessage()`, campo `convUpdates.lastAgentAction`.

## 🔹 Fase 5: Retiro del Bot de Estados Antiguo ✅
- **Objetivo**: Eliminar la máquina de estados rígida (`BotState`, `switch(conv.state)`).
- **Código Eliminado**:
  - Type `BotState` con 9 estados (`IDLE`, `CHOOSING_DOCTOR`, etc.).
  - Interface `Conversation` antigua con campos de paso a paso.
  - Funciones `offerInitialMenu`, `startBookingFlow`, `offerDates`.
  - Función `bookAppointment` (reemplazada por `bookAppointmentTool`).
  - Función `getStateLabel`.
  - Todo el `switch(conv.state)` del `workerProcessor`.
- **Código Conservado**:
  - `getCenterByPhoneId` — Resolución multi-centro por `phoneNumberId`.
  - Mensajería WA (`sendText`, `sendRawWhatsAppPayload`, `sendButtons`, `sendList`).
  - `getAvailableSlots` — Lectura de Firestore.
  - `triggerHandoff` — Persistencia en `handoff_requests`.
  - `onAppointmentBooked` — Trigger de notificación web→WA.
  - `dailyControlRescuer` — Cron de Auto-Rescate de Controles.
- **Nuevo**:
  - Interface `AgentConversation` con `history[]`, `phase`, `lastAgentAction`.
  - `buildSystemPrompt()` — Prompt dinámico con catálogo de médicos y contexto de rescate.
  - Compatibilidad con botones de Rescate (`rescate_agendar`, `rescate_examenes`).

---

## 📊 Resumen de Cambios (Métricas)

| Métrica | Antes (BotState) | Después (Agent) |
|---|---|---|
| Líneas de código | ~1180 | ~1047 |
| Estados del bot | 9 (IDLE...HANDOFF) | 2 (ACTIVE, HANDOFF) |
| Tools del agente | 0 | 6 |
| Máx. tool calls/msg | N/A | 5 (configurable) |
| Historial de chat | No | Sí (últimos 10 msgs) |
| TTL de conversación | 8h (solo HANDOFF) | 4h (ACTIVE) + 8h (HANDOFF) |
| Sugerencia alternativa | No | Sí (14 días) |
| Info del centro | No | Sí (get_center_info) |
| Detección de urgencias | No | Sí (instrucción en prompt) |

---

## 🚀 Próximo Paso: Deploy

```bash
firebase deploy --only functions:whatsappWebhook,functions:onAppointmentBooked,functions:dailyControlRescuer
```

### Pre-requisitos:
1. `GEMINI_API_KEY` configurada en Firebase Secrets.
2. `WHATSAPP_TOKEN` configurada en Firebase Secrets.
3. Centro "Los Andes" con `whatsappConfig.phoneNumberId` correcto en Firestore.

### Rollback:
Si se detectan problemas, restaurar el archivo `whatsapp.ts` desde el commit anterior:
```bash
git checkout HEAD~1 -- functions/src/whatsapp.ts
firebase deploy --only functions
```
