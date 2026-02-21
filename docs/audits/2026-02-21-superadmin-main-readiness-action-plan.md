# Plan de Acción Técnico — Main Readiness

Fecha: 2026-02-21  
Base: auditoría de control previa de rama `feature/superadmin-metrics-and-templates`.

## Objetivo

Dejar la rama lista para merge a `main` con foco en:

1. Calidad estática (lint/format) sin romper lógica.
2. Estabilidad de hooks (`useFirestoreSync.ts`, dependencias y closures).
3. Unificación de fuentes de métricas con criterio escalable para Clave Salud.
4. Endurecimiento de tipado (reducción de `any`) empezando por dominio (`types.ts`) y propagación controlada.

---

## Prioridad 0 (Crítico bloqueante de merge): congelar comportamiento y reducir riesgo de regresión

### Paso 0.1 — Baseline y smoke tests por flujo crítico

**Acciones**
- Ejecutar y guardar baseline de build/lint actual.
- Ejecutar smoke manuales de flujos críticos:
  - login + navegación `superadmin-dashboard`;
  - pestaña métricas;
  - navegación `admin-dashboard` y `doctor-dashboard`;
  - listado de pacientes y agenda.

**Comandos sugeridos**
- `npm run build`
- `npm run lint`

**Criterio de salida**
- Baseline documentado para comparar antes/después de cada lote de refactor.

---

## Prioridad 1 (Crítico): limpiar formato/lint sin alterar lógica

### Estrategia recomendada (por lotes, no “big-bang”)

1. **Formato primero, reglas después**: resolver `prettier` en un lote aislado.
2. **Lint por dominio funcional**: App + hooks + dashboards en lotes separados.
3. **Cero cambios de comportamiento en cada lote**: únicamente formato/tipos/imports/deps de hooks.
4. **Validar build tras cada lote**.

### Paso 1.1 — Lote A: solo Prettier

**Acciones**
- Ejecutar `prettier --write` en archivos de UI/core más calientes.
- Commit dedicado solo a formato.

**Archivos foco inicial**
- `App.tsx`
- `components/SuperAdminDashboard.tsx`
- `components/AdminDashboard.tsx`
- `components/DoctorDashboard.tsx`
- `hooks/useFirestoreSync.ts`
- `types.ts`

### Paso 1.2 — Lote B: warnings/errors de lint de bajo riesgo

**Acciones**
- Eliminar imports no usados.
- Reemplazar casts redundantes (`as any`) donde ya existe tipo suficiente.
- Homogeneizar helpers tipados reutilizables en vez de casts in-line.

### Paso 1.3 — Lote C: lint de complejidad media

**Acciones**
- Resolver `no-explicit-any` empezando por entradas/salidas de funciones públicas.
- Resolver `react-hooks/exhaustive-deps` en `useFirestoreSync` (ver Prioridad 2).

**Gate para pasar de Prioridad 1**
- `npm run lint` en verde o, si se decide rollout incremental, al menos verde en:
  - `App.tsx`
  - `hooks/useFirestoreSync.ts`
  - `components/SuperAdminDashboard.tsx`
  - `types.ts`

---

## Prioridad 2 (Crítico funcional): resolver dependencias de hooks en `useFirestoreSync.ts`

## Problema observado
- Dependencias incompletas y funciones internas recreadas en cada render pueden generar:
  - suscripciones stale;
  - re-suscripciones innecesarias;
  - comportamiento no determinístico por closure antigua.

### Paso 2.1 — Estabilizar helpers fuera del `useEffect`

**Acciones**
- Extraer y exportar funciones puras (o `useCallback`) para:
  - `normalizeClinicalRole`
  - `mapStaffToDoctor`
  - predicados de rol (`isAdminRole`, `isAdminOrStaff`)

**Resultado esperado**
- Referencias estables y dependencias explícitas.

### Paso 2.2 — Partir el efecto monolítico en efectos por dominio

**Acciones**
- Efecto 1: carga de `centers` (solo superadmin).
- Efecto 2: `patients` (dependiente de `activeCenterId`, `portfolioMode`, `authUser`, `currentUser`).
- Efecto 3: `staff/appointments/auditLogs/preadmissions`.

**Resultado esperado**
- Menor superficie de dependencias cruzadas y cleanup más predecible.

### Paso 2.3 — Dependencias explícitas y limpias

**Checklist dependencias mínimas**
- `activeCenterId`
- `authUser?.uid`
- `demoMode`
- `isSuperAdminClaim`
- `portfolioMode`
- `currentUser` (o versión derivada memoizada)
- `setCenters` (si aplica)

### Paso 2.4 — Normalizar role checks en una sola fuente

**Acciones**
- Crear helper canónico de autorización (p.ej. `utils/roles.ts`) y reutilizarlo.
- Evitar repetición de `currentUser?.roles?.includes(...)` distribuida en hooks/componentes.

**Gate para cerrar Prioridad 2**
- Sin warning de `react-hooks/exhaustive-deps` en `hooks/useFirestoreSync.ts`.
- Build y smoke tests de lectura/escritura operativos.

---

## Prioridad 3 (Alta): unificar fuentes de métricas (decisión de arquitectura)

## Decisión recomendada para Clave Salud (más escalable)

**Fuente de verdad primaria: `centers/{id}.stats` (agregados materializados server-side).**

