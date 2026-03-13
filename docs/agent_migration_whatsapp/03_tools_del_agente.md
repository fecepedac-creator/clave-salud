# Diseño de Tools del Agente: Implementación Final

Estas son las 6 herramientas (Tools) implementadas en `functions/src/whatsapp.ts` que el Agente Gemini puede ejecutar.

## 📋 Tabla de Tools

| # | Tool | Tipo | Firestore | Implementada |
|---|---|---|---|---|
| 1 | `list_professionals` | Lectura | `centers/{centerId}/staff` | ✅ |
| 2 | `get_available_slots` | Lectura | `centers/{centerId}/appointments` | ✅ |
| 3 | `suggest_alternative_dates` | Lectura | `centers/{centerId}/appointments` (x14 días) | ✅ |
| 4 | `book_appointment` | Escritura | `centers/{centerId}/appointments/{slotDocId}` | ✅ |
| 5 | `get_center_info` | Lectura | `centers/{centerId}` (desde cache) | ✅ |
| 6 | `trigger_handoff` | Escritura | `centers/{centerId}/handoff_requests` | ✅ |

---

## 🔍 Detalle por Tool

### 1. `list_professionals`
- **Input**: `{}` (sin parámetros)
- **Output**: `{ professionals: [{ id, name, specialty }] }`
- **Origen**: Cache de `getCenterByPhoneId()` → campo `staff`
- **Filtros aplicados**: Solo `visibleInBooking: true` y `active: true`
- **Riesgo**: Ninguno (solo lectura de cache)

### 2. `get_available_slots`
- **Input**: `{ staffId: string, date: string }`
- **Output**: `{ date, slots: [{ time, docId }], count, message }`
- **Origen**: `getAvailableSlots(centerId, staffId, date)`
- **Filtros**: `status == "available"`, ordenado por `time asc`
- **Compatibilidad**: Busca por `doctorId` primero, fallback a `doctorUid`
- **Riesgo**: Mostrar slots expirados → Mitigado: solo busca `status: available`

### 3. `suggest_alternative_dates` *(NUEVA)*
- **Input**: `{ staffId: string, startDate: string }`
- **Output**: `{ alternatives: [{ date, label, count }], message }`
- **Lógica**: Itera hasta 14 días desde `startDate`, excluye domingos, retorna máximo 5 fechas con disponibilidad
- **Riesgo**: Múltiples lecturas Firestore (hasta 14) → Mitigado: se detiene al encontrar 5

### 4. `book_appointment`
- **Input**: `{ slotDocId: string, staffId?: string, patientName: string, patientRut: string }`
- **Output**: `{ success: boolean, message: string }`
- **Implementación**: `bookAppointmentTool()` con `db.runTransaction`
- **Escritura**: Cambia `status` a `"booked"`, agrega `patientName`, `patientRut`, `patientPhone`, `bookedVia: "whatsapp_agent"`
- **Riesgos y Controles**:
  - ⚠️ **Doble reserva**: Transacción atómica verifica `status == "available"` dentro del lock
  - ⚠️ **Datos falsos**: El prompt instruye al agente a CONFIRMAR antes de llamar esta tool
  - ⚠️ **RUT inválido**: Actualmente no hay validación de dígito verificador (mejora futura)

### 5. `get_center_info` *(NUEVA)*
- **Input**: `{}` (sin parámetros)
- **Output**: `{ name, address, phone, businessHours, googleMapsUrl }`
- **Origen**: Objeto `center` del cache
- **Riesgo**: Ninguno (solo lectura)

### 6. `trigger_handoff`
- **Input**: `{ reason: string }`
- **Output**: `{ success: boolean, message: string }`
- **Escritura**: Crea documento en `handoff_requests` con `status: "pending"`, `source: "whatsapp_agent"`
- **Notificación**: Envía WhatsApp a `secretaryPhone` del centro
- **Efecto extra**: Cambia `conv.phase` a `"HANDOFF"` → el agente deja de responder

---

## 🛡️ Reglas de Seguridad (implementadas en System Prompt)

1. **Pre-booking**: El agente debe tener `slotDocId` real (de `get_available_slots`) antes de llamar a `book_appointment`.
2. **Confirmación explícita**: El prompt dice "CONFIRMA explícitamente todos los datos con el paciente" antes de reservar.
3. **No diagnósticos**: "NO des diagnósticos, recomendaciones médicas ni sugerencias de medicamentos. NUNCA."
4. **Urgencias**: Si detecta palabras de riesgo vital → `trigger_handoff` + indicar llamar al 131.
5. **Aislamiento multi-centro**: El `centerId` se inyecta en el prompt y cada tool solo opera sobre ese centro.
6. **Anti-loop**: `MAX_AGENT_TURNS = 5` por mensaje.
