# Auditoría profunda backend Firebase — ClaveSalud (sistema clínico)

Fecha de corte: 2026-03-29.

> Alcance: Firestore (modelo + queries), Cloud Functions, Firestore Rules, multi-tenant por `centerId`, trazabilidad y cumplimiento (Ley 20.584, DS 41, Ley 19.628).

## 1) Mapa backend actual (Firestore + Functions)

## 1.1 Estructura de colecciones (observada)
- **Raíz multiuso:** `/centers`, `/patients`, `/users`, `/invites`, `/auditLogs`.
- **Por tenant:** `/centers/{centerId}/staff`, `publicStaff`, `patients`, `appointments`, `consultations`, `preadmissions`, `auditLogs`, `messageLogs`, `settings/*`, `services`, `stats/*`.
- **Modelo híbrido clínico:** coexistencia de paciente/consulta en:
  - ruta por centro (`centers/{centerId}/patients/{patientId}` y subcolecciones), y
  - ruta global (`patients/{patientId}` y `patients/{patientId}/consultations/{consultationId}`).

## 1.2 Patrón de sincronización frontend observado
- `useFirestoreSync` centraliza listeners de pacientes, staff, agenda, auditoría, preadmisiones y servicios.
- Agenda usa `onSnapshot` con `limit(1000)` y filtrado client-side posterior.

---

## 2) Riesgos críticos (estrictos)

## CRÍTICO-01 — Escalada de privilegios en `/patients` (modelo raíz)
**Evidencia técnica**
- Regla de update en `/patients/{patientId}` permite actualizar al owner o profesional en `allowedUids`, **sin restricción de campos**.
- Un profesional autorizado puede modificar `accessControl.allowedUids`, `ownerUid`, `centerIds`, u otros campos sensibles.

**Impacto:** **ALTO**
- Riesgo real de expansión indebida de acceso a ficha clínica (confidencialidad, integridad, trazabilidad).
- Compromete aislamiento clínico y principio de mínimo privilegio.

**Solución técnica clara**
1. En reglas raíz `/patients`, separar permisos por tipo de campo:
   - clínicos editables (anamnesis, diagnóstico, plan, etc.),
   - seguridad (`ownerUid`, `accessControl.*`, `careTeamUids`) solo por función backend firmada.
2. Mover cambios de ACL a Cloud Function transaccional (`updatePatientAccessControl`) con:
   - validación rol/tenant,
   - justificación obligatoria,
   - audit log inmutable.

---

## CRÍTICO-02 — Hard delete permitido en colección clínica raíz
**Evidencia técnica**
- En `/patients/{patientId}` raíz, `allow delete` para owner/superadmin.
- En `/patients/{patientId}/consultations/{consultationId}` raíz, `allow delete` para owner/superadmin.

**Impacto:** **ALTO**
- Contradice expectativas de conservación y trazabilidad en ficha clínica (Ley 20.584 + DS 41).
- Riesgo de pérdida irreversible de evidencia clínica/legal.

**Solución técnica clara**
1. Prohibir delete físico en reglas (`allow delete: if false`) para entidades clínicas.
2. Implementar soft delete obligatorio:
   - `active=false`, `deletedAt`, `deletedBy`, `deleteReason`, `retentionUntil`.
3. Forzar archivado vía Function con validación de retención y logging forense.

---

## CRÍTICO-03 — Endpoints públicos callable sin autenticación ni anti-abuso
**Evidencia técnica**
- `listPatientAppointments` y `cancelPatientAppointment` no exigen `requireAuth`.
- Validan por `centerId + RUT + phone` (y `appointmentId` en cancelación), pero sin rate limit, sin captcha, sin WAF token.

**Impacto:** **ALTO**
- Riesgo de enumeración y abuso por fuerza bruta sobre datos de citas.
- Riesgo operacional (cancelaciones maliciosas o scraping de disponibilidad ocupada).

**Solución técnica clara**
1. Mantener flujo público solo vía endpoint HTTP dedicado + App Check + reCAPTCHA Enterprise + throttling por IP/huella.
2. En callable pública: nonce de un solo uso + expiración + firma HMAC desde backend.
3. Registrar intentos fallidos y bloquear por comportamiento anómalo.

---

## CRÍTICO-04 — Superficie de fuga por lecturas públicas en reglas
**Evidencia técnica**
- `/centers/{centerId}` lectura permitida si `isActive == true` (sin auth).
- `/centers/{centerId}/services/{serviceId}` `allow read: if true`.
- `/centers/{centerId}/publicStaff/{staffUid}` `allow read: if true`.