### Justificación
- `collectionGroup + getCountFromServer` escala peor con crecimiento multi-centro y puede encarecer lecturas.
- Agregados materializados por centro permiten:
  - consulta O(n_centros),
  - mejor latencia para dashboard superadmin,
  - control de consistencia temporal (ventanas definidas: diario/30d).

### Paso 3.1 — Definir contrato único de métricas

**Propuesta de contrato mínimo en `MedicalCenter.stats`**
- `staffCount`
- `patientCount`
- `appointmentCount`
- `consultationCount`
- `window`: `"all_time" | "30d"`
- `updatedAt`: timestamp servidor

### Paso 3.2 — Backend primero, UI después

**Acciones**
- Actualizar función backend que consolida stats por centro.
- Persistir `updatedAt` y ventana de cálculo.

### Paso 3.3 — UI sin mezcla de fuentes

**Acciones**
- En `SuperAdminDashboard`, eliminar conteo paralelo vía `collectionGroup` para tarjetas globales.
- Calcular totales globales sumando `centers[].stats`.
- Reemplazar `mockAttentions` por valor real de `consultationCount` en ventana acordada.
- Si no hay dato, mostrar estado “Sin datos” (no mock silencioso).

**Gate para cerrar Prioridad 3**
- Una sola fuente de verdad de métricas en frontend.
- Pestaña métricas sin placeholders mock de actividad.

---

## Prioridad 4 (Media-Alta): migración de `any` a tipos estrictos (centrado en `types.ts`)

## Campos `any` en `types.ts` a tipar primero

1. `MedicalCenter.stats.updatedAt?: any`
2. `AuditLogEntry.metadata?: Record<string, any>`
3. `AuditLogEvent.metadata?: Record<string, any>`
4. `Prescription.metadata?: { selectedExams?: string[]; [key: string]: any }`
5. `CenterInvite.createdAt?: any`
6. `CenterInvite.claimedAt?: any`
7. `CenterRuntimeOverrides.activeCenter?: any`
8. `CenterRuntimeOverrides.activeDoctor?: any`
9. `CenterRuntimeOverrides.currentUser?: any`
10. `GeminiConfig.modelConfig?: any`
11. `GeminiConfig.safetySettings?: any`

### Archivos exactos que deben alinearse al endurecer `types.ts`

**Core/UI**
- `App.tsx`
- `components/SuperAdminDashboard.tsx`
- `components/AdminDashboard.tsx`
- `components/DoctorDashboard.tsx`

**Hooks**
- `hooks/useFirestoreSync.ts`

**Backend types (consistencia transversal)**
- `functions/src/types.ts`

### Paso 4.1 — Introducir tipos de compatibilidad con Firestore

**Acciones**
- Definir alias reusable, por ejemplo:
  - `type FirestoreDateLike = Timestamp | string | null;`
  - `type JsonMap = Record<string, string | number | boolean | null | JsonMap | JsonValue[]>;`

### Paso 4.2 — Cambiar tipos en `types.ts` con migración segura

**Acciones**
- Sustituir `any` por tipos unión/estructurados.
- Donde haya incertidumbre real, usar `unknown` + type guards (no `any`).

### Paso 4.3 — Propagar cambios por bordes de IO

**Acciones**
- Normalizar lectura Firestore al ingresar a app (mapper typed).
- Evitar casts `as any` en componentes de presentación.

**Gate para cerrar Prioridad 4**
- `types.ts` sin `any` en contratos de dominio principales.
- Reducción medible de `as any` en archivos críticos.

---

## Prioridad 5 (Media): importaciones circulares y robustez de tooling

### Paso 5.1 — Incorporar chequeo de ciclos en CI sin depender de red

**Acciones**
- Agregar herramienta de detección de ciclos en `devDependencies` (si política lo permite) o script local vendorizado.
- Añadir job de CI que falle si detecta ciclos.

### Paso 5.2 — Regla preventiva

**Acciones**
- Definir política de arquitectura simple:
  - `components` no importan desde `App.tsx`;
  - `types.ts` no depende de UI;
  - `hooks` dependen de `types/utils`, no de componentes.

---

## Prioridad 6 (Estético / UX de mantenimiento)

1. Etiquetar claramente en UI cuándo una métrica está desactualizada (`updatedAt`).
2. Ajustar textos/labels para distinguir “total histórico” vs “últimos 30 días”.
3. Documentar contrato de métricas en `docs/` para onboarding.

---

## Orden de ejecución recomendado (de crítico a estético)

1. Prioridad 0 → baseline/smoke.
2. Prioridad 1 → formato + lint por lotes.
3. Prioridad 2 → hooks/deps en `useFirestoreSync.ts`.
4. Prioridad 3 → unificación de métricas a `center.stats`.
5. Prioridad 4 → endurecimiento de tipos desde `types.ts` y propagación.
6. Prioridad 5 → ciclos/import graph en CI.
7. Prioridad 6 → mejoras estéticas/documentales.

## Definición de Done para “lista para main”

- Build OK.
- Lint OK (o excepción temporal explícita y acotada aprobada por equipo).
- `useFirestoreSync.ts` sin warnings de dependencias.
- Dashboard de métricas sin datos mock en producción.
- Contratos críticos de `types.ts` sin `any` en superficies principales.
- Checklist de smoke funcional aprobado por QA interna.
