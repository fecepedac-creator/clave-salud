# Auditoría automática — SuperAdmin Dashboard

- **Área:** `superadmin`
- **Fecha ejecución:** `2026-03-22`
- **Generado por:** `scripts/audit/run-audit.cjs`
- **Estado general:** **RIESGO MEDIO**

## Resumen de resultados

- ✅ Pass: **0**
- ❌ Fail: **0**
- ⚠️ Warning: **2**

## Alcance recomendado del área

Gobernanza global, preview multi-centro, métricas globales y operaciones de centros.

### Puntos de foco
- Acceso y claims de superadmin
- Preview cross-center y salida de preview
- Operaciones globales de centros y comunicaciones
- Aislamiento multi-tenant

### Evidencia de código a revisar
- `components/SuperAdminDashboard.tsx`
- `App.tsx`
- `hooks/useAuth.ts`
- `hooks/useCenters.ts`
- `tests/admin/superadmin-audit.spec.ts`

## Ejecuciones automáticas

| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ⚠️ WARNING | `npm run build` | 2026-03-22T11:39:40.971Z | 2026-03-22T11:39:40.971Z |
| ⚠️ WARNING | `npx playwright test tests/admin/superadmin-audit.spec.ts --reporter=line` | 2026-03-22T11:39:40.971Z | 2026-03-22T11:39:40.971Z |

## Evidencia de salida

### ⚠️ npm run build

```text
Ejecución omitida por --dry-run.
```

### ⚠️ npx playwright test tests/admin/superadmin-audit.spec.ts --reporter=line

```text
Ejecución omitida por --dry-run.
```

## Hallazgos manuales posteriores

> Esta sección puede ser completada automáticamente en futuras iteraciones con reglas estáticas/dinámicas.

- [ ] H-001
- [ ] H-002
- [ ] H-003

## Metadata de archivo

- **Ruta del reporte:** `docs/audits/2026/2026-03-22_superadmin.md`
- **Timestamp generado:** `2026-03-22T11:39:40.972Z`

