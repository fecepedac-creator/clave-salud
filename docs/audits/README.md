# Índice de Auditorías

Este directorio almacena auditorías versionadas por área.

## Estructura sugerida

- `docs/audits/YYYY/YYYY-MM-DD_<area>.md` → reporte legible
- `docs/audits/results/YYYY-MM-DD_<area>.json` → salida estructurada para análisis comparativo
- `docs/audits/TEMPLATE_AUDITORIA_AREA.md` → referencia del formato

## Ejecutar auditoría automática

```bash
npm run audit:superadmin
npm run audit:admin
npm run audit:doctor
npm run audit:whatsapp
# o genérico
npm run audit:run -- --area superadmin --date 2026-03-22
```

> Nota: cada ejecución genera/actualiza archivos de reporte dentro de este directorio.
