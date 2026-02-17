# Almacenamiento de atenciones clínicas (consultations)

## Fuente de verdad

Cada atención clínica se guarda como documento independiente en:

`centers/{centerId}/patients/{patientId}/consultations/{consultationId}`

- `consultationId` debe ser estable y coincide con `consultation.id`.
- No usar `addDoc` para crear ID aleatorio en este flujo.

## Escritura

Al crear una atención se persiste con `setDoc` incluyendo:

- `centerId`
- `patientId`
- `createdAt` (server timestamp)
- `updatedAt` (server timestamp)
- `prescriptions` dentro del documento de atención

## Lectura

El historial clínico en el dashboard médico lee primero desde la subcolección.

Compatibilidad temporal:

- Si no hay documentos en subcolección, se usa fallback legacy desde `patients/{patientId}.consultations` (solo lectura).
- El flujo nuevo ya no agrega objetos de atención al array embebido en paciente.

## Migración opcional

Callable admin-only:

`backfillPatientConsultationsToSubcollection({ centerId, patientId? })`

- Migra `patients/{patientId}.consultations` a la subcolección.
- No borra legacy automáticamente.
