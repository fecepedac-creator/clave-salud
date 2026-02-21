# Auditoría de control — Rama feature/superadmin-metrics-and-templates

Fecha: 2026-02-21

## Alcance

Se auditó específicamente:

1. Integridad de lógica en dashboards tras resoluciones de conflicto.
2. Coherencia de `types.ts` con los nuevos componentes de métricas.
3. Riesgos de linting e importaciones circulares post-rebase.
4. Criterio de readiness para merge a `main`.

## Hallazgos

### 1) Dashboards: no se observan pérdidas obvias de lógica crítica por conflicto

- `SuperAdminDashboard` mantiene carga de métricas globales vía `collectionGroup` para pacientes/profesionales y rendering en tarjetas superiores.
- La pestaña `metrics` conserva el agregado por `center.stats` (`consultationCount`, `staffCount`, `appointmentCount`) para tablero de uso.
- `App.tsx` mantiene routing y preview-mode para `superadmin-dashboard`, `admin-dashboard` y `doctor-dashboard`.

**Observación funcional:** el ranking de actividad usa `mockAttentions` derivado de un `seed` en cliente para la columna de “Atenciones (30d)” y salud operativa. Es útil como placeholder, pero no representa datos reales de producción.

### 2) Coherencia de `types.ts` con métricas

- `MedicalCenter.stats` define `staffCount`, `patientCount`, `appointmentCount`, `consultationCount`, alineado con los accesos usados en dashboard de métricas.
- No se detectaron errores de tipado que bloqueen compilación (`vite build` exitoso).

**Riesgo de diseño:** conviven dos fuentes de métricas en `SuperAdminDashboard`:

- estado local `metrics` (patients/professionals desde `collectionGroup`), y
- agregados por centro desde `center.stats`.

Esto puede introducir discrepancias temporales o semánticas si no se documenta la fuente de verdad.

### 3) Linting y salud estática

- `npm run lint` falla con volumen alto de incidencias (prettier + warnings TS/React hooks).
- En revisión focalizada de archivos críticos (`App.tsx`, dashboards, `types.ts`, `useFirestoreSync`) persisten errores/warnings, incluyendo:
  - formato (prettier/prettier),
  - `no-explicit-any`, `no-unused-vars`,
  - `react-hooks/exhaustive-deps` en `hooks/useFirestoreSync.ts`.

**Conclusión:** la rama no está en estado “lint-clean”.

### 4) Importaciones circulares

- No fue posible usar `madge` por restricción de acceso al registry (`403` al descargar paquete).
- Se ejecutó detección alternativa de ciclos en imports relativos TS/TSX (script DFS local): **sin ciclos detectados**.

## Veredicto de merge

## ❌ No recomendada para merge inmediato a `main`

### Riesgos técnicos abiertos

1. **Gate de calidad incumplido:** lint global falla de forma masiva.
2. **Riesgo funcional menor/medio:** métrica de actividad en pestaña de uso mezcla datos reales y mock (`mockAttentions`), potencialmente confuso para operación.
3. **Riesgo de mantenibilidad:** alto nivel de `any` y warnings hook-deps incrementa probabilidad de regresiones silenciosas.

## Recomendaciones previas a merge

1. Ejecutar una pasada de normalización de formato (`prettier`) y luego limpieza de lint por lotes.
2. Definir explícitamente fuente de verdad para métricas (global `collectionGroup` vs agregados `center.stats`) y etiquetar UI si existe dato simulado.
3. Corregir warnings de `react-hooks/exhaustive-deps` en hooks críticos.
4. Incorporar chequeo de ciclos en CI con herramienta vendorizada o ya instalada (evitar dependencia de red en pipeline restringido).
