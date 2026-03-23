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

