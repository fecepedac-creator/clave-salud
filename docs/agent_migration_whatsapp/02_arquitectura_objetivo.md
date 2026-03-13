# Diseño de la Arquitectura Objetivo: Agente ClaveSalud V2

Esta sección propone la estructura de un **Asistente de Agendamiento Inteligente** que preserve la soberanía de los datos médicos y el control del centro (ej: Los Andes).

## 1. El Loop de Razonamiento del Agente
El agente debe operar bajo el paradigma de **Function Calling (Tools)** de Google Gemini.

1.  **Entrada**: Mensaje de WhatsApp (Texto o Audio).
2.  **Preparación**: El backend (Firebase Function) inyecta el `centerId` y el perfil del centro (Nombre, especialidades) en el prompt del sistema.
3.  **Razonamiento**: Gemini analiza el mensaje.
    - Si necesita datos: Llama a una **Tool**.
    - Si tiene suficiente info: Responde al paciente.
4.  **Ejecución**: El backend ejecuta la Tool (lectura o escritura controlada) y devuelve el resultado a Gemini.
5.  **Respuesta Final**: Gemini genera un mensaje empático y formal para WhatsApp.

## 2. Los Componentes del Agente

### A. Capa de Identidad (Identity Layer)
- **Prompt Sistémico**: Define que es el Asistente de "Centro Los Andes".
- **Aislamiento Multi-centro**: El agente solo puede ver médicos y agendas del `centerId` asociado a su `phoneNumberId`.

### B. Capa de Acciones Determinísticas (Tools)
El agente **no escribe** en Firestore libremente. Solo puede llamar a funciones pre-aprobadas:
- `get_available_slots(staffId, date)`
- `list_professionals()`
- `book_appointment(slotDocId, patientData)`
- `trigger_handoff(reason)`

### C. Capa de Fallback (Voz Humana)
- Si el agente tiene dudas de confianza (< 80%) o el paciente pide explícitamente a una persona, la herramienta `trigger_handoff` genera la solicitud a la secretaria.

## 3. Seguridad e Integridad Clínica/Operativa
- **Transaccionalidad**: Todas las reservas (`book_appointment`) siguen usando **Transactions** de Firestore.
- **Doble Reserva**: Al llamar a `book_appointment`, el backend vuelve a verificar que el `slotDocId` siga en estado `available` antes de proceder.
- **Validación RUT**: Una herramienta de validación de RUT se asegura de que el formato sea correcto antes de intentar agendar.
