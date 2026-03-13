# Recomendación Final: Agente de Agendamiento ClaveSalud V2

## Estado: ✅ IMPLEMENTADO — Listo para Deploy

La migración del chatbot rígido (`BotState`) al Agente Inteligente (`Gemini Function Calling`) ha sido completada en su totalidad como un **rewrite de `functions/src/whatsapp.ts`**.

## ⚖️ ¿Valió la pena?
**Sí.** El archivo resultante es más corto (~1047 vs ~1180 líneas), más mantenible y significativamente más capaz:

| Capacidad | Bot Antiguo | Agente V2 |
|---|---|---|
| Flujo libre ("Quiero hora con Cepeda mañana") | ❌ Ignoraba | ✅ Entiende y actúa |
| Proponer alternativas si no hay hora | ❌ | ✅ Busca 14 días |
| Info del centro (dirección, horarios) | ❌ | ✅ get_center_info |
| Memoria conversacional | ❌ Solo estado actual | ✅ Últimos 10 mensajes |
| Detección de urgencias | ❌ | ✅ En el prompt |
| Auto-expiración de conversaciones | Parcial (HANDOFF 8h) | ✅ ACTIVE 4h + HANDOFF 8h |
| Rescate de controles | ✅ | ✅ (Mejorado con contexto en prompt) |

## 📦 ¿Qué se conservó del bot anterior?
1. **`getCenterByPhoneId`** — Resolución multi-centro (intacta).
2. **`getAvailableSlots`** — Lectura de Firestore con fallback `doctorId/doctorUid` (intacta).
3. **`triggerHandoff`** — Persistencia en `handoff_requests` y notificación WA (refactorizada pero equivalente).
4. **`onAppointmentBooked`** — Trigger de notificación post-reserva (intacto).
5. **`dailyControlRescuer`** — Cron de auto-rescate de controles (intacto).
6. **Botones de rescate** — `rescate_agendar`, `rescate_examenes`, `action_handoff` (compatibles).

## 🗑️ ¿Qué se eliminó?
1. **Máquina de estados** — 9 estados, `switch(conv.state)`, funciones de envío de listas/botones de paso a paso.
2. **`processWithAI`** — Clasificador JSON básico de 3 categorías.
3. **Funciones intermedias** — `offerInitialMenu`, `startBookingFlow`, `offerDates`.

## 🛠️ Primer paso técnico real: DEPLOY
```bash
# Desde la raíz del proyecto
cd functions
npm run build           # ← Ya verificado ✅
firebase deploy --only functions
```

### Verificación post-deploy:
1. Enviar "Hola" al número de WhatsApp de Los Andes.
2. El agente debe responder con saludo personalizado.
3. Pedir "Quiero hora con [nombre de médico]".
4. Verificar que el agente llama a `get_available_slots`.
5. Verificar en Cloud Logging los logs `[Agent] Turn N: Tool=xxx`.

### Rollback inmediato:
```bash
git checkout HEAD~1 -- functions/src/whatsapp.ts
cd functions && npm run build && firebase deploy --only functions
```
