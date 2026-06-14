# Backlog técnico profesional — ClaveSalud (listo para GitHub Issues)

Fecha de corte: 2026-03-29.
Rol aplicado: Product Owner técnico senior.

## Convenciones
- **Prioridad:** P0 (crítico), P1 (alto), P2 (medio).
- **Complejidad:** Baja / Media / Alta.
- **Impacto:** Clínico / Seguridad / Negocio / Técnico.

---

## 1) Backlog por categoría

## Seguridad

| ID | Título | Descripción | Problema que resuelve | Impacto | Prioridad | Complejidad | Archivos / módulos afectados | Propuesta de solución concreta |
|---|---|---|---|---|---|---|---|---|
| SEC-01 | Bloquear escalada ACL en pacientes raíz | Endurecer reglas para impedir que usuarios con acceso clínico modifiquen `ownerUid` o `accessControl`. | Posible escalada lateral de privilegios y fuga de ficha clínica. | Seguridad, Clínico, Técnico | **P0** | Alta | `firestore.rules`, `functions/src/index.ts`, `hooks/useCrudOperations.ts` | Denegar update de campos ACL en rules; crear callable `updatePatientAccessControl` con validación de rol, motivo obligatorio y auditoría inmutable. |
| SEC-02 | Eliminar hard delete en entidades clínicas | Prohibir borrado físico de `/patients` y `/patients/*/consultations`. | Pérdida irreversible de evidencia clínica y legal. | Clínico, Seguridad, Negocio | **P0** | Media | `firestore.rules`, `functions/src/index.ts` | `allow delete: false` + flujo de archivado lógico (`active=false`, `deletedAt`, `deletedBy`, `deleteReason`, `retentionUntil`). |
| SEC-03 | Proteger endpoints públicos de citas contra abuso | Blindar list/cancel de citas públicas con anti-bot, rate limit y App Check. | Enumeración por RUT/teléfono y cancelaciones maliciosas. | Seguridad, Negocio, Clínico | **P0** | Alta | `functions/src/index.ts`, `firebase.json`, capa frontend booking | Migrar a endpoint HTTP con App Check + reCAPTCHA + throttling por IP/fingerprint + nonce de un solo uso. |
| SEC-04 | Reducir superficie de lectura pública | Separar datos públicos de internos en centros/servicios/staff. | Fuga de metadatos multi-tenant. | Seguridad, Negocio | **P0** | Media | `firestore.rules`, estructura colecciones `/centers/*` | Crear `centers_public`, `services_public`, `staff_public` con whitelist mínima; cerrar lecturas abiertas en colecciones internas. |
| SEC-05 | Homologar estado activo (`active` vs `activo`) | Unificar semántica de “usuario activo” entre rules y functions. | Autorización no determinista. | Seguridad, Técnico | **P1** | Media | `firestore.rules`, `functions/src/index.ts`, datos `staff` | Migración de campo único `active`; compatibilidad temporal; eliminación de legacy en fecha definida. |

## Arquitectura

| ID | Título | Descripción | Problema que resuelve | Impacto | Prioridad | Complejidad | Archivos / módulos afectados | Propuesta de solución concreta |
|---|---|---|---|---|---|---|---|---|
| ARC-01 | Descomponer `App.tsx` por dominios | Separar shell de navegación (public, clinical workspace, superadmin). | Alto acoplamiento y riesgo de regresión transversal. | Técnico, Negocio | **P1** | Alta | `App.tsx`, `components/*`, `hooks/*` | Implementar router por bounded contexts + guards por rol/tenant + feature flags centralizadas. |
| ARC-02 | Dividir `useFirestoreSync` en hooks verticales | Crear hooks dedicados por dominio: patients, appointments, logs, preadmissions, services. | Hook monolítico difícil de mantener y optimizar. | Técnico, Negocio | **P1** | Alta | `hooks/useFirestoreSync.ts`, `hooks/*`, dashboards | Refactor incremental con selectors memoizados y contratos tipados por dominio. |
| ARC-03 | Consolidar reglas duplicadas y ambiguas | Eliminar duplicidad de bloques `match /settings/{settingId}` y normalizar helpers. | Ambigüedad de mantenimiento y potenciales errores de autorización. | Seguridad, Técnico | **P1** | Media | `firestore.rules` | Reescribir sección settings una sola vez + suite de tests de reglas por escenario. |
| ARC-04 | Flujo de baja de centro no destructivo | Reemplazar `deleteCenter` destructivo por decommission formal. | Riesgo legal y operativo por eliminación física. | Negocio, Seguridad, Clínico | **P1** | Media | `functions/src/index.ts`, `firestore.rules`, dashboards admin | Workflow: `isActive=false`, freeze operaciones, retención, export legal y cierre auditado. |

