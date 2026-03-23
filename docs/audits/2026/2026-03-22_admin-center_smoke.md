# Auditoría automática — Admin Center Dashboard

- **Área:** `admin-center`
- **Fecha ejecución:** `2026-03-22`
- **Generado por:** `scripts/audit/run-audit.cjs`
- **Estado general:** **SIN BLOQUEOS**

## Resumen de resultados

- ✅ Pass: **2**
- ❌ Fail: **0**
- ⚠️ Warning: **0**

## Alcance del área

Gestión operativa del centro: staff, agenda, métricas y configuración.

### Puntos de foco
- Roles administrativos locales
- Gestión de staff y servicios
- Consistencia de la agenda
- Exportaciones contables

### Evidencia revisada
- `components/AdminDashboard.tsx`
- `hooks/useFirestoreSync.ts`
- `tests/admin/multi-tenant.spec.ts`

## Ejecuciones

| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ✅ PASS | `npx playwright test tests/admin/login.spec.ts --reporter=line` | 2026-03-22T21:12:38.397Z | 2026-03-22T21:12:56.248Z |
| ✅ PASS | `npx playwright test tests/admin/performance-tab.spec.ts --reporter=line` | 2026-03-22T21:12:56.248Z | 2026-03-22T21:13:20.593Z |

## Detalle de salida

### ✅ npx playwright test tests/admin/login.spec.ts --reporter=line

```text
[dotenv@17.3.1] injecting env (17) from .env.test -- tip: 🛠️  run anywhere with `dotenvx run -- yourcommand`

Running 3 tests using 1 worker

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com

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

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: ⚙️  override existing env vars with { override: true }

[1A[2K[3/3] [admin-tests] › tests\admin\login.spec.ts:16:1 › T1 — Admin: login y acceso a dashboard
[1A[2K[admin-tests] › tests\admin\login.spec.ts:16:1 › T1 — Admin: login y acceso a dashboard
✅ T1 — Login de Admin exitoso. Dashboard visible.

[1A[2K  3 passed (13.4s)
```

### ✅ npx playwright test tests/admin/performance-tab.spec.ts --reporter=line

```text
[dotenv@17.3.1] injecting env (17) from .env.test -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild

Running 4 tests using 1 worker

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: ⚡️ secrets for agents: https://dotenvx.com/as2

[1A[2K[1/4] [setup] › tests\auth\auth.setup.ts:61:1 › Admin: generar sesión
[1A[2K[setup] › tests\auth\auth.setup.ts:61:1 › Admin: generar sesión
DEBUG: [Auth Setup Admin] URL inicial: http://localhost:5175/acceso-admin?agent_test=true

[1A[2KDEBUG: Ya estamos en el Dashboard (Bypass activado)

[1A[2KDEBUG: Esperando Dashboard (Admin)...

[1A[2K✅ Admin storageState guardado en C:\Users\fecep\clave-salud\tests\auth\.auth\admin.json

[1A[2K[2/4] [setup] › tests\auth\auth.setup.ts:111:1 › Doctor: generar sesión
[1A[2K[setup] › tests\auth\auth.setup.ts:111:1 › Doctor: generar sesión
DEBUG: [Auth Setup Doctor] URL inicial: http://localhost:5175/accesoprofesionales?agent_test=true

[1A[2KDEBUG: Ya estamos en el Dashboard de Doctor (Bypass activado)

[1A[2KDEBUG: Esperando Dashboard (Doctor)...

[1A[2K✅ Doctor storageState guardado en C:\Users\fecep\clave-salud\tests\auth\.auth\doctor.json

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🛠️  run anywhere with `dotenvx run -- yourcommand`

[1A[2K[3/4] [admin-tests] › tests\admin\performance-tab.spec.ts:53:1 › T2 — Admin: Tab Rendimiento carga KPIs del centro
[1A[2K[admin-tests] › tests\admin\performance-tab.spec.ts:53:1 › T2 — Admin: Tab Rendimiento carga KPIs del centro
✅ T2 — Tab Rendimiento cargado. Badge: "Mes Abierto", Total citas: 0

[1A[2K[4/4] [admin-tests] › tests\admin\performance-tab.spec.ts:101:1 › T3 — Admin: Cierre contable de mes y cambio de badge a 'Mes Cerrado'
[1A[2K[admin-tests] › tests\admin\performance-tab.spec.ts:101:1 › T3 — Admin: Cierre contable de mes y cambio de badge a 'Mes Cerrado'
ℹ️  T3 — Cierre omitido (Pass por defecto): Botón deshabilitado (sin datos/stats).

[1A[2K  4 passed (19.8s)
```

## Hallazgos manuales (Post-Auditoría)

- [ ] H-001 (Pendiente)
- [ ] H-002 (Pendiente)

- **Reporte:** `docs\audits\2026\2026-03-22_admin-center_smoke.md`
- **Timestamp:** `2026-03-22T21:13:20.594Z`