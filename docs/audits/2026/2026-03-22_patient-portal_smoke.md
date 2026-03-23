# Auditoría automática — Patient Portal

- **Área:** `patient-portal`
- **Fecha ejecución:** `2026-03-22`
- **Generado por:** `scripts/audit/run-audit.cjs`
- **Estado general:** **ALTO RIESGO**

## Resumen de resultados

- ✅ Pass: **0**
- ❌ Fail: **1**
- ⚠️ Warning: **0**

## Alcance del área

Experiencia del paciente: reserva, cancelación y portal personal.

### Puntos de foco
- Reserva pública
- Cancelación determinista
- Verificación de documentos (QR)

### Evidencia revisada
- `App.tsx`
- `tests/pilot.spec.ts`

## Ejecuciones

| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ❌ FAIL | `npx playwright test tests/pilot.spec.ts --reporter=line` | 2026-03-22T21:11:34.047Z | 2026-03-22T21:11:38.803Z |

## Detalle de salida

### ❌ npx playwright test tests/pilot.spec.ts --reporter=line

```text
[dotenv@17.3.1] injecting env (17) from .env.test -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.

[1A[2K
```

**Error/Stderr:**

```text
Command failed: npx playwright test tests/pilot.spec.ts --reporter=line
```

## Hallazgos manuales (Post-Auditoría)

- [ ] H-001 (Pendiente)
- [ ] H-002 (Pendiente)

- **Reporte:** `docs\audits\2026\2026-03-22_patient-portal_smoke.md`
- **Timestamp:** `2026-03-22T21:11:38.803Z`