# Prompts de ejecución — Cumplimiento paso a paso del plan de acción

Fecha: 2026-02-21

Este documento contiene prompts listos para usar con Codex (o agente equivalente) para ejecutar el plan técnico en secuencia, desde lo crítico a lo estético.

---

## Modo de trabajo recomendado

- Ejecutar **1 fase por PR** (evitar PRs grandes).
- Exigir salida con:
  - resumen de cambios,
  - comandos ejecutados,
  - riesgos abiertos,
  - estado final `READY/NOT READY` de la fase.
- Si hay bloqueo de entorno (ej. npm 403), usar fallback local y documentarlo.

---

## Prompt 0 — Baseline (bloqueante)

```text
Codex, ejecuta la fase 0 (Baseline) del plan para feature/superadmin-metrics-and-templates.

Objetivo:
1) Capturar estado real de calidad.
2) Identificar bloqueantes antes de tocar lógica.

Tareas:
- Ejecuta: npm run build
- Ejecuta: npm run lint
- Documenta en docs/audits:
  - fecha/hora,
  - comandos,
  - resultado,
  - bloqueantes,
  - workaround sugerido.

Restricciones:
- No tocar lógica de negocio.
- Solo documentación de baseline.

Entrega:
- Commit docs atómico.
- PR: "docs: baseline técnico de calidad para rama superadmin".
```

---

## Prompt 1 — Lote A (solo formato)

```text
Codex, ejecuta Lote A: solo formato (prettier) sin cambios funcionales.

Archivos:
- App.tsx
- components/SuperAdminDashboard.tsx
- components/AdminDashboard.tsx
- components/DoctorDashboard.tsx
- hooks/useFirestoreSync.ts
- types.ts

Tareas:
- Ejecuta prettier únicamente en esos archivos.
- Verifica diff: solo estilo/espaciado/saltos de línea.
- Ejecuta npm run build.

Entrega:
- Commit único style/chore.
- Tabla por archivo: líneas tocadas + "solo formato".
```

---

## Prompt 2 — Lote B (lint bajo riesgo)

```text
Codex, ejecuta Lote B de lint bajo riesgo sin alterar comportamiento.

Objetivo:
- Bajar warnings rápidos y seguros.

Tareas:
- Eliminar imports no usados.
- Eliminar variables no usadas seguras.
- Reemplazar casts redundantes as any donde exista tipo claro local.
- Ejecutar eslint en archivos modificados.
- Ejecutar npm run build.

Restricciones:
- No modificar reglas de negocio ni queries Firestore.

Entrega:
- PR con checklist:
  - warnings cerrados,
  - warnings remanentes,
  - riesgos.
```

---

## Prompt 3 — useFirestoreSync (Parte 1: dependencias)

```text
Codex, implementa Parte 1 en hooks/useFirestoreSync.ts para estabilizar dependencias.

Objetivo:
- Evitar closures stale y re-suscripciones innecesarias.

Tareas:
- Asegura referencias estables para helpers usados por useEffect (useCallback o funciones puras extraídas).
- Completa dependency arrays sin suppressions.
- Mantén equivalencia funcional.

Validación:
- npx eslint hooks/useFirestoreSync.ts --ext .ts
- npm run build

Entrega:
- PR solo del hook.
- Sección "Riesgo funcional y mitigación".
```

---

## Prompt 4 — useFirestoreSync (Parte 2: separar efecto monolítico)

```text
Codex, implementa Parte 2 en hooks/useFirestoreSync.ts: separar el efecto por dominios.

Objetivo:
- Aislar suscripciones para facilitar mantenimiento y depuración.

Tareas:
- Crear efectos separados para:
  1) centers,
  2) patients,
  3) staff/appointments/auditLogs/preadmissions.
- Mantener filtros actuales (roles, portfolioMode, activeCenterId).
- Cleanup correcto por cada effect.

Validación:
- eslint del archivo
- build
- nota de equivalencia funcional antes/después

Entrega:
- PR único de refactor.
```

