# Memoria y Estado Conversacional: Implementación Final

## 1. Interface `AgentConversation` (implementada)

```typescript
interface AgentConversation {
    centerId?: string;                    // Centro activo (ej: "c_cf35oz9w")
    centerName?: string;                  // Nombre para mensajes
    patientName?: string;                 // Nombre del paciente
    patientRut?: string;                  // RUT del paciente
    patientPhone?: string;                // Teléfono del paciente
    history?: { role: string; text: string }[]; // Últimos N mensajes
    selectedStaffId?: string;             // Médico seleccionado (del agente)
    selectedStaffName?: string;           // Nombre del médico
    selectedDate?: string;                // Fecha seleccionada
    selectedSlotDocId?: string;           // Slot Firestore seleccionado
    selectedSlotLabel?: string;           // Hora legible
    // Auto-Rescate de Controles
    isRescuingControl?: boolean;          // ¿Fue contactado proactivamente?
    targetDoctorId?: string;              // Médico del control pendiente
    targetDoctorName?: string;            // Nombre del médico
    hasPendingExams?: boolean;            // ¿Tiene exámenes pendientes?
    // Estado simplificado
    phase: "ACTIVE" | "HANDOFF";          // Solo 2 estados posibles
    // Auditoría
    lastAgentAction?: string;             // Última tool ejecutada
    updatedAt: admin.firestore.FieldValue; // Timestamp
}
```

## 2. Colección Firestore: `conversations/{phone}`

Cada documento se indexa por el número de teléfono del paciente (ej: `56912345678`).

### Ciclo de vida:
1. **Creación**: Al recibir el primer mensaje del paciente, o al enviar un Template de Rescate.
2. **Actualización**: En cada mensaje procesado, se actualiza `history[]` y `updatedAt`.
3. **Eliminación**: Tras una reserva exitosa (`resetConversation`), o por expiración.

## 3. Gestión de Historial

- **Máximo**: `MAX_HISTORY_MESSAGES = 10` mensajes almacenados.
- **Formato**: `{ role: "user" | "model", text: "..." }`.
- **Propósito**: Se envía como `history` al chat de Gemini para contexto multi-turn.
- **Beneficio**: El agente "recuerda" que ya le preguntó el nombre o el RUT.

## 4. Auto-expiración (TTL)

| Fase | TTL | Comportamiento |
|---|---|---|
| `ACTIVE` | 4 horas | Se limpia el historial y se reinicia la conversación |
| `HANDOFF` | 8 horas | Se resetea completamente (paciente puede volver a intentar) |

La expiración se verifica en `getConversation()` al inicio de cada mensaje entrante.

## 5. Aislamiento Multi-centro

- El `centerId` se **recarga** desde `getCenterByPhoneId(phoneNumberId)` en cada mensaje.
- El prompt del sistema incluye solo el catálogo de profesionales de ESE centro.
- Las tools (`get_available_slots`, `book_appointment`) solo operan sobre `centers/{centerId}/...`.
- **No existe** forma de que el agente acceda a datos de otro centro.

## 6. Trazabilidad y Auditoría

- **`lastAgentAction`**: Guarda `"tool_name({params...})"` para cada tool ejecutada.
- **Cloud Logging**: Cada tool call genera `[Agent] Turn N: Tool=xxx` con los argumentos.
- **`bookedVia: "whatsapp_agent"`**: Las citas reservadas por el agente están marcadas en Firestore.
- **`source: "whatsapp_agent"`**: Las solicitudes de handoff están marcadas con la fuente.

## 7. Seguridad de Datos

- El historial enviado a Gemini **solo contiene texto**. No se procesan imágenes ni documentos adjuntos.
- El RUT se almacena en Firestore pero no se usa como parte de ningún entrenamiento.
- Se recomienda migrar a **Vertex AI** (Google Cloud) para garantizar aislamiento empresarial de datos si se escala a producción multi-cliente.
