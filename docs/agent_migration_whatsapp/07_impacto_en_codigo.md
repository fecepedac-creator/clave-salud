# Impacto Real en el Código: Migración Agente ClaveSalud

Este documento refleja los cambios **realmente implementados** en el repositorio.

## 1. Archivo Principal Modificado

### `functions/src/whatsapp.ts` — **REWRITE COMPLETO**

| Sección | Estado |
|---|---|
| Imports | Añadido `SchemaType` de `@google/generative-ai` |
| Cache multi-centro | ✅ Sin cambios (conservado) |
| `getCenterByPhoneId()` | ✅ Sin cambios (conservado) |
| `BotState` type | ❌ **ELIMINADO** — Reemplazado por `AgentConversation.phase` |
| `Conversation` interface | ❌ **ELIMINADO** — Reemplazado por `AgentConversation` |
| `getConversation()` | ♻️ **REFACTORIZADO** — Ahora retorna `AgentConversation` con historial y TTL de 4h |
| `setConversation()` | ♻️ Renombrado a `saveConversation()` |
| `_resetConversation()` | ♻️ Renombrado a `resetConversation()` (exportado) |
| `sendText/sendButtons/sendList` | ✅ Sin cambios (conservados, `sendButtons` y `sendList` exportados) |
| `getAvailableSlots()` | ✅ Sin cambios (conservado) |
| `bookAppointment()` | ❌ **ELIMINADO** — Reemplazado por `bookAppointmentTool()` con interfaz limpia |
| `triggerHandoff()` | ♻️ **REFACTORIZADO** — Firma simplificada, campo `source: "whatsapp_agent"` |
| `processWithAI()` | ❌ **ELIMINADO** — Reemplazado por `processAgentMessage()` |
| `offerInitialMenu()` | ❌ **ELIMINADO** |
| `startBookingFlow()` | ❌ **ELIMINADO** |
| `offerDates()` | ❌ **ELIMINADO** |
| `getStateLabel()` | ❌ **ELIMINADO** |
| `workerProcessor()` | ♻️ **REWRITE** — De ~260 líneas a ~90 líneas. Sin switch/case de estados |
| `whatsappWebhook` | ✅ Sin cambios sustanciales (conservado) |
| `onAppointmentBooked` | ✅ Sin cambios (conservado) |
| `dailyControlRescuer` | ✅ Sin cambios sustanciales (conservado) |

### Nuevas Funciones Añadidas:
- `bookAppointmentTool()` — Reserva atómica con transacción Firestore
- `processAgentMessage()` — Loop de razonamiento con Gemini Function Calling
- `buildSystemPrompt()` — Prompt dinámico con catálogo de médicos
- `AGENT_TOOLS` — Definiciones de 6 herramientas para Gemini

## 2. Archivos NO Modificados
- `functions/src/index.ts` — Ya tenía `export * from "./whatsapp"` (línea 2085)
- `functions/package.json` — Ya tenía `@google/generative-ai` como dependencia
- `firestore.rules` — Sin cambios necesarios (Service Account tiene permisos)
- Todos los componentes de frontend — Sin impacto

## 3. Documentación Generada
- `docs/agent_migration_whatsapp/` — 9 archivos markdown con diseño completo

## 4. Estimación de Impacto
- **Líneas eliminadas**: ~400 (máquina de estados, funciones de botones)
- **Líneas añadidas**: ~270 (agente, tools, prompt, memoria)
- **Resultado neto**: Archivo más corto (~1047 vs ~1180 líneas) y más mantenible
