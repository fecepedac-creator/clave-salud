# Auditoría automática — Doctor Dashboard

- **Área:** `doctor-dashboard`
- **Fecha ejecución:** `2026-03-22`
- **Generado por:** `scripts/audit/run-audit.cjs`
- **Estado general:** **SIN BLOQUEOS**

## Resumen de resultados

- ✅ Pass: **1**
- ❌ Fail: **0**
- ⚠️ Warning: **0**

## Alcance del área

Flujo clínico, agenda y gestión de ficha de paciente.

### Puntos de foco
- Aislamiento por profesional
- Flujo clínico (PSCV)
- Actualización de agenda
- Privacidad del registro clínico

### Evidencia revisada
- `components/DoctorDashboard.tsx`
- `features/doctor/components/DoctorPatientRecord.tsx`

## Ejecuciones

| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ✅ PASS | `npx playwright test tests/doctor/login.spec.ts --reporter=line` | 2026-03-22T21:10:35.662Z | 2026-03-22T21:10:52.653Z |

## Detalle de salida

### ✅ npx playwright test tests/doctor/login.spec.ts --reporter=line

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

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🤖 agentic secret storage: https://dotenvx.com/as2

[1A[2K[3/3] [doctor-tests] › tests\doctor\login.spec.ts:12:1 › T6 — Doctor: login y acceso a dashboard médico
[1A[2K[doctor-tests] › tests\doctor\login.spec.ts:12:1 › T6 — Doctor: login y acceso a dashboard médico
✅ T6 — Login de Doctor exitoso. Dashboard visible.

[1A[2K  3 passed (12.6s)
```

## Hallazgos manuales (Post-Auditoría)

- [ ] H-001 (Pendiente)
- [ ] H-002 (Pendiente)

- **Reporte:** `docs\audits\2026\2026-03-22_doctor-dashboard_smoke.md`
- **Timestamp:** `2026-03-22T21:10:52.654Z`