## Frontend / UX

| ID | Título | Descripción | Problema que resuelve | Impacto | Prioridad | Complejidad | Archivos / módulos afectados | Propuesta de solución concreta |
|---|---|---|---|---|---|---|---|---|
| UX-01 | Reorganizar navegación Admin por objetivos | Agrupar tabs en Operación, Equipo, Gobernanza, Growth. | Sobrecarga cognitiva y baja discoverability. | Negocio, Técnico | **P1** | Media | `components/AdminDashboard.tsx` | IA de navegación por objetivo + navegación secundaria contextual. |
| UX-02 | Hardening de PII en agenda/modal | Enmascarar RUT/teléfono por defecto y revelar por acción explícita. | Exposición visual accidental de datos sensibles. | Clínico, Seguridad | **P1** | Baja | `components/DoctorDashboard.tsx`, `components/AgendaView.tsx` | Masking parcial + timeout de visibilidad + evento auditado de reveal. |
| UX-03 | Estandarizar estados vacíos/errores | Patrón único para loading, empty, degraded mode y recovery actions. | Experiencia inconsistente y mayor tasa de error operativo. | Negocio, Técnico | **P2** | Media | `components/*Dashboard*`, `components/AgendaView.tsx`, `components/PatientList.tsx` | UI kit de estados + microcopy clínico operativo + acciones sugeridas. |
| UX-04 | Reemplazar `prompt/confirm` en acciones críticas | Sustituir diálogos nativos por wizard transaccional auditado. | Flujos frágiles en operaciones clínicas y de archivo/exportación. | Clínico, Técnico | **P1** | Media | `hooks/useCrudOperations.ts`, `components/PatientDetail.tsx` | Modal con validación de motivo, confirmación en 2 pasos y registro de auditoría. |

## Firebase / Backend

| ID | Título | Descripción | Problema que resuelve | Impacto | Prioridad | Complejidad | Archivos / módulos afectados | Propuesta de solución concreta |
|---|---|---|---|---|---|---|---|---|
| FBE-01 | Unificar modelo canónico paciente/consulta | Definir una sola fuente de verdad y congelar escrituras legacy. | Divergencia de datos clínicos entre root y center-scoped. | Clínico, Técnico, Negocio | **P0** | Alta | `firestore.rules`, `functions/src/index.ts`, `hooks/useFirestoreSync.ts` | Plan de migración por fases: shadow-write, reconciliación hash, cutover, bloqueo legacy. |
| FBE-02 | Optimizar queries de agenda | Eliminar fetch masivo y filtrado client-side en appointments. | Latencia/costo alto en centros con gran volumen. | Técnico, Negocio | **P1** | Media | `hooks/useFirestoreSync.ts`, `firestore.indexes.json`, `components/AgendaView.tsx` | Queries por rango de fecha + doctor + estado; paginación; índices compuestos adicionales. |
| FBE-03 | Validación de payload con esquema formal | Introducir validación estructural centralizada en functions. | Inputs incompletos o inconsistentes en callables críticos. | Seguridad, Técnico | **P1** | Media | `functions/src/index.ts`, `functions/src/*` | Capa Zod/TypeBox + middleware reusable + errores tipados consistentes. |
| FBE-04 | Endurecer `preadmissions` anónimas | Limitar tamaño/campos y aplicar anti-spam. | Riesgo de abuso y costos de escritura. | Seguridad, Negocio | **P1** | Media | `firestore.rules`, `functions/src/index.ts`, flujo portal paciente | Schema estricto + bucketed rate limits + fingerprint + cuarentena de solicitudes sospechosas. |
| FBE-05 | Auditoría inmutable centralizada | Homogeneizar logs de acceso/evento con hash e integridad verificable. | Trazabilidad parcial no uniforme entre módulos. | Clínico, Seguridad, Negocio | **P1** | Alta | `functions/src/index.ts`, `functions/src/immutableAudit*`, `firestore.rules` | Append-only + hash chain por centro + política de retención y consulta forense. |

## Datos clínicos