---

## Prompt 5 — Unificar métricas (decisión escalable)

```text
Codex, unifica métricas en frontend usando centers/{id}.stats como fuente de verdad única.

Objetivo:
- Eliminar mezcla de collectionGroup + stats.

Tareas:
- En SuperAdminDashboard, usar solo agregación de centers[].stats.
- Eliminar mockAttentions en producción.
- Si faltan datos: mostrar "Sin datos" explícito.
- Etiquetar ventana temporal (all_time / 30d).

Validación:
- build
- lint de archivos tocados
- evidencia de que no quedan métricas duales

Entrega:
- PR con sección "Impacto de escalabilidad".
```

---

## Prompt 6 — types.ts (fase 1 de tipado estricto)

```text
Codex, ejecuta fase 1 de endurecimiento de tipos en types.ts con riesgo controlado.

Objetivo:
- Reducir any en contratos de dominio prioritarios.

Tareas:
- Crear aliases reutilizables (FirestoreDateLike, JsonValue, JsonMap o equivalente).
- Migrar primero:
  - MedicalCenter.stats.updatedAt
  - AuditLogEntry.metadata
  - AuditLogEvent.metadata
  - Prescription.metadata
  - CenterInvite.createdAt/claimedAt
- Donde aplique, usar unknown + type guards.

Validación:
- build
- eslint types.ts y consumidores directos

Entrega:
- PR con tabla "any antiguo -> tipo nuevo".
```

---

## Prompt 7 — Propagar tipos a consumidores

```text
Codex, propaga el tipado estricto a consumidores directos.

Archivos objetivo:
- App.tsx
- components/SuperAdminDashboard.tsx
- components/AdminDashboard.tsx
- components/DoctorDashboard.tsx
- hooks/useFirestoreSync.ts
- functions/src/types.ts (si aplica)

Tareas:
- Reducir as any en bordes de lectura.
- Crear mappers tipados al consumir Firestore.
- Corregir tipos sin cambiar comportamiento de negocio.

Validación:
- build
- lint de archivos tocados

Entrega:
- PR con métrica de reducción de as any por archivo.
```

---

## Prompt 8 — Ciclos de importación en CI

```text
Codex, agrega chequeo de importaciones circulares en CI con fallback offline.

Objetivo:
- Detectar ciclos TS/TSX de forma reproducible.

Tareas:
- Implementar script local de detección (si no se puede instalar dependencia externa).
- Agregar script npm (ej: lint:cycles).
- Integrar job CI que falle con ciclos.

Validación:
- ejecutar script local
- documentar salida

Entrega:
- PR tooling + documentación.
```

---

## Prompt 9 — Cierre de readiness para main

```text
Codex, ejecuta fase final de readiness para merge a main.

Checklist obligatorio:
- build OK
- lint OK (o excepciones mínimas explícitas y aprobadas)
- useFirestoreSync sin warnings de dependencias
- métricas sin mocks en producción
- contratos críticos sin any en superficies principales

Tareas:
- ejecutar checks finales
- actualizar auditoría con pass/fail por criterio
- emitir veredicto final Ready/Not Ready + riesgos residuales

Entrega:
- PR de cierre con resumen ejecutivo.
```

---

## Prompt maestro (orquestador)

```text
Codex, ejecuta el plan técnico completo por fases (0 a 9) en PRs pequeños.

Reglas:
- Solo la siguiente fase pendiente (nunca más de una por PR).
- Antes de codificar: resumen de alcance y riesgos.
- Después: comandos exactos, resultados y riesgos abiertos.
- Si hay bloqueo de red/registry: fallback local documentado.
- Commits atómicos con nombre de fase.

Comienza ahora con la fase 0 (Baseline).
```

---

## Orden sugerido para empezar hoy

1. Ejecutar Prompt 0.
2. Si baseline confirma bloqueos de build/lint, correr Prompt 1.
3. Luego Prompt 2.
4. Continuar con Prompt 3 y 4 (`useFirestoreSync`).

