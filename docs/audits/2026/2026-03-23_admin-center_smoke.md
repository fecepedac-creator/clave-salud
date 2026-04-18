# Auditoría automática — Admin Center Dashboard

- **Área:** `admin-center`
- **Fecha ejecución:** `2026-03-23`
- **Estado general:** **ALTO RIESGO**

## Resumen de resultados
- ✅ Pass: **2**
- ❌ Fail: **1**
- ⚠️ Warning: **0**

## Ejecuciones
| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ✅ PASS | `npx playwright test tests/admin/login.spec.ts --reporter=line` | 2026-03-23T02:20:51.254Z | 2026-03-23T02:21:08.709Z |
| ✅ PASS | `npx playwright test tests/admin/performance-tab.spec.ts --reporter=line` | 2026-03-23T02:21:08.709Z | 2026-03-23T02:21:32.788Z |
| ❌ FAIL | `npx playwright test tests/admin/navigation-ux.spec.ts --reporter=line` | 2026-03-23T02:21:32.788Z | 2026-03-23T02:23:08.285Z |