| ID | Título | Descripción | Problema que resuelve | Impacto | Prioridad | Complejidad | Archivos / módulos afectados | Propuesta de solución concreta |
|---|---|---|---|---|---|---|---|---|
| DAT-01 | Política técnica de conservación clínica 15+ años | Aplicar retención obligatoria en todo el ciclo de vida clínico. | Riesgo de incumplimiento de conservación de ficha clínica. | Clínico, Negocio, Seguridad | **P0** | Media | `firestore.rules`, `functions/src/index.ts`, jobs programados | Motor de retención por entidad clínica + bloqueos de borrado + evidencia de cumplimiento. |
| DAT-02 | Versionado de registros clínicos | Registrar versiones con autor, timestamp servidor y diff clínico. | Falta de reconstrucción histórica robusta de evolución clínica. | Clínico, Técnico | **P1** | Alta | `functions/src/index.ts`, modelo `consultations`, `patients` | Event sourcing liviano o snapshots versionados por episodio clínico. |
| DAT-03 | Catálogo de datos sensibles (PII/PHI) | Clasificar campos y definir políticas de acceso/mascarado por rol. | Exposición no controlada de datos sensibles. | Seguridad, Clínico | **P1** | Media | `types.ts`, `firestore.rules`, componentes clínicos | Data classification matrix + guardrails UI + controles de exportación. |

## Testing

| ID | Título | Descripción | Problema que resuelve | Impacto | Prioridad | Complejidad | Archivos / módulos afectados | Propuesta de solución concreta |
|---|---|---|---|---|---|---|---|---|
| TST-01 | Test suite de Firestore Rules orientada a abuso | Cubrir escenarios de escalada ACL, fuga por centerId y bypass anónimo. | Riesgos críticos no detectados antes de deploy. | Seguridad, Técnico | **P0** | Media | `tests/`, `firestore.rules` | Casos positivos/negativos por rol + fuzzing de campos sensibles + CI bloqueante. |
| TST-02 | Pruebas E2E de flujos públicos anti-abuso | Validar booking/cancel bajo límites, captcha y bloqueo por intento. | Superficie pública sin garantías operacionales. | Seguridad, Negocio | **P1** | Media | `tests/`, `scripts/audit/`, functions públicas | Escenarios de abuso controlado, throttling y comportamiento esperado. |
| TST-03 | Pruebas de consistencia de migración clínica | Verificar paridad root↔legacy antes del cutover. | Riesgo de pérdida o divergencia de datos clínicos en migración. | Clínico, Técnico | **P0** | Alta | `functions/src/index.ts`, scripts migración, datasets | Checksums por paciente/consulta + reportes de diffs + criterio de salida “0 divergencias críticas”. |

---

## 2) Backlog ordenado por prioridad real (global)

| Orden | ID | Prioridad | Título | Motivo de prioridad |
|---:|---|---|---|---|
| 1 | SEC-01 | P0 | Bloquear escalada ACL en pacientes raíz | Riesgo directo de acceso indebido a ficha clínica. |
| 2 | SEC-02 | P0 | Eliminar hard delete en entidades clínicas | Riesgo legal/clínico por pérdida irreversible de datos. |
| 3 | SEC-03 | P0 | Proteger endpoints públicos de citas | Riesgo de abuso externo inmediato. |
| 4 | FBE-01 | P0 | Unificar modelo canónico paciente/consulta | Evita inconsistencias clínicas estructurales. |
| 5 | DAT-01 | P0 | Política técnica de conservación clínica | Cumplimiento y trazabilidad obligatoria. |
| 6 | TST-01 | P0 | Test suite de rules orientada a abuso | Previene regresiones de seguridad en deploy. |
| 7 | TST-03 | P0 | Pruebas de consistencia de migración | Evita corrupción/diferencias al unificar modelo. |
| 8 | SEC-04 | P0 | Reducir superficie de lectura pública | Minimiza fuga de metadatos multi-tenant. |
| 9 | ARC-03 | P1 | Consolidar reglas duplicadas | Disminuye riesgo de errores de autorización. |
| 10 | FBE-03 | P1 | Validación de payload con esquema formal | Robustece endpoints críticos. |
| 11 | FBE-05 | P1 | Auditoría inmutable centralizada | Fortalece trazabilidad legalmente defendible. |
| 12 | ARC-04 | P1 | Baja de centro no destructiva | Evita borrado destructivo y riesgo regulatorio. |
| 13 | FBE-04 | P1 | Endurecer preadmissions anónimas | Mitiga spam y abuso de escritura. |
| 14 | FBE-02 | P1 | Optimizar queries de agenda | Reduce latencia/costo y mejora estabilidad. |
| 15 | ARC-02 | P1 | Dividir useFirestoreSync | Reduce deuda técnica operativa. |
| 16 | ARC-01 | P1 | Descomponer App.tsx por dominios | Mejora mantenibilidad y reduce regressions. |
| 17 | UX-02 | P1 | Hardening de PII en agenda/modal | Reduce exposición visual de datos sensibles. |
| 18 | UX-04 | P1 | Reemplazar prompt/confirm críticos | Mejora seguridad/UX de operaciones clínicas. |
| 19 | DAT-02 | P1 | Versionado de registros clínicos | Mejora integridad longitudinal de ficha. |
| 20 | DAT-03 | P1 | Catálogo de datos sensibles | Estándar de privacidad por rol y contexto. |
| 21 | SEC-05 | P1 | Homologar active/activo | Evita discrepancias de autorización. |
| 22 | TST-02 | P1 | E2E anti-abuso en flujos públicos | Cierre técnico de seguridad operativa. |
| 23 | UX-01 | P1 | Reorganizar navegación Admin | Impacto directo en eficiencia operativa. |
| 24 | UX-03 | P2 | Estandarizar estados vacíos/errores | Mejora calidad percibida y adopción. |

