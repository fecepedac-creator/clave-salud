# Plan de remediación por lotes (P0/P1) — ClaveSalud

Fecha: 2026-03-29.
Objetivo: aplicar mejoras seguras, testeables y reversibles sobre hallazgos críticos del backlog.

## Lote 1 (implementado en este PR)
**Título:** Bloqueo de hard delete en ficha clínica raíz.

- **Problema que soluciona:** eliminación física de `patients` y `consultations` en modelo raíz, con riesgo de pérdida irreversible de evidencia clínica.
- **Cambios:** denegar `delete` en:
  - `/patients/{patientId}`
  - `/patients/{patientId}/consultations/{consultationId}`
- **Archivos modificados:** `firestore.rules`.
- **Riesgos:**
  - si existía alguna operación cliente que dependía de delete físico, quedará bloqueada por reglas.
- **Mitigación:**
  - el flujo actual ya usa archivado lógico en frontend para pacientes; la medida alinea seguridad sin introducir nuevo modelo.
- **Cómo validarlo:**
  1. intentar borrar paciente/consulta desde cliente autenticado (owner/admin/superadmin): debe fallar con `PERMISSION_DENIED`.
  2. validar que update de archivado (`active=false`, metadatos) siga funcionando.
  3. revisar que lectura/listado no cambie.
- **Reversibilidad:**
  - cambio de reglas acotado a dos líneas de autorización; rollback simple por commit revert.

---

## Lote 2
**Título:** Endurecer ACL de `/patients` (bloquear cambios de `ownerUid` y `accessControl` desde cliente).

- **Problema que soluciona:** escalada lateral de permisos sobre ficha clínica.
- **Archivos potenciales:** `firestore.rules`, `functions/src/index.ts` (nueva callable ACL), `hooks/useCrudOperations.ts`.
- **Riesgos:** romper updates de pacientes que hoy envían payload amplio.
- **Validación:** tests de rules por rol + pruebas de actualización clínica vs cambios ACL.
- **Reversibilidad:** feature flag y rollout por entorno.

## Lote 3
**Título:** Protección anti-abuso en funciones públicas de citas.

- **Problema que soluciona:** enumeración/cancelación maliciosa por brute force de RUT/teléfono.
- **Archivos potenciales:** `functions/src/index.ts`, infraestructura App Check/CAPTCHA, frontend booking.
- **Riesgos:** fricción en portal público si validaciones son demasiado estrictas.
- **Validación:** pruebas E2E de booking/cancel con casos válidos y abuso.
- **Reversibilidad:** toggle de enforcement gradual.

## Lote 4
**Título:** Reducir superficie de lectura pública multi-tenant.

- **Problema que soluciona:** fuga de metadatos en `centers/services/publicStaff`.
- **Archivos potenciales:** `firestore.rules`, migración de catálogos públicos, componentes de portal.
- **Riesgos:** romper portal público si no existe colección pública equivalente.
- **Validación:** smoke tests portal + pruebas de reglas anónimas/autenticadas.
- **Reversibilidad:** fallback temporal por colección espejo.

## Lote 5
**Título:** Optimización de agenda (query server-side + paginación por rango).

- **Problema que soluciona:** `limit(1000)` + filtrado client-side, latencia y costo.
- **Archivos potenciales:** `hooks/useFirestoreSync.ts`, `firestore.indexes.json`, vistas agenda.
- **Riesgos:** divergencias funcionales en agenda por ventana temporal.
- **Validación:** comparación de resultados antes/después + métricas de lectura.
- **Reversibilidad:** bandera para volver a query anterior temporalmente.

## Lote 6
**Título:** Unificación del modelo clínico canónico (root vs legacy center).

- **Problema que soluciona:** inconsistencia clínica por duplicación de modelo.
- **Archivos potenciales:** `firestore.rules`, `functions/src/index.ts`, hooks de sincronización, scripts de migración.
- **Riesgos:** alto impacto de datos.
- **Validación:** reconciliación con checksums, diffs y criterio de salida sin divergencias críticas.
- **Reversibilidad:** estrategia de shadow-write + corte controlado.