**Impacto:** **ALTO**
- Exposición de metadatos de centros, staff y servicios más allá de necesidad mínima.
- Riesgo de correlación de información para ingeniería social/fraude.

**Solución técnica clara**
1. Crear colecciones explícitas “public catalog” con campos minimizados (whitelist estricto).
2. Quitar lectura abierta en `centers` y `services` internos.
3. Versionar contratos públicos y validar esquema con CI de reglas.

---

## CRÍTICO-05 — Modelo clínico duplicado (root + center) con migraciones activas
**Evidencia técnica**
- Functions de migración/backfill entre `centers/*/patients` y `/patients`.
- Reglas activas para ambos modelos.

**Impacto:** **ALTO**
- Riesgo de inconsistencia clínica: mismo paciente con ACL y consultas divergentes.
- Riesgo de decisiones clínicas sobre datos no canónicos.

**Solución técnica clara**
1. Definir **fuente única canónica** (recomendado: `/patients` + índices por tenant).
2. Congelar escrituras en modelo legacy (solo lectura temporal).
3. Ejecutar reconciliación con hash clínico + reporte de divergencias + corte controlado.

---

## 3) Riesgos altos/medios adicionales

## ALTO-01 — `preadmissions` acepta creación anónima sin validación estructural fuerte
- Riesgo de spam/inyección de payloads excesivos y costos de escritura.
- Mitigar con schema validation (campos/tamaños), rate limit y origen verificado.

## ALTO-02 — Inconsistencia de estado activo (`active` vs `activo`)
- Reglas dependen de `active==true`; functions usan `active || activo`.
- Riesgo de discrepancias de autorización entre cliente y backend.
- Mitigar normalizando un único campo y migración de compatibilidad con fecha de retiro.

## ALTO-03 — Eliminación física de centro en `deleteCenter`
- Se elimina documento del centro sin flujo formal de baja clínica/retención.
- Mitigar con “decommission workflow”: `isActive=false`, bloqueo de nuevas altas, congelamiento, retención y cierre auditado.

## MEDIO-01 — Duplicidad de bloques `match /settings/{settingId}` en reglas
- Puede inducir ambigüedad operacional y errores de mantenimiento.
- Mitigar consolidando reglas y agregando tests de políticas.

## MEDIO-02 — Queries ineficientes de agenda y snapshots de alto volumen
- `limit(1000)` + filtrado/sorting client-side en agenda.
- Mitigar con índices por `centerId/date/status/doctorUid` y ventanas paginadas por rango temporal.

## MEDIO-03 — Trazabilidad no uniformemente inmutable
- Hay logs de acceso/evento, pero no todos los caminos críticos fuerzan razón clínica obligatoria ni hash de integridad.
- Mitigar con pipeline de auditoría inmutable (append-only + firma/hash + retención).

---

## 4) Cloud Functions — robustez, validaciones y errores

## Fortalezas
- Uso de `requireAuth` y checks de rol en múltiples callables sensibles.
- Uso de transacciones en operaciones críticas (aceptar invitación, deduplicación de logAccess, vínculo paciente-profesional).
- Captura de errores en varios paths con `HttpsError` tipado.

## Brechas críticas
1. **Callables públicas sin protección anti-automatización** (ver CRÍTICO-03).
2. **Validación de esquema incompleta** en varios payloads (se valida presencia, no profundidad/tamaño/formato clínico).
3. **Borrado destructivo** en `deleteCenter` sin salvaguardas de retención clínica.
4. **Funciones de migración potentes** expuestas a operación manual; falta de “change window guardrail” y dry-run obligatorio por política.

## Recomendación técnica inmediata
- Introducir capa común de validación (p.ej. Zod/TypeBox) + política por endpoint:
  - auth mode,
  - rate limit,
  - data classification,
  - audit policy.

---

## 5) Firestore Rules — rol, aislamiento por centerId y fuga de datos

## Hallazgos de control de acceso
- Existe modelo RBAC por staff del centro (`isCenterAdmin`, `isAdministrative`, `isDoctor`).
- Hay separación parcial por `centerId` en subcolecciones por tenant.
- Sin embargo, en modelo raíz `/patients` no se fuerza separación por tenant en updates sensibles.

## Accesos indebidos posibles (reales)
1. Profesional con acceso a un paciente raíz puede modificar ACL del propio paciente (escalada lateral).
2. Actor externo puede intentar enumeración de citas usando callable pública y combinaciones de RUT/teléfono.
3. Lectura abierta de datos “públicos” con potencial correlación (centro/servicios/staff) más allá de minimización.

