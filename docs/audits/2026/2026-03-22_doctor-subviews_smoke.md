# Auditoría automática — Doctor Subviews

- **Área:** `doctor-subviews`
- **Fecha ejecución:** `2026-03-22`
- **Generado por:** `scripts/audit/run-audit.cjs`
- **Estado general:** **ALTO RIESGO**

## Resumen de resultados

- ✅ Pass: **0**
- ❌ Fail: **1**
- ⚠️ Warning: **0**

## Alcance del área

Componentes especializados del flujo clínico.

### Puntos de foco
- Gestión de recetas
- Evoluciones
- Historial clínico detallado

### Evidencia revisada
- `features/doctor/components/DoctorClinicalHistory.tsx`
- `hooks/doctor/usePrescriptionLogic.ts`

## Ejecuciones

| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ❌ FAIL | `npx playwright test tests/doctor/pscv-flow.spec.ts --reporter=line` | 2026-03-22T21:10:56.403Z | 2026-03-22T21:11:30.371Z |

## Detalle de salida

### ❌ npx playwright test tests/doctor/pscv-flow.spec.ts --reporter=line

```text
[dotenv@17.3.1] injecting env (17) from .env.test -- tip: ⚙️  write to custom object with { processEnv: myObject }

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

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🛡️ auth for agents: https://vestauth.com

[1A[2K[3/3] [doctor-tests] › tests\doctor\pscv-flow.spec.ts:6:3 › Doctor: PSCV Flow Automation › should create a patient and complete a full PSCV control
[1A[2K[doctor-tests] › tests\doctor\pscv-flow.spec.ts:6:3 › Doctor: PSCV Flow Automation › should create a patient and complete a full PSCV control
BROWSER LOG: loadExamOrderCatalog FirebaseError: Missing or insufficient permissions.

[1A[2KBROWSER LOG: loadExamOrderCatalog FirebaseError: Missing or insufficient permissions.

[1A[2K  1) [doctor-tests] › tests\doctor\pscv-flow.spec.ts:6:3 › Doctor: PSCV Flow Automation › should create a patient and complete a full PSCV control 

    TimeoutError: page.click: Timeout 15000ms exceeded.
    Call log:
    [2m  - waiting for locator('[data-testid="btn-surgical-item-VESICULA"]')[22m


      28 |
      29 |     await page.click('[data-testid="btn-add-surgical-history"]');
    > 30 |     await page.click('[data-testid="btn-surgical-item-VESICULA"]');
         |                ^
      31 |
      32 |     // Insurance
      33 |     // We find the select that contains "FONASA" option
        at C:\Users\fecep\clave-salud\tests\doctor\pscv-flow.spec.ts:30:16

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\pscv-flow-Doctor-PSCV-Flow-c66e8-omplete-a-full-PSCV-control-doctor-tests\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\pscv-flow-Doctor-PSCV-Flow-c66e8-omplete-a-full-PSCV-control-doctor-tests\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\pscv-flow-Doctor-PSCV-Flow-c66e8-omplete-a-full-PSCV-control-doctor-tests\error-context.md


[1A[2K  1 failed
    [doctor-tests] › tests\doctor\pscv-flow.spec.ts:6:3 › Doctor: PSCV Flow Automation › should create a patient and complete a full PSCV control 
  2 passed (29.2s)
```

**Error/Stderr:**

```text
Command failed: npx playwright test tests/doctor/pscv-flow.spec.ts --reporter=line
```

## Hallazgos manuales (Post-Auditoría)

- [ ] H-001 (Pendiente)
- [ ] H-002 (Pendiente)

- **Reporte:** `docs\audits\2026\2026-03-22_doctor-subviews_smoke.md`
- **Timestamp:** `2026-03-22T21:11:30.372Z`