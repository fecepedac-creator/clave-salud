# Auditoría del Estado Actual: Chatbot WhatsApp ClaveSalud

Esta revisión técnica detalla el funcionamiento del chatbot tal como reside en `functions/src/whatsapp.ts`.

## 1. Funcionamiento del Flujo Actual (Bot de Estados)
Hoy el chatbot opera como una **Máquina de Estados Finita (FSM)**:
- **Estados Definidos**: `IDLE`, `CHOOSING_DOCTOR`, `CHOOSING_DATE`, `CHOOSING_SLOT`, `COLLECTING_NAME`, `COLLECTING_RUT`, `COLLECTING_PHONE`, `CONFIRMING`, `HANDOFF`.
- **Transiciones Rígidas**: El bot espera entradas específicas en cada estado. Si un paciente dice "Me duele el brazo" en medio de `CHOOSING_DATE`, el bot no entiende y re-itera el pedido de fecha.
- **Relación con Firestore**:
    - `centers/{centerId}/appointments`: Base de datos de slots médicos.
    - `conversations/{phone}`: Persistencia de estado actual y datos temporales del agendamiento.
    - `handoff_requests`: Solicitudes para secretaria generadas por el bot.

## 2. Resolución de Centro Multi-Sede
Se utiliza el `phoneNumberId` capturado en el Webhook de Meta:
- **Función**: `getCenterByPhoneId(phoneNumberId: string)`.
- **Mecanismo**: Busca en la colección `centers` un documento donde `whatsappConfig.phoneNumberId == phoneNumberId`. Esto permite soportar múltiples centros (ej: Los Andes) de forma aislada.

## 3. Consulta de Disponibilidad y Reserva
- **Consulta**: `getAvailableSlots(centerId, staffId, date)`. Realiza una consulta filtrando por `status == "available"`.
- **Reserva**: `bookAppointment(phone, conv)`. Utiliza un **Firestore Transaction** (`db.runTransaction`) para evitar dobles reservas (Race Conditions). Cambia el estado a `booked` y guarda los datos del paciente.

## 4. Handoff a Secretaria
- **Función**: `triggerHandoff`. Crea un documento en la subcolección `handoff_requests` del centro y —opcionalmente— envía una notificación al `secretaryPhone` configurado en `whatsappConfig`.

## 5. Límites Detectados
- **Rigidez Conversacional**: Si el paciente entrega información "fuera de turno", el bot la ignora.
- **Detección de Intenciones**: El `processWithAI` actual es un simple clasificador de 3 categorías (`BOOKING`, `GENERAL`, `HANDOFF`), pero no extrae entidades (médico, especialidad, fecha) de forma estructurada.
- **Alucinación de Horarios**: No existe, ya que hoy el bot solo muestra botones de slots que leyó de Firestore.
