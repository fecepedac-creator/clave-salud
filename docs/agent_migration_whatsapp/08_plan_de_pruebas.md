# Plan de Pruebas: Agente ClaveSalud V2

Esta estrategia de QA asegura que el Agente de WhatsApp no rompa la operación diaria de los centros médicos (ej: Los Andes).

## 🟢 1. Pruebas Unitarias (Tools)
- **Propósito**: Validar que las funciones que se entregan al agente funcionan como se espera de forma aislada.
- **Tools Críticas**: `get_available_slots` y `book_appointment`.
- **Casos de Prueba**:
    - `get_available_slots`: Verificar que retorna solo horas marcadas como `available` y de la fecha solicitada.
    - `book_appointment`: Simular una reserva y confirmar que el documento en Firestore cambia de estado correctamente.

## 🟡 2. Pruebas de Integración (Tool Calling)
- **Propósito**: Validar que Gemini 1.5 Flash sabe CUÁNDO llamar a una herramienta.
- **Simulación**: Enviar mensajes como *"¿Qué hora hay mañana?"* y confirmar que el bot genera una solicitud de función a `get_available_slots`.
- **Fallos Controlados**: Enviar mensajes ambiguos (*"Quiero ir pronto"*) y verificar que el agente repregunte en lugar de alucinar una fecha.

## 🟠 3. Pruebas de Fallback a Humana (Handoff)
- **Propósito**: Asegurar que ningún paciente quede en un bucle infinito con la IA.
- **Casos de Prueba**:
    - El paciente dice *"No me entiendes, pásame a una persona"*. Confirmar que se activa el `trigger_handoff`.
    - Simular un error de API de Google y verificar que el bot envía un mensaje genérico indicando que un humano se contactará pronto.

## 🔴 4. Pruebas de Regresión (Multi-centro)
- **Propósito**: Asegurar que la configuración del Centro A no afecte la del Centro B (Mapeo de `phoneNumberId`).
- **Casos de Prueba**:
    - Enviar mensajes por el número de WhatsApp de Los Andes y confirmar que el agente se presenta como "Asistente de Los Andes".
    - Verificar que solo puede leer staff del ID `c_cf35oz9w`.

## 📡 5. Pruebas E2E (WhatsApp Real)
- **Propósito**: Validación final de la cadena Meta webhook -> Cloud Function -> Firestore -> Respuesta WA.
- **Herramientas**: Usar una cuenta de WhatsApp Business de prueba y dispositivos móviles reales.
- **Escenarios**: Ciclo completo de agendamiento: Saludo -> Selección Doctor -> Selección Hora -> Ingreso RUT -> Confirmación -> Recepción del mensaje de éxito.