## Reglas recomendadas (hardening)
1. En `/patients` raíz:
   - prohibir cambios directos a `ownerUid`, `accessControl`, `careTeamUids` desde cliente.
   - permitir solo campos clínicos no estructurales por rol clínico.
2. En `/centers`:
   - remover lectura pública del documento completo; exponer solo `centers_public`.
3. En `/services`:
   - separar catálogo público de configuración interna (precios internos, estados, metadatos).
4. Añadir pruebas automáticas de reglas por escenarios de abuso (fuzzing de ACL).

---

## 6) Cumplimiento normativo (enfoque técnico, no asesoría legal)

## Ley 20.584 / DS 41 (ficha clínica)
**Riesgos:**
- Hard delete en entidades clínicas raíz.
- Modelo duplicado sin canonicidad explícita (riesgo de historia clínica inconsistente).
- Trazabilidad parcial/no homogénea en todos los caminos de modificación.

**Controles técnicos exigibles recomendados:**
1. Política de conservación efectiva por diseño (no delete físico de ficha/consulta).
2. Auditoría completa de accesos y modificaciones, inmutable y verificable.
3. Control de integridad clínica (versionado de documento clínico + autor + timestamp servidor).

## Ley 19.628 (datos personales)
**Riesgos:**
- Superficie de datos públicos mayor a la necesaria (minimización insuficiente).
- Endpoints públicos susceptibles a enumeración.

**Controles técnicos exigibles recomendados:**
1. Minimización estricta en datos públicos.
2. Protección anti-abuso (captcha, rate limit, App Check, listas de bloqueo).
3. Clasificación de datos y controles por sensibilidad (PII/PHI).

---

## 7) Lista final de riesgos (severidad + impacto + solución)

| ID | Riesgo | Impacto | Severidad | Solución técnica clara |
|---|---|---|---|---|
| R1 | Escalada ACL en `/patients` raíz | Exposición/alteración de ficha clínica | **Crítico** | Bloquear campos ACL en rules + Function dedicada para ACL |
| R2 | Hard delete clínico en raíz | Pérdida de trazabilidad/historia clínica | **Crítico** | `allow delete: false` + soft delete obligatorio |
| R3 | Callables públicas sin anti-abuso | Enumeración/abuso de citas | **Crítico** | HTTP protegido + App Check + CAPTCHA + throttling |
| R4 | Lecturas públicas amplias (`centers/services/publicStaff`) | Fuga de metadatos | **Crítico** | Colecciones públicas minimizadas y separadas |
| R5 | Modelo clínico duplicado | Inconsistencia clínica | **Crítico** | Modelo canónico único + plan de corte legacy |
| R6 | `preadmissions` anónimo sin validación robusta | Spam/costos/inyección | Alto | Schema + límites + reputación de origen |
| R7 | `active` vs `activo` inconsistente | Autorización no determinista | Alto | Normalización de campo de estado |
| R8 | `deleteCenter` destructivo | Riesgo legal/operacional | Alto | Flujo de baja lógica y retención |
| R9 | Query agenda `limit(1000)` + filtro local | Latencia/costo | Medio | Índices y ventanas por rango |
| R10 | Duplicidad de reglas `settings` | Riesgo de mantenimiento | Medio | Consolidar reglas + tests |

---

## 8) Plan de remediación recomendado (estricto)

## Fase 0 (48–72h)
1. Bloquear deletes físicos en raíz clínica.
2. Restringir updates ACL en `/patients`.
3. Poner rate limits inmediatos a funciones públicas de citas.

## Fase 1 (1–2 semanas)
1. Separar datos públicos vs internos en colecciones dedicadas.
2. Endurecer validación de payloads en todas las Functions críticas.
3. Incorporar test suite de reglas orientada a abuso multi-tenant.

## Fase 2 (2–6 semanas)
1. Ejecutar unificación de modelo clínico (canónico + adapters legacy temporales).
2. Implementar auditoría inmutable con trazabilidad de motivo clínico obligatorio.
3. Introducir observabilidad de seguridad (detección de patrón de enumeración).

## Fase 3 (6+ semanas)
1. Gobernanza de datos clínicos: catálogos de sensibilidad, retención automatizada y reportes de cumplimiento.

---

## 9) Conclusión ejecutiva
- El backend tiene bases sólidas de RBAC y auditoría parcial, pero en su estado actual presenta **riesgos críticos reales** para un sistema clínico: escalada en ACL de pacientes, hard delete de datos clínicos, endpoints públicos sin anti-abuso y duplicación de modelo clínico.
- La remediación debe ser inmediata y estricta, priorizando integridad de ficha clínica, aislamiento multi-tenant y trazabilidad legalmente defendible.
