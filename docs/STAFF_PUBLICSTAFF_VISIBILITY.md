# Staff ↔ PublicStaff: visibilidad de profesionales

## Objetivo

Unificar cómo se publica un profesional en agenda pública sin mezclar permisos internos con rol clínico.

## Campos canónicos

En `centers/{centerId}/staff/{uid}` y `centers/{centerId}/publicStaff/{uid}`:

- `accessRole: string`
  - Rol de acceso interno (ej: `center_admin`, `doctor`).
  - **Nunca** se debe usar para mostrar especialidad al paciente.
- `clinicalRole: string`
  - Rol clínico visible al paciente (ej: `MEDICO`, `NUTRICIONISTA`, etc.).
- `specialty: string`
  - Especialidad/subespecialidad opcional.
- `visibleInBooking: boolean`
  - Controlado por admin del centro.
  - Default: `false`.
- `active: boolean`
  - Estado operativo del profesional.
- `fullName: string`
  - Nombre visible en panel interno y agenda pública.

## Reglas de publicación

La agenda pública solo considera profesionales con:

- `active === true`
- `visibleInBooking === true`

Si `agendaConfig` no existe o es `null`, el profesional puede estar publicado, pero la UI pública debe mostrar estado **"No disponible"** para evitar agendamiento inválido.

## Sincronización automática

Cloud Function `syncPublicStaff`:

- Trigger: `centers/{centerId}/staff/{uid}`.
- Acción: upsert en `centers/{centerId}/publicStaff/{uid}`.
- Copia: `fullName`, `accessRole`, `clinicalRole`, `specialty`, `active`, `visibleInBooking`, `agendaConfig`.
- No borra `publicStaff` al ocultar: mantiene documento y actualiza flags.

## Backfill

Cloud Function callable: `backfillPublicStaffFromStaff`.

- Opcional `centerId`: procesa un centro puntual; sin parámetro procesa todos.
- Normaliza:
  - `visibleInBooking` faltante => `false`
  - `clinicalRole` faltante desde `role` legacy si es clínico
  - Si `role` legacy es `center_admin`, no se usa como clínico
  - `fullName` vacío se completa desde `displayName`/`name` si existe
- Re-sincroniza `publicStaff` con campos canónicos.
