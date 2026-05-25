# Indice de Auditorias

Este indice agrupa auditorias historicas y documentos operativos. Se normalizo para permitir futuras actualizaciones automaticas sin conflictos de merge.

## Ejecucion rapida

```bash
npm run audit:setup:e2e
npm run audit:all
npm run audit:run -- --all --profile smoke
npm run audit:run -- --all --profile deep
npm run audit:all:strict
```

## Checklist Playwright para ejecucion real

1. `npx playwright install`
2. Configurar `.env.test` con credenciales y IDs
3. Ejecutar `npx playwright test --project=setup`
4. Validar smoke:
   - `npx playwright test tests/admin/login.spec.ts --project=admin-tests`
   - `npx playwright test tests/doctor/login.spec.ts --project=doctor-tests`

## Reportes principales

| Archivo | Nota |
|---|---|
| [2026-05-25_auditoria_integral_modulos_ia_clinica.md](2026-05-25_auditoria_integral_modulos_ia_clinica.md) | Auditoria integral reciente por modulos e IA clinica |
| [2026/2026-03-22_admin-center.md](2026/2026-03-22_admin-center.md) | Auditoria admin centro |
| [2026/2026-03-22_doctor-dashboard.md](2026/2026-03-22_doctor-dashboard.md) | Auditoria panel medico |
| [2026/2026-03-22_doctor-subviews.md](2026/2026-03-22_doctor-subviews.md) | Auditoria subviews medico |
| [2026/2026-03-22_patient-portal.md](2026/2026-03-22_patient-portal.md) | Auditoria portal paciente |
| [2026/2026-03-22_superadmin.md](2026/2026-03-22_superadmin.md) | Auditoria superadmin |
| [2026/2026-03-22_transversal-tenancy.md](2026/2026-03-22_transversal-tenancy.md) | Auditoria multi-tenant |
| [2026/2026-03-22_whatsapp-chatbot.md](2026/2026-03-22_whatsapp-chatbot.md) | Auditoria chatbot WhatsApp |
| [AUDITORIA_PROFUNDA_BACKEND_FIREBASE_2026-03-29.md](AUDITORIA_PROFUNDA_BACKEND_FIREBASE_2026-03-29.md) | Backend/Firebase |
| [AUDITORIA_PROFUNDA_DASHBOARDS_FLUJO_CLINICO_UX_2026-03-29.md](AUDITORIA_PROFUNDA_DASHBOARDS_FLUJO_CLINICO_UX_2026-03-29.md) | Dashboards, flujo clinico y UX |
| [BACKLOG_TECNICO_FIREBASE_CLINICO_2026-03-29.md](BACKLOG_TECNICO_FIREBASE_CLINICO_2026-03-29.md) | Backlog tecnico |
| [PLAN_LOTES_REMEDIACION_P0_P1_2026-03-29.md](PLAN_LOTES_REMEDIACION_P0_P1_2026-03-29.md) | Plan P0/P1 |

## Multiagente

| Archivo |
|---|
| [multiagent/README.md](multiagent/README.md) |
| [multiagent/AGENTES_PROMPTS.md](multiagent/AGENTES_PROMPTS.md) |
| [multiagent/ORQUESTADOR_PROMPT.md](multiagent/ORQUESTADOR_PROMPT.md) |
| [multiagent/SALIDA_ESTANDAR.md](multiagent/SALIDA_ESTANDAR.md) |
