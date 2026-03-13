# Riesgos y Controles: Agente ClaveSalud V2

Identificamos 5 riesgos críticos y sus mitigaciones técnicas para operar el Agente de WhatsApp en **ClaveSalud**.

## 1. Riesgo: Alucinación de Horarios
**Descripción**: El agente le dice al paciente "Sí, tengo a las 11:30" cuando ese horario no está en Firestore o ya fue tomado.
**Impacto**: Frustración del paciente y sobrecupos reales en el centro médico.
**Controles**:
- **Tool-First**: El agente **no puede** confirmar una hora si no ha llamado antes a `get_available_slots` y recibido un `slotDocId`.
- **Double-Check**: El backend de `book_appointment` vuelve a verificar el estado `available` en Firestore antes de persistir la reserva atomizada.
- **Validación Final**: El mensaje de confirmación que recibe el paciente se genera desde el resultado **real** de la Tool de reserva, no inventado por el agente.

## 2. Riesgo: Fuga de Datos entre Centros (Multi-tenant)
**Descripción**: Un paciente escribe al Centro A (Los Andes) y el agente le ofrece horas del Centro B.
**Impacto**: Falla de seguridad y privacidad entre clientes de ClaveSalud.
**Controles**:
- **Contexto Rígido**: El `centerId` se inyecta en el **System Instruction** de Gemini al inicio de cada mensaje.
- **Autorización a Nivel de Tool**: Las herramientas (ej: `get_available_slots`) **solo** consultan las subcolecciones del `centerId` activo. No se permiten consultas globales.

## 3. Riesgo: Mala Interpretación Clínica
**Descripción**: El paciente pide ayuda por un dolor agudo y el agente intenta agendar una hora para dentro de una semana en lugar de derivar a urgencia.
**Impacto**: Riesgo vital para el paciente.
**Controles**:
- **Regla de Oro (Identity)**: Se prohíbe explícitamente al agente dar diagnósticos o recomendaciones médicas.
- **Trigger de Alarmas**: El agente tiene instrucciones de detectar palabras clave de riesgo (dolor de pecho, falta de aire) y llamar a `trigger_handoff` con una alerta de prioridad alta para la secretaria.

## 4. Riesgo: Costo Inesperado de API (Gemini)
**Descripción**: Una conversación circular entre bots o un spam de mensajes genera costos altos en la API de Google.
**Impacto**: Financiero.
**Controles**:
- **Rate Limiting**: Máximo 10 mensajes por usuario por minuto.
- **Token Max**: Limitar el `maxOutputTokens` a 500 y una ventana de contexto de máx 5-10 mensajes previos.

## 5. Riesgo: Doble Reserva (Race Condition)
**Descripción**: Dos pacientes intentan reservar el mismo slot al mismo tiempo por distintos medios (Web y WhatsApp).
**Impacto**: Conflicto de agenda.
**Controles**:
- **Firestore Transaction**: Se usa `db.runTransaction` en la Tool de reserva para asegurar que solo una escritura sea exitosa.
- **Notificación Inmediata**: Si la reserva falla, el agente recibe el error y debe proponer alternativas.
