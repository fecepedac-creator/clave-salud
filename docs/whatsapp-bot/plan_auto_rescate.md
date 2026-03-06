# Plan de Implementación: Auto-Rescate de Controles Médicos Vía WhatsApp API

Este documento detalla el plan paso a paso para implementar la automatización de recordatorios de controles médicos a través del bot de WhatsApp, asegurando no romper el flujo existente y maximizando la conversión (agendamientos reales).

## 🚀 Objetivo
Aumentar la asistencia a controles médicos mediante automatización proactiva vía WhatsApp, ofreciendo un flujo hiper-personalizado que considera si el paciente tiene o no exámenes médicos pendientes indicados en su última consulta.

---

## 🏗️ Fase 1: Preparación del Terreno (Sin tocar producción)

### 1.1 Nueva Plantilla en Meta (Business Manager)
- **Acción (Manual por el admin):** Crear una plantilla en el administrador comercial de Meta de categoría "Utilidad" llamada `recordatorio_control_asistido`.
- **Estructura propuesta:**
  - Header: Texto `Notificación de Control`
  - Body: `Hola {{1}}, le escribimos desde {{2}}. Se acerca la fecha recomendada por el {{3}} para su próximo control. {{4}} ¿Qué desea hacer en este momento?`
  - Botones (Call to Action / Quick Replies):
    1. Agendar control
    2. Tema Exámenes
    3. Hablar con secretaria (Handoff)
- **Nota técnica:** El parámetro `{{4}}` será dinámico desde código. Si tiene exámenes diremos: *"Vimos que el doctor le solicitó exámenes en su última consulta"*. Si no tiene, se enviará un espacio en blanco o una frase genérica de saludo.

### 1.2 Extensión del Esquema de Conversación (Firestore)
- **Acción:** Asegurar que el tipado de `Conversation` en `whatsapp.ts` pueda almacenar contexto de la proactividad.
- **Campos a agregar en `conv_state`:**
  - `isRescuingControl`: boolean
  - `targetDoctorId`: string (Para saltarse el paso de selección de doctor)
  - `targetDoctorName`: string
  - `hasPendingExams`: boolean

---

## ⚙️ Fase 2: Implementación Backend (Cloud Functions)

### 2.1 Creación del Cron Job (`dailyControlRescuer`)
- **Acción:** Crear una nueva Cloud Function (Pub/Sub) que se ejecute diariamente (ej: 09:30 AM).
- **Lógica:**
  1. Consultar en Firestore pacientes activos (`active: true`).
  2. Filtrar por `nextControlDate` que coincida exactamente con "Hoy + 7 días" (para darles tiempo hábil de agendar).
  3. Para cada paciente que califique:
     - Buscar su última consulta (`consultations` ordenada por fecha descendente).
     - Verificar si tiene una receta de tipo `"OrdenExamenes"` o `"Solicitud de Examen"`. Esto determina la variable `hasPendingExams`.
     - Validar que el paciente no tenga ya una cita futura (`appointments`) con ese médico (`status: "booked"`).
     - **Ejecutar envío de WhatsApp (API API Graph de Meta)** enviando la plantilla `recordatorio_control_asistido` con las variables inyectadas.
     - **Inicializar estado en Firestore:** Crear/actualizar la sesión de conversación del paciente en `conversations` con estado `IDLE` pero añadiendo el contexto de rescate (`isRescuingControl: true`, `targetDoctorId`, etc).

### 2.2 Mejora del Prompt de Gemini (IA Contextual)
- **Acción:** Inyectar variables dinámicas en el prompt de la función `processWithAI` en `whatsapp.ts`.
- **Cambio:** Si el paciente tiene `isRescuingControl: true`, añadir al prompt: 
  > *"Contexto vital: Este paciente fue contactado hoy para recordarle su control médico con el {targetDoctorName}. El sistema indica que {hasPendingExams ? 'TIENE' : 'NO TIENE'} exámenes pendientes por hacerse. Trata de guiar al paciente a agendar su consulta o derivarlo con secretaria si necesita ayuda con los exámenes."*

---

## 🔀 Fase 3: Modificación del Webhook (Flujo de Respuestas)

### 3.1 Intercepción de Botones del Template
- **Acción:** En `whatsappWebhook`, interceptar los *payloads* de los botones de la nueva plantilla.
- **Rama A ("Agendar control"):**
  - Si el paciente toca esto, en lugar de llamar a `startBookingFlow` (que lista a todos los médicos), saltar directamente a `offerDates` pasando el `targetDoctorId` y `targetDoctorName` guardado en el documento de la conversación.
  - Esto garantiza que con solo 1 clic, ya esté viendo la agenda de *su* doctor tratante.
- **Rama B ("Tema Exámenes"):**
  - Informar al paciente: *"Una persona encargada tomará contacto con usted para revisar la orden y agendar la toma de muestras."*
  - Llamar a la función existente `triggerHandoff()`, asegurando que la notificación que llega a la secretaria de Centro Médico indique explícitamente: *"MOTIVO: Agendamiento de exámenes previos a control"*.
- **Rama C ("Hablar con secretaria"):**
  - Ejecutar el flujo de handoff estándar ya implementado.

### 3.2 Manejo de Caída (Fallback) de Agenda Vacía
- **Seguridad UX:** Si en la **Rama A**, al llamar a `offerDates`, el sistema devuelve que el doctor no tiene turnos cargados (arreglo realizado hoy), el webhook ya sabe cómo derivar a secretaria suavemente (*"El doctor no tiene horas... ¿Desea que la secretaria lo contacte?"*). No se requiere desarrollo nuevo aquí, la arquitectura heredará las mejoras actuales.

---

## 🧪 Fase 4: Pruebas y Despliegue Secuencial

Para no romper el webhook en producción:
1. **Desarrollo:** Código de la Cron Job (Pub/Sub) y nuevas intercepciones del webhook en la rama `feature/auto-rescue-bot`.
2. **Prueba End-to-End:** Utilizar un paciente de prueba, forzar su `nextControlDate` a +7 días y correr la función Cron manualmente.
3. **Despliegue Secuencial:**
   - Desplegar primero el webhook (para que sepa reaccionar si por error se envía la plantilla).
   - Desplegar finalmente el Cron Job Pub/Sub.
4. **Validación:** Monitorear logs de Firebase los primeros 3 días para verificar el funnel de conversión (Enviados vs Agendados).

---
*Nota: Este plan está diseñado para insertarse limpiamente sobre la lógica de `whatsapp.ts` refactorizada recientemente, minimizando la deuda técnica.*
