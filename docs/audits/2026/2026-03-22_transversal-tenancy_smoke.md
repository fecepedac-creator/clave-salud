# Auditoría automática — Transversal Tenancy

- **Área:** `transversal-tenancy`
- **Fecha ejecución:** `2026-03-22`
- **Generado por:** `scripts/audit/run-audit.cjs`
- **Estado general:** **SIN BLOQUEOS**

## Resumen de resultados

- ✅ Pass: **1**
- ❌ Fail: **0**
- ⚠️ Warning: **0**

## Alcance del área

Seguridad y aislamiento multi-centro a nivel de infraestructura.

### Puntos de foco
- Aislamiento de Firestore
- Claims de Auth
- Leakage prevention

### Evidencia revisada
- `firebase.json`
- `tests/admin/multi-tenant.spec.ts`

## Ejecuciones

| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ✅ PASS | `npx playwright test tests/admin/multi-tenant.spec.ts --reporter=line` | 2026-03-22T21:11:42.456Z | 2026-03-22T21:12:06.866Z |

## Detalle de salida

### ✅ npx playwright test tests/admin/multi-tenant.spec.ts --reporter=line

```text
[dotenv@17.3.1] injecting env (17) from .env.test -- tip: ⚙️  suppress all logs with { quiet: true }

Running 3 tests using 1 worker

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild

[1A[2K[1/3] [setup] › tests\auth\auth.setup.ts:61:1 › Admin: generar sesión
[1A[2K[setup] › tests\auth\auth.setup.ts:61:1 › Admin: generar sesión
DEBUG: [Auth Setup Admin] URL inicial: http://localhost:5175/acceso-admin?agent_test=true

[1A[2KDEBUG: Ya estamos en el Dashboard (Bypass activado)

[1A[2KDEBUG: Esperando Dashboard (Admin)...

[1A[2K✅ Admin storageState guardado en C:\Users\fecep\clave-salud\tests\auth\.auth\admin.json

[1A[2K[2/3] [setup] › tests\auth\auth.setup.ts:111:1 › Doctor: generar sesión
[1A[2K[setup] › tests\auth\auth.setup.ts:111:1 › Doctor: generar sesión
DEBUG: [Auth Setup Doctor] URL inicial: http://localhost:5175/accesoprofesionales?agent_test=true

[1A[2KDEBUG: Ya estamos en el Dashboard de Doctor (Bypass activado)

[1A[2KDEBUG: Esperando Dashboard (Doctor)...

[1A[2K✅ Doctor storageState guardado en C:\Users\fecep\clave-salud\tests\auth\.auth\doctor.json

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🛠️  run anywhere with `dotenvx run -- yourcommand`

[1A[2K[3/3] [admin-tests] › tests\admin\multi-tenant.spec.ts:24:1 › T9 — Seguridad Multi-Tenant: Admin no ve KPIs de otro centro
[1A[2K[admin-tests] › tests\admin\multi-tenant.spec.ts:24:1 › T9 — Seguridad Multi-Tenant: Admin no ve KPIs de otro centro
[T9] Admin dashboard visible. URL: http://localhost:5175/center/c_otro_centro_999?agent_test=true

[1A[2K✅ T9 — Multi-tenant OK: tabla de otro centro está vacía (Firestore rules bloquearon).

[1A[2K✅ T9 — KPI total del Centro B = 0 (correcto: sin datos seeded).

[1A[2K  3 passed (20.0s)
```

## Hallazgos manuales (Post-Auditoría)

- [ ] H-001 (Pendiente)
- [ ] H-002 (Pendiente)

- **Reporte:** `docs\audits\2026\2026-03-22_transversal-tenancy_smoke.md`
- **Timestamp:** `2026-03-22T21:12:06.867Z`