---

## 3) Quick wins (2 a 10 días)

| ID | Quick Win | Prioridad | Esfuerzo | Resultado esperado |
|---|---|---|---|---|
| QW-01 | Bloquear delete físico en rules de entidades clínicas | P0 | Bajo | Reducción inmediata de riesgo legal/clínico. |
| QW-02 | Cerrar lectura pública en `centers` internos | P0 | Bajo | Menor exposición de metadatos. |
| QW-03 | Masking de RUT/teléfono en modales de agenda | P1 | Bajo | Menor exposición accidental de PII. |
| QW-04 | Consolidar bloque duplicado `settings` en rules | P1 | Bajo | Menos ambigüedad operativa. |
| QW-05 | Añadir rate limit básico en callables públicas | P0 | Bajo/Medio | Contención inicial de abuso externo. |
| QW-06 | Reemplazar `confirm/prompt` críticos por modal validado | P1 | Medio | Mejor trazabilidad y menor error humano. |

---

## 4) Deuda técnica estructural (no cosmética)

| Bloque | Síntoma | Riesgo | Acción estructural |
|---|---|---|---|
| Modelo de datos clínicos dual | Root + center para paciente/consulta | Inconsistencia clínica y ACL divergente | Programa de unificación canónica con cutover controlado |
| Orquestación frontend centralizada | `App.tsx` y hook de sync monolíticos | Regresiones y costo de cambio alto | Arquitectura por dominios + hooks verticales |
| Seguridad distribuida sin contrato único | Reglas + funciones + cliente sin policy contract | Drift de autorización | Security policy-as-code + tests obligatorios |
| Trazabilidad heterogénea | Logs parciales y no siempre inmutables | Debilidad forense y de compliance | Plataforma de auditoría inmutable central |

---

## 5) Roadmap en 3 fases

## Fase 1 — Crítico inmediato (0–2 semanas)
| Objetivo | Ítems |
|---|---|
| Cerrar riesgos de seguridad y cumplimiento inmediatos | SEC-01, SEC-02, SEC-03, SEC-04, DAT-01, TST-01 |
| Reducir exposición pública y abuso | QW-01, QW-02, QW-05 |
| Frenar pérdida de datos clínicos | Bloqueo de hard delete + archivado obligatorio |

## Fase 2 — Estabilización (2–6 semanas)
| Objetivo | Ítems |
|---|---|
| Robustecer backend y gobernanza | FBE-03, FBE-04, FBE-05, ARC-03, ARC-04, SEC-05 |
| Mejorar confiabilidad operativa de agenda | FBE-02, TST-02 |
| Seguridad UX clínica | UX-02, UX-04 |

## Fase 3 — Mejora estructural (6–14 semanas)
| Objetivo | Ítems |
|---|---|
| Resolver deuda estructural y escalabilidad | FBE-01, TST-03, ARC-01, ARC-02 |
| Fortalecer integridad clínica longitudinal | DAT-02, DAT-03 |
| Optimizar experiencia y eficiencia de operación | UX-01, UX-03 |

---

## 6) Formato sugerido para crear GitHub Issues

```md
### Contexto
[ID] <Título>

### Descripción
<Descripción breve>

### Problema que resuelve
<riesgo operativo/seguridad/clínico>

### Impacto
- Clínico:
- Seguridad:
- Negocio:
- Técnico:

### Prioridad
P0 / P1 / P2

### Complejidad
Baja / Media / Alta

### Alcance técnico
- Archivos/módulos afectados:

### Propuesta de solución
<plan concreto>

### Criterios de aceptación
- [ ] ...
- [ ] ...

### Riesgos / dependencias
<dependencias>
```
