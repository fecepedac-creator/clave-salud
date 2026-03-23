<<<<<<< HEAD
# 📑 Índice de Auditorías

Generado automáticamente por el corredor de auditoría.

| Reporte | Fecha Modificación |
|---|---|
| [2026/2026-03-22_whatsapp-chatbot.md](2026/2026-03-22_whatsapp-chatbot.md) | 2026-03-22T13:05:28.590Z |
| [2026/2026-03-22_whatsapp-chatbot_smoke.md](2026/2026-03-22_whatsapp-chatbot_smoke.md) | 2026-03-22T21:12:36.832Z |
| [2026/2026-03-22_transversal-tenancy_smoke.md](2026/2026-03-22_transversal-tenancy_smoke.md) | 2026-03-22T21:12:06.869Z |
| [2026/2026-03-22_superadmin.md](2026/2026-03-22_superadmin.md) | 2026-03-22T13:24:09.845Z |
| [2026/2026-03-22_superadmin_smoke.md](2026/2026-03-22_superadmin_smoke.md) | 2026-03-22T21:09:34.683Z |
| [2026/2026-03-22_patient-portal_smoke.md](2026/2026-03-22_patient-portal_smoke.md) | 2026-03-22T21:11:38.804Z |
| [2026/2026-03-22_doctor-subviews_smoke.md](2026/2026-03-22_doctor-subviews_smoke.md) | 2026-03-22T21:11:30.373Z |
| [2026/2026-03-22_doctor-dashboard_smoke.md](2026/2026-03-22_doctor-dashboard_smoke.md) | 2026-03-22T21:10:52.657Z |
| [2026/2026-03-22_admin-center_smoke.md](2026/2026-03-22_admin-center_smoke.md) | 2026-03-22T21:13:20.595Z |
| [2026-02-21-superadmin-main-readiness-action-plan.md](2026-02-21-superadmin-main-readiness-action-plan.md) | 2026-02-22T00:12:44.970Z |
| [2026-02-21-superadmin-execution-prompts.md](2026-02-21-superadmin-execution-prompts.md) | 2026-02-22T00:12:44.968Z |
| [2026-02-21-superadmin-branch-audit.md](2026-02-21-superadmin-branch-audit.md) | 2026-02-22T00:12:44.967Z |
=======
# Índice de Auditorías

Este índice se actualiza automáticamente con cada ejecución de `run-audit.cjs`.

## Ejecución rápida

```bash
npm run audit:setup:e2e
npm run audit:all
npm run audit:run -- --all --profile smoke
npm run audit:run -- --all --profile deep
npm run audit:all:strict
```

## Checklist Playwright para ejecución real

1. `npx playwright install`
2. Configurar `.env.test` con credenciales y IDs
3. Ejecutar `npx playwright test --project=setup`
4. Validar smoke:
   - `npx playwright test tests/admin/login.spec.ts --project=admin-tests`
   - `npx playwright test tests/doctor/login.spec.ts --project=doctor-tests`


| Archivo | Última actualización (UTC) |
|---|---|
| [multiagent/SALIDA_ESTANDAR.md](multiagent/SALIDA_ESTANDAR.md) | 2026-03-22T21:37:00.096Z |
| [multiagent/ORQUESTADOR_PROMPT.md](multiagent/ORQUESTADOR_PROMPT.md) | 2026-03-22T21:37:00.092Z |
| [multiagent/AGENTES_PROMPTS.md](multiagent/AGENTES_PROMPTS.md) | 2026-03-22T21:37:00.092Z |
| [2026/2026-03-22_whatsapp-chatbot.md](2026/2026-03-22_whatsapp-chatbot.md) | 2026-03-22T21:38:37.187Z |
| [2026/2026-03-22_transversal-tenancy.md](2026/2026-03-22_transversal-tenancy.md) | 2026-03-22T21:38:19.439Z |
| [2026/2026-03-22_superadmin.md](2026/2026-03-22_superadmin.md) | 2026-03-22T21:38:09.331Z |
| [2026/2026-03-22_patient-portal.md](2026/2026-03-22_patient-portal.md) | 2026-03-22T21:37:59.455Z |
| [2026/2026-03-22_multiagente_consolidado.md](2026/2026-03-22_multiagente_consolidado.md) | 2026-03-22T21:38:37.191Z |
| [2026/2026-03-22_doctor-subviews.md](2026/2026-03-22_doctor-subviews.md) | 2026-03-22T21:37:48.668Z |
| [2026/2026-03-22_doctor-dashboard.md](2026/2026-03-22_doctor-dashboard.md) | 2026-03-22T21:37:38.724Z |
| [2026/2026-03-22_admin-center.md](2026/2026-03-22_admin-center.md) | 2026-03-22T21:37:28.580Z |
| [2026-02-21-superadmin-main-readiness-action-plan.md](2026-02-21-superadmin-main-readiness-action-plan.md) | 2026-03-22T14:22:14.536Z |
| [2026-02-21-superadmin-execution-prompts.md](2026-02-21-superadmin-execution-prompts.md) | 2026-03-22T14:22:14.536Z |
| [2026-02-21-superadmin-branch-audit.md](2026-02-21-superadmin-branch-audit.md) | 2026-03-22T14:22:14.536Z |

>>>>>>> pr-104
