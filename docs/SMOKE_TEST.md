# Smoke Test Checklist (ClaveSalud)

> Objetivo: validar rápidamente los flujos end-to-end más críticos por rol.

## SuperAdmin

**Checklist**
1. Inicia sesión como SuperAdmin (Google o credenciales según configuración).
2. Accede a la vista **SuperAdmin Dashboard**.
3. Crea un centro nuevo con nombre y slug válidos.
4. Verifica que el centro aparece en el listado y en el home.
5. Edita el centro y define `adminEmail`.
6. Genera invitación de admin y valida que se copie el enlace.
7. (Opcional) Sube logo y verifica que se muestre en la UI.

**Login con Google (3 pasos)**
1. Click en el candado de SuperAdmin.
2. Selecciona la cuenta Google autorizada.
3. Verifica que se abre el SuperAdmin Dashboard.

**Firestore paths esperados**
- `centers/{centerId}`
- `invites/{token}` (si se generó invitación)

---

## Center Admin

**Checklist**
1. Inicia sesión con un correo invitado (acepta invitación).
2. Accede a **Admin Dashboard**.
3. Crea un profesional con email y rol válido.
4. Verifica que el profesional aparece en la lista.
5. Abre agenda y crea un bloque disponible.
6. Cancela un bloque y verifica auditoría.
7. Revisa **Preingresos** y aprueba un preingreso pendiente.

**Firestore paths esperados**
- `centers/{centerId}/staff/{staffUid}`
- `invites/{token}` (para profesionales invitados)
- `centers/{centerId}/appointments/{appointmentId}`
- `centers/{centerId}/patients/{patientId}`
- `centers/{centerId}/auditLogs/{logId}`
- `centers/{centerId}/preadmissions/{preadmissionId}` (debe eliminarse al aprobar)

---

## Professional / Doctor

**Checklist**
1. Inicia sesión como profesional.
2. Accede a **Doctor Dashboard**.
3. Crea o edita un paciente.
4. Registra una atención (consulta) con diagnóstico básico.
5. Crea/actualiza plantilla clínica.
6. Abre agenda y crea un bloque disponible.
7. Verifica que el conteo de citas del día se actualiza.

**Firestore paths esperados**
- `centers/{centerId}/patients/{patientId}`
- `centers/{centerId}/consultations/{consultationId}`
- `centers/{centerId}/appointments/{appointmentId}`
- `centers/{centerId}/staff/{staffUid}` (plantillas y perfiles)
- `centers/{centerId}/auditLogs/{logId}`

---

## Paciente (sin login)

**Checklist**
1. En la home, selecciona un centro médico.
2. Ingresa a **Soy Paciente**.
3. Completa **Ficha de Pre-Ingreso** (RUT, nombre, teléfono o email).
4. Envía preingreso y verifica mensaje de éxito.
5. Ingresa a **Solicitar Hora**.
6. Selecciona especialista y horario disponible.
7. Completa datos y confirma reserva (preingreso).

**Firestore paths esperados**
- `centers/{centerId}/preadmissions/{preadmissionId}`

---

## Verificación rápida de integridad

- Recargar la app (F5) y confirmar que los datos visibles provienen de Firestore.
- Confirmar que no se crean documentos en colecciones raíz legacy (`patients`, `appointments`, `logs`).
