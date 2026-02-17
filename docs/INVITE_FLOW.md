# Flujo de invitación de profesionales (Center Admin)

Este documento resume qué pasa cuando un administrador de centro crea un profesional en ClaveSalud.

## 1) El admin crea la invitación

Desde `AdminDashboard`, al guardar un profesional nuevo **no** se crea todavía un usuario activo en `centers/{centerId}/staff/{uid}`.

En su lugar se crea un documento en `invites/{token}` con:
- `emailLower`
- `centerId`
- `role` de acceso (`doctor` o `center_admin`)
- `profileData` (nombre, rut, especialidad, foto, agenda, etc.)
- `status: "pending"`
- `expiresAt` (7 días)

## 2) Mensaje "Invitación enviada al mail..."

Ese mensaje es un **toast de confirmación UI**. Indica que la invitación quedó registrada en Firestore y pendiente de aceptación.

Importante: en este flujo no hay envío SMTP implementado en `AdminDashboard`.

## 3) ¿Cómo le llega el link al profesional?

En el flujo de **Center Admin**, hoy no existe un envío automático del enlace por correo.

Además, para profesionales el link no es estrictamente necesario: cuando inician sesión con el correo invitado, la app detecta invitaciones `pending` para ese email y completa la aceptación automáticamente.

En otras palabras, el admin normalmente debe avisarle al profesional por un canal externo (WhatsApp, llamada, etc.) que entre a ClaveSalud con ese correo.

> Nota: el flujo de **SuperAdmin** sí genera/copia un enlace de invitación para compartirlo, pero ese comportamiento no está implementado igual en `AdminDashboard`.

## 4) El profesional acepta

Cuando la persona invitada abre el enlace `/invite?token=...` (o inicia sesión con ese correo y tiene invitación pendiente):

1. Se valida token, estado y expiración.
2. Se exige que el correo autenticado coincida con `emailLower` de la invitación.
3. Se crea/actualiza `users/{uid}`.
4. Se crea/actualiza `centers/{centerId}/staff/{uid}` con datos de `profileData`.
5. Se marca la invitación como `accepted`.

## 5) Cuándo aparece en la lista de profesionales

Aparece como profesional activo **después** de aceptar la invitación.
Antes de eso solo existe el invite pendiente